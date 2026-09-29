import { READ_INTERVAL_MS } from '../ui/timing';

export interface LiveParams {
  seed: number;
  readMs: number;
}

/** Fastest reading interval a URL may ask for — quick enough for e2e, slow enough to still render every reading. */
export const MIN_READ_MS = 50;

/**
 * Two URL knobs for the live app, neither of which changes behavior, only
 * pacing and noise:
 *  - `?seed=<uint>` pins the sim's RNG so a run is reproducible (the default
 *    is random per load, like the prototype's Math.random()).
 *  - `?readMs=<ms>` shortens the reading interval, so the Playwright suite can
 *    drive a whole incident in seconds rather than minutes.
 */
export function readLiveParams(search: string, random: () => number = Math.random): LiveParams {
  const q = new URLSearchParams(search);
  const seedParam = q.get('seed');
  const seedNum = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : NaN;
  const seed = Number.isFinite(seedNum) ? seedNum : Math.floor(random() * 0xffffffff) >>> 0;

  const readParam = Number(q.get('readMs'));
  const readMs = q.has('readMs') && Number.isFinite(readParam) && readParam > 0 ? Math.max(MIN_READ_MS, Math.round(readParam)) : READ_INTERVAL_MS;

  return { seed, readMs };
}
