/**
 * Throughput benchmark — measures requests/second under load.
 *
 * Run: npx tsx benchmarks/throughput.ts
 */

import { checkLimit, resolveConfig } from '../src/core/rate-limiter'
import { MemoryStore } from '../src/stores/memory'

async function benchmark() {
  console.log('🛡️ TUMULL.SHIELD — Throughput Benchmark\n')

  const store = new MemoryStore()
  const iterations = 100_000
  const algorithms = ['sliding-window', 'fixed-window', 'token-bucket'] as const

  for (const algorithm of algorithms) {
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      // Simulate requests from different IPs
      const key = `ip-${i % 1000}`
      await checkLimit(key, 1000, 60_000, algorithm, store)
    }

    const elapsed = performance.now() - start
    const rps = Math.floor(iterations / (elapsed / 1000))

    console.log(
      `  ${algorithm.padEnd(16)} ${rps.toLocaleString().padStart(10)} req/s  (${elapsed.toFixed(1)}ms for ${iterations.toLocaleString()} ops)`,
    )
  }

  console.log()

  // Process request benchmark
  const config = resolveConfig({
    limit: 100,
    window: '1m',
    store,
    routes: {
      '/api/auth/*': { limit: 5, window: '5m' },
      '/api/public/*': { limit: 500, window: '1m' },
    },
  })

  const { processRequest } = await import('../src/core/rate-limiter')

  const paths = ['/api/test', '/api/auth/login', '/api/public/data']
  const processIterations = 50_000

  console.log('  Full processRequest pipeline:')

  for (const path of paths) {
    const start = performance.now()

    for (let i = 0; i < processIterations; i++) {
      const request = new Request(`http://localhost${path}`, {
        headers: { 'x-forwarded-for': `10.0.${i % 256}.${i % 256}` },
      })
      await processRequest({ request, config })
    }

    const elapsed = performance.now() - start
    const rps = Math.floor(processIterations / (elapsed / 1000))

    console.log(
      `    ${path.padEnd(20)} ${rps.toLocaleString().padStart(10)} req/s`,
    )
  }

  await store.close()
  console.log('\n✅ Benchmark complete')
}

benchmark().catch(console.error)
