/*
 * Route pattern matching.
 *
 * Supports:
 *   "/api/hello"     exact
 *   "/api/*"         single segment wildcard
 *   "/api/**"        catch-all
 *   "/api/:id"       named param (matches one segment)
 *   "/api/:path*"    rest param
 */

export function matchRoute(path: string, pattern: string): boolean {
  if (path === pattern) return true

  const np = normalize(path)
  const npat = normalize(pattern)
  if (np === npat) return true

  return toRegex(npat).test(np)
}

// find the most specific matching route config
export function findMatchingRoute(
  path: string,
  routes: Record<string, unknown>,
): string | null {
  let best: string | null = null
  let bestScore = -1

  for (const pattern of Object.keys(routes)) {
    if (matchRoute(path, pattern)) {
      const score = specificity(pattern)
      if (score > bestScore) {
        best = pattern
        bestScore = score
      }
    }
  }

  return best
}

function toRegex(pattern: string): RegExp {
  let re = '^'
  const segs = pattern.split('/')

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (i > 0) re += '\\/'

    if (seg === '**' || seg === ':path*') {
      re += '.*'
      break // everything after ** is matched
    } else if (seg === '*') {
      re += '[^\\/]+'
    } else if (seg.startsWith(':')) {
      re += '[^\\/]+'
    } else {
      re += escRe(seg)
    }
  }

  re += '$'
  return new RegExp(re)
}

// higher = more specific
function specificity(pattern: string): number {
  let score = 0
  for (const seg of pattern.split('/')) {
    if (seg === '**' || seg === ':path*') score += 1
    else if (seg === '*' || seg.startsWith(':')) score += 5
    else score += 10
  }
  return score
}

function normalize(path: string): string {
  if (path === '/') return '/'
  return path.replace(/\/+$/, '')
}

function escRe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractPathname(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      return new URL(urlOrPath).pathname
    }
    const qi = urlOrPath.indexOf('?')
    if (qi !== -1) return urlOrPath.slice(0, qi)
    return urlOrPath
  } catch {
    return urlOrPath
  }
}
