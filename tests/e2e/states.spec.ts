import { expect, test } from '@playwright/test';

/**
 * Visual baselines for every fixture on /states (docs/BUILD_BRIEF.md step 4).
 * Each fixture is built from a deterministic, seeded SimState (src/states/fixtures.ts)
 * and nothing here is animated or ticking, so these screenshots are expected to be
 * byte-stable across runs — a diff means either a real visual regression or a
 * deliberate change that needs a new approved baseline (`--update-snapshots`).
 *
 * Scoped to each fixture's `.device` frame, not the whole page: the verification
 * page's own headings/descriptions aren't part of the product and shouldn't gate CI.
 */
const FIXTURE_IDS = [
  'calm',
  'recovering',
  'rising',
  'critical',
  'critical-holding',
  'offline',
  'multi-rack',
  'manual-override',
  'outcome-ok',
  'outcome-mixed',
  'outcome-fail',
  'overlay-intro',
  'overlay-lock',
  'overlay-lock-opened',
];

test.describe('/states visual baselines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/states');
    // Web fonts loading after first paint would shift text metrics between
    // runs/environments — wait for Archivo before any screenshot.
    await page.evaluate(() => document.fonts.ready);
  });

  test('renders exactly the fixtures this suite expects', async ({ page }) => {
    const ids = await page.locator('[data-fixture]').evaluateAll((els) => els.map((el) => el.getAttribute('data-fixture')));
    expect(ids).toEqual(FIXTURE_IDS);
  });

  for (const id of FIXTURE_IDS) {
    test(`fixture: ${id}`, async ({ page }) => {
      const device = page.locator(`[data-fixture="${id}"] .device`);
      await expect(device).toHaveScreenshot(`${id}.png`);
    });
  }
});
