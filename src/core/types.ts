/*
 * all the types for shield live here
 * kept in one file so imports stay clean
 */

export interface ShieldConfig {
  limit: number // max reqs per window, defaults to 100
  window: string // "30s", "1m", "5m" etc — defaults to "1m"
  block?: string // how long to block after exceeding limit
  routes?: Record<string, RouteConfig>
  key?: (req: Request) => string | Promise<string> // custom key fn, defaults to IP
  store?: 'memory' | Store
  botDetection?: boolean
  blockBots?: string[]
  onLimit?: (req: Request, retryAfter: number) => Response
  onBlock?: (key: string, info: BlockInfo) => void
  allowlist?: string[]
  blocklist?: string[]
  algorithm?: Algorithm
  headers?: boolean // attach ratelimit headers? default true
}

export interface RouteConfig {
  limit?: number
  window?: string
  block?: string
  skip?: boolean // set true to bypass rate limiting entirely
  key?: (req: Request) => string | Promise<string>
  onFailure?: {
    statusCodes?: number[] // which status codes count as "failure" (default [401, 403])
    maxFailures?: number
    blockDuration?: string
  }
}

// internal — what we actually use after merging user config w/ defaults
export interface ResolvedConfig {
  limit: number
  window: string
  windowMs: number
  block?: string
  blockMs?: number
  routes: Record<string, RouteConfig>
  key: (req: Request) => string | Promise<string>
  store: Store
  botDetection: boolean
  blockBots: string[]
  onLimit?: (req: Request, retryAfter: number) => Response
  onBlock?: (key: string, info: BlockInfo) => void
  allowlist: string[]
  blocklist: string[]
  algorithm: Algorithm
  headers: boolean
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // unix ts (seconds)
  retryAfter: number // 0 when allowed
  blocked: boolean
}

export interface BlockInfo {
  reason: 'rate-limit' | 'brute-force' | 'bot' | 'blocklist'
  key: string
  limit: number
  window: number
  blocked: boolean
  blockedUntil?: number
}

// anything that satisfies this can be a backing store
export interface Store {
  increment(key: string, windowMs: number): Promise<StoreIncrementResult>
  getSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData>
  incrementSlidingWindow(key: string, windowMs: number): Promise<SlidingWindowData>
  isBlocked(key: string): Promise<boolean>
  block(key: string, durationMs: number): Promise<void>
  reset(key: string): Promise<void>
  getTokenBucket(key: string): Promise<TokenBucketState | null>
  setTokenBucket(key: string, state: TokenBucketState, windowMs: number): Promise<void>
  close?(): Promise<void>
}

export interface StoreIncrementResult {
  count: number
  reset: number // unix ms when window resets
}

export interface SlidingWindowData {
  previousCount: number
  currentCount: number
  currentWindowStart: number
  windowMs: number
}

export interface TokenBucketState {
  tokens: number
  lastRefill: number
}

export type Algorithm = 'sliding-window' | 'fixed-window' | 'token-bucket'

// framework compat types — minimal so we don't need express/fastify as deps

export interface ExpressRequest {
  ip?: string
  path: string
  url: string
  method: string
  headers: Record<string, string | string[] | undefined>
  get?(name: string): string | undefined
}

export interface ExpressResponse {
  status(code: number): ExpressResponse
  set(field: string, value: string): ExpressResponse
  setHeader(name: string, value: string | number): ExpressResponse
  json(body: unknown): void
  end(): void
  headersSent: boolean
}

export type ExpressNextFunction = (err?: unknown) => void

export interface FastifyRequest {
  ip: string
  url: string
  method: string
  headers: Record<string, string | string[] | undefined>
  routeOptions?: { url?: string }
}

export interface FastifyReply {
  code(statusCode: number): FastifyReply
  header(name: string, value: string): FastifyReply
  send(payload?: unknown): FastifyReply
  sent: boolean
}

export interface FastifyInstance {
  addHook(
    name: 'onRequest',
    hook: (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => void,
  ): void
}
