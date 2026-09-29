import { defineConfig, devices } from '@playwright/test'

// The verification page is /states at 390x844 — the device size the
// prototype is designed against.
export default defineConfig({
  testDir: 'tests/e2e',
  snapshotDir: 'tests/e2e/__screenshots__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
  },
  // No global toHaveScreenshot tolerance: /states baselines are compared by
  // tests/e2e/visual.ts — pixel-exact everywhere except the canvas field, which
  // gets a small per-pixel tolerance for its measured run-to-run noise. The old
  // global tolerance (threshold 0.2 + 40px) passed real colour and text changes.
  // Baselines are generated and checked on CI's runner (update-screenshots job).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
