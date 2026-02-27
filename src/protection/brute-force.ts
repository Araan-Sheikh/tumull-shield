import type { Store, BlockInfo } from '../core/types.js'
import { parseWindow } from '../utils/time.js'
import {
  DEFAULT_FAILURE_STATUS_CODES,
  DEFAULT_MAX_FAILURES,
  DEFAULT_FAILURE_BLOCK_DURATION,
} from '../constants.js'

export interface BruteForceConfig {
  statusCodes?: number[] // what counts as a failure (default: [401, 403])
  maxFailures?: number // how many before we block (default: 5)
  blockDuration?: string // "15m", "1h" etc
}

interface FailureRecord {
  count: number
  firstFailure: number
  lastFailure: number
}

export class BruteForceDetector {
  private failures = new Map<string, FailureRecord>()
  private readonly statusCodes: Set<number>
  private readonly maxFailures: number
  private readonly blockDurationMs: number
  private readonly windowMs: number

  constructor(config: BruteForceConfig = {}, windowMs = 300_000) {
    this.statusCodes = new Set(config.statusCodes ?? DEFAULT_FAILURE_STATUS_CODES)
    this.maxFailures = config.maxFailures ?? DEFAULT_MAX_FAILURES
    this.blockDurationMs = parseWindow(config.blockDuration ?? DEFAULT_FAILURE_BLOCK_DURATION)
    this.windowMs = windowMs
  }

  isFailureStatus(statusCode: number): boolean {
    return this.statusCodes.has(statusCode)
  }

  // track a failure, returns whether we should block now
  recordFailure(key: string): { shouldBlock: boolean; blockInfo?: BlockInfo } {
    const now = Date.now()
    const existing = this.failures.get(key)

    if (!existing || now - existing.firstFailure > this.windowMs) {
      // fresh start
      this.failures.set(key, { count: 1, firstFailure: now, lastFailure: now })
      return { shouldBlock: false }
    }

    existing.count++
    existing.lastFailure = now

    if (existing.count >= this.maxFailures) {
      this.failures.delete(key) // done tracking, they're blocked now

      return {
        shouldBlock: true,
        blockInfo: {
          reason: 'brute-force',
          key,
          limit: this.maxFailures,
          window: this.windowMs,
          blocked: true,
          blockedUntil: now + this.blockDurationMs,
        },
      }
    }

    return { shouldBlock: false }
  }

  // successful login? reset their counter
  recordSuccess(key: string): void {
    this.failures.delete(key)
  }

  async blockInStore(key: string, store: Store): Promise<void> {
    await store.block(key, this.blockDurationMs)
  }

  // exponential backoff: 0, 1s, 2s, 4s, 8s, 16s... capped at 30s
  getProgressiveDelay(key: string): number {
    const record = this.failures.get(key)
    if (!record || record.count <= 1) return 0
    return Math.min(30_000, Math.pow(2, record.count - 2) * 1000)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.failures) {
      if (now - record.firstFailure > this.windowMs) {
        this.failures.delete(key)
      }
    }
  }

  reset(): void {
    this.failures.clear()
  }
}
