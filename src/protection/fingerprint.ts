/*
 * Request fingerprinting — combine a few stable request attributes
 * to identify clients more reliably than IP alone (useful for mobile
 * users who hop between cell towers).
 *
 * Not cryptographic, just good enough for rate limit bucketing.
 */

export function generateFingerprint(request: Request): string {
  const parts: string[] = []

  const ua = request.headers.get('user-agent')
  if (ua) parts.push(ua)

  const lang = request.headers.get('accept-language')
  if (lang) parts.push(lang)

  const enc = request.headers.get('accept-encoding')
  if (enc) parts.push(enc)

  const accept = request.headers.get('accept')
  if (accept) parts.push(accept)

  if (parts.length === 0) return 'unknown'

  return djb2(parts.join('|'))
}

// djb2 hash — fast and simple, not for security
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff
  }
  return (hash >>> 0).toString(36)
}

export function createCompositeKey(ip: string, fingerprint: string): string {
  return `${ip}:${fingerprint}`
}
