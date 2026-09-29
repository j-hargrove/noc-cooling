import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Region-aware screenshot comparison for /states (step 8).
 *
 * Why not toHaveScreenshot: it has one tolerance for the whole image, and its
 * default per-pixel colour threshold (0.2) let real regressions through — the
 * offline state rendering calm cyan instead of steel (~1000 pixels, channel
 * deltas up to 56) and stale temperatures in two notification/stat texts all
 * passed. A single loose tolerance was there for one reason: the canvas field
 * isn't pixel-deterministic run to run on the CI runner (measured: up to 17 of
 * 255 per channel, never outside the field).
 *
 * So the tolerance is scoped to where the noise is:
 *  - inside the `.field` box, each channel may differ by up to FIELD_TOLERANCE;
 *  - everywhere else, pixels must match exactly (0 levels, 0 pixels).
 * It's a per-pixel tolerance, not a mask: anything drawn over or inside the
 * field that really changes (a chip's text, a notification over the blurred
 * map) moves pixels far more than 20 levels and still fails.
 */
export const FIELD_TOLERANCE = 20; // measured noise 17; a real change (offline: 56) is ~3x over

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompareResult {
  sizeMismatch: string | null;
  /** Pixels outside the field that differ at all. Must be 0. */
  outsideDiff: number;
  outsideMaxDelta: number;
  /** Pixels inside the field whose channel delta exceeds the tolerance. Must be 0. */
  insideOver: number;
  insideMaxDelta: number;
  /** PNG data URL: the actual image, washed out, with failing pixels in red (only when failing). */
  diffPng: string | null;
}

/** Decodes both PNGs in a scratch page and compares them region by region. */
export async function comparePngs(page: Page, expected: Buffer, actual: Buffer, field: Rect, tolerance = FIELD_TOLERANCE): Promise<CompareResult> {
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(
      async ([e64, a64, f, tol]) => {
        const load = async (b64: string) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0);
          return { img, data: ctx.getImageData(0, 0, img.width, img.height) };
        };
        const [E, A] = [await load(e64), await load(a64)];
        const w = E.data.width;
        const h = E.data.height;
        if (w !== A.data.width || h !== A.data.height) {
          return { sizeMismatch: `${w}x${h} expected, ${A.data.width}x${A.data.height} actual`, outsideDiff: 0, outsideMaxDelta: 0, insideOver: 0, insideMaxDelta: 0, diffPng: null };
        }
        const x0 = Math.floor(f.x);
        const y0 = Math.floor(f.y);
        const x1 = Math.ceil(f.x + f.width);
        const y1 = Math.ceil(f.y + f.height);
        const bad: number[] = [];
        let outsideDiff = 0;
        let outsideMaxDelta = 0;
        let insideOver = 0;
        let insideMaxDelta = 0;
        const e = E.data.data;
        const a = A.data.data;
        for (let i = 0; i < e.length; i += 4) {
          const d = Math.max(Math.abs(e[i] - a[i]), Math.abs(e[i + 1] - a[i + 1]), Math.abs(e[i + 2] - a[i + 2]), Math.abs(e[i + 3] - a[i + 3]));
          if (!d) continue;
          const px = (i / 4) % w;
          const py = Math.floor(i / 4 / w);
          const inField = px >= x0 && px < x1 && py >= y0 && py < y1;
          if (inField) {
            insideMaxDelta = Math.max(insideMaxDelta, d);
            if (d > tol) {
              insideOver++;
              bad.push(i);
            }
          } else {
            outsideMaxDelta = Math.max(outsideMaxDelta, d);
            outsideDiff++;
            bad.push(i);
          }
        }
        let diffPng: string | null = null;
        if (bad.length) {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(A.img, 0, 0);
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fillRect(0, 0, w, h);
          const out = ctx.getImageData(0, 0, w, h);
          for (const i of bad) out.data.set([230, 0, 0, 255], i);
          ctx.putImageData(out, 0, 0);
          ctx.strokeStyle = 'rgba(0,120,255,.9)';
          ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1); // the tolerant region, for context
          diffPng = c.toDataURL('image/png');
        }
        return { sizeMismatch: null, outsideDiff, outsideMaxDelta, insideOver, insideMaxDelta, diffPng };
      },
      [expected.toString('base64'), actual.toString('base64'), field, tolerance] as const,
    );
  } finally {
    await scratch.close();
  }
}

/**
 * The tolerant region, relative to the element being screenshotted: the
 * field's box — grown by the reach of any overlay that blurs it. The intro
 * and lock screen sit over the field with `backdrop-filter: blur(Npx)`, which
 * spreads the field's flicker beyond its own box (CI: overlay-intro, 28px at
 * 1 level just outside it). A CSS blur of N px is a Gaussian with σ = N, so
 * its spread is taken as 3N. Still the same per-pixel tolerance there, not a mask.
 */
export async function fieldRectWithin(root: Locator): Promise<Rect> {
  const [r, f] = await Promise.all([root.boundingBox(), root.locator('.field').boundingBox()]);
  if (!r || !f) throw new Error('fixture has no .field to scope the tolerance to');
  const blurPx = await root.evaluate((el) => {
    let max = 0;
    for (const o of el.querySelectorAll<HTMLElement>('.intro, .lock')) {
      const m = /blur\(([\d.]+)px\)/.exec(getComputedStyle(o).backdropFilter || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max;
  });
  const spill = 3 * blurPx;
  const x = Math.max(0, f.x - r.x - spill);
  const y = Math.max(0, f.y - r.y - spill);
  return {
    x,
    y,
    width: Math.min(r.width, f.x - r.x + f.width + spill) - x,
    height: Math.min(r.height, f.y - r.y + f.height + spill) - y,
  };
}

/**
 * Asserts `root` matches its committed baseline under the region rules above.
 * Honours --update-snapshots (all / changed / missing), writing to the same
 * paths toHaveScreenshot used, so CI's update-screenshots job keeps working.
 */
export async function expectMatchesBaseline(page: Page, root: Locator, name: string, testInfo: TestInfo): Promise<void> {
  const baselinePath = testInfo.snapshotPath(name);
  const actual = await root.screenshot({ animations: 'disabled', caret: 'hide' });
  const mode = testInfo.config.updateSnapshots;
  const write = () => {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, actual);
  };

  if (!existsSync(baselinePath)) {
    if (mode === 'none') throw new Error(`No baseline at ${baselinePath}; run with --update-snapshots`);
    write();
    return;
  }
  if (mode === 'all') {
    write();
    return;
  }

  const result = await comparePngs(page, readFileSync(baselinePath), actual, await fieldRectWithin(root));
  const pass = !result.sizeMismatch && result.outsideDiff === 0 && result.insideOver === 0;
  if (!pass && mode === 'changed') {
    write();
    return;
  }
  if (!pass) {
    await testInfo.attach(`${name}-expected`, { path: baselinePath, contentType: 'image/png' });
    await testInfo.attach(`${name}-actual`, { body: actual, contentType: 'image/png' });
    if (result.diffPng) {
      const diff = Buffer.from(result.diffPng.split(',')[1], 'base64');
      writeFileSync(testInfo.outputPath(`${name.replace(/\.png$/, '')}-diff.png`), diff);
      writeFileSync(testInfo.outputPath(`${name.replace(/\.png$/, '')}-actual.png`), actual);
      await testInfo.attach(`${name}-diff`, { body: diff, contentType: 'image/png' });
    }
  }
  expect(
    { sizeMismatch: result.sizeMismatch, outsideDiff: result.outsideDiff, insideOverTolerance: result.insideOver },
    `${name}: outside the field ${result.outsideDiff} px differ (max delta ${result.outsideMaxDelta}); ` +
      `inside the field ${result.insideOver} px exceed ±${FIELD_TOLERANCE} (max delta ${result.insideMaxDelta})`,
  ).toEqual({ sizeMismatch: null, outsideDiff: 0, insideOverTolerance: 0 });
}
