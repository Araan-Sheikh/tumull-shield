/**
 * Accuracy benchmark — validates rate limiting precision.
 *
 * Run: npx tsx benchmarks/accuracy.ts
 */

import { checkLimit } from '../src/core/rate-limiter'
import { MemoryStore } from '../src/stores/memory'

async function benchmark() {
  console.log('🛡️ TUMULL.SHIELD — Accuracy Benchmark\n')

  const algorithms = ['sliding-window', 'fixed-window', 'token-bucket'] as const
  const limit = 10
  const windowMs = 1_000 // 1 second

  for (const algorithm of algorithms) {
    const store = new MemoryStore()
    let allowed = 0
    let blocked = 0

    // Send exactly `limit` requests — all should be allowed
    for (let i = 0; i < limit; i++) {
      const result = await checkLimit('test-key', limit, windowMs, algorithm, store)
      if (result.allowed) allowed++
      else blocked++
    }

    // Send one more — should be blocked
    const overLimit = await checkLimit('test-key', limit, windowMs, algorithm, store)

    console.log(`  ${algorithm.padEnd(16)}:`)
    console.log(`    Allowed: ${allowed}/${limit} (expected: ${limit})`)
    console.log(`    Blocked after limit: ${!overLimit.allowed} (expected: true)`)
    console.log(`    Accuracy: ${allowed === limit && !overLimit.allowed ? '✅ PASS' : '❌ FAIL'}`)
    console.log()

    await store.close()
  }

  // ── Window Reset Test ───────────────────────────────────────────────────

  console.log('  Window reset test (2s window):')
  const store = new MemoryStore()
  const resetLimit = 5
  const resetWindowMs = 2_000

  // Exhaust limit
  for (let i = 0; i < resetLimit; i++) {
    await checkLimit('reset-key', resetLimit, resetWindowMs, 'fixed-window', store)
  }

  const beforeReset = await checkLimit(
    'reset-key',
    resetLimit,
    resetWindowMs,
    'fixed-window',
    store,
  )
  console.log(`    Before reset: blocked = ${!beforeReset.allowed} (expected: true)`)

  // Wait for window to reset
  await new Promise((r) => setTimeout(r, resetWindowMs + 100))

  const afterReset = await checkLimit('reset-key', resetLimit, resetWindowMs, 'fixed-window', store)
  console.log(`    After reset:  allowed = ${afterReset.allowed} (expected: true)`)
  console.log(`    ${!beforeReset.allowed && afterReset.allowed ? '✅ PASS' : '❌ FAIL'}`)

  await store.close()
  console.log('\n✅ Accuracy benchmark complete')
}

benchmark().catch(console.error)
