import type { Store, RateLimitResult } from './types.js'

/*
 * Token bucket — tokens refill at a constant rate, each request
 * uses one token. Allows bursty traffic up to `limit` tokens
 * while keeping average rate smooth. Bit more complex than the
 * other two but plays nice with spiky real-world traffic.
 */
export async function tokenBucketCheck(
  key: string,
  limit: number,
  windowMs: number,
  store: Store,
): Promise<RateLimitResult> {
  const now = Date.now()
  const refillRate = limit / windowMs // tokens per ms

  let state = await store.getTokenBucket(key)

  if (!state) {
    // first request ever for this key — init with limit-1 tokens
    state = { tokens: limit - 1, lastRefill: now }
    await store.setTokenBucket(key, state, windowMs)

    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0,
      blocked: false,
    }
  }

  // calculate how many tokens have been added since last check
  const elapsed = now - state.lastRefill
  const tokensToAdd = elapsed * refillRate
  const newTokens = Math.min(limit, state.tokens + tokensToAdd)

  if (newTokens >= 1) {
    // got tokens, consume one
    const updated = { tokens: newTokens - 1, lastRefill: now }
    await store.setTokenBucket(key, updated, windowMs)

    return {
      allowed: true,
      limit,
      remaining: Math.floor(newTokens - 1),
      reset: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0,
      blocked: false,
    }
  }

  // empty bucket — figure out when next token arrives
  const timeUntilNext = (1 - newTokens) / refillRate
  const retryAfter = Math.ceil(timeUntilNext / 1000)

  // still update the state even though we're rejecting
  const updated = { tokens: newTokens, lastRefill: now }
  await store.setTokenBucket(key, updated, windowMs)

  return {
    allowed: false,
    limit,
    remaining: 0,
    reset: Math.ceil((now + timeUntilNext) / 1000),
    retryAfter: Math.max(1, retryAfter),
    blocked: false,
  }
}
