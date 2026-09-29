// Generates the app icon and iOS launch images from contract/tokens.json.
// Run: node scripts/generate-launch-assets.mjs   (writes into public/)
//
// Icon: "Gauge" — the app ground, full bleed, with one thin 270° dial in
// steel and a single short segment at its high end in the critical red. An
// instrument mark, not an illustration; no text. Everything sits inside the
// central 80% circle so an Android maskable crop can't clip it.
//
// Launch images: plain app ground, so iOS shows the same dark the app's first
// frame paints — no white flash, no second "splash" design to keep in sync.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const t = JSON.parse(readFileSync(join(root, 'contract', 'tokens.json'), 'utf8'));
const GROUND = t.color.app.ground;
const STEEL = t.color.app.steel;
const CRIT = t.color.state.critical;

// 512-unit design grid. The dial opens at the bottom (135° lower-left,
// clockwise over the top to 405° lower-right); the critical segment is the
// last stretch of the sweep, after a small gap.
const DIAL = { cx: 256, cy: 272, r: 150, stroke: 24, trackEnd: 350, critStart: 366, critEnd: 405, trackOpacity: 0.55 };

export function iconSvg() {
  const { cx, cy, r } = DIAL;
  const pt = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (a0, a1) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${GROUND}"/>
  <path d="${arc(135, DIAL.trackEnd)}" fill="none" stroke="${STEEL}" stroke-width="${DIAL.stroke}" stroke-linecap="round" opacity="${DIAL.trackOpacity}"/>
  <path d="${arc(DIAL.critStart, DIAL.critEnd)}" fill="none" stroke="${CRIT}" stroke-width="${DIAL.stroke}" stroke-linecap="round"/>
</svg>`;
}

/** Current iPhones, portrait CSS size @ DPR (launch images are per exact device resolution). */
export const IPHONES = [
  { w: 440, h: 956, dpr: 3, models: 'iPhone 16/17 Pro Max' },
  { w: 420, h: 912, dpr: 3, models: 'iPhone Air' },
  { w: 402, h: 874, dpr: 3, models: 'iPhone 16 Pro, 17, 17 Pro' },
  { w: 430, h: 932, dpr: 3, models: 'iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus' },
  { w: 393, h: 852, dpr: 3, models: 'iPhone 14 Pro, 15, 15 Pro, 16, 16e' },
  { w: 428, h: 926, dpr: 3, models: 'iPhone 12/13 Pro Max, 14 Plus' },
  { w: 390, h: 844, dpr: 3, models: 'iPhone 12, 12 Pro, 13, 13 Pro, 14' },
  { w: 375, h: 812, dpr: 3, models: 'iPhone X, XS, 11 Pro, 12/13 mini' },
  { w: 414, h: 896, dpr: 3, models: 'iPhone XS Max, 11 Pro Max' },
  { w: 414, h: 896, dpr: 2, models: 'iPhone XR, 11' },
  { w: 375, h: 667, dpr: 2, models: 'iPhone SE (2nd/3rd gen), 8' },
];

export const startupName = ({ w, h, dpr }, landscape) =>
  landscape ? `startup-${h * dpr}x${w * dpr}.png` : `startup-${w * dpr}x${h * dpr}.png`;

export function startupLinks(prefix = '/launch/') {
  const out = [];
  for (const d of IPHONES) {
    for (const landscape of [false, true]) {
      const media = `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: ${landscape ? 'landscape' : 'portrait'})`;
      out.push(`<link rel="apple-touch-startup-image" media="${media}" href="${prefix}${startupName(d, landscape)}" />`);
    }
  }
  return out;
}

async function main() {
  const pub = join(root, 'public');
  mkdirSync(join(pub, 'icons'), { recursive: true });
  mkdirSync(join(pub, 'launch'), { recursive: true });
  const svg = iconSvg();
  writeFileSync(join(pub, 'icons', 'icon.svg'), svg);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (html, w, h, file) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><body style="margin:0;background:${GROUND}">${html}</body>`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (const [size, file] of [
    [512, 'icons/icon-512.png'],
    [192, 'icons/icon-192.png'],
    [180, 'icons/apple-touch-icon.png'],
  ]) {
    await render(svg.replace('width="512" height="512"', `width="${size}" height="${size}"`), size, size, join(pub, file));
  }
  const seen = new Set();
  for (const d of IPHONES) {
    for (const landscape of [false, true]) {
      const name = startupName(d, landscape);
      if (seen.has(name)) continue;
      seen.add(name);
      const [w, h] = landscape ? [d.h * d.dpr, d.w * d.dpr] : [d.w * d.dpr, d.h * d.dpr];
      await render('', w, h, join(pub, 'launch', name));
    }
  }
  await browser.close();
  console.log(`wrote icons (512, 192, 180) and ${seen.size} launch images`);
}

if (process.argv[1] === import.meta.filename) await main();
