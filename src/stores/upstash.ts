import type {
  Store,
  StoreIncrementResult,
  SlidingWindowData,
  TokenBucketState,
} from '../core/types.js'
import { getWindowStart } from '../utils/time.js'

/*
 * Upstash adapter — HTTP-based Redis, no persistent connections.
 * Perfect for edge runtimes (Vercel Edge, Cloudflare Workers, etc.)
 * where you can't hold open TCP sockets.
 *
 *   const store = new UpstashStore({
 *     url: process.env.UPSTASH_REDIS_URL,
 *     token: process.env.UPSTASH_REDIS_TOKEN,
 *   })
 */

export interface UpstashStoreOptions {
  url: string
  token: string
  prefix?: string
}

interface UpstashResponse<T = unknown> {
  result: T
  error?: string
}

export class UpstashStore implements Store {
  private readonly url: string
  private readonly token: string
  private readonly prefix: string

  constructor(options: UpstashStoreOptions) {
    this.url = options.url.replace(/\/$/, '') // strip trailing slash
    this.token = options.token
    this.prefix = options.prefix ?? 'shield:'
  }

  private k(suffix: string): string {
    return `${this.prefix}${suffix}`
  }

  private async cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })

    if (!res.ok) {
      throw new Error(`[shield] upstash request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as UpstashResponse<T>
    if (data.error) {
      throw new Error(`[shield] upstash error: ${data.error}`)
    }
    return data.result
  }

  private async pipe(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    })

    if (!res.ok) {
      throw new Error(`[shield] upstash pipeline failed: ${res.status}`)
    }

    const data = (await res.json()) as UpstashResponse[]
    return data.map((d) => d.result)
  }

  async increment(key: string, windowMs: number): Promise<StoreIncrementResult> {
    const now = Date.now()
    const windowStart = getWindowStart(windowMs, now)
    const reset = windowStart + windowMs
    const rk = this.k(`fixed:${key}:${windowStart}`)
    const ttl = Math.ceil(windowMs / 1000) + 1

    const results = await this.pipe([
      ['INCR', rk],
      ['EXPIRE', rk, ttl],
    ])

    return { count: results[0] as number, reset: Math.ceil(reset / 1000) }
  }

  async getSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData> {
    const now = Date.now()
    const currentWindowStart = getWindowStart(windowMs, now)
    const prevStart = currentWindowStart - windowMs

    const results = await this.pipe([
      ['GET', this.k(`sliding:${key}:${currentWindowStart}`)],
      ['GET', this.k(`sliding:${key}:${prevStart}`)],
    ])

    return {
      currentCount: results[0] ? parseInt(String(results[0]), 10) : 0,
      previousCount: results[1] ? parseInt(String(results[1]), 10) : 0,
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
    const ttl = Math.ceil((windowMs * 2) / 1000) + 1

    const results = await this.pipe([
      ['INCR', currentKey],
      ['EXPIRE', currentKey, ttl],
      ['GET', prevKey],
    ])

    return {
      currentCount: results[0] as number,
      previousCount: results[2] ? parseInt(String(results[2]), 10) : 0,
      currentWindowStart,
      windowMs,
    }
  }

  async isBlocked(key: string): Promise<boolean> {
    const val = await this.cmd<string | null>('GET', this.k(`block:${key}`))
    return val !== null
  }

  async block(key: string, durationMs: number): Promise<void> {
    const seconds = Math.ceil(durationMs / 1000)
    await this.cmd('SET', this.k(`block:${key}`), '1', 'EX', seconds)
  }

  async reset(key: string): Promise<void> {
    await this.pipe([
      ['DEL', this.k(`block:${key}`)],
      ['DEL', this.k(`bucket:${key}`)],
    ])
  }

  async getTokenBucket(key: string): Promise<TokenBucketState | null> {
    const data = await this.cmd<string | null>('GET', this.k(`bucket:${key}`))
    if (!data) return null
    try {
      return JSON.parse(data) as TokenBucketState
    } catch {
      return null
    }
  }

  async setTokenBucket(key: string, state: TokenBucketState, windowMs: number): Promise<void> {
    const ttl = Math.ceil(windowMs / 1000) * 2
    await this.cmd('SET', this.k(`bucket:${key}`), JSON.stringify(state), 'EX', ttl)
  }

  async close(): Promise<void> {
    // nothing to close — HTTP is stateless
  }
}
