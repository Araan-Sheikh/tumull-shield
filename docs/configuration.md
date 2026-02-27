# Configuration

## All options

```ts
interface ShieldConfig {
  limit: number           // max requests per window (default: 100)
  window: string          // time window (default: "1m")
  block?: string          // block duration after exceeding limit
  algorithm?: 'sliding-window' | 'fixed-window' | 'token-bucket'
  routes?: Record<string, RouteConfig>
  key?: (req: Request) => string | Promise<string>
  store?: 'memory' | Store
  botDetection?: boolean
  blockBots?: string[]
  onLimit?: (req: Request, retryAfter: number) => Response
  onBlock?: (key: string, info: BlockInfo) => void
  allowlist?: string[]
  blocklist?: string[]
  headers?: boolean       // default: true
}
```

## Time formats

| Format | Duration |
|--------|----------|
| `"30s"` | 30 seconds |
| `"1m"` | 1 minute |
| `"5m"` | 5 minutes |
| `"1h"` | 1 hour |
| `"1d"` | 1 day |
| `60000` | 60,000ms (number also works) |

## Per-route config

```ts
shield({
  limit: 100,
  window: '1m',
  routes: {
    '/api/auth/login': { limit: 5, window: '5m', block: '30m' },
    '/api/public/*':   { limit: 500, window: '1m' },
    '/api/webhook/*':  { skip: true },
    '/api/auth/**':    { limit: 20, window: '1m' },
  },
})
```

### Pattern syntax

| Pattern | Matches |
|---------|---------|
| `/api/hello` | exact |
| `/api/*` | one segment (`/api/users`) |
| `/api/**` | any depth (`/api/users/123/posts`) |
| `/api/:id` | named param (one segment) |
| `/api/:path*` | rest of path |

## Custom key

By default Shield uses the client's IP. You can override that:

```ts
// rate limit by API key
shield({
  key: (req) => req.headers.get('x-api-key') ?? 'anonymous',
})

// rate limit by user ID
shield({
  key: async (req) => {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return extractIP(req)
    const user = await verifyToken(token)
    return user.id
  },
})
```

## Custom response

```ts
shield({
  onLimit: (req, retryAfter) =>
    new Response(
      JSON.stringify({ error: 'Whoa, slow down!', retryAfter }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ),
})
```
