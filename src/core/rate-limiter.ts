import type {
  ShieldConfig,
  ResolvedConfig,
  RateLimitResult,
  RouteConfig,
  Store,
  BlockInfo,
} from './types.js'
import { slidingWindowCheck } from './sliding-window.js'
import { fixedWindowCheck } from './fixed-window.js'
import { tokenBucketCheck } from './token-bucket.js'
import { MemoryStore } from '../stores/memory.js'
import { extractIP, ipMatches } from '../utils/ip.js'
import { cachedLookupCountry } from '../utils/geo.js'
import { parseWindow } from '../utils/time.js'
import { findMatchingRoute, extractPathname } from '../utils/matcher.js'
import {
  DEFAULT_LIMIT,
  DEFAULT_WINDOW,
  DEFAULT_ALGORITHM,
  DEFAULT_HEADERS,
  DEFAULT_BOT_DETECTION,
} from '../constants.js'

// merge user config with sane defaults
export function resolveConfig(config: Partial<ShieldConfig> = {}): ResolvedConfig {
  const windowStr = config.window ?? DEFAULT_WINDOW
  const windowMs = parseWindow(windowStr)

  let store: Store
  if (!config.store || config.store === 'memory') {
    store = new MemoryStore()
  } else {
    store = config.store
  }

  return {
    limit: config.limit ?? DEFAULT_LIMIT,
    window: windowStr,
    windowMs,
    block: config.block,
    blockMs: config.block ? parseWindow(config.block) : undefined,
    routes: config.routes ?? {},
    key: config.key ?? extractIP,
    store,
    botDetection: config.botDetection ?? DEFAULT_BOT_DETECTION,
    blockBots: config.blockBots ?? [],
    onLimit: config.onLimit,
    onBlock: config.onBlock,
    allowlist: config.allowlist ?? [],
    blocklist: config.blocklist ?? [],
    allowlistGeo: config.allowlistGeo ?? [],
    blocklistGeo: config.blocklistGeo ?? [],
    algorithm: config.algorithm ?? DEFAULT_ALGORITHM,
    headers: config.headers ?? DEFAULT_HEADERS,
  }
}

/*
 * Core rate limit check — picks the right algorithm, runs it,
 * and returns whether the request should go through.
 */
export async function checkLimit(
  requestKey: string,
  limit: number,
  windowMs: number,
  algorithm: ResolvedConfig['algorithm'],
  store: Store,
): Promise<RateLimitResult> {
  // blocked keys get rejected immediately
  const blocked = await store.isBlocked(requestKey)
  if (blocked) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: Math.ceil((Date.now() + windowMs) / 1000),
      retryAfter: Math.ceil(windowMs / 1000),
      blocked: true,
    }
  }

  switch (algorithm) {
    case 'sliding-window':
      return slidingWindowCheck(requestKey, limit, windowMs, store)
    case 'fixed-window':
      return fixedWindowCheck(requestKey, limit, windowMs, store)
    case 'token-bucket':
      return tokenBucketCheck(requestKey, limit, windowMs, store)
    default:
      // fall back to sliding window if someone passes garbage
      return slidingWindowCheck(requestKey, limit, windowMs, store)
  }
}

// full pipeline types

export interface ProcessRequestOptions {
  request: Request
  config: ResolvedConfig
  pathname?: string // override if the framework already parsed the path
}

export interface ProcessRequestResult {
  result: RateLimitResult
  skip: boolean
  blockInfo?: BlockInfo
  key: string
}

/*
 * Runs a request through the entire shield pipeline:
 *   allowlist → blocklist → route matching → rate limit → block
 */
export async function processRequest(
  options: ProcessRequestOptions,
): Promise<ProcessRequestResult> {
  const { request, config, pathname: pathOverride } = options
  const key = await config.key(request)
  const pathname = pathOverride ?? extractPathname(request.url)

  // allowlisted? let it through, no questions asked
  if (config.allowlist.length > 0 && ipMatches(key, config.allowlist)) {
    return {
      result: {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        reset: Math.ceil((Date.now() + config.windowMs) / 1000),
        retryAfter: 0,
        blocked: false,
      },
      skip: true,
      key,
    }
  }

    // geo allowlist: if configured, only these countries may proceed
    if (config.allowlistGeo.length > 0) {
      const country = cachedLookupCountry(key)
      if (!country || !config.allowlistGeo.includes(country)) {
        // treat as blocked by geo
        const blockInfo: BlockInfo = {
          reason: 'blocklist',
          key,
          limit: config.limit,
          window: config.windowMs,
          blocked: true,
        }
        config.onBlock?.(key, blockInfo)
        return {
          result: {
            allowed: false,
            limit: config.limit,
            remaining: 0,
            reset: Math.ceil((Date.now() + config.windowMs) / 1000),
            retryAfter: Math.ceil(config.windowMs / 1000),
            blocked: true,
          },
          skip: false,
          blockInfo,
          key,
        }
      }
    }

  // blocklisted? hard block
  if (config.blocklist.length > 0 && ipMatches(key, config.blocklist)) {
    const blockInfo: BlockInfo = {
      reason: 'blocklist',
      key,
      limit: config.limit,
      window: config.windowMs,
      blocked: true,
    }
    config.onBlock?.(key, blockInfo)

    return {
      result: {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        reset: Math.ceil((Date.now() + config.windowMs) / 1000),
        retryAfter: Math.ceil(config.windowMs / 1000),
        blocked: true,
      },
      skip: false,
      blockInfo,
      key,
    }
  }

  // geo blocklist
  if (config.blocklistGeo.length > 0) {
    const country = cachedLookupCountry(key)
    if (country && config.blocklistGeo.includes(country)) {
      const blockInfo: BlockInfo = {
        reason: 'blocklist',
        key,
        limit: config.limit,
        window: config.windowMs,
        blocked: true,
      }
      config.onBlock?.(key, blockInfo)
      return {
        result: {
          allowed: false,
          limit: config.limit,
          remaining: 0,
          reset: Math.ceil((Date.now() + config.windowMs) / 1000),
          retryAfter: Math.ceil(config.windowMs / 1000),
          blocked: true,
        },
        skip: false,
        blockInfo,
        key,
      }
    }
  }

  // figure out per-route overrides
  let routeLimit = config.limit
  let routeWindowMs = config.windowMs
  let routeAlgorithm = config.algorithm
  let routeKey = key
  let routeBlockMs = config.blockMs

  const matchedPattern = findMatchingRoute(pathname, config.routes)

  if (matchedPattern) {
    const routeConfig: RouteConfig = config.routes[matchedPattern]

    if (routeConfig.skip) {
      return {
        result: {
          allowed: true,
          limit: config.limit,
          remaining: config.limit,
          reset: Math.ceil((Date.now() + config.windowMs) / 1000),
          retryAfter: 0,
          blocked: false,
        },
        skip: true,
        key,
      }
    }

    if (routeConfig.limit !== undefined) routeLimit = routeConfig.limit
    if (routeConfig.window) routeWindowMs = parseWindow(routeConfig.window)
    if (routeConfig.key) routeKey = await routeConfig.key(request)
    if (routeConfig.block) routeBlockMs = parseWindow(routeConfig.block)
  }

  // scope the key so per-route limits don't collide
  const scopedKey = matchedPattern ? `${routeKey}:${matchedPattern}` : routeKey

  const result = await checkLimit(
    scopedKey,
    routeLimit,
    routeWindowMs,
    routeAlgorithm,
    config.store,
  )

  // exceeded + block duration set? put them in timeout
  if (!result.allowed && routeBlockMs && !result.blocked) {
    await config.store.block(scopedKey, routeBlockMs)

    const blockInfo: BlockInfo = {
      reason: 'rate-limit',
      key: routeKey,
      limit: routeLimit,
      window: routeWindowMs,
      blocked: true,
      blockedUntil: Date.now() + routeBlockMs,
    }
    config.onBlock?.(routeKey, blockInfo)

    return {
      result: {
        ...result,
        blocked: true,
        retryAfter: Math.ceil(routeBlockMs / 1000),
      },
      skip: false,
      blockInfo,
      key: routeKey,
    }
  }

  // exceeded but no block duration — just 429 it
  if (!result.allowed) {
    const blockInfo: BlockInfo = {
      reason: 'rate-limit',
      key: routeKey,
      limit: routeLimit,
      window: routeWindowMs,
      blocked: false,
    }
    config.onBlock?.(routeKey, blockInfo)
    return { result, skip: false, blockInfo, key: routeKey }
  }

  return { result, skip: false, key: routeKey }
}
