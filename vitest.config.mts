import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The pure game core only. Anything needing a DOM belongs in Playwright,
    // which already runs the real browser this app ships to.
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    // Mirrors the `@/*` path in tsconfig.json, which `lib/room` imports through.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
