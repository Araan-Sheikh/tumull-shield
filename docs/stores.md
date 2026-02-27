# Stores

## Memory (default)

No config needed. Uses LRU eviction so it doesn't eat all your RAM.

```ts
import { shield, MemoryStore } from '@tumull/shield'

shield({ limit: 100, window: '1m' })
// or
shield({ store: new MemoryStore({ maxSize: 10_000, cleanupInterval: 60_000 }) })
```

Good for: dev, single server, prototyping.  
Not great for: serverless (cold starts lose state), multi-instance (not shared).

---

## Redis

For when you've got multiple servers or want persistence.

```bash
npm install ioredis
```

```ts
import { shield } from '@tumull/shield'
import { RedisStore } from '@tumull/shield/stores/redis'
import Redis from 'ioredis'

shield({
  store: new RedisStore({
    client: new Redis(process.env.REDIS_URL),
    prefix: 'shield:',
  }),
})
```

---

## Upstash

HTTP-based Redis. Works in edge runtimes (Vercel Edge, Cloudflare Workers, etc).

```ts
import { shield } from '@tumull/shield'
import { UpstashStore } from '@tumull/shield/stores/upstash'

shield({
  store: new UpstashStore({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
    prefix: 'shield:',
  }),
})
```

---

## Custom store

Implement the `Store` interface and pass it in:

```ts
import type { Store } from '@tumull/shield'

class MyStore implements Store {
  async increment(key: string, windowMs: number) {
    /* return { count, reset } */
  }
  async getSlidingWindow(key: string, windowMs: number) {
    /* ... */
  }
  async incrementSlidingWindow(key: string, windowMs: number) {
    /* ... */
  }
  async isBlocked(key: string) {
    /* return boolean */
  }
  async block(key: string, durationMs: number) {
    /* ... */
  }
  async reset(key: string) {
    /* ... */
  }
  async getTokenBucket(key: string) {
    /* return { tokens, lastRefill } | null */
  }
  async setTokenBucket(key: string, state: TokenBucketState, windowMs: number) {
    /* ... */
  }
  async close() {
    /* cleanup */
  }
}
```

## Which one?

| Situation           | Store            |
| ------------------- | ---------------- |
| Dev / single server | Memory           |
| Multiple instances  | Redis            |
| Serverless (Lambda) | Redis or Upstash |
| Edge (Vercel Edge)  | Upstash          |
| Cloudflare Workers  | Upstash          |
