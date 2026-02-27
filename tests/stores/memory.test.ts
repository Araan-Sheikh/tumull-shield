import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryStore } from '../../src/stores/memory'

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => { store = new MemoryStore({ cleanupInterval: 60_000 }) })
  afterEach(async () => { await store.close() })

  describe('fixed window (increment)', () => {
    it('starts at 1', async () => {
      const r = await store.increment('k', 60_000)
      expect(r.count).toBe(1)
      expect(r.reset).toBeGreaterThan(0)
    })

    it('increments', async () => {
      await store.increment('k', 60_000)
      const r = await store.increment('k', 60_000)
      expect(r.count).toBe(2)
    })

    it('different keys are separate', async () => {
      await store.increment('a', 60_000)
      await store.increment('a', 60_000)
      const r = await store.increment('b', 60_000)
      expect(r.count).toBe(1)
    })
  })

  describe('sliding window', () => {
    it('returns zeros for unknown key', async () => {
      const data = await store.getSlidingWindow('k', 60_000)
      expect(data.previousCount).toBe(0)
      expect(data.currentCount).toBe(0)
    })

    it('increments current window', async () => {
      await store.incrementSlidingWindow('k', 60_000)
      const data = await store.incrementSlidingWindow('k', 60_000)
      expect(data.currentCount).toBe(2)
      expect(data.previousCount).toBe(0)
    })
  })

  describe('blocking', () => {
    it('not blocked by default', async () => {
      expect(await store.isBlocked('k')).toBe(false)
    })

    it('blocks a key', async () => {
      await store.block('k', 60_000)
      expect(await store.isBlocked('k')).toBe(true)
    })

    it('expires after duration', async () => {
      await store.block('k', 1) // 1ms
      await new Promise((r) => setTimeout(r, 10))
      expect(await store.isBlocked('k')).toBe(false)
    })
  })

  describe('token bucket', () => {
    it('null for new key', async () => {
      expect(await store.getTokenBucket('k')).toBe(null)
    })

    it('roundtrips state', async () => {
      const state = { tokens: 5, lastRefill: Date.now() }
      await store.setTokenBucket('k', state, 60_000)
      expect(await store.getTokenBucket('k')).toEqual(state)
    })
  })

  describe('reset', () => {
    it('clears everything for a key', async () => {
      await store.increment('k', 60_000)
      await store.incrementSlidingWindow('k', 60_000)
      await store.block('k', 60_000)
      await store.setTokenBucket('k', { tokens: 5, lastRefill: Date.now() }, 60_000)

      await store.reset('k')

      expect((await store.increment('k', 60_000)).count).toBe(1)
      expect(await store.isBlocked('k')).toBe(false)
      expect(await store.getTokenBucket('k')).toBe(null)
    })
  })

  describe('LRU eviction', () => {
    it('evicts oldest when over capacity', async () => {
      const small = new MemoryStore({ maxSize: 3, cleanupInterval: 60_000 })

      await small.increment('k1', 60_000)
      await small.increment('k2', 60_000)
      await small.increment('k3', 60_000)
      await small.increment('k4', 60_000) // should boot k1

      // k4 should be at count 2 (not evicted)
      const r = await small.increment('k4', 60_000)
      expect(r.count).toBe(2)

      await small.close()
    })
  })
})
