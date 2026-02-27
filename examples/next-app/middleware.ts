// Next.js Middleware Example
// File: middleware.ts (at the root of your Next.js project)

import { shield } from '@tumull/shield'

export default shield({
  // Global rate limit
  limit: 100,
  window: '1m',

  // Per-route configuration
  routes: {
    '/api/auth/login': {
      limit: 5,
      window: '5m',
      block: '30m',
    },
    '/api/auth/register': {
      limit: 3,
      window: '1h',
    },
    '/api/public/*': {
      limit: 500,
      window: '1m',
    },
    '/api/webhook/*': {
      skip: true, // No rate limiting
    },
  },

  // Enable bot detection
  botDetection: true,

  // Logging
  onBlock: (key, info) => {
    console.warn(`[SHIELD] Blocked ${key}: ${info.reason}`)
  },
})

export const config = {
  matcher: '/api/:path*',
}
