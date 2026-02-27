import { KNOWN_BOT_PATTERNS, EXPECTED_BROWSER_HEADERS } from '../constants.js'

export interface BotDetectionResult {
  isBot: boolean
  reason?: string
  confidence: number // 0-1
}

export interface BotDetectionConfig {
  blockPatterns?: string[]
  allowPatterns?: string[]
  flagEmptyUA?: boolean // default true
  checkHeaders?: boolean // default true
}

// check if a request looks like it's from a bot
export function detectBot(
  request: Request,
  config: BotDetectionConfig = {},
): BotDetectionResult {
  const ua = request.headers.get('user-agent') ?? ''
  const flagEmptyUA = config.flagEmptyUA ?? true
  const checkHeaders = config.checkHeaders ?? true

  // no user-agent is pretty sus
  if (flagEmptyUA && !ua.trim()) {
    return { isBot: true, reason: 'Empty or missing User-Agent header', confidence: 0.7 }
  }

  const uaLower = ua.toLowerCase()

  // explicit allow list takes priority
  if (config.allowPatterns) {
    for (const pattern of config.allowPatterns) {
      if (uaLower.includes(pattern.toLowerCase())) {
        return { isBot: false, confidence: 0 }
      }
    }
  }

  // check against known bot signatures
  const patterns = [...KNOWN_BOT_PATTERNS, ...(config.blockPatterns ?? [])]
  for (const pattern of patterns) {
    if (uaLower.includes(pattern.toLowerCase())) {
      return {
        isBot: true,
        reason: `User-Agent matches bot pattern: "${pattern}"`,
        confidence: 0.9,
      }
    }
  }

  // real browsers send certain headers that scripts usually don't
  if (checkHeaders) {
    const headerResult = checkBrowserHeaders(request)
    if (headerResult.isBot) return headerResult
  }

  return { isBot: false, confidence: 0 }
}

function checkBrowserHeaders(request: Request): BotDetectionResult {
  const missing: string[] = []
  for (const h of EXPECTED_BROWSER_HEADERS) {
    if (!request.headers.get(h)) missing.push(h)
  }

  // if literally ALL expected headers are missing, probably not a browser
  if (missing.length === EXPECTED_BROWSER_HEADERS.length) {
    return {
      isBot: true,
      reason: `Missing all expected browser headers: ${missing.join(', ')}`,
      confidence: 0.6,
    }
  }

  return { isBot: false, confidence: 0 }
}

// quick helper for checking a single UA string
export function isKnownBot(userAgent: string, extra: string[] = []): boolean {
  const lower = userAgent.toLowerCase()
  const all = [...KNOWN_BOT_PATTERNS, ...extra]
  return all.some((p) => lower.includes(p.toLowerCase()))
}
