import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createExpressMiddleware } from '../../src/middleware/express'
import { MemoryStore } from '../../src/stores/memory'
import type { ExpressRequest, ExpressResponse, ExpressNextFunction } from '../../src/core/types'

function mockReq(overrides: Partial<ExpressRequest> = {}): ExpressRequest {
  return {
    ip: '127.0.0.1',
    path: '/api/test',
    url: '/api/test',
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (Test Browser)',
      accept: 'application/json',
      'accept-language': 'en-US',
      'accept-encoding': 'gzip',
    },
    get(name: string) {
      const v = this.headers[name.toLowerCase()]
      return Array.isArray(v) ? v[0] : v
    },
    ...overrides,
  }
}

function mockRes(): ExpressResponse & {
  statusCode: number
  body: unknown
  headers: Record<string, string>
} {
  const r: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    headersSent: false,
    status(code: number) {
      r.statusCode = code
      return r
    },
    set(field: string, value: string) {
      r.headers[field] = value
      return r
    },
    setHeader(name: string, value: string | number) {
      r.headers[name] = String(value)
      return r
    },
    json(body: unknown) {
      r.body = body
      r.headersSent = true
    },
    end() {
      r.headersSent = true
    },
  }
  return r
}

describe('express middleware', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })
  afterEach(async () => {
    await store.close()
  })

  it('calls next() normally', async () => {
    const mw = createExpressMiddleware({ limit: 10, window: '1m', store })
    const next = vi.fn()

    await new Promise<void>((resolve) => {
      mw(mockReq(), mockRes(), (...args: unknown[]) => {
        next(...args)
        resolve()
      })
    })

    expect(next).toHaveBeenCalled()
  })

  it('429s when over limit', async () => {
    const mw = createExpressMiddleware({ limit: 2, window: '1m', store })
    const next = vi.fn()

    for (let i = 0; i < 2; i++) {
      await new Promise<void>((resolve) => {
        mw(mockReq(), mockRes(), () => resolve())
      })
    }

    const res = mockRes()
    await new Promise<void>((resolve) => {
      mw(mockReq(), res, () => resolve())
      setTimeout(resolve, 50)
    })

    expect(res.statusCode).toBe(429)
    expect(res.body).toBeDefined()
  })

  it('attaches headers', async () => {
    const mw = createExpressMiddleware({ limit: 100, window: '1m', store })
    const res = mockRes()

    await new Promise<void>((resolve) => {
      mw(mockReq(), res, () => resolve())
    })

    expect(res.headers['X-RateLimit-Limit']).toBe('100')
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined()
  })

  it('blocks blocklisted IPs', async () => {
    const mw = createExpressMiddleware({
      limit: 100,
      window: '1m',
      store,
      blocklist: ['127.0.0.1'],
    })
    const res = mockRes()
    const next = vi.fn()

    await new Promise<void>((resolve) => {
      mw(mockReq(), res, next)
      setTimeout(resolve, 50)
    })

    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('geo allowlist lets allowed country through and blocks others', async () => {
    const mw = createExpressMiddleware({
      limit: 100,
      window: '1m',
      store,
      allowlistGeo: ['US'],
    })
    // US IP should pass
    const next = vi.fn()
    await new Promise<void>((resolve) => {
      mw(mockReq({ headers: { 'x-forwarded-for': '8.8.8.8' } }), mockRes(), () => {
        next()
        resolve()
      })
    })
    expect(next).toHaveBeenCalled()

    // non-US IP should be blocked
    const res = mockRes()
    await new Promise<void>((resolve) => {
      mw(mockReq({ headers: { 'x-forwarded-for': '5.255.255.55' } }), res, () => resolve())
      setTimeout(resolve, 20)
    })
    expect(res.statusCode).toBe(403)
  })

  it('geo blocklist blocks that country', async () => {
    const mw = createExpressMiddleware({
      limit: 100,
      window: '1m',
      store,
      blocklistGeo: ['US'],
    })
    const res = mockRes()
    await new Promise<void>((resolve) => {
      mw(mockReq({ headers: { 'x-forwarded-for': '8.8.8.8' } }), res, () => resolve())
      setTimeout(resolve, 20)
    })
    expect(res.statusCode).toBe(403)
  })
})
