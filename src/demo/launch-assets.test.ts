import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Launch assets (icon, manifest, iOS startup images) must stay on the
 * contract: the app ground is the one colour the phone shows before the app
 * paints, so a drift here is a white (or wrong-dark) flash on launch.
 * Regenerate with `node scripts/generate-launch-assets.mjs`.
 */
const root = process.cwd();
const tokens = JSON.parse(readFileSync(join(root, 'contract', 'tokens.json'), 'utf8'));
const GROUND: string = tokens.color.app.ground;
const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'));

/** Width/height straight from the PNG's IHDR chunk. */
function pngSize(publicPath: string): { w: number; h: number } {
  const buf = readFileSync(join(root, 'public', publicPath));
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('launch colours come from the contract (color.app.ground)', () => {
  it('manifest background_color and theme_color', () => {
    expect(manifest.background_color).toBe(GROUND);
    expect(manifest.theme_color).toBe(GROUND);
  });
  it('theme-color meta and the pre-CSS ground in index.html', () => {
    expect(html).toContain(`<meta name="theme-color" content="${GROUND}" />`);
    expect(html).toContain(`html:not(.embed) { background: ${GROUND}; }`);
  });
  it('the icon source uses it as its ground', () => {
    expect(readFileSync(join(root, 'public', 'icons', 'icon.svg'), 'utf8')).toContain(`fill="${GROUND}"`);
  });
});

describe('icons', () => {
  it('manifest icons exist at their declared sizes, with a maskable 512', () => {
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(icon.src)).toEqual({ w, h });
    }
    expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`).sort()).toEqual(['192x192/any', '512x512/any', '512x512/maskable']);
  });
  it('apple-touch-icon is 180×180', () => {
    const href = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html)![1];
    expect(pngSize(href)).toEqual({ w: 180, h: 180 });
  });
});

describe('iOS startup images', () => {
  const links = [...html.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="([^"]+)"/g)].map((m) => ({ media: m[1], href: m[2] }));

  it('are only offered when the page can launch as a home-screen app', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(links.length).toBeGreaterThanOrEqual(20);
  });

  it('each image exists at exactly the resolution its media query describes', () => {
    for (const { media, href } of links) {
      const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\) and \(orientation: (portrait|landscape)\)/.exec(media);
      expect(m, media).not.toBeNull();
      const [w, h, dpr] = [Number(m![1]), Number(m![2]), Number(m![3])];
      const expected = m![4] === 'portrait' ? { w: w * dpr, h: h * dpr } : { w: h * dpr, h: w * dpr };
      expect(existsSync(join(root, 'public', href)), href).toBe(true);
      expect(pngSize(href), href).toEqual(expected);
    }
  });

  it('cover every listed device in both orientations, once each', () => {
    const medias = links.map((l) => l.media);
    expect(new Set(medias).size).toBe(medias.length);
    const portrait = medias.filter((m) => m.includes('portrait')).length;
    expect(medias.length).toBe(portrait * 2);
  });
});
