// Express App Example

import express from 'express'
import { shieldExpress } from '@tumull/shield'

const app = express()
const port = 3000

// ─── Global Rate Limiting ───────────────────────────────────────────────────

app.use(
  shieldExpress({
    limit: 100,
    window: '1m',
    botDetection: true,
    onBlock: (key, info) => {
      console.warn(`[SHIELD] Blocked ${key}: ${info.reason}`)
    },
  }),
)

// ─── Stricter Limits for Auth Routes ────────────────────────────────────────

app.use(
  '/api/auth',
  shieldExpress({
    limit: 5,
    window: '5m',
    block: '30m',
  }),
)

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/hello', (_req, res) => {
  res.json({
    message: 'Hello from Express!',
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/auth/login', (req, res) => {
  // Simulate login
  res.json({ message: 'Login endpoint' })
})

app.get('/api/users/:id', (req, res) => {
  res.json({
    user: { id: req.params.id, name: 'John Doe' },
  })
})

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`🛡️ Express server with Shield running on http://localhost:${port}`)
})
