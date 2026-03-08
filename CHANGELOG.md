# Changelog

## 1.0.0 (2025-02-26)

Initial release.

- Sliding window, fixed window, and token bucket rate limiting
- Memory store w/ LRU eviction (no config needed)
- Redis store (ioredis)
- Upstash store (HTTP, works at the edge)
- Middleware for Next.js, Express, Fastify, Hono, Node.js http
- Bot detection via user-agent + header analysis
- Brute force protection with progressive delays
- Request fingerprinting
- Per-route config with glob/pattern matching
- Allowlist / blocklist
- Custom key functions

## [1.1.0] — 2026-02-27

### Added

- Geo‑blocking support (`allowlistGeo` / `blocklistGeo` configuration)
	(identifies country via `geoip-lite`)
- Standard `X-RateLimit-*` headers
- TypeScript, ESM + CJS
