/*
 * IP extraction — tries the common proxy headers in order:
 *   1. CF-Connecting-IP  (cloudflare)
 *   2. X-Real-IP         (nginx)
 *   3. X-Forwarded-For   (first entry = real client)
 *   4. fallback to 'unknown'
 */

// for Web API requests (next.js, hono, edge)
export function extractIP(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    firstForwardedFor(req.headers.get('x-forwarded-for')) ??
    'unknown'
  )
}

// for express/node where headers are a plain object
export function extractIPFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback?: string,
): string {
  const cf = headerVal(headers, 'cf-connecting-ip')
  if (cf) return cf

  const real = headerVal(headers, 'x-real-ip')
  if (real) return real

  const fwd = headerVal(headers, 'x-forwarded-for')
  if (fwd) {
    const first = firstForwardedFor(fwd)
    if (first) return first
  }

  return fallback ?? 'unknown'
}

function firstForwardedFor(value: string | null | undefined): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

function headerVal(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

// normalize ::ffff:127.0.0.1 → 127.0.0.1
export function normalizeIP(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

// check if an IP matches any entry in a list (exact match + wildcard)
export function ipMatches(ip: string, patterns: string[]): boolean {
  const norm = normalizeIP(ip)
  for (const p of patterns) {
    const np = normalizeIP(p)
    if (norm === np) return true
    if (np === '*') return true
  }
  return false
}
