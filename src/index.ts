// @tumull/shield — API rate limiting & DDoS protection
// https://github.com/Araan-Sheikh/tumull-shield

// main exports — one per framework
export { createNextMiddleware as shield } from './middleware/next.js'
export { createExpressMiddleware as shieldExpress } from './middleware/express.js'
export { createFastifyPlugin as shieldFastify } from './middleware/fastify.js'
export { createHonoMiddleware as shieldHono } from './middleware/hono.js'
export { createNodeHandler as shieldNode } from './middleware/node.js'

// core engine
export { resolveConfig, checkLimit, processRequest } from './core/rate-limiter.js'
export { slidingWindowCheck } from './core/sliding-window.js'
export { fixedWindowCheck } from './core/fixed-window.js'
export { tokenBucketCheck } from './core/token-bucket.js'

// stores
export { MemoryStore } from './stores/memory.js'
export type { MemoryStoreOptions } from './stores/memory.js'

// protection
export { BruteForceDetector } from './protection/brute-force.js'
export type { BruteForceConfig } from './protection/brute-force.js'
export { detectBot, isKnownBot } from './protection/bot-detect.js'
export type { BotDetectionResult, BotDetectionConfig } from './protection/bot-detect.js'
export { generateFingerprint, createCompositeKey } from './protection/fingerprint.js'

// utils
export { parseWindow, formatMs, getWindowStart } from './utils/time.js'
export { extractIP, extractIPFromHeaders, normalizeIP, ipMatches } from './utils/ip.js'
export { matchRoute, findMatchingRoute, extractPathname } from './utils/matcher.js'
export {
  buildRateLimitHeaders,
  createRateLimitResponse,
  createBlockedResponse,
} from './utils/headers.js'

// types
export type {
  ShieldConfig,
  RouteConfig,
  ResolvedConfig,
  RateLimitResult,
  BlockInfo,
  Store,
  StoreIncrementResult,
  SlidingWindowData,
  TokenBucketState,
  Algorithm,
} from './core/types.js'
