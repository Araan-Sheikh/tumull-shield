import { defineConfig } from 'tsup'

export default defineConfig([
  // Main entry
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: 'es2022',
    outDir: 'dist',
    splitting: false,
    treeshake: true,
  },
  // Store adapters (separate entry points)
  {
    entry: {
      'stores/redis': 'src/stores/redis.ts',
      'stores/upstash': 'src/stores/upstash.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    minify: false,
    target: 'es2022',
    outDir: 'dist',
    splitting: false,
    treeshake: true,
    external: ['ioredis', '@upstash/redis'],
  },
])
