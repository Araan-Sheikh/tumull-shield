// Fastify App Example

import Fastify from 'fastify'
import { shieldFastify } from '@tumull/shield'

const app = Fastify({ logger: true })

// ─── Register Shield Plugin ────────────────────────────────────────────────

app.register(shieldFastify, {
  limit: 100,
  window: '1m',
  botDetection: true,
  routes: {
    '/api/auth/*': {
      limit: 5,
      window: '5m',
      block: '30m',
    },
  },
  onBlock: (key, info) => {
    app.log.warn(`[SHIELD] Blocked ${key}: ${info.reason}`)
  },
})

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/hello', async () => {
  return {
    message: 'Hello from Fastify!',
    timestamp: new Date().toISOString(),
  }
})

app.post('/api/auth/login', async () => {
  return { message: 'Login endpoint' }
})

// ─── Start Server ───────────────────────────────────────────────────────────

const start = async () => {
  try {
    await app.listen({ port: 3000 })
    console.log('🛡️ Fastify server with Shield running on http://localhost:3000')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
