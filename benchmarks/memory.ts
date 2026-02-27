/**
 * Memory usage benchmark — measures memory footprint under load.
 *
 * Run: npx tsx benchmarks/memory.ts
 */

import { MemoryStore } from '../src/stores/memory'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

async function benchmark() {
  console.log('🛡️ TUMULL.SHIELD — Memory Benchmark\n')

  const baseMemory = process.memoryUsage()
  const store = new MemoryStore({ maxSize: 100_000 })
  const windowMs = 60_000

  const checkpoints = [100, 1_000, 5_000, 10_000, 50_000, 100_000]
  let lastCheckpoint = 0

  for (const checkpoint of checkpoints) {
    for (let i = lastCheckpoint; i < checkpoint; i++) {
      await store.incrementSlidingWindow(`key-${i}`, windowMs)
    }
    lastCheckpoint = checkpoint

    const memory = process.memoryUsage()
    const heapDiff = memory.heapUsed - baseMemory.heapUsed

    console.log(
      `  ${checkpoint.toLocaleString().padStart(7)} keys  → ` +
        `Heap: ${formatBytes(memory.heapUsed).padStart(8)}  ` +
        `(+${formatBytes(heapDiff).padStart(8)})  ` +
        `Store size: ${store.size}`,
    )
  }

  await store.close()
  console.log('\n✅ Memory benchmark complete')
}

benchmark().catch(console.error)
