import { describe, it, expect } from 'vitest'
import {
  buildRateLimitHeaders,
  createRateLimitResponse,
  createBlockedResponse,
} from '../../src/utils/headers'

describe('buildRateLimitHeaders', () => {
  it('includes all the standard headers', () => {
    const h = buildRateLimitHeaders({
      allowed: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
      retryAfter: 0,
      blocked: false,
    })
    expect(h['X-RateLimit-Limit']).toBe('100')
    expect(h['X-RateLimit-Remaining']).toBe('95')
    expect(h['X-RateLimit-Reset']).toBe('1700000000')
    expect(h['Retry-After']).toBeUndefined()
  })

  it('adds Retry-After when blocked', () => {
    const h = buildRateLimitHeaders({
      allowed: false,
      limit: 100,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 45,
      blocked: false,
    })
    expect(h['Retry-After']).toBe('45')
    expect(h['X-RateLimit-Remaining']).toBe('0')
  })
})

describe('createRateLimitResponse', () => {
  it('gives a proper 429', async () => {
    const res = createRateLimitResponse({
      allowed: false,
      limit: 100,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 30,
      blocked: false,
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res.headers.get('Retry-After')).toBe('30')

    const body = await res.json()
    expect(body.error).toBe('Too Many Requests')
    expect(body.retryAfter).toBe(30)
  })
})

describe('createBlockedResponse', () => {
  it('gives a 403', async () => {
    const res = createBlockedResponse('Bot detected')
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toContain('Bot detected')
  })
})
