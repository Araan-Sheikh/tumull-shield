# Getting Started

## Install

```bash
npm install @tumull/shield
```

## Next.js

Create `middleware.ts` at your project root:

```ts
import { shield } from '@tumull/shield'

export default shield({
  limit: 100,
  window: '1m',
})

export const config = {
  matcher: '/api/:path*',
}
```

Done. Your API routes are rate-limited.

## Express

```ts
import express from 'express'
import { shieldExpress } from '@tumull/shield'

const app = express()
app.use(shieldExpress({ limit: 100, window: '1m' }))
app.listen(3000)
```

## Fastify

```ts
import Fastify from 'fastify'
import { shieldFastify } from '@tumull/shield'

const app = Fastify()
app.register(shieldFastify, { limit: 100, window: '1m' })
app.listen({ port: 3000 })
```

## What happens when someone hits the limit?

They get a `429 Too Many Requests` with a `Retry-After` header and a JSON body:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

## What next?

- [Configuration](./configuration.md) — all the options
- [Algorithms](./algorithms.md) — sliding window vs fixed window vs token bucket
- [Stores](./stores.md) — memory, Redis, Upstash
- [Framework guides](./frameworks.md)
