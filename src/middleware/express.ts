import type {
  ShieldConfig,
  ExpressRequest,
  ExpressResponse,
  ExpressNextFunction,
} from '../core/types.js'
import { resolveConfig, checkLimit } from '../core/rate-limiter.js'
import { extractIPFromHeaders, ipMatches } from '../utils/ip.js'
import { extractPathname, findMatchingRoute } from '../utils/matcher.js'
import { parseWindow } from '../utils/time.js'
import { buildRateLimitHeaders } from '../utils/headers.js'
import { detectBot } from '../protection/bot-detect.js'
import { DEFAULT_RATE_LIMIT_RESPONSE } from '../constants.js'

// express/connect compatible middleware
export function createExpressMiddleware(
  userConfig: Partial<ShieldConfig> = {},
): (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void {
  const config = resolveConfig(userConfig)

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void => {
    handleRequest(req, res, next, config).catch(next)
  }
}

async function handleRequest(
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction,
  config: ReturnType<typeof resolveConfig>,
): Promise<void> {
  const ip = extractIPFromHeaders(req.headers, req.ip)
  const pathname = extractPathname(req.url ?? req.path)

  // bot check
  if (config.botDetection) {
    const mockReq = toWebRequest(req)
    const botResult = detectBot(mockReq, { blockPatterns: config.blockBots })

    if (botResult.isBot) {
      config.onBlock?.(ip, {
        reason: 'bot',
        key: ip,
        limit: config.limit,
        window: config.windowMs,
        blocked: true,
      })
      res.status(403).json({
        error: 'Forbidden',
        message: `Request blocked: ${botResult.reason ?? 'Bot detected'}`,
      })
      return
    }
  }

  // allowlist bypass
  if (config.allowlist.length > 0 && ipMatches(ip, config.allowlist)) {
    next()
    return
  }

  // blocklist
  if (config.blocklist.length > 0 && ipMatches(ip, config.blocklist)) {
    config.onBlock?.(ip, {
      reason: 'blocklist',
      key: ip,
      limit: config.limit,
      window: config.windowMs,
      blocked: true,
    })
    res.status(403).json({ error: 'Forbidden', message: 'Request blocked' })
    return
  }

  // per-route config
  let limit = config.limit
  let windowMs = config.windowMs
  let key = ip
  let blockMs = config.blockMs

  const matched = findMatchingRoute(pathname, config.routes)
  if (matched) {
    const rc = config.routes[matched]
    if (rc.skip) { next(); return }
    if (rc.limit !== undefined) limit = rc.limit
    if (rc.window) windowMs = parseWindow(rc.window)
    if (rc.block) blockMs = parseWindow(rc.block)
  }

  const scopedKey = matched ? `${key}:${matched}` : key

  const result = await checkLimit(scopedKey, limit, windowMs, config.algorithm, config.store)

  // headers
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
    res.status(429).json({
      ...DEFAULT_RATE_LIMIT_RESPONSE,
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    })
    return
  }

  next()
}

function getHeader(req: ExpressRequest, name: string): string | undefined {
  if (req.get) return req.get(name)
  const val = req.headers[name]
  return Array.isArray(val) ? val[0] : val
}

// wrap express req into a Web API Request for bot detection
function toWebRequest(req: ExpressRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value)
  }
  return new Request(`http://localhost${req.url ?? req.path}`, {
    method: req.method,
    headers,
  })
}
