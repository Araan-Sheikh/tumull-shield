import { describe, it, expect } from 'vitest'
import { extractIP, extractIPFromHeaders, normalizeIP, ipMatches } from '../../src/utils/ip'

describe('extractIP', () => {
  it('gets CF-Connecting-IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    })
    expect(extractIP(req)).toBe('1.2.3.4')
  })

  it('gets X-Real-IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '5.6.7.8' },
    })
    expect(extractIP(req)).toBe('5.6.7.8')
  })

  it('gets first IP from X-Forwarded-For', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    })
    expect(extractIP(req)).toBe('1.2.3.4')
  })

  it('prefers CF header', () => {
    const req = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'x-forwarded-for': '3.3.3.3',
      },
    })
    expect(extractIP(req)).toBe('1.1.1.1')
  })

  it('falls back to unknown', () => {
    const req = new Request('http://localhost')
    expect(extractIP(req)).toBe('unknown')
  })
})

describe('extractIPFromHeaders', () => {
  it('works with express-style headers', () => {
    expect(extractIPFromHeaders({ 'x-real-ip': '1.2.3.4' })).toBe('1.2.3.4')
  })

  it('uses fallback', () => {
    expect(extractIPFromHeaders({}, '127.0.0.1')).toBe('127.0.0.1')
  })

  it('returns unknown when nothing', () => {
    expect(extractIPFromHeaders({})).toBe('unknown')
  })

  it('handles array values', () => {
    expect(extractIPFromHeaders({ 'x-real-ip': ['1.2.3.4', '5.6.7.8'] })).toBe('1.2.3.4')
  })
})

describe('normalizeIP', () => {
  it('strips ipv6-mapped prefix', () => {
    expect(normalizeIP('::ffff:127.0.0.1')).toBe('127.0.0.1')
  })

  it('leaves normal IPs alone', () => {
    expect(normalizeIP('1.2.3.4')).toBe('1.2.3.4')
    expect(normalizeIP('::1')).toBe('::1')
  })
})

describe('ipMatches', () => {
  it('exact match', () => {
    expect(ipMatches('1.2.3.4', ['1.2.3.4'])).toBe(true)
    expect(ipMatches('1.2.3.4', ['5.6.7.8'])).toBe(false)
  })

  it('wildcard', () => {
    expect(ipMatches('1.2.3.4', ['*'])).toBe(true)
  })

  it('normalizes ipv6-mapped ipv4', () => {
    expect(ipMatches('::ffff:127.0.0.1', ['127.0.0.1'])).toBe(true)
  })

  it('searches through the list', () => {
    expect(ipMatches('1.2.3.4', ['5.5.5.5', '1.2.3.4', '9.9.9.9'])).toBe(true)
  })
})
