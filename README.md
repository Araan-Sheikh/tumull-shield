# @tumull/shield

Rate limiting, bot detection, and brute force protection for Node.js apps. Works with Next.js, Express, Fastify, Hono, or plain `http`. No external dependencies in the core.

[![npm](https://img.shields.io/npm/v/@tumull/shield)](https://npmjs.com/package/@tumull/shield) [![downloads](https://img.shields.io/npm/dm/@tumull/shield)](https://npmjs.com/package/@tumull/shield) [![bundle](https://img.shields.io/bundlephobia/minzip/@tumull/shield)](https://bundlephobia.com/package/@tumull/shield) [![license](https://img.shields.io/npm/l/@tumull/shield)](./LICENSE) [![tests](https://github.com/Aaraan-Sheikh/tumull-shield/actions/workflows/ci.yml/badge.svg)](https://github.com/Aaraan-Sheikh/tumull-shield/actions) [![release](https://github.com/Aaraan-Sheikh/tumull-shield/releases/latest/download/badge.svg)](https://github.com/Aaraan-Sheikh/tumull-shield/releases/latest)

---

## Why?

Most rate limiting libs are either too simple (fixed window, no bot detection) or tied to a paid service. Shield gives you sliding window, token bucket, bot detection, brute force protection, and per-route config — all in one package, for free, with zero lock-in.

## Install

```bash
npm install @tumull/shield
```

## Usage

### Next.js

```ts
// middleware.ts
import { shield } from '@tumull/shield'

export default shield({
  limit: 100,
  window: '1m',
})

export const config = {
  matcher: '/api/:path*',
}
```

That's basically it. Your API routes are rate-limited now.

### Express

```ts
import express from 'express'
import { shieldExpress } from '@tumull/shield'

const app = express()
app.use(shieldExpress({ limit: 100, window: '1m' }))
```

### Fastify

```ts
import Fastify from 'fastify'
import { shieldFastify } from '@tumull/shield'

const app = Fastify()
app.register(shieldFastify, { limit: 100, window: '1m' })
```

### Hono

```ts
import { Hono } from 'hono'
import { shieldHono } from '@tumull/shield'

const app = new Hono()
app.use('*', shieldHono({ limit: 100, window: '1m' }))
```

### Node.js HTTP

```ts
import http from 'node:http'
import { shieldNode } from '@tumull/shield'

const limiter = shieldNode({ limit: 100, window: '1m' })

http
  .createServer(async (req, res) => {
    if (await limiter(req, res)) return // blocked
    res.writeHead(200)
    res.end('ok')
  })
  .listen(3000)
```

## Config

```ts
shield({
  limit: 100, // requests per window
  window: '1m', // "30s", "1m", "5m", "1h", "1d"
  block: '15m', // how long to block after exceeding limit
  algorithm: 'sliding-window', // or 'fixed-window', 'token-bucket'

  // different limits for different routes
  routes: {
    '/api/auth/login': { limit: 5, window: '5m', block: '30m' },
    '/api/public/*': { limit: 500, window: '1m' },
    '/api/webhook/*': { skip: true },
  },

  // custom key (default: client IP)
  key: (req) => req.headers.get('x-api-key') ?? extractIP(req),

  store: 'memory', // default. also supports Redis, Upstash
  botDetection: true,
  blockBots: ['scrapy', 'curl'],
  allowlist: ['127.0.0.1'],
  // country-level controls (ISO codes)
  allowlistGeo: ['US', 'CA'],
  blocklistGeo: ['RU'],
  blocklist: [],
  headers: true, // X-RateLimit-* headers

  onLimit: (req, retryAfter) =>
    new Response(JSON.stringify({ error: 'Slow down' }), { status: 429 }),
})
```

Full config reference → [docs/configuration.md](./docs/configuration.md)

## Stores

**Memory** (default) — no setup, works everywhere. LRU eviction keeps memory bounded.

```ts
import { shield, MemoryStore } from '@tumull/shield'
shield({ store: new MemoryStore({ maxSize: 10_000 }) })
```

**Redis** — for multi-instance / production setups.

```ts
import { RedisStore } from '@tumull/shield/stores/redis'
import Redis from 'ioredis'

shield({ store: new RedisStore({ client: new Redis(process.env.REDIS_URL) }) })
```

**Upstash** — HTTP-based, works on the edge (Vercel Edge, Cloudflare Workers).

```ts
import { UpstashStore } from '@tumull/shield/stores/upstash'

shield({
  store: new UpstashStore({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  }),
})
```

More details → [docs/stores.md](./docs/stores.md)

## Algorithms

| Algorithm        | What it does                                  | Good for            |
| ---------------- | --------------------------------------------- | ------------------- |
| `sliding-window` | Weighted average of current + previous window | Most apps (default) |
| `fixed-window`   | Simple counter, resets on interval            | High throughput     |
| `token-bucket`   | Tokens refill at constant rate                | Bursty traffic      |

More details → [docs/algorithms.md](./docs/algorithms.md)

## Response headers

When `headers: true` (default):

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1708934400
```

When blocked → `429 Too Many Requests` with `Retry-After` header.

## How it compares

|                    | Shield | express-rate-limit | @upstash/ratelimit | Arcjet   |
| ------------------ | ------ | ------------------ | ------------------ | -------- |
| Next.js middleware | ✅     | ❌                 | ✅                 | ✅       |
| Edge runtime       | ✅     | ❌                 | ✅                 | ✅       |
| Zero deps          | ✅     | ✅                 | ❌                 | ❌       |
| Sliding window     | ✅     | ❌                 | ✅                 | ✅       |
| Bot detection      | ✅     | ❌                 | ❌                 | ✅       |
| Brute force        | ✅     | ❌                 | ❌                 | ✅       |
| Per-route config   | ✅     | manual             | ❌                 | ✅       |
| Free               | ✅     | ✅                 | freemium           | freemium |

## Docs

- [Getting started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Algorithms](./docs/algorithms.md)
- [Stores](./docs/stores.md)
- [Framework guides](./docs/frameworks.md)
- [Bot detection](./docs/bot-detection.md)
- [Brute force protection](./docs/brute-force.md)
- [Migration from other libs](./docs/migration.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — [TUMULL I.N.C.](https://github.com/Araan-Sheikh)
