import { expect, test, type Page } from '@playwright/test';

/**
 * The live app (docs/BUILD_BRIEF.md step 6), driven for real: the sim loop,
 * lock screen, event gating, hold-to-confirm, outcome sheets and the demo
 * harness. Behavioural assertions only — no screenshots; /states owns the
 * visual baselines.
 *
 * `?readMs=100` runs the sensor feed 15x faster than the demo's 1.5s so an
 * incident plays out in seconds; `?seed=` pins the sim's noise.
 */
const LIVE = '/?seed=7&readMs=100';

/**
 * Records every shockwave firing, with whether the lock screen was in the
 * DOM at that instant. Installed before the app loads, so nothing can fire
 * unobserved. Two independent signals, so neither can hide a firing:
 *  - `animationstart` of the leading ring — what the operator actually
 *    sees (one per firing; the trailing `.b` ring is ignored).
 *  - any class write on a ring at all — catches a firing even where the
 *    animation itself is suppressed (reduced motion zeroes it in CSS).
 */
async function recordShocks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shocks: { lockPresent: boolean }[]; __shockTouched: number };
    w.__shocks = [];
    w.__shockTouched = 0;
    document.addEventListener(
      'animationstart',
      (e) => {
        const el = e.target as HTMLElement;
        if (el.classList.contains('shock') && !el.classList.contains('b')) w.__shocks.push({ lockPresent: !!document.querySelector('.lock') });
      },
      true,
    );
    new MutationObserver((muts) => {
      for (const m of muts) if ((m.target as HTMLElement).classList?.contains('shock')) w.__shockTouched++;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}
const shockTouched = (page: Page) => page.evaluate(() => (window as unknown as { __shockTouched: number }).__shockTouched);
const shocks = (page: Page) => page.evaluate(() => (window as unknown as { __shocks: { lockPresent: boolean }[] }).__shocks);

test.describe('live app', () => {
  test('from the lock screen: the shockwave never fires behind it, then fires on opening', async ({ page }) => {
    await recordShocks(page);
    await page.goto(LIVE);
    await page.getByRole('button', { name: 'Start the incident' }).click();

    const lock = page.locator('.lock');
    await expect(lock).toBeVisible();
    // The notification escalates in place to critical while locked…
    await expect(page.locator('.notif.crit strong')).toHaveText('Critical: rack B-07 above 32°C', { timeout: 15_000 });
    await expect(page.locator('.app')).toHaveAttribute('data-state', 'critical');
    // …and B-07's escalation to critical fired no shock behind the lock.
    expect(await shockTouched(page)).toBe(0);
    expect(await shocks(page)).toEqual([]);

    await page.locator('.notif').click();
    await expect(lock).toHaveCount(0);
    // Opening onto a critical rack fires it once, with the lock gone.
    await expect.poll(() => shocks(page)).toEqual([{ lockPresent: false }]);
    // Focus lands on the action.
    await expect(page.locator('.hold')).toBeFocused();
  });

  test('lock-screen notifications do not render once the app is open', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();
    await expect(page.locator('.app')).toHaveAttribute('data-state', 'critical', { timeout: 15_000 });
    await expect(page.locator('.lock')).toHaveCount(0);
    await expect(page.locator('.notif')).toHaveCount(0);
  });

  test('hold to boost resolves the incident, and CRAC-3 stands down', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByLabel('Second rack fails after the first incident ends').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();

    const hold = page.locator('.hold');
    await expect(hold).toBeVisible({ timeout: 15_000 });
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900); // holdMs is 750
    await page.mouse.up();

    await expect(page.locator('.status')).toContainText('CRAC-3');
    await expect(page.getByRole('dialog')).toContainText('Incident resolved', { timeout: 20_000 });
    await expect(page.locator('.log')).toContainText('CRAC-3 fan boosted to 100% by you');
    await expect(page.locator('.log')).toContainText('CRAC-3 returned to 60%', { timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('keyboard path: two activations confirm, then focus moves to undo', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();
    const hold = page.locator('.hold');
    await expect(hold).toBeVisible({ timeout: 15_000 });
    await hold.focus();
    await page.keyboard.press('Enter');
    await expect(hold).toHaveText('Press again to confirm');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Revert boost' })).toBeFocused();
  });

  test('doing nothing: the rack shuts down, and dispatch is logged once', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Rack B-07 shut down', { timeout: 30_000 });
    await expect(page.locator('.app')).toHaveAttribute('data-state', 'offline');
    await expect(page.locator('.app')).toHaveAttribute('data-outcome', 'fail');
    await sheet.getByRole('button', { name: 'Dispatch on-site tech' }).click();
    await expect(sheet.getByRole('button', { name: 'Tech dispatched, logged' })).toBeDisabled();
    await expect(page.locator('.log')).toContainText('On-site tech dispatched to B-07 by you');
  });

  test('announcements reach the live regions', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();
    await expect(page.locator('[aria-live="assertive"]')).toContainText('Critical. Rack B-07 inlet', { timeout: 15_000 });
  });

  test('panel: reset returns to calm and re-arms the run button', async ({ page }) => {
    await page.goto(LIVE);
    await page.getByRole('button', { name: 'Look around first' }).click();
    await page.getByRole('button', { name: 'Run the incident' }).click();
    await expect(page.getByRole('button', { name: 'Incident running' })).toBeDisabled();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('button', { name: 'Run the incident' })).toBeEnabled();
    await expect(page.locator('.lock')).toHaveCount(0);
    await expect(page.locator('.intro')).toHaveCount(0); // reset doesn't bring the intro back
    await expect(page.locator('.log li')).toHaveText(['Nothing logged yet.']);
  });

  test('panel: fail a second rack queues A-03', async ({ page }) => {
    await page.goto(LIVE);
    const second = page.getByRole('button', { name: 'Fail a second rack' });
    await second.click();
    await expect(second).toBeDisabled();
    await expect(page.locator('.intro')).toHaveCount(0);
    await expect(page.locator('.log')).toContainText('Simulated: fan failure on rack A-03');
  });

  /** Starts the incident and holds to boost B-07 as soon as the hold button appears. */
  async function boostB07(page: Page) {
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();
    const hold = page.locator('.hold');
    await expect(hold).toBeVisible({ timeout: 15_000 });
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900); // holdMs is 750
    await page.mouse.up();
    await expect(page.locator('.log')).toContainText('CRAC-3 fan boosted to 100% by you');
  }

  test('regression: boost B-07, fail a second rack, let A-03 shut down — the boost still ends', async ({ page }) => {
    await page.goto(LIVE);
    await boostB07(page);
    await page.getByRole('button', { name: 'Fail a second rack' }).click();
    await expect(page.getByRole('dialog')).toContainText('Rack A-03 shut down', { timeout: 30_000 });
    await expect(page.locator('.log')).toContainText('CRAC-3 returned to 60%', { timeout: 5_000 });
  });

  test('panel: reset mid-boost leaves no boost and no stand-down behind', async ({ page }) => {
    await page.goto(LIVE);
    await boostB07(page);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.log li')).toHaveText(['Nothing logged yet.']);
    await page.waitForTimeout(1_000); // 10 readings: well past any stand-down that could have been left pending
    await expect(page.locator('.log li')).toHaveText(['Nothing logged yet.']);
    await expect(page.getByText('All 16 racks in range. Nothing needs your attention.')).toBeVisible();
  });
});

test.describe('reduced motion (OS setting only)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the app follows the OS setting, and no shockwave ever fires', async ({ page }) => {
    await recordShocks(page);
    await page.goto(LIVE);
    await expect(page.locator('.app')).toHaveAttribute('data-motion', 'reduced');
    await page.getByLabel('Start from the lock screen').uncheck();
    await page.getByRole('button', { name: 'Start the incident' }).click();
    await expect(page.locator('.app')).toHaveAttribute('data-state', 'critical', { timeout: 15_000 });
    await page.waitForTimeout(500);
    expect(await shockTouched(page)).toBe(0);
    expect(await shocks(page)).toEqual([]);
  });
});

test('there is no in-page motion toggle anywhere in the live app', async ({ page }) => {
  await page.goto(LIVE);
  await expect(page.locator('.app')).toHaveAttribute('data-motion', 'full');
  // Every control on the page, by accessible name: none of them is about motion or animation.
  const names = await page
    .locator('button, input, select, [role="switch"], [role="checkbox"], a')
    .evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? el.closest('label')?.textContent ?? el.textContent ?? '').trim()));
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n).not.toMatch(/motion|animat/i);
});

test.describe('mobile', () => {
  test('the "Demo controls" pill jumps to the panel and hides once the app scrolls away', async ({ page }) => {
    await page.goto(LIVE);
    const pill = page.getByRole('link', { name: 'Demo controls' });
    await expect(pill).toBeVisible();
    await expect(pill).not.toHaveClass(/off/);
    await pill.click();
    await expect(page.locator('#panel')).toBeInViewport();
    await expect(pill).toHaveClass(/off/);
  });
});
