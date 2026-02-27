import type { RateLimitResult } from '../core/types.js'
import {
  HEADER_RATE_LIMIT,
  HEADER_RATE_REMAINING,
  HEADER_RATE_RESET,
  HEADER_RETRY_AFTER,
} from '../constants.js'

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    [HEADER_RATE_LIMIT]: String(result.limit),
    [HEADER_RATE_REMAINING]: String(Math.max(0, result.remaining)),
    [HEADER_RATE_RESET]: String(result.reset),
  }

  if (!result.allowed || result.blocked) {
    h[HEADER_RETRY_AFTER] = String(Math.max(1, result.retryAfter))
  }

  return h
}

// clone a response but with rate limit headers added
export function applyHeadersToResponse(response: Response, result: RateLimitResult): Response {
  const hdrs = buildRateLimitHeaders(result)
  const merged = new Headers(response.headers)

  for (const [k, v] of Object.entries(hdrs)) {
    merged.set(k, v)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  })
}

export function createRateLimitResponse(result: RateLimitResult): Response {
  const body = JSON.stringify({
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
    retryAfter: result.retryAfter,
  })

  return new Response(body, {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      ...buildRateLimitHeaders(result),
    },
  })
}

export function createBlockedResponse(reason: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Forbidden',
      message: `Request blocked: ${reason}`,
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
