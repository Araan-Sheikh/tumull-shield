import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { slidingWindowCheck } from '../../src/core/sliding-window'
import { MemoryStore } from '../../src/stores/memory'

describe('sliding window', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore({ cleanupInterval: 60_000 })
  })
  afterEach(async () => {
    await store.close()
  })

  it('allows requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await slidingWindowCheck('k', 5, 60_000, store)
      expect(res.allowed).toBe(true)
      expect(res.remaining).toBe(5 - i - 1)
    }
  })

  it('blocks once you exceed limit', async () => {
    for (let i = 0; i < 3; i++) {
      await slidingWindowCheck('k', 3, 60_000, store)
    }
    const res = await slidingWindowCheck('k', 3, 60_000, store)
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
    expect(res.retryAfter).toBeGreaterThan(0)
  })

  it('returns correct info', async () => {
    const res = await slidingWindowCheck('k', 100, 60_000, store)
    expect(res.limit).toBe(100)
    expect(res.remaining).toBe(99)
    expect(res.reset).toBeGreaterThan(0)
    expect(res.retryAfter).toBe(0)
    expect(res.blocked).toBe(false)
  })

  it('keeps keys isolated', async () => {
    await slidingWindowCheck('a', 2, 60_000, store)
    await slidingWindowCheck('a', 2, 60_000, store)

    const ra = await slidingWindowCheck('a', 2, 60_000, store)
    const rb = await slidingWindowCheck('b', 2, 60_000, store)

    expect(ra.allowed).toBe(false)
    expect(rb.allowed).toBe(true)
  })
})
