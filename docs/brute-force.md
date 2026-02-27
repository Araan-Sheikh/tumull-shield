# Brute Force Protection

Track failed login attempts and block IPs that keep failing.

## How it works

1. Watch for 401/403 responses on auth endpoints
2. After N failures in a window → block that IP
3. Delays ramp up with each failure
4. Successful login resets the counter

## Setup

```ts
shield({
  routes: {
    '/api/auth/login': {
      limit: 20,
      window: '1m',
      onFailure: {
        statusCodes: [401, 403],
        maxFailures: 5,
        blockDuration: '15m',
      },
    },
  },
})
```

## Using BruteForceDetector directly

```ts
import { BruteForceDetector } from '@tumull/shield'

const detector = new BruteForceDetector({
  maxFailures: 5,
  blockDuration: '15m',
  statusCodes: [401, 403],
})

// on failed login
if (detector.isFailureStatus(response.status)) {
  const { shouldBlock, blockInfo } = detector.recordFailure(clientIP)
  if (shouldBlock) {
    await detector.blockInStore(clientIP, store)
  }
}

// on successful login
detector.recordSuccess(clientIP)
```

## Progressive delays

| Failure # | Delay |
|-----------|-------|
| 1 | none |
| 2 | 1s |
| 3 | 2s |
| 4 | 4s |
| 5 | blocked |
