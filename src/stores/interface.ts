/**
 * Store interface re-export.
 *
 * The Store interface is defined in core/types.ts.
 * This file exists as a convenient import path and documentation.
 *
 * To create a custom store, implement the Store interface:
 *
 * ```ts
 * import type { Store } from '@tumull/shield'
 *
 * class MyStore implements Store {
 *   async increment(key, windowMs) { ... }
 *   async getSlidingWindow(key, windowMs) { ... }
 *   async incrementSlidingWindow(key, windowMs) { ... }
 *   async isBlocked(key) { ... }
 *   async block(key, durationMs) { ... }
 *   async reset(key) { ... }
 *   async getTokenBucket(key) { ... }
 *   async setTokenBucket(key, state, windowMs) { ... }
 *   async close() { ... }
 * }
 * ```
 */
export type {
  Store,
  StoreIncrementResult,
  SlidingWindowData,
  TokenBucketState,
} from '../core/types.js'
