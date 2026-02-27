import type { ShieldConfig } from '../core/types.js'
import { resolveConfig, processRequest } from '../core/rate-limiter.js'
import { detectBot } from '../protection/bot-detect.js'
import {
  buildRateLimitHeaders,
  createRateLimitResponse,
  createBlockedResponse,
} from '../utils/headers.js'

// next.js middleware — this is what `shield()` calls under the hood
export function createNextMiddleware(
  userConfig: Partial<ShieldConfig> = {},
): (request: Request) => Promise<Response> {
  const config = resolveConfig(userConfig)

  return async (request: Request): Promise<Response> => {
    // check bots first if enabled
    if (config.botDetection) {
      const botResult = detectBot(request, { blockPatterns: config.blockBots })

      if (botResult.isBot) {
        const blockInfo = {
          reason: 'bot' as const,
          key: 'bot',
          limit: config.limit,
          window: config.windowMs,
          blocked: true,
        }
        config.onBlock?.('bot', blockInfo)
        return createBlockedResponse(botResult.reason ?? 'Bot detected')
      }
    }

    // run the rate limiter
    const { result, skip, blockInfo } = await processRequest({ request, config })

    if (skip) {
      return passthrough(request, result.allowed ? config.headers : false, result)
    }

    if (!result.allowed) {
      if (config.onLimit) {
        const custom = config.onLimit(request, result.retryAfter)
        if (config.headers) {
          const hdrs = buildRateLimitHeaders(result)
          for (const [name, value] of Object.entries(hdrs)) {
            custom.headers.set(name, value)
          }
        }
        return custom
      }
      return createRateLimitResponse(result)
    }

    return passthrough(request, config.headers, result)
  }
}

/*
 * Fake "next" response — in real Next.js this'd be NextResponse.next().
 * We can't import next/server here since it's optional, so we just set
 * the x-middleware-next header and let Next handle it.
 */
function passthrough(
  _request: Request,
  includeHeaders: boolean,
  result?: import('../core/types.js').RateLimitResult,
): Response {
  const headers = new Headers()

  if (includeHeaders && result) {
    const rlHeaders = buildRateLimitHeaders(result)
    for (const [name, value] of Object.entries(rlHeaders)) {
      headers.set(name, value)
    }
  }

  headers.set('x-middleware-next', '1')
  return new Response(null, { status: 200, headers })
}
