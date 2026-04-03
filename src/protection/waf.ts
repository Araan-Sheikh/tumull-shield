import type { WafRule } from '../core/types.js'

export interface WafResult {
  blocked: boolean
  rule?: WafRule
  reason?: string
}

export function evaluateWaf(request: Request, rules: WafRule[]): WafResult {
  for (const rule of rules) {
    const haystack = extractTargetValue(request, rule)
    if (haystack === null) continue

    const op = rule.operator ?? 'includes'
    let matched = false

    if (op === 'equals') {
      matched = haystack === rule.value
    } else if (op === 'regex') {
      try {
        const re = new RegExp(rule.value, rule.flags)
        matched = re.test(haystack)
      } catch {
        // skip invalid regex rules so one bad rule doesn't break the pipeline
        matched = false
      }
    } else {
      matched = haystack.toLowerCase().includes(rule.value.toLowerCase())
    }

    if (matched) {
      return {
        blocked: true,
        rule,
        reason: rule.message ?? `Blocked by WAF rule${rule.id ? `: ${rule.id}` : ''}`,
      }
    }
  }

  return { blocked: false }
}

function extractTargetValue(request: Request, rule: WafRule): string | null {
  try {
    switch (rule.target) {
      case 'url':
        return request.url
      case 'path': {
        const url = new URL(request.url)
        return url.pathname
      }
      case 'query': {
        const url = new URL(request.url)
        const raw = url.search
        const plusNormalized = raw.replace(/\+/g, ' ')
        try {
          return decodeURIComponent(plusNormalized)
        } catch {
          return plusNormalized
        }
      }
      case 'user-agent':
        return request.headers.get('user-agent') ?? ''
      case 'method':
        return request.method
      case 'header':
        if (!rule.headerName) return null
        return request.headers.get(rule.headerName) ?? ''
      default:
        return null
    }
  } catch {
    return null
  }
}
