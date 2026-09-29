import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { embedTheme, fullScreenUrl, isEmbed, MOBILE_BREAKPOINT_PX } from './embed';
import { buildPreviewState } from './previewState';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'contract', 'tokens.json'), 'utf8'));

describe('embed mode', () => {
  it('is on only for embed=1', () => {
    expect(isEmbed('?embed=1')).toBe(true);
    expect(isEmbed('?seed=4&embed=1')).toBe(true);
    expect(isEmbed('')).toBe(false);
    expect(isEmbed('?embed=0')).toBe(false);
    expect(isEmbed('?embed=true')).toBe(false);
  });

  it('breakpoint matches contract/tokens.json → meta.breakpoint.mobile', () => {
    expect(`${MOBILE_BREAKPOINT_PX}px`).toBe(tokens.meta.breakpoint.mobile);
  });

  it('"Open full screen" drops the embed-only params and keeps everything else', () => {
    expect(fullScreenUrl('https://x.app/?embed=1')).toBe('https://x.app/');
    expect(fullScreenUrl('https://x.app/?seed=7&embed=1&theme=dark#panel')).toBe('https://x.app/?seed=7');
  });

  it('theme: light, dark or auto; anything else means "not declared"', () => {
    expect(embedTheme('?embed=1&theme=dark')).toBe('dark');
    expect(embedTheme('?theme=light')).toBe('light');
    expect(embedTheme('?theme=auto')).toBe('auto');
    expect(embedTheme('?theme=blue')).toBeNull();
    expect(embedTheme('?embed=1')).toBeNull();
  });
});

describe('static preview state', () => {
  const s = buildPreviewState();
  it('shows B-07 critical, live, with the action on offer', () => {
    expect(s.racks['B-07'].state).toBe('critical');
    expect(s.racks['B-07'].down).toBe(false);
    expect(s.racks['B-07'].acted).toBeNull();
  });
  it('shows the open app — no intro, no lock screen, no outcome', () => {
    expect(s.introDismissed).toBe(true);
    expect(s.locked).toBe(false);
    expect(s.ended).toBeNull();
  });
  it('is deterministic', () => {
    expect(buildPreviewState()).toEqual(s);
  });
});
