import geoip from 'geoip-lite'

// return the 2‑letter country code for an IP address, or null if unknown
export function lookupCountry(ip: string): string | null {
  try {
    const info = geoip.lookup(ip)
    if (info && info.country) return info.country
  } catch {
    // geoip-lite sometimes throws on malformed input
  }
  return null
}

// simple LRU cache wrapper so we don't call lookup every time
const cache = new Map<string, string | null>()

export function cachedLookupCountry(ip: string): string | null {
  if (cache.has(ip)) return cache.get(ip) ?? null
  const country = lookupCountry(ip)
  cache.set(ip, country)
  // keep cache small
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value as string | undefined
    if (firstKey) cache.delete(firstKey)
  }
  return country
}
