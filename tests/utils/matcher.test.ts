import { describe, it, expect } from 'vitest'
import { matchRoute, findMatchingRoute, extractPathname } from '../../src/utils/matcher'

describe('matchRoute', () => {
  it('exact paths', () => {
    expect(matchRoute('/api/hello', '/api/hello')).toBe(true)
    expect(matchRoute('/api/hello', '/api/world')).toBe(false)
  })

  it('trailing slash normalization', () => {
    expect(matchRoute('/api/hello/', '/api/hello')).toBe(true)
    expect(matchRoute('/api/hello', '/api/hello/')).toBe(true)
  })

  it('single wildcard', () => {
    expect(matchRoute('/api/hello', '/api/*')).toBe(true)
    expect(matchRoute('/api/world', '/api/*')).toBe(true)
    expect(matchRoute('/api/hello/world', '/api/*')).toBe(false) // * = one segment only
  })

  it('glob star **', () => {
    expect(matchRoute('/api/hello', '/api/**')).toBe(true)
    expect(matchRoute('/api/hello/world', '/api/**')).toBe(true)
    expect(matchRoute('/api/a/b/c', '/api/**')).toBe(true)
  })

  it('named params', () => {
    expect(matchRoute('/api/users/123', '/api/users/:id')).toBe(true)
    expect(matchRoute('/api/users/abc', '/api/users/:id')).toBe(true)
  })

  it(':path* pattern', () => {
    expect(matchRoute('/api/hello', '/api/:path*')).toBe(true)
    expect(matchRoute('/api/hello/world', '/api/:path*')).toBe(true)
  })

  it('no false positives', () => {
    expect(matchRoute('/other/hello', '/api/*')).toBe(false)
    expect(matchRoute('/', '/api/*')).toBe(false)
  })
})

describe('findMatchingRoute', () => {
  const routes = {
    '/api/auth/login': { limit: 5 },
    '/api/auth/*': { limit: 10 },
    '/api/**': { limit: 100 },
    '/api/public/*': { skip: true },
  }

  it('prefers exact match', () => {
    expect(findMatchingRoute('/api/auth/login', routes)).toBe('/api/auth/login')
  })

  it('falls back to wildcard', () => {
    expect(findMatchingRoute('/api/public/data', routes)).toBe('/api/public/*')
  })

  it('falls back to glob', () => {
    expect(findMatchingRoute('/api/other/deep/path', routes)).toBe('/api/**')
  })

  it('returns null on no match', () => {
    expect(findMatchingRoute('/other/path', routes)).toBe(null)
  })
})

describe('extractPathname', () => {
  it('from full URL', () => {
    expect(extractPathname('https://example.com/api/hello')).toBe('/api/hello')
  })

  it('strips query string', () => {
    expect(extractPathname('/api/hello?foo=bar')).toBe('/api/hello')
  })

  it('plain path', () => {
    expect(extractPathname('/api/hello')).toBe('/api/hello')
  })
})
