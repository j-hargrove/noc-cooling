import { expect, test, type Page } from '@playwright/test';

/**
 * Embed mode (docs/BUILD_BRIEF.md step 7), tested the way a case-study page
 * uses it: a host document with an <iframe>, not the bare ?embed=1 URL.
 * The host paints a loud magenta ground so any pixel of it showing through
 * the frame proves the embed is transparent.
 */
const HOST_BG = '#ff00ff';

async function host(
  page: Page,
  { width, height, query = 'embed=1&seed=7&readMs=100', hostStyle = `background:${HOST_BG}` }: { width: number; height: number; query?: string; hostStyle?: string },
) {
  await page.setViewportSize({ width: width + 80, height: height + 80 });
  const src = new URL(`/?${query}`, test.info().project.use.baseURL).toString();
  await page.setContent(
    `<!doctype html><body style="margin:0;${hostStyle}">
       <iframe id="f" src="${src}" title="Cooling alert demo" style="display:block;margin:40px;border:0;width:${width}px;height:${height}px"></iframe>
     </body>`,
  );
  const frame = page.frameLocator('#f');
  await frame.locator('.app').first().waitFor();
  await page.frames()[1].evaluate(() => document.fonts.ready);
  return frame;
}

/** Reads one pixel of a page screenshot (page-relative CSS px), by decoding the PNG in the page itself. */
async function pixel(page: Page, x: number, y: number): Promise<string> {
  const png = (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }, png);
}

test.describe('embed, wide frame (820×844)', () => {
  test('only the phone and the controls: no page chrome', async ({ page }) => {
    const f = await host(page, { width: 820, height: 844 });
    await expect(f.locator('.device .app')).toBeVisible();
    await expect(f.getByRole('complementary', { name: 'Demo controls' })).toBeVisible();
    await expect(f.getByRole('button', { name: 'Run the incident' })).toBeVisible();
    await expect(f.getByLabel('Heat load in aisle 4')).toBeVisible();
    await expect(f.getByText('Action log')).toBeVisible();
    // Chrome the host page supplies itself:
    await expect(f.locator('h1')).toHaveCount(0);
    await expect(f.locator('.steps')).toHaveCount(0);
    await expect(f.getByText('A working prototype, not a mockup.')).toHaveCount(0);
    await expect(f.locator('.to-app')).toHaveCount(0);
    await expect(f.locator('.demo-pill')).toHaveCount(0);
  });

  test('transparent: the host page shows through around the phone', async ({ page }) => {
    await host(page, { width: 820, height: 844 });
    const bg = await page.frames()[1].evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
    expect(bg).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
    // Actual pixels inside the iframe's box, at its corners (clear of the phone
    // and of the bezel's drop shadow, which legitimately tints its surroundings).
    expect(await pixel(page, 40 + 2, 40 + 2)).toBe(HOST_BG);
    expect(await pixel(page, 40 + 816, 40 + 4)).toBe(HOST_BG);
    expect(await pixel(page, 40 + 816, 40 + 840)).toBe(HOST_BG);
  });

  test('sized for the frame: nothing scrolls or overflows', async ({ page }) => {
    await host(page, { width: 820, height: 844 });
    const fits = await page.frames()[1].evaluate(() => ({
      x: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    }));
    expect(fits).toEqual({ x: true, y: true });
  });

  test('a shorter frame still fits: the phone flexes to the frame height', async ({ page }) => {
    const f = await host(page, { width: 820, height: 700 });
    const h = await f.locator('.device').evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeLessThanOrEqual(700);
    const overflowY = await page.frames()[1].evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
    expect(overflowY).toBeLessThanOrEqual(0);
  });

  test('it is the live app: the incident runs inside the frame', async ({ page }) => {
    const f = await host(page, { width: 820, height: 844 });
    await f.getByRole('button', { name: 'Start the incident' }).click();
    await expect(f.locator('.lock')).toBeVisible();
    await expect(f.locator('.notif strong')).toContainText('Rack B-07', { timeout: 10_000 });
    await f.locator('.notif').click();
    await expect(f.locator('.app')).toHaveAttribute('data-state', /rising|critical/);
    await expect(f.locator('.log')).toContainText('Simulated incident started');
  });
});

test.describe('embed, narrow frame (360×640)', () => {
  test('a static preview and an "Open full screen" link instead of the live app', async ({ page }) => {
    const f = await host(page, { width: 360, height: 640 });
    await expect(f.locator('.embed-preview')).toBeVisible();
    await expect(f.locator('.panel')).toHaveCount(0);
    await expect(f.getByRole('img', { name: /Preview of the cooling alert app: rack B-07 critical/ })).toBeVisible();
    const link = f.getByRole('link', { name: 'Open full screen' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    const href = await link.getAttribute('href');
    expect(new URL(href!).searchParams.has('embed')).toBe(false);
  });

  test('static: no live loop runs, and the preview is not interactive', async ({ page }) => {
    const f = await host(page, { width: 360, height: 640 });
    const clock = f.locator('[aria-label="Last reading"]');
    const before = await clock.textContent();
    await page.waitForTimeout(800); // 8 readings' worth at readMs=100
    await expect(clock).toHaveText(before!);
    await expect(f.locator('.app')).toHaveAttribute('data-motion', 'reduced');
    await expect(f.locator('.embed-preview .device')).toHaveAttribute('inert', '');
  });

  test('the whole phone fits the frame, link included', async ({ page }) => {
    const f = await host(page, { width: 360, height: 640 });
    const boxes = await Promise.all([f.locator('.embed-preview-frame').boundingBox(), f.getByRole('link', { name: 'Open full screen' }).boundingBox()]);
    for (const b of boxes) {
      expect(b!.x).toBeGreaterThanOrEqual(40);
      expect(b!.y).toBeGreaterThanOrEqual(40);
      expect(b!.x + b!.width).toBeLessThanOrEqual(40 + 360 + 0.5);
      expect(b!.y + b!.height).toBeLessThanOrEqual(40 + 640 + 0.5);
    }
    expect(await pixel(page, 40 + 2, 40 + 2)).toBe(HOST_BG); // transparent here too
  });

  test('"Open full screen" opens the full app in a new tab', async ({ page, context }) => {
    const f = await host(page, { width: 360, height: 640 });
    const [popup] = await Promise.all([context.waitForEvent('page'), f.getByRole('link', { name: 'Open full screen' }).click()]);
    await popup.waitForLoadState();
    expect(new URL(popup.url()).searchParams.has('embed')).toBe(false);
    await expect(popup.locator('.app')).toBeVisible();
  });
});

test.describe('embed on a dark host page', () => {
  const DARK = '#1b1d22';

  test('why ?theme= exists: an undeclared embed on a color-scheme:dark host gets an opaque backdrop', async ({ page }) => {
    await host(page, { width: 820, height: 844, hostStyle: `background:${DARK};color-scheme:dark` });
    expect(await pixel(page, 40 + 816, 40 + 4)).not.toBe(DARK); // the browser's opaque canvas, not the host
  });

  test('?theme=dark: transparent over the dark host, and the panel switches to light ink', async ({ page }) => {
    const f = await host(page, { width: 820, height: 844, query: 'embed=1&seed=7&theme=dark', hostStyle: `background:${DARK};color-scheme:dark` });
    expect(await pixel(page, 40 + 2, 40 + 2)).toBe(DARK);
    expect(await pixel(page, 40 + 816, 40 + 840)).toBe(DARK);
    await expect(f.getByText('Action log')).toHaveCSS('color', 'rgb(220, 231, 238)'); // color.page.dark.ink
  });

  test.describe('under an OS dark preference', () => {
    test.use({ colorScheme: 'dark' });
    test('?theme=auto: transparent over a `color-scheme: light dark` host', async ({ page }) => {
      await host(page, { width: 820, height: 844, query: 'embed=1&seed=7&theme=auto', hostStyle: `background:${DARK};color-scheme:light dark` });
      expect(await pixel(page, 40 + 816, 40 + 4)).toBe(DARK);
    });
  });
});

test('resizing the frame across the breakpoint swaps live app ↔ preview', async ({ page }) => {
  const f = await host(page, { width: 820, height: 844 });
  await expect(f.locator('.panel')).toBeVisible();
  await page.locator('#f').evaluate((el: HTMLIFrameElement) => (el.style.width = '360px'));
  await expect(f.locator('.embed-preview')).toBeVisible();
  await expect(f.locator('.panel')).toHaveCount(0);
  await page.locator('#f').evaluate((el: HTMLIFrameElement) => (el.style.width = '820px'));
  await expect(f.locator('.panel')).toBeVisible();
});

test('without ?embed=1 the full page is unchanged', async ({ page }) => {
  await page.goto('/?seed=7');
  await expect(page.locator('h1')).toHaveText('Cooling alert, critical state');
  await expect(page.locator('html')).not.toHaveClass(/embed/);
});
