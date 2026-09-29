import { expect, test, type Page } from '@playwright/test';
import { comparePngs, expectMatchesBaseline, FIELD_TOLERANCE, fieldRectWithin } from './visual';

/**
 * Visual baselines for every fixture on /states (docs/BUILD_BRIEF.md step 4),
 * compared region by region (tests/e2e/visual.ts): pixel-exact everywhere
 * except the canvas field, which may flicker by up to FIELD_TOLERANCE levels.
 * Each fixture is built from a deterministic, seeded SimState (src/states/fixtures.ts).
 *
 * The thermal field (src/field) is a genuine live canvas (step 5): a
 * continuous rAF loop, plume noise from Math.random(), and time-based
 * streamline dash animation. Freezing it is the test's job, not the app's
 * (the app should look like reference/prototype.html, noise and all). Two
 * mocks, installed before the page loads:
 *  - Math.random() is replaced with a fixed-seed LCG, so plume texture is
 *    identical every run (it's consumed synchronously during the field's
 *    initial 400-step settle, before either mock below would matter).
 *  - page.clock freezes time at 0, so requestAnimationFrame callbacks never
 *    fire again after the initial mount (the field settles once and stays
 *    on that frame) and the streamline dash offset (a function of
 *    performance.now()) is pinned to a fixed position.
 * Even so the canvas isn't pixel-identical run to run on the CI runner
 * (measured ≤17/255 per channel) — hence the field's tolerance, and only there.
 *
 * Baselines are CI-runner pixels (the update-screenshots workflow job); a
 * local machine renders text a little differently, so run this suite in CI.
 * Scoped to each fixture's `.device` frame: the page's own headings aren't product.
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

async function openStates(page: Page) {
  // page.clock FIRST: it installs its own performance.now() patch, and our
  // override below must be registered after it to win. Init scripts run in
  // registration order on each navigation, so this order is load-bearing.
  await page.clock.install({ time: 0 });
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    // The streamline dash offset is a direct function of performance.now().
    performance.now = () => 0;
  });
  await page.goto('/states');
  // Web fonts loading after first paint would shift text metrics — wait for Archivo.
  await page.evaluate(() => document.fonts.ready);
}

test.describe('/states visual baselines', () => {
  test.beforeEach(async ({ page }) => openStates(page));

  test('renders exactly the fixtures this suite expects', async ({ page }) => {
    const ids = await page.locator('[data-fixture]').evaluateAll((els) => els.map((el) => el.getAttribute('data-fixture')));
    expect(ids).toEqual(FIXTURE_IDS);
  });

  for (const id of FIXTURE_IDS) {
    test(`fixture: ${id}`, async ({ page }, testInfo) => {
      await expectMatchesBaseline(page, page.locator(`[data-fixture="${id}"] .device`), `${id}.png`, testInfo);
    });
  }
});

/**
 * The comparator itself, proven on this machine: each case screenshots a
 * fixture untouched, then again with one deliberate change injected as CSS
 * (reverted by reloading — nothing in src/ is touched), and checks the
 * verdict. Compared against the fresh untouched shot, not the CI baseline,
 * so it holds on any machine.
 */
test.describe('visual comparator catches what the old tolerance let through', () => {
  test.beforeEach(async ({ page }) => openStates(page));

  async function verdict(page: Page, id: string, css: string) {
    const device = page.locator(`[data-fixture="${id}"] .device`);
    const field = await fieldRectWithin(device);
    // Colour changes run the app's own CSS transitions (up to 0.65s + 0.1s delay,
    // on the real document timeline — page.clock doesn't freeze those), so let
    // each change settle before shooting it.
    const settle = () => page.waitForTimeout(1000);
    await settle(); // the untouched shot too: first paint can still be settling (sparkline head edge)
    const before = await device.screenshot({ animations: 'disabled', caret: 'hide' });
    await page.addStyleTag({ content: css });
    await settle();
    const after = await device.screenshot({ animations: 'disabled', caret: 'hide' });
    // Revert = a fresh render. (Removing the style in place leaves Chrome's
    // re-rasterised anti-aliasing on the sparkline head a few levels off — paint
    // history, not a real difference — so reload, which replays the same seeded,
    // frozen setup the baseline tests render under.)
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await settle();
    const reverted = await device.screenshot({ animations: 'disabled', caret: 'hide' });
    return { changed: await comparePngs(page, before, after, field), reverted: await comparePngs(page, before, reverted, field) };
  }

  test('a one-level colour change outside the field fails', async ({ page }) => {
    // steel #8FA4B2 -> #90A4B2 on the aisle label: 1/255 on one channel.
    const { changed, reverted } = await verdict(page, 'calm', `[data-fixture="calm"] .aisle { color: #90A4B2 !important; }`);
    expect(changed.outsideDiff).toBeGreaterThan(0);
    expect(changed.outsideMaxDelta).toBe(1);
    expect(reverted.outsideDiff + reverted.insideOver).toBe(0);
  });

  test('reintroducing the step-8 offline bug (steel -> calm cyan) fails', async ({ page }) => {
    const { changed, reverted } = await verdict(page, 'offline', `[data-fixture="offline"] .app { --sc: var(--ok) !important; }`);
    expect(changed.outsideDiff).toBeGreaterThan(100);
    expect(reverted.outsideDiff + reverted.insideOver).toBe(0);
  });

  test('sub-noise flicker inside the field passes', async ({ page }) => {
    // brightness(1.03) moves field pixels by a few levels — the scale of the runner's own noise.
    const { changed } = await verdict(page, 'calm', `[data-fixture="calm"] .field canvas { filter: brightness(1.03) !important; }`);
    expect(changed.insideMaxDelta).toBeGreaterThan(0);
    expect(changed.insideMaxDelta).toBeLessThanOrEqual(FIELD_TOLERANCE);
    expect(changed.insideOver).toBe(0);
    expect(changed.outsideDiff).toBe(0);
  });

  test('a real change inside the field still fails — tolerant, not masked', async ({ page }) => {
    const { changed } = await verdict(page, 'calm', `[data-fixture="calm"] .field canvas { filter: brightness(1.3) !important; }`);
    expect(changed.insideOver).toBeGreaterThan(0);
  });
});
