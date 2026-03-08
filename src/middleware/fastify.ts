import type { ShieldConfig, FastifyInstance, FastifyRequest, FastifyReply } from '../core/types.js'
import { resolveConfig, checkLimit } from '../core/rate-limiter.js'
import { extractIPFromHeaders, ipMatches } from '../utils/ip.js'
import { cachedLookupCountry } from '../utils/geo.js'
import { extractPathname, findMatchingRoute } from '../utils/matcher.js'
import { parseWindow } from '../utils/time.js'
import { buildRateLimitHeaders } from '../utils/headers.js'
import { detectBot } from '../protection/bot-detect.js'
import { DEFAULT_RATE_LIMIT_RESPONSE } from '../constants.js'

// fastify plugin
export function createFastifyPlugin(
  userConfig: Partial<ShieldConfig> = {},
): (fastify: FastifyInstance, opts: Partial<ShieldConfig>, done: (err?: Error) => void) => void {
  return (fastify, opts, done) => {
    const merged = { ...userConfig, ...opts }
    const config = resolveConfig(merged)

    fastify.addHook('onRequest', (request, reply, hookDone) => {
      handleFastifyRequest(request, reply, config)
        .then((blocked) => {
          if (!blocked) hookDone()
        })
        .catch((err) => hookDone(err instanceof Error ? err : new Error(String(err))))
    })

    done()
  }
}

async function handleFastifyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  config: ReturnType<typeof resolveConfig>,
): Promise<boolean> {
  const ip = extractIPFromHeaders(request.headers, request.ip)
  const pathname = extractPathname(request.url)

  if (config.botDetection) {
    const mockReq = toWebRequest(request)
    const botResult = detectBot(mockReq, { blockPatterns: config.blockBots })

    if (botResult.isBot) {
      config.onBlock?.(ip, {
        reason: 'bot',
        key: ip,
        limit: config.limit,
        window: config.windowMs,
        blocked: true,
      })
      reply.code(403).send({
        error: 'Forbidden',
        message: `Request blocked: ${botResult.reason ?? 'Bot detected'}`,
      })
      return true
    }
  }

  if (config.allowlist.length > 0 && ipMatches(ip, config.allowlist)) return false

  // geo allowlist
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
      reply.code(403).send({ error: 'Forbidden', message: 'Request blocked' })
      return true
    }
  }

  if (config.blocklist.length > 0 && ipMatches(ip, config.blocklist)) {
    config.onBlock?.(ip, {
      reason: 'blocklist',
      key: ip,
      limit: config.limit,
      window: config.windowMs,
      blocked: true,
    })
    reply.code(403).send({ error: 'Forbidden', message: 'Request blocked' })
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
      reply.code(403).send({ error: 'Forbidden', message: 'Request blocked' })
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
      reply.header(name, value)
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
    reply.code(429).send({
      ...DEFAULT_RATE_LIMIT_RESPONSE,
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    })
    return true
  }

  return false
}

function toWebRequest(request: FastifyRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value)
  }
  return new Request(`http://localhost${request.url}`, {
    method: request.method,
    headers,
  })
}
