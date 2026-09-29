import { expect, test, type Page } from '@playwright/test';

/**
 * Launch polish: the phone must show the app ground from the first frame,
 * not white — before any stylesheet or script arrives. Tested with every
 * .css/.js request blocked, the worst case of a slow launch.
 */
const GROUND = 'rgb(10, 24, 34)'; // color.app.ground #0A1822

async function blockCssAndJs(page: Page) {
  await page.route(/\.(css|js)(\?|$)/, (route) => route.abort());
  // Fonts too: irrelevant to the ground, and keeps the page from waiting on the network.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
}
const rootBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test('the manifest parses cleanly in Chromium, with the app ground as its background', async ({ page }) => {
  await page.goto('/');
  const cdp = await page.context().newCDPSession(page);
  const { errors, parsed } = (await cdp.send('Page.getAppManifest')) as { errors: { message: string }[]; parsed?: unknown };
  expect(errors).toEqual([]);
  const manifest = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  expect(manifest.background_color).toBe('#0A1822');
  expect(parsed ?? manifest).toBeTruthy();
});

test('every icon and launch image the page references is served', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('link[rel="apple-touch-icon"], link[rel="icon"], link[rel="apple-touch-startup-image"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(20);
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'], href).toContain('image/png');
  }
});

test.describe('no white flash on a phone', () => {
  test('with all CSS and JS blocked, the page is already the app ground', async ({ page }) => {
    await blockCssAndJs(page);
    await page.goto('/');
    expect(await rootBackground(page)).toBe(GROUND);
  });

  test('and once the app loads, the top of the screen is the dark app, not the page ground', async ({ page }) => {
    await page.goto('/');
    await page.locator('.app').waitFor();
    const px = await page.evaluate(() => getComputedStyle(document.querySelector('.app')!).backgroundColor);
    expect(px).toBe(GROUND);
  });
});

test.describe('desktop keeps its light page ground', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('the pre-CSS dark ground applies to phone widths only', async ({ page }) => {
    await blockCssAndJs(page);
    await page.goto('/');
    expect(await rootBackground(page)).not.toBe(GROUND);
  });
});

test('a narrow embed never flashes dark on its host, even before CSS/JS', async ({ page }) => {
  await blockCssAndJs(page);
  await page.goto('/?embed=1');
  expect(await page.evaluate(() => document.documentElement.classList.contains('embed'))).toBe(true);
  expect(await rootBackground(page)).toBe('rgba(0, 0, 0, 0)');
});
