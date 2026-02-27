import type {
  Store,
  StoreIncrementResult,
  SlidingWindowData,
  TokenBucketState,
} from '../core/types.js'
import { getWindowStart } from '../utils/time.js'

/*
 * Redis adapter — works with ioredis and node-redis.
 * Use this when you need shared state across multiple server instances.
 *
 * Example:
 *   import Redis from 'ioredis'
 *   const store = new RedisStore({ client: new Redis(process.env.REDIS_URL) })
 */

export interface RedisStoreOptions {
  client: RedisClient
  prefix?: string // defaults to "shield:"
}

// works with both ioredis and node-redis
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>
  del(key: string | string[]): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number | boolean>
  pexpire(key: string, milliseconds: number): Promise<number | boolean>
  ttl(key: string): Promise<number>
  pttl(key: string): Promise<number>
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>
  quit?(): Promise<unknown>
  disconnect?(): void
}

export class RedisStore implements Store {
  private readonly client: RedisClient
  private readonly prefix: string

  constructor(options: RedisStoreOptions) {
    this.client = options.client
    this.prefix = options.prefix ?? 'shield:'
  }

  private k(suffix: string): string {
    return `${this.prefix}${suffix}`
  }

  async increment(key: string, windowMs: number): Promise<StoreIncrementResult> {
    const now = Date.now()
    const windowStart = getWindowStart(windowMs, now)
    const reset = windowStart + windowMs
    const rk = this.k(`fixed:${key}:${windowStart}`)

    const count = await this.client.incr(rk)

    // only set ttl on first hit to avoid resetting it
    if (count === 1) {
      await this.client.pexpire(rk, windowMs + 1000)
    }

    return { count, reset: Math.ceil(reset / 1000) }
  }

  async getSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData> {
    const now = Date.now()
    const currentWindowStart = getWindowStart(windowMs, now)
    const prevStart = currentWindowStart - windowMs

    const [currentStr, prevStr] = await Promise.all([
      this.client.get(this.k(`sliding:${key}:${currentWindowStart}`)),
      this.client.get(this.k(`sliding:${key}:${prevStart}`)),
    ])

    return {
      currentCount: currentStr ? parseInt(currentStr, 10) : 0,
      previousCount: prevStr ? parseInt(prevStr, 10) : 0,
      currentWindowStart,
      windowMs,
    }
  }

  async incrementSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData> {
    const now = Date.now()
    const currentWindowStart = getWindowStart(windowMs, now)
    const prevStart = currentWindowStart - windowMs

    const currentKey = this.k(`sliding:${key}:${currentWindowStart}`)
    const prevKey = this.k(`sliding:${key}:${prevStart}`)

    const [currentCount, prevStr] = await Promise.all([
      this.client.incr(currentKey),
      this.client.get(prevKey),
    ])

    // keep keys around for 2x window so the previous window data is available
    if (currentCount === 1) {
      await this.client.pexpire(currentKey, windowMs * 2 + 1000)
    }

    return {
      currentCount,
      previousCount: prevStr ? parseInt(prevStr, 10) : 0,
      currentWindowStart,
      windowMs,
    }
  }

  async isBlocked(key: string): Promise<boolean> {
    const val = await this.client.get(this.k(`block:${key}`))
    return val !== null
  }

  async block(key: string, durationMs: number): Promise<void> {
    const seconds = Math.ceil(durationMs / 1000)
    await this.client.set(this.k(`block:${key}`), '1', 'EX', seconds)
  }

  async reset(key: string): Promise<void> {
    // can't enumerate all window keys without SCAN, just nuke the ones we know about
    await Promise.all([
      this.client.del(this.k(`block:${key}`)),
      this.client.del(this.k(`bucket:${key}`)),
    ])
  }

  async getTokenBucket(key: string): Promise<TokenBucketState | null> {
    const data = await this.client.get(this.k(`bucket:${key}`))
    if (!data) return null
    try {
      return JSON.parse(data) as TokenBucketState
    } catch {
      return null
    }
  }

  async setTokenBucket(key: string, state: TokenBucketState, windowMs: number): Promise<void> {
    const ttl = Math.ceil(windowMs / 1000) * 2
    await this.client.set(this.k(`bucket:${key}`), JSON.stringify(state), 'EX', ttl)
  }

  async close(): Promise<void> {
    if (this.client.quit) {
      await this.client.quit()
    } else if (this.client.disconnect) {
      this.client.disconnect()
    }
  }
}
