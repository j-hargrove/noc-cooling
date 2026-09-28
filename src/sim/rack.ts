import { RECOMMENDED_C, ALLOWABLE_C } from './constants';
import { nextRandom, nextSigned, type Seed } from './rng';
import type { AlertState, RackId, RackModel, ShownState, SimState } from './types';

/**
 * A fresh rack at ambient, with 24 readings of history already behind it
 * (matches the prototype's reset(): each rack starts with a settled trace,
 * not a cold start). Draw order doesn't need to match the prototype —
 * Math.random() there isn't seedable, so there's nothing to bit-match.
 */
export function makeRack(id: RackId, seed: Seed): [RackModel, Seed] {
  const [jitter, s1] = nextRandom(seed);
  const T = 24.2 + jitter * 0.4;
  const hist: number[] = [];
  let s = s1;
  for (let i = 0; i < 24; i++) {
    const [n, sNext] = nextSigned(s, 0.2);
    hist.push(T + n);
    s = sNext;
  }
  const rack: RackModel = {
    id,
    T,
    hist,
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
  };
  return [rack, s];
}

export function cloneRack(m: RackModel): RackModel {
  return { ...m, hist: [...m.hist] };
}

/**
 * Where this rack's inlet is heading. Fixes ramp in gradually (`prog`);
 * unaddressed critical feeds on itself (`runaway`) until it's addressed or
 * the rack goes down, at which point it stops radiating heat entirely.
 */
export function target(state: Pick<SimState, 'heat' | 'boosted'>, m: RackModel, prog = m.prog): number {
  if (m.down) return 24;
  const run = m.runaway * (1 - prog);
  if (m.id === 'B-07') return 22 + state.heat * 0.14 + run - 10 * prog;
  const hot = 23.8 + 13.7 * m.faultLvl + run;
  return hot + (25.5 - hot) * prog - (state.boosted ? 1.5 : 0);
}

/** How fast the inlet moves toward `target`. A-03 settles faster once fixed. */
export function rate(m: Pick<RackModel, 'id' | 'acted'>): number {
  return m.id === 'B-07' ? 0.12 : m.acted === 'fix' ? 0.1 : 0.12;
}

/**
 * Classification carries its own short memory via `m.state`/`m.slope`
 * (e.g. a rack already 'rising' stays 'rising' through a slightly negative
 * slope) — this is on top of, not instead of, the reading's evaluate()
 * hysteresis, which gates the visible downgrade to 3 consecutive readings.
 */
export function classify(m: Pick<RackModel, 'T' | 'slope' | 'state'>): AlertState {
  if (m.T >= ALLOWABLE_C) return 'critical';
  if (m.T >= RECOMMENDED_C) {
    if (m.slope > 0.015 || m.state === 'calm' || (m.state === 'rising' && m.slope > -0.015)) return 'rising';
    return 'recovering';
  }
  return 'calm';
}

export function shownState(m: Pick<RackModel, 'down' | 'state'>): ShownState {
  return m.down ? 'offline' : m.state;
}
