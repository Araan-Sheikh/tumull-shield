import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tokenBucketCheck } from '../../src/core/token-bucket'
import { MemoryStore } from '../../src/stores/memory'

describe('token bucket', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore({ cleanupInterval: 60_000 })
  })
  afterEach(async () => {
    await store.close()
  })

  it('allows first request', async () => {
    const res = await tokenBucketCheck('k', 10, 60_000, store)
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(9)
  })

  it('allows up to limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await tokenBucketCheck('k', 5, 60_000, store)
      expect(res.allowed).toBe(true)
    }
  })

  it('blocks when tokens run out', async () => {
    for (let i = 0; i < 3; i++) await tokenBucketCheck('k', 3, 60_000, store)

    const res = await tokenBucketCheck('k', 3, 60_000, store)
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
    expect(res.retryAfter).toBeGreaterThan(0)
  })

  it('refills over time', async () => {
    // 1s window so we don't wait forever
    for (let i = 0; i < 5; i++) await tokenBucketCheck('k', 5, 1_000, store)

    // wait a bit for tokens to refill
    await new Promise((r) => setTimeout(r, 300))

    const res = await tokenBucketCheck('k', 5, 1_000, store)
    expect(res.allowed).toBe(true)
  })
})
