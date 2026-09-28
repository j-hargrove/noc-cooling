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
  // Baselines are generated in one Linux sandbox and compared in CI's own
  // Linux runner; a small tolerance absorbs anti-aliasing/font-hinting noise
  // between the two without masking a real visual regression (color, layout,
  // and missing-content diffs all move far more than 1% of pixels).
  expect: {
    toHaveScreenshot: { maxDiffPixels: 40 },
  },
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
