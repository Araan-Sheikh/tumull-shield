import type { ShieldConfig } from '../core/types.js'
import { resolveConfig, processRequest } from '../core/rate-limiter.js'
import { detectBot } from '../protection/bot-detect.js'
import {
  buildRateLimitHeaders,
  createRateLimitResponse,
  createBlockedResponse,
} from '../utils/headers.js'

// hono middleware adapter
export function createHonoMiddleware(
  userConfig: Partial<ShieldConfig> = {},
): (c: HonoContext, next: () => Promise<void>) => Promise<Response | void> {
  const config = resolveConfig(userConfig)

  return async (c: HonoContext, next: () => Promise<void>): Promise<Response | void> => {
    const request = c.req.raw

    if (config.botDetection) {
      const botResult = detectBot(request, { blockPatterns: config.blockBots })

      if (botResult.isBot) {
        config.onBlock?.('bot', {
          reason: 'bot',
          key: 'bot',
          limit: config.limit,
          window: config.windowMs,
          blocked: true,
        })
        return createBlockedResponse(botResult.reason ?? 'Bot detected')
      }
    }

    const { result, skip } = await processRequest({ request, config })

    if (skip) {
      await next()
      return
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

    // allowed — set headers and continue
    if (config.headers) {
      const hdrs = buildRateLimitHeaders(result)
      for (const [name, value] of Object.entries(hdrs)) {
        c.header(name, value)
      }
    }

    await next()
  }
}

// minimal hono context type so we don't need hono as a dep
interface HonoContext {
  req: {
    raw: Request
    url: string
    method: string
    header(name: string): string | undefined
  }
  header(name: string, value: string): void
  status(code: number): void
  json(data: unknown): Response
  body(data: string | null): Response
}
