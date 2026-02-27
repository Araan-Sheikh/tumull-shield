import type { Store, RateLimitResult } from './types.js'

/*
 * Sliding window counter.
 *
 * Blends the current + previous window with a weight based on
 * how far we are into the current window. This avoids the burst
 * problem you get with plain fixed windows.
 *
 *   weight = (windowMs - elapsed) / windowMs
 *   effective = prev * weight + current
 */
export async function slidingWindowCheck(
  key: string,
  limit: number,
  windowMs: number,
  store: Store,
): Promise<RateLimitResult> {
  const now = Date.now()
  const data = await store.incrementSlidingWindow(key, windowMs)

  const elapsed = now - data.currentWindowStart
  const weight = Math.max(0, (windowMs - elapsed) / windowMs)
  const effectiveCount = Math.floor(data.previousCount * weight) + data.currentCount

  const allowed = effectiveCount <= limit
  const remaining = Math.max(0, limit - effectiveCount)
  const resetMs = data.currentWindowStart + windowMs
  const retryAfter = allowed ? 0 : Math.ceil((resetMs - now) / 1000)

  return {
    allowed,
    limit,
    remaining,
    reset: Math.ceil(resetMs / 1000),
    retryAfter: Math.max(0, retryAfter),
    blocked: false,
  }
}
