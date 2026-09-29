import { expect, test } from '@playwright/test';

/**
 * Visual baselines for every fixture on /states (docs/BUILD_BRIEF.md step 4).
 * Each fixture is built from a deterministic, seeded SimState (src/states/fixtures.ts).
 *
 * The thermal field (src/field) is a genuine live canvas now (step 5): a
 * continuous rAF loop, plume noise from Math.random(), and time-based
 * streamline dash animation. None of that is reproducible screenshot to
 * screenshot on its own — freezing it is the test's job, not the app's
 * (the app should look like reference/prototype.html, noise and all). Two
 * mocks, installed before the page loads:
 *  - Math.random() is replaced with a fixed-seed LCG, so plume texture is
 *    identical every run (it's consumed synchronously during the field's
 *    initial 400-step settle, before either mock below would matter).
 *  - page.clock freezes time at 0, so requestAnimationFrame callbacks never
 *    fire again after the initial mount (the field settles once and stays
 *    on that frame) and the streamline dash offset (a function of
 *    performance.now()) is pinned to a fixed position.
 * A diff past that setup means either a real visual regression or a
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
  'critical-boosted',
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
    // page.clock FIRST: it installs its own performance.now() patch (based
    // on real elapsed wall-clock time, confirmed by direct measurement — it
    // does NOT freeze at 0 the way Date/setTimeout do), and our override
    // below must be registered after it to win. Init scripts run in
    // registration order on each navigation, so this order is load-bearing.
    await page.clock.install({ time: 0 });
    await page.addInitScript(() => {
      let seed = 42;
      Math.random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      // The streamline dash offset is a direct function of performance.now();
      // boosted streamlines amplify any drift in it by ~90x, idle ones by
      // ~28x — which is why only the boosted fixture visibly showed it.
      performance.now = () => 0;
    });
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
