import { describe, expect, it } from 'vitest';
import { classify, rate, target } from './rack';
import type { RackModel } from './types';

const rack = (overrides: Partial<RackModel> = {}): RackModel => ({
  id: 'B-07',
  T: 24,
  hist: [],
  slope: 0,
  state: 'calm',
  stable: 0,
  acted: null,
  actAt: '',
  fresh: false,
  flare: 0,
  fault: false,
  faultLvl: 0,
  runaway: 0,
  down: false,
  downAt: '',
  critAt: 0,
  thr: 0,
  peak: 0,
  prog: 0,
  ...overrides,
});

describe('classify', () => {
  it('is calm below 27°C regardless of slope or prior state', () => {
    expect(classify(rack({ T: 26.9, slope: 1, state: 'rising' }))).toBe('calm');
  });

  it('is critical at or above 32°C', () => {
    expect(classify(rack({ T: 32, slope: 0 }))).toBe('critical');
    expect(classify(rack({ T: 35, slope: -1 }))).toBe('critical');
  });

  it('a first crossing of 27°C from calm reads as rising, not recovering', () => {
    expect(classify(rack({ T: 27, slope: 0, state: 'calm' }))).toBe('rising');
  });

  it('climbing (slope > 0.015) in range reads as rising', () => {
    expect(classify(rack({ T: 28, slope: 0.02, state: 'recovering' }))).toBe('rising');
  });

  it('a rising rack stays rising through a slightly negative slope (sticky)', () => {
    expect(classify(rack({ T: 28, slope: -0.01, state: 'rising' }))).toBe('rising');
  });

  it('a rising rack reads recovering once its slope drops past -0.015', () => {
    expect(classify(rack({ T: 28, slope: -0.02, state: 'rising' }))).toBe('recovering');
  });

  it('a flat, already-recovering rack stays recovering', () => {
    expect(classify(rack({ T: 28, slope: 0, state: 'recovering' }))).toBe('recovering');
  });
});

describe('target', () => {
  it('a down rack targets ambient (24°C) regardless of id or heat load', () => {
    expect(target({ heat: 90, boosted: true }, rack({ id: 'B-07', down: true, runaway: 9 }))).toBe(24);
    expect(target({ heat: 90, boosted: true }, rack({ id: 'A-03', down: true, faultLvl: 1 }))).toBe(24);
  });

  it('B-07 tracks the aisle heat load, and a fix pulls the target down', () => {
    const base = target({ heat: 30, boosted: false }, rack({ id: 'B-07', prog: 0, runaway: 0 }));
    expect(base).toBeCloseTo(22 + 30 * 0.14, 5);
    const fixed = target({ heat: 30, boosted: false }, rack({ id: 'B-07', prog: 1, runaway: 0 }));
    expect(fixed).toBeLessThan(base);
  });

  it('unaddressed critical runaway pushes B-07 hotter, and decays as the fix lands', () => {
    const noRunaway = target({ heat: 30, boosted: false }, rack({ id: 'B-07', runaway: 0, prog: 0 }));
    const withRunaway = target({ heat: 30, boosted: false }, rack({ id: 'B-07', runaway: 5, prog: 0 }));
    expect(withRunaway).toBeGreaterThan(noRunaway);
    const halfFixed = target({ heat: 30, boosted: false }, rack({ id: 'B-07', runaway: 5, prog: 0.5 }));
    expect(halfFixed).toBeLessThan(withRunaway);
  });

  it('A-03 heats with fan degradation, and a boost trims the target', () => {
    const idle = target({ heat: 30, boosted: false }, rack({ id: 'A-03', faultLvl: 0 }));
    const degraded = target({ heat: 30, boosted: false }, rack({ id: 'A-03', faultLvl: 1 }));
    expect(degraded).toBeGreaterThan(idle);
    const boosted = target({ heat: 30, boosted: true }, rack({ id: 'A-03', faultLvl: 1 }));
    expect(boosted).toBeLessThan(degraded);
  });
});

describe('rate', () => {
  it('B-07 always settles at the same rate', () => {
    expect(rate({ id: 'B-07', acted: null })).toBe(0.12);
    expect(rate({ id: 'B-07', acted: 'fix' })).toBe(0.12);
  });

  it('A-03 settles faster once fixed', () => {
    expect(rate({ id: 'A-03', acted: null })).toBe(0.12);
    expect(rate({ id: 'A-03', acted: 'fix' })).toBe(0.1);
  });
});
