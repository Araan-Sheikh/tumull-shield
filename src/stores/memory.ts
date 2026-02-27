import type {
  Store,
  StoreIncrementResult,
  SlidingWindowData,
  TokenBucketState,
} from '../core/types.js'
import { DEFAULT_MAX_STORE_SIZE, STORE_CLEANUP_INTERVAL } from '../constants.js'
import { getWindowStart } from '../utils/time.js'

interface FixedWindowEntry {
  count: number
  reset: number
}

interface SlidingWindowEntry {
  previousCount: number
  currentCount: number
  currentWindowStart: number
  windowMs: number
}

interface BlockEntry {
  blockedUntil: number
}

interface LRUEntry<T> {
  value: T
  lastAccess: number
}

export interface MemoryStoreOptions {
  maxSize?: number // entries before LRU kicks in (default 10k)
  cleanupInterval?: number // ms between expired entry sweeps
}

export class MemoryStore implements Store {
  private fixedWindows = new Map<string, LRUEntry<FixedWindowEntry>>()
  private slidingWindows = new Map<string, LRUEntry<SlidingWindowEntry>>()
  private blocks = new Map<string, BlockEntry>()
  private tokenBuckets = new Map<string, LRUEntry<TokenBucketState>>()

  private readonly maxSize: number
  private readonly cleanupTimer: ReturnType<typeof setInterval>

  constructor(options: MemoryStoreOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_STORE_SIZE
    const interval = options.cleanupInterval ?? STORE_CLEANUP_INTERVAL

    this.cleanupTimer = setInterval(() => this.cleanup(), interval)

    // don't hold the process open just for cleanup
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref()
    }
  }

  async increment(key: string, windowMs: number): Promise<StoreIncrementResult> {
    const now = Date.now()
    const windowStart = getWindowStart(windowMs, now)
    const reset = windowStart + windowMs
    const k = `fixed:${key}`

    const existing = this.fixedWindows.get(k)
    if (existing && existing.value.reset > now) {
      existing.value.count++
      existing.lastAccess = now
      return { count: existing.value.count, reset: Math.ceil(existing.value.reset / 1000) }
    }

    // new window
    const entry: LRUEntry<FixedWindowEntry> = {
      value: { count: 1, reset },
      lastAccess: now,
    }
    this.fixedWindows.set(k, entry)
    this.evictIfNeeded(this.fixedWindows)

    return { count: 1, reset: Math.ceil(reset / 1000) }
  }

  async getSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData> {
    const now = Date.now()
    const currentWindowStart = getWindowStart(windowMs, now)
    const k = `sliding:${key}`
    const existing = this.slidingWindows.get(k)

    if (!existing) {
      return { previousCount: 0, currentCount: 0, currentWindowStart, windowMs }
    }

    const entry = existing.value
    existing.lastAccess = now

    if (currentWindowStart > entry.currentWindowStart + windowMs) {
      // been gone for 2+ windows, everything's stale
      return { previousCount: 0, currentCount: 0, currentWindowStart, windowMs }
    }

    if (currentWindowStart > entry.currentWindowStart) {
      // rolled over to next window
      return {
        previousCount: entry.currentCount,
        currentCount: 0,
        currentWindowStart,
        windowMs,
      }
    }

    return {
      previousCount: entry.previousCount,
      currentCount: entry.currentCount,
      currentWindowStart: entry.currentWindowStart,
      windowMs,
    }
  }

  async incrementSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData> {
    const now = Date.now()
    const currentWindowStart = getWindowStart(windowMs, now)
    const k = `sliding:${key}`
    const existing = this.slidingWindows.get(k)

    if (!existing) {
      const fresh: LRUEntry<SlidingWindowEntry> = {
        value: { previousCount: 0, currentCount: 1, currentWindowStart, windowMs },
        lastAccess: now,
      }
      this.slidingWindows.set(k, fresh)
      this.evictIfNeeded(this.slidingWindows)
      return fresh.value
    }

    const entry = existing.value
    existing.lastAccess = now

    if (currentWindowStart > entry.currentWindowStart + windowMs) {
      entry.previousCount = 0
      entry.currentCount = 1
      entry.currentWindowStart = currentWindowStart
    } else if (currentWindowStart > entry.currentWindowStart) {
      entry.previousCount = entry.currentCount
      entry.currentCount = 1
      entry.currentWindowStart = currentWindowStart
    } else {
      entry.currentCount++
    }

    return { ...entry }
  }

  async isBlocked(key: string): Promise<boolean> {
    const entry = this.blocks.get(key)
    if (!entry) return false

    if (Date.now() >= entry.blockedUntil) {
      this.blocks.delete(key)
      return false
    }
    return true
  }

  async block(key: string, durationMs: number): Promise<void> {
    this.blocks.set(key, { blockedUntil: Date.now() + durationMs })
  }

  async reset(key: string): Promise<void> {
    this.fixedWindows.delete(`fixed:${key}`)
    this.slidingWindows.delete(`sliding:${key}`)
    this.blocks.delete(key)
    this.tokenBuckets.delete(`bucket:${key}`)
  }

  async getTokenBucket(key: string): Promise<TokenBucketState | null> {
    const entry = this.tokenBuckets.get(`bucket:${key}`)
    if (!entry) return null
    entry.lastAccess = Date.now()
    return { ...entry.value }
  }

  async setTokenBucket(key: string, state: TokenBucketState, _windowMs: number): Promise<void> {
    this.tokenBuckets.set(`bucket:${key}`, {
      value: { ...state },
      lastAccess: Date.now(),
    })
    this.evictIfNeeded(this.tokenBuckets)
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupTimer)
    this.fixedWindows.clear()
    this.slidingWindows.clear()
    this.blocks.clear()
    this.tokenBuckets.clear()
  }

  // sweep expired stuff
  private cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.fixedWindows) {
      if (entry.value.reset <= now) this.fixedWindows.delete(key)
    }

    for (const [key, entry] of this.slidingWindows) {
      const expiry = entry.value.currentWindowStart + entry.value.windowMs * 2
      if (expiry <= now) this.slidingWindows.delete(key)
    }

    for (const [key, entry] of this.blocks) {
      if (entry.blockedUntil <= now) this.blocks.delete(key)
    }
  }

  // boot the oldest entry when we're over capacity
  private evictIfNeeded<T>(map: Map<string, LRUEntry<T>>): void {
    if (map.size <= this.maxSize) return

    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of map) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) map.delete(oldestKey)
  }

  // handy for tests
  get size(): number {
    return (
      this.fixedWindows.size + this.slidingWindows.size + this.blocks.size + this.tokenBuckets.size
    )
  }
}
