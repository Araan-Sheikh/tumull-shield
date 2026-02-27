import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fixedWindowCheck } from '../../src/core/fixed-window'
import { MemoryStore } from '../../src/stores/memory'

describe('fixed window', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore({ cleanupInterval: 60_000 })
  })
  afterEach(async () => {
    await store.close()
  })

  it('allows requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fixedWindowCheck('k', 5, 60_000, store)
      expect(res.allowed).toBe(true)
      expect(res.remaining).toBe(5 - i - 1)
    }
  })

  it('blocks over limit', async () => {
    for (let i = 0; i < 3; i++) await fixedWindowCheck('k', 3, 60_000, store)

    const res = await fixedWindowCheck('k', 3, 60_000, store)
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
    expect(res.retryAfter).toBeGreaterThan(0)
  })

  it('has correct info on first request', async () => {
    const res = await fixedWindowCheck('k', 100, 60_000, store)
    expect(res.limit).toBe(100)
    expect(res.remaining).toBe(99)
    expect(res.blocked).toBe(false)
  })
})
