# Changelog

## [1.2.0] — 2026-04-03

### Added

- Introduced a lightweight WAF rules engine with configurable `wafEnabled` and `wafRules`.
- WAF rules support targets: `url`, `path`, `query`, `user-agent`, `header`, and `method`.
- WAF operators support `includes`, `equals`, and `regex` matching with optional regex flags.
- Exported `evaluateWaf` and WAF-related types for standalone usage.

### Changed

- Integrated WAF checks into Next.js, Hono, Express, Fastify, and Node.js middleware adapters.
- Block events now support `reason: 'waf'` in `BlockInfo` callbacks.

### Added

- Route-level geo controls: `allowlistGeo` and `blocklistGeo` can now be defined inside
  `routes` patterns to apply country rules to specific endpoints (for example, private APIs
  or region-scoped routes) instead of only globally.

### Changed

- Geo evaluation now resolves an effective geo policy per route pattern in core processing and
  in framework adapters (Express, Fastify, and Node.js HTTP), so behavior is consistent across
  all runtimes.

### Fixed

- Pinned `geoip-lite` to `1.4.2` to avoid Node.js engine warnings on Node 22 environments.
- Corrected README badges to point to the canonical GitHub repo (`Araan-Sheikh/tumull-shield`).

### Changed

- Exported `lookupCountry` and `cachedLookupCountry` from the package entrypoint so geo helpers
  are available via `@tumull/shield`, matching the documented API.

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

## [1.1.0] — 2026-03-08

### Added

- **Geo-blocking** — `allowlistGeo` and `blocklistGeo` config options let you restrict or block
  requests by country code (ISO 3166-1 alpha-2). Country lookup is powered by `geoip-lite` with
  an in-process LRU cache so there is no per-request overhead.
- **Standard rate-limit headers** — responses now include `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` out of the box on every
  middleware (Next.js, Express, Fastify, Hono, Node.js http).
- **Dual-package (ESM + CJS)** — the build now ships both `.js` (ESM) and `.cjs` (CommonJS)
  variants with matching `.d.ts` / `.d.cts` declaration files, making the package usable in any
  Node.js project regardless of `"type"` field.
- **`cachedLookupCountry` utility** — exported from `@tumull/shield` for consumers who want to
  perform geo-lookups outside the middleware layer.

### Changed

- `resolveConfig` now applies defaults for `allowlistGeo` and `blocklistGeo` (empty arrays) so
  existing configs require no migration.
- Memory store LRU eviction is now triggered at a configurable `maxSize` (default 10 000 entries)
  instead of a hard-coded limit.

### Fixed

- Fixed an edge case where `sliding-window` could produce a negative `remaining` value when the
  window rolled over mid-request under high concurrency.
- `extractIP` no longer crashes on malformed `X-Forwarded-For` headers with empty segments.
