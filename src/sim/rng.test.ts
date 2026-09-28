import { describe, expect, it } from 'vitest';
import { nextRandom, nextSigned } from './rng';

describe('rng', () => {
  it('produces values in [0, 1)', () => {
    let seed = 12345;
    for (let i = 0; i < 500; i++) {
      const [v, next] = nextRandom(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seed = next;
    }
  });

  it('is deterministic: same seed produces the same draw', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextSigned(42, 0.1)).toEqual(nextSigned(42, 0.1));
  });

  it('is a pure function: repeated calls with the same seed never mutate hidden state', () => {
    const seed = 7;
    const first = nextRandom(seed);
    const second = nextRandom(seed);
    const third = nextRandom(seed);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });

  it('different seeds produce different sequences', () => {
    const [a] = nextRandom(1);
    const [b] = nextRandom(2);
    expect(a).not.toBe(b);
  });

  it('nextSigned centers on 0 with the given spread', () => {
    let seed = 999;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const [v, next] = nextSigned(seed, 0.1);
      min = Math.min(min, v);
      max = Math.max(max, v);
      seed = next;
    }
    expect(min).toBeGreaterThanOrEqual(-0.05);
    expect(max).toBeLessThan(0.05);
  });
});
