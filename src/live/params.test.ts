import { describe, expect, it } from 'vitest';
import { READ_INTERVAL_MS } from '../ui/timing';
import { MIN_READ_MS, readLiveParams } from './params';

describe('readLiveParams', () => {
  it('defaults: a random seed and the real reading interval', () => {
    expect(readLiveParams('', () => 0.5)).toEqual({ seed: Math.floor(0.5 * 0xffffffff), readMs: READ_INTERVAL_MS });
  });

  it('pins the seed when given one', () => {
    expect(readLiveParams('?seed=42').seed).toBe(42);
  });

  it('ignores a malformed seed', () => {
    expect(readLiveParams('?seed=abc', () => 0).seed).toBe(0);
    expect(readLiveParams('?seed=-3', () => 0).seed).toBe(0);
  });

  it('shortens the reading interval, but never below the floor', () => {
    expect(readLiveParams('?readMs=200').readMs).toBe(200);
    expect(readLiveParams('?readMs=1').readMs).toBe(MIN_READ_MS);
  });

  it('ignores a malformed or non-positive interval', () => {
    expect(readLiveParams('?readMs=fast').readMs).toBe(READ_INTERVAL_MS);
    expect(readLiveParams('?readMs=0').readMs).toBe(READ_INTERVAL_MS);
  });
});
