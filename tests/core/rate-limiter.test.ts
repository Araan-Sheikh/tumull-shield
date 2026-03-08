import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveConfig, checkLimit, processRequest } from '../../src/core/rate-limiter'
import { MemoryStore } from '../../src/stores/memory'

describe('resolveConfig', () => {
  it('applies defaults', () => {
    const cfg = resolveConfig({})
    expect(cfg.limit).toBe(100)
    expect(cfg.window).toBe('1m')
    expect(cfg.windowMs).toBe(60_000)
    expect(cfg.algorithm).toBe('sliding-window')
    expect(cfg.headers).toBe(true)
    expect(cfg.botDetection).toBe(false)
    expect(cfg.store).toBeInstanceOf(MemoryStore)
  })

  it('lets you override everything', () => {
    const cfg = resolveConfig({
      limit: 50,
      window: '5m',
      algorithm: 'fixed-window',
      headers: false,
    })
    expect(cfg.limit).toBe(50)
    expect(cfg.windowMs).toBe(300_000)
    expect(cfg.algorithm).toBe('fixed-window')
    expect(cfg.headers).toBe(false)
  })

  it('accepts a custom store', () => {
    const myStore = new MemoryStore()
    const cfg = resolveConfig({ store: myStore })
    expect(cfg.store).toBe(myStore)
  })
})

describe('checkLimit', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })
  afterEach(async () => {
    await store.close()
  })

  it('allows within limit', async () => {
    const res = await checkLimit('key', 5, 60_000, 'sliding-window', store)
    expect(res.allowed).toBe(true)
  })

  it('rejects blocked keys', async () => {
    await store.block('key', 60_000)
    const res = await checkLimit('key', 100, 60_000, 'sliding-window', store)
    expect(res.allowed).toBe(false)
    expect(res.blocked).toBe(true)
  })

  it('works with fixed-window', async () => {
    const res = await checkLimit('key', 5, 60_000, 'fixed-window', store)
    expect(res.allowed).toBe(true)
  })

  it('works with token-bucket', async () => {
    const res = await checkLimit('key', 5, 60_000, 'token-bucket', store)
    expect(res.allowed).toBe(true)
  })
})

describe('processRequest', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })
  afterEach(async () => {
    await store.close()
  })

  it('lets through normal requests', async () => {
    const config = resolveConfig({ limit: 10, store })
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    const { result, skip } = await processRequest({ request: req, config })
    expect(result.allowed).toBe(true)
    expect(skip).toBe(false)
  })

  it('skips allowlisted IPs', async () => {
    const config = resolveConfig({ limit: 10, store, allowlist: ['1.2.3.4'] })
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const { skip } = await processRequest({ request: req, config })
    expect(skip).toBe(true)
  })

  it('allows only specified countries when geo allowlist used', async () => {
    const config = resolveConfig({ limit: 10, store, allowlistGeo: ['US'] })
    const usReq = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '8.8.8.8' },
    })
    const ruReq = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '5.255.255.55' }, // Russian IP
    })
    const ok = await processRequest({ request: usReq, config })
    expect(ok.result.allowed).toBe(true)
    const blocked = await processRequest({ request: ruReq, config })
    expect(blocked.result.allowed).toBe(false)
    expect(blocked.blockInfo?.reason).toBe('blocklist')
  })

  it('blocks countries on geo blocklist', async () => {
    const config = resolveConfig({ limit: 10, store, blocklistGeo: ['US'] })
    const usReq = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '8.8.8.8' },
    })
    const { result, blockInfo } = await processRequest({ request: usReq, config })
    expect(result.allowed).toBe(false)
    expect(blockInfo?.reason).toBe('blocklist')
  })

  it('rejects blocklisted IPs', async () => {
    const config = resolveConfig({ limit: 10, store, blocklist: ['1.2.3.4'] })
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const { result, blockInfo } = await processRequest({ request: req, config })
    expect(result.allowed).toBe(false)
    expect(blockInfo?.reason).toBe('blocklist')
  })

  it('applies per-route limits', async () => {
    const config = resolveConfig({
      limit: 100,
      store,
      routes: { '/api/auth/*': { limit: 2 } },
    })

    const makeReq = () =>
      new Request('http://localhost/api/auth/login', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })

    await processRequest({ request: makeReq(), config })
    await processRequest({ request: makeReq(), config })
    const { result } = await processRequest({ request: makeReq(), config })
    expect(result.allowed).toBe(false)
  })

  it('respects skip: true on routes', async () => {
    const config = resolveConfig({
      limit: 1,
      store,
      routes: { '/api/webhook/*': { skip: true } },
    })
    const req = new Request('http://localhost/api/webhook/stripe', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const { skip } = await processRequest({ request: req, config })
    expect(skip).toBe(true)
  })
})
