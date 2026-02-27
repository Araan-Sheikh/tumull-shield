import { describe, it, expect } from 'vitest'
import { parseWindow, formatMs, getWindowStart } from '../../src/utils/time'

describe('parseWindow', () => {
  it('parses seconds', () => {
    expect(parseWindow('30s')).toBe(30_000)
    expect(parseWindow('1s')).toBe(1_000)
    expect(parseWindow('120s')).toBe(120_000)
  })

  it('parses minutes', () => {
    expect(parseWindow('1m')).toBe(60_000)
    expect(parseWindow('5m')).toBe(300_000)
    expect(parseWindow('30m')).toBe(1_800_000)
  })

  it('parses hours', () => {
    expect(parseWindow('1h')).toBe(3_600_000)
    expect(parseWindow('2h')).toBe(7_200_000)
    expect(parseWindow('24h')).toBe(86_400_000)
  })

  it('parses days', () => {
    expect(parseWindow('1d')).toBe(86_400_000)
    expect(parseWindow('7d')).toBe(604_800_000)
  })

  it('parses ms suffix', () => {
    expect(parseWindow('500ms')).toBe(500)
    expect(parseWindow('1000ms')).toBe(1_000)
  })

  it('passes through numbers', () => {
    expect(parseWindow(60_000)).toBe(60_000)
    expect(parseWindow(1_000)).toBe(1_000)
  })

  it('treats bare number strings as ms', () => {
    expect(parseWindow('60000')).toBe(60_000)
    expect(parseWindow('1000')).toBe(1_000)
  })

  it('handles whitespace', () => {
    expect(parseWindow(' 1m ')).toBe(60_000)
    expect(parseWindow('  5s  ')).toBe(5_000)
  })

  it('is case-insensitive', () => {
    expect(parseWindow('1M')).toBe(60_000)
    expect(parseWindow('1H')).toBe(3_600_000)
    expect(parseWindow('1S')).toBe(1_000)
  })

  it('throws on garbage input', () => {
    expect(() => parseWindow('abc')).toThrow('[shield]')
    expect(() => parseWindow('')).toThrow('[shield]')
    expect(() => parseWindow('1x')).toThrow('[shield]')
  })

  it('throws on zero or negative', () => {
    expect(() => parseWindow(0)).toThrow('[shield]')
    expect(() => parseWindow(-1)).toThrow('[shield]')
    expect(() => parseWindow('0')).toThrow('[shield]')
  })
})

describe('formatMs', () => {
  it('formats sub-second', () => {
    expect(formatMs(500)).toBe('500ms')
  })
  it('formats seconds', () => {
    expect(formatMs(5_000)).toBe('5s')
    expect(formatMs(30_000)).toBe('30s')
  })
  it('formats minutes', () => {
    expect(formatMs(60_000)).toBe('1m')
    expect(formatMs(300_000)).toBe('5m')
  })
  it('formats hours', () => {
    expect(formatMs(3_600_000)).toBe('1h')
  })
  it('formats days', () => {
    expect(formatMs(86_400_000)).toBe('1d')
  })
})

describe('getWindowStart', () => {
  it('aligns to window boundary', () => {
    const windowMs = 60_000
    const now = 1_700_000_030_000
    const start = getWindowStart(windowMs, now)

    expect(start % windowMs).toBe(0)
    expect(start).toBeLessThanOrEqual(now)
    expect(start + windowMs).toBeGreaterThan(now)
  })

  it('two timestamps in same window get same start', () => {
    const windowMs = 60_000
    const base = getWindowStart(windowMs, 1_700_000_000_000)
    const s1 = getWindowStart(windowMs, base + 1)
    const s2 = getWindowStart(windowMs, base + 59_999)

    expect(s1).toBe(base)
    expect(s2).toBe(base)
  })
})
