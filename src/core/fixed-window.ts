import type { Store, RateLimitResult } from './types.js'

/*
 * Fixed window — dead simple counter that resets on interval.
 * Low overhead but can let through 2x burst at window edges.
 * Good enough for most use cases honestly.
 */
export async function fixedWindowCheck(
  key: string,
  limit: number,
  windowMs: number,
  store: Store,
): Promise<RateLimitResult> {
  const now = Date.now()
  const { count, reset } = await store.increment(key, windowMs)

  const allowed = count <= limit
  const remaining = Math.max(0, limit - count)
  const resetMs = reset * 1000
  const retryAfter = allowed ? 0 : Math.ceil((resetMs - now) / 1000)

  return {
    allowed,
    limit,
    remaining,
    reset,
    retryAfter: Math.max(0, retryAfter),
    blocked: false,
  }
}
