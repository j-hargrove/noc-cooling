import { defineConfig } from 'vitest/config'

// src/sim and src/compose are pure TS and run in node.
// src/ui tests opt into jsdom with a per-file // @vitest-environment jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
})
