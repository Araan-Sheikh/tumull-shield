# Algorithms

Shield ships with three rate limiting algorithms. Pick whichever fits your use case.

## Sliding Window (default)

Combines the current and previous window using a weighted average. Gives the smoothest rate limiting — no burst spikes at window boundaries.

```
weight = (windowSize - elapsed) / windowSize
count  = prev * weight + current
```

Example: 1 minute window, 30s in. Previous window had 80 hits, current has 20.

`weight = (60-30)/60 = 0.5 → count = 80*0.5 + 20 = 60`

```ts
shield({ algorithm: 'sliding-window', limit: 100, window: '1m' })
```

## Fixed Window

Simple counter that resets at fixed intervals. Fast, low memory, but can allow up to 2x the limit at window boundaries (a burst right before and right after the reset).

```ts
shield({ algorithm: 'fixed-window', limit: 100, window: '1m' })
```

## Token Bucket

Bucket starts full (capacity = limit). Tokens refill at a constant rate. Each request takes one token. If the bucket's empty, request is denied. Allows controlled bursts up to the full bucket size.

```ts
shield({ algorithm: 'token-bucket', limit: 100, window: '1m' })
```

## Quick comparison

|            | Sliding Window | Fixed Window    | Token Bucket   |
| ---------- | -------------- | --------------- | -------------- |
| Accuracy   | best           | ok              | good           |
| Complexity | medium         | simple          | more complex   |
| Memory     | 2 windows      | 1 counter       | bucket state   |
| Bursts     | smooth         | 2x at boundary  | controlled     |
| Use case   | most APIs      | high throughput | bursty traffic |
