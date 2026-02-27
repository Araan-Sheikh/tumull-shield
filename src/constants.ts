// defaults
export const DEFAULT_LIMIT = 100
export const DEFAULT_WINDOW = '1m'
export const DEFAULT_ALGORITHM = 'sliding-window' as const
export const DEFAULT_HEADERS = true
export const DEFAULT_BOT_DETECTION = false
export const DEFAULT_MAX_STORE_SIZE = 10_000
export const STORE_CLEANUP_INTERVAL = 60_000 // 1 min

// 429 response
export const DEFAULT_RATE_LIMIT_RESPONSE = {
  error: 'Too Many Requests',
  message: 'Rate limit exceeded. Please try again later.',
}

// brute force
export const DEFAULT_FAILURE_STATUS_CODES = [401, 403]
export const DEFAULT_MAX_FAILURES = 5
export const DEFAULT_FAILURE_BLOCK_DURATION = '15m'

// user-agent patterns we flag as bots
export const KNOWN_BOT_PATTERNS: string[] = [
  // scrapers & crawlers
  'scrapy',
  'crawler',
  'spider',
  'bot',
  // cli tools
  'curl',
  'wget',
  'httpie',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'java/',
  'libwww',
  'lwp-',
  'apache-httpclient',
  // seo bots (can be allowlisted if you want them)
  'ahrefsbot',
  'semrushbot',
  'dotbot',
  'mj12bot',
  'rogerbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  // headless browsers
  'headlesschrome',
  'phantomjs',
  'slimerjs',
  // api tools
  'postman',
  'insomnia',
]

// headers real browsers always include
export const EXPECTED_BROWSER_HEADERS = ['accept', 'accept-language', 'accept-encoding']

// rate limit header names (following the draft spec)
export const HEADER_RATE_LIMIT = 'X-RateLimit-Limit'
export const HEADER_RATE_REMAINING = 'X-RateLimit-Remaining'
export const HEADER_RATE_RESET = 'X-RateLimit-Reset'
export const HEADER_RETRY_AFTER = 'Retry-After'
