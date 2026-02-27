# Framework Guides

## Next.js

### App Router

Drop a `middleware.ts` at your project root:

```ts
import { shield } from '@tumull/shield'

export default shield({ limit: 100, window: '1m' })

export const config = { matcher: '/api/:path*' }
```

### If you need NextResponse

Sometimes you want to chain with other middleware logic or copy headers over:

```ts
import { NextResponse } from 'next/server'
import { shield } from '@tumull/shield'

const protect = shield({ limit: 100, window: '1m' })

export async function middleware(request: Request) {
  const result = await protect(request)
  if (result.status !== 200) return result

  const response = NextResponse.next()
  result.headers.forEach((v, k) => response.headers.set(k, v))
  return response
}
```

---

## Express

```ts
import express from 'express'
import { shieldExpress } from '@tumull/shield'

const app = express()

// protect everything
app.use(shieldExpress({ limit: 100, window: '1m' }))

// or just auth routes
app.use('/api/auth', shieldExpress({ limit: 5, window: '5m' }))
```

---

## Fastify

```ts
import Fastify from 'fastify'
import { shieldFastify } from '@tumull/shield'

const app = Fastify()
app.register(shieldFastify, { limit: 100, window: '1m' })
```

---

## Hono

```ts
import { Hono } from 'hono'
import { shieldHono } from '@tumull/shield'

const app = new Hono()
app.use('*', shieldHono({ limit: 100, window: '1m' }))
// or just some routes
app.use('/api/*', shieldHono({ limit: 50, window: '1m' }))
```

---

## Node.js HTTP

```ts
import http from 'node:http'
import { shieldNode } from '@tumull/shield'

const limiter = shieldNode({ limit: 100, window: '1m' })

http.createServer(async (req, res) => {
  if (await limiter(req, res)) return
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
}).listen(3000)
```
