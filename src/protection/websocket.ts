import type { Algorithm, BlockInfo, RateLimitResult, Store } from '../core/types.js'
import { checkLimit } from '../core/rate-limiter.js'
import { MemoryStore } from '../stores/memory.js'
import { DEFAULT_ALGORITHM, DEFAULT_LIMIT, DEFAULT_WINDOW } from '../constants.js'
import { parseWindow } from '../utils/time.js'

export interface WebSocketLimiterConfig {
  store?: 'memory' | Store
  algorithm?: Algorithm
  connectionLimit?: number
  connectionWindow?: string
  connectionBlock?: string
  messageLimit?: number
  messageWindow?: string
  messageBlock?: string
  keyPrefix?: string
  onBlock?: (key: string, info: BlockInfo) => void
}

export interface WebSocketLimiter {
  connection(key: string): Promise<RateLimitResult>
  message(key: string, socketId?: string): Promise<RateLimitResult>
  shouldCloseConnection(key: string): Promise<boolean>
  shouldDropMessage(key: string, socketId?: string): Promise<boolean>
  close(): Promise<void>
}

interface ResolvedWebSocketLimiterConfig {
  store: Store
  ownsStore: boolean
  algorithm: Algorithm
  connectionLimit: number
  connectionWindowMs: number
  connectionBlockMs?: number
  messageLimit: number
  messageWindowMs: number
  messageBlockMs?: number
  keyPrefix: string
  onBlock?: (key: string, info: BlockInfo) => void
}

export function createWebSocketLimiter(config: WebSocketLimiterConfig = {}): WebSocketLimiter {
  const resolved = resolveWebSocketConfig(config)

  return {
    connection: (key) =>
      consume({
        config: resolved,
        publicKey: key,
        scopedKey: `${resolved.keyPrefix}:ws:connection:${key}`,
        limit: resolved.connectionLimit,
        windowMs: resolved.connectionWindowMs,
        blockMs: resolved.connectionBlockMs,
      }),
    message: (key, socketId) => {
      const messageKey = socketId ? `${key}:${socketId}` : key
      return consume({
        config: resolved,
        publicKey: key,
        scopedKey: `${resolved.keyPrefix}:ws:message:${messageKey}`,
        limit: resolved.messageLimit,
        windowMs: resolved.messageWindowMs,
        blockMs: resolved.messageBlockMs,
      })
    },
    shouldCloseConnection: async (key) => {
      const result = await consume({
        config: resolved,
        publicKey: key,
        scopedKey: `${resolved.keyPrefix}:ws:connection:${key}`,
        limit: resolved.connectionLimit,
        windowMs: resolved.connectionWindowMs,
        blockMs: resolved.connectionBlockMs,
      })
      return !result.allowed
    },
    shouldDropMessage: async (key, socketId) => {
      const messageKey = socketId ? `${key}:${socketId}` : key
      const result = await consume({
        config: resolved,
        publicKey: key,
        scopedKey: `${resolved.keyPrefix}:ws:message:${messageKey}`,
        limit: resolved.messageLimit,
        windowMs: resolved.messageWindowMs,
        blockMs: resolved.messageBlockMs,
      })
      return !result.allowed
    },
    close: async () => {
      if (resolved.ownsStore) await resolved.store.close?.()
    },
  }
}

export const shieldWs = createWebSocketLimiter

function resolveWebSocketConfig(config: WebSocketLimiterConfig): ResolvedWebSocketLimiterConfig {
  let store: Store
  let ownsStore = false

  if (!config.store || config.store === 'memory') {
    store = new MemoryStore()
    ownsStore = true
  } else {
    store = config.store
  }

  return {
    store,
    ownsStore,
    algorithm: config.algorithm ?? DEFAULT_ALGORITHM,
    connectionLimit: config.connectionLimit ?? DEFAULT_LIMIT,
    connectionWindowMs: parseWindow(config.connectionWindow ?? DEFAULT_WINDOW),
    connectionBlockMs: config.connectionBlock ? parseWindow(config.connectionBlock) : undefined,
    messageLimit: config.messageLimit ?? DEFAULT_LIMIT,
    messageWindowMs: parseWindow(config.messageWindow ?? DEFAULT_WINDOW),
    messageBlockMs: config.messageBlock ? parseWindow(config.messageBlock) : undefined,
    keyPrefix: config.keyPrefix ?? 'shield',
    onBlock: config.onBlock,
  }
}

async function consume(options: {
  config: ResolvedWebSocketLimiterConfig
  publicKey: string
  scopedKey: string
  limit: number
  windowMs: number
  blockMs?: number
}): Promise<RateLimitResult> {
  const { config, publicKey, scopedKey, limit, windowMs, blockMs } = options
  const result = await checkLimit(scopedKey, limit, windowMs, config.algorithm, config.store)

  if (!result.allowed && blockMs && !result.blocked) {
    await config.store.block(scopedKey, blockMs)
    const blockInfo: BlockInfo = {
      reason: 'websocket',
      key: publicKey,
      limit,
      window: windowMs,
      blocked: true,
      blockedUntil: Date.now() + blockMs,
    }
    config.onBlock?.(publicKey, blockInfo)

    return {
      ...result,
      blocked: true,
      retryAfter: Math.ceil(blockMs / 1000),
    }
  }

  if (!result.allowed) {
    config.onBlock?.(publicKey, {
      reason: 'websocket',
      key: publicKey,
      limit,
      window: windowMs,
      blocked: result.blocked,
    })
  }

  return {
    ...result,
    blocked: result.blocked,
  }
}
