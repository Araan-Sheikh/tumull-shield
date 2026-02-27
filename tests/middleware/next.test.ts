import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createNextMiddleware } from '../../src/middleware/next'
import { MemoryStore } from '../../src/stores/memory'

describe('next.js middleware', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })
  afterEach(async () => {
    await store.close()
  })

  it('lets requests through', async () => {
    const mw = createNextMiddleware({ limit: 10, window: '1m', store })
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await mw(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('429s when over limit', async () => {
    const mw = createNextMiddleware({ limit: 2, window: '1m', store })

    for (let i = 0; i < 2; i++) {
      await mw(
        new Request('http://localhost/api/test', {
          headers: { 'x-forwarded-for': '1.2.3.4' },
        }),
      )
    }

    const res = await mw(
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    )
    expect(res.status).toBe(429)
  })

  it('sends rate limit headers', async () => {
    const mw = createNextMiddleware({ limit: 100, window: '1m', store })
    const res = await mw(
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    )
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
  })

  it('calls custom onLimit handler', async () => {
    const mw = createNextMiddleware({
      limit: 1,
      window: '1m',
      store,
      onLimit: (_req, retryAfter) =>
        new Response(JSON.stringify({ custom: true, retryAfter }), { status: 429 }),
    })

    await mw(
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    )

    const res = await mw(
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.custom).toBe(true)
  })

  it('catches bots', async () => {
    const mw = createNextMiddleware({
      limit: 100,
      window: '1m',
      store,
      botDetection: true,
    })
    const res = await mw(
      new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'curl/7.68' },
      }),
    )
    expect(res.status).toBe(403)
  })

  it('allowlisted IPs bypass everything', async () => {
    const mw = createNextMiddleware({
      limit: 1,
      window: '1m',
      store,
      allowlist: ['1.2.3.4'],
    })

    // spam 5 requests — all should pass
    for (let i = 0; i < 5; i++) {
      const res = await mw(
        new Request('http://localhost/api/test', {
          headers: { 'x-forwarded-for': '1.2.3.4' },
        }),
      )
      expect(res.status).toBe(200)
    }
  })
})
