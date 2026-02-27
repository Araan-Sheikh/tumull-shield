# Migrating from other libraries

## From express-rate-limit

Before:
```ts
import rateLimit from 'express-rate-limit'
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }))
```

After:
```ts
import { shieldExpress } from '@tumull/shield'
app.use(shieldExpress({ limit: 100, window: '15m' }))
```

Main differences: human-readable time strings instead of milliseconds, sliding window by default, built-in bot detection + brute force, works with Next.js.

---

## From @upstash/ratelimit

Before:
```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})
const { success } = await ratelimit.limit(identifier)
```

After:
```ts
import { shield } from '@tumull/shield'
import { UpstashStore } from '@tumull/shield/stores/upstash'

export default shield({
  limit: 10,
  window: '10s',
  store: new UpstashStore({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  }),
})
```

Main differences: works without Upstash (memory store is free), drop-in middleware instead of manual wiring, bot detection + per-route config included.

---

## From rate-limiter-flexible

Before:
```ts
import { RateLimiterMemory } from 'rate-limiter-flexible'

const limiter = new RateLimiterMemory({ points: 10, duration: 1 })

app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip)
    next()
  } catch {
    res.status(429).send('Too Many Requests')
  }
})
```

After:
```ts
import { shieldExpress } from '@tumull/shield'
app.use(shieldExpress({ limit: 10, window: '1s' }))
```
