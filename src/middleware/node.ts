import type { ShieldConfig } from '../core/types.js'
import { resolveConfig, checkLimit } from '../core/rate-limiter.js'
import { extractIPFromHeaders, ipMatches } from '../utils/ip.js'
import { cachedLookupCountry } from '../utils/geo.js'
import { extractPathname, findMatchingRoute } from '../utils/matcher.js'
import { parseWindow } from '../utils/time.js'
import { buildRateLimitHeaders } from '../utils/headers.js'
import { DEFAULT_RATE_LIMIT_RESPONSE } from '../constants.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

/*
 * Raw node:http handler. Returns true if the request was blocked
 * (and the response was already sent), false if it should continue.
 *
 *   const limiter = shieldNode({ limit: 100, window: '1m' })
 *   http.createServer(async (req, res) => {
 *     if (await limiter(req, res)) return
 *     // handle request...
 *   })
 */
export function createNodeHandler(
  userConfig: Partial<ShieldConfig> = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const config = resolveConfig(userConfig)

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const ip = extractIPFromHeaders(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket?.remoteAddress,
    )
    const pathname = extractPathname(req.url ?? '/')
    // ip allowlist
    if (config.allowlist.length > 0 && ipMatches(ip, config.allowlist)) return false

    // geo allowlist: if present, only these countries are allowed
    if (config.allowlistGeo.length > 0) {
      const country = cachedLookupCountry(ip)
      if (!country || !config.allowlistGeo.includes(country)) {
        config.onBlock?.(ip, {
          reason: 'blocklist',
          key: ip,
          limit: config.limit,
          window: config.windowMs,
          blocked: true,
        })
        sendJson(res, 403, { error: 'Forbidden', message: 'Request blocked' })
        return true
      }
    }

    // ip blocklist
    if (config.blocklist.length > 0 && ipMatches(ip, config.blocklist)) {
      config.onBlock?.(ip, {
        reason: 'blocklist',
        key: ip,
        limit: config.limit,
        window: config.windowMs,
        blocked: true,
      })
      sendJson(res, 403, { error: 'Forbidden', message: 'Request blocked' })
      return true
    }

    // geo blocklist
    if (config.blocklistGeo.length > 0) {
      const country = cachedLookupCountry(ip)
      if (country && config.blocklistGeo.includes(country)) {
        config.onBlock?.(ip, {
          reason: 'blocklist',
          key: ip,
          limit: config.limit,
          window: config.windowMs,
          blocked: true,
        })
        sendJson(res, 403, { error: 'Forbidden', message: 'Request blocked' })
        return true
      }
    }

    let limit = config.limit
    let windowMs = config.windowMs
    let key = ip
    let blockMs = config.blockMs

    const matched = findMatchingRoute(pathname, config.routes)
    if (matched) {
      const rc = config.routes[matched]
      if (rc.skip) return false
      if (rc.limit !== undefined) limit = rc.limit
      if (rc.window) windowMs = parseWindow(rc.window)
      if (rc.block) blockMs = parseWindow(rc.block)
    }

    const scopedKey = matched ? `${key}:${matched}` : key
    const result = await checkLimit(scopedKey, limit, windowMs, config.algorithm, config.store)

    if (config.headers) {
      const hdrs = buildRateLimitHeaders(result)
      for (const [name, value] of Object.entries(hdrs)) {
        res.setHeader(name, value)
      }
    }

    if (!result.allowed) {
      if (blockMs && !result.blocked) {
        await config.store.block(scopedKey, blockMs)
      }
      config.onBlock?.(ip, {
        reason: 'rate-limit',
        key: ip,
        limit,
        window: windowMs,
        blocked: result.blocked,
      })
      sendJson(res, 429, {
        ...DEFAULT_RATE_LIMIT_RESPONSE,
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      })
      return true
    }

    return false
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  })
  res.end(json)
}
