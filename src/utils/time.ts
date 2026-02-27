/*
 * Parse human-friendly time strings into milliseconds.
 *   "30s"  → 30000
 *   "1m"   → 60000
 *   "2h"   → 7200000
 *   "1d"   → 86400000
 *   500    → 500 (passthrough)
 */

const UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  min: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  d: 86_400_000,
}

const TIME_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|h|hr|d)$/i

export function parseWindow(window: string | number): number {
  if (typeof window === 'number') {
    if (window <= 0) throw new Error(`[shield] Invalid window: must be positive, got ${window}`)
    return Math.floor(window)
  }

  const trimmed = window.trim()

  // bare number → treat as ms
  if (/^\d+$/.test(trimmed)) {
    const ms = parseInt(trimmed, 10)
    if (ms <= 0) throw new Error(`[shield] Invalid window: must be positive, got "${window}"`)
    return ms
  }

  const match = trimmed.match(TIME_RE)
  if (!match) {
    throw new Error(`[shield] Invalid time format: "${window}". Use "30s", "1m", "5m", "1h", "1d"`)
  }

  const val = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  const mult = UNITS[unit]

  if (!mult) throw new Error(`[shield] Unknown time unit: "${unit}"`)

  const ms = Math.floor(val * mult)
  if (ms <= 0) throw new Error(`[shield] Window must resolve to positive duration, got ${ms}ms`)

  return ms
}

export function formatMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`
  return `${Math.round(ms / 86_400_000)}d`
}

// snap to the start of the current fixed window
export function getWindowStart(windowMs: number, now: number = Date.now()): number {
  return Math.floor(now / windowMs) * windowMs
}
