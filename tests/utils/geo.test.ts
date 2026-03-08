/// <reference types="vitest" />
import { lookupCountry, cachedLookupCountry } from '../../src/utils/geo'

describe('geo lookup', () => {
  it('resolves known IPs to countries', () => {
    // google DNS should be in the US
    expect(lookupCountry('8.8.8.8')).toBe('US')
    // another Google DNS, same country
    expect(lookupCountry('8.8.4.4')).toBe('US')
  })

  it('returns null for invalid or private IPs', () => {
    expect(lookupCountry('127.0.0.1')).toBeNull()
    expect(lookupCountry('not-an-ip')).toBeNull()
  })

  it('caches results', () => {
    const a = cachedLookupCountry('8.8.8.8')
    const b = cachedLookupCountry('8.8.8.8')
    expect(a).toBe('US')
    expect(b).toBe('US')
  })
})
