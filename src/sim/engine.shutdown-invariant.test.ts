import { describe, expect, it } from 'vitest';
import { RACK_IDS, SHUTDOWN_C } from './constants';
import {
  act,
  advanceReading,
  createInitialState,
  dismissIntro,
  dispatchTech,
  failSecondRack,
  openLock,
  override,
  setHeatLoad,
  setHoldBusy,
  startIncident,
  switchFocus,
  undo,
  type StepResult,
} from './engine';
import type { SimState } from './types';

/** Every live rack at or above the shutdown line is a breach: shutdown must always win, whatever the incident phase. */
function breaches(s: SimState): string[] {
  return RACK_IDS.filter((id) => !s.racks[id].down && s.racks[id].T >= SHUTDOWN_C).map(
    (id) => `${id} live at ${s.racks[id].T.toFixed(1)}°C (ended=${s.ended}, phase=${s.phase}, focus=${s.focus})`,
  );
}

describe('shutdown at 38°C is unconditional (production bug: A-03 throttled on to 46°C)', () => {
  it('regression: second rack failed while the first is recovering, first resolves "ok" before A-03 leaves calm', () => {
    // The exact sequence from production, seed 1: run, boost B-07 while rising,
    // "Fail a second rack" before B-07 resolves. B-07 resolves "ok" while A-03
    // is still calm, CRAC-3 stands down, and A-03 — never acted on — heats.
    let s = startIncident(createInitialState(1)).state;
    for (let n = 0; n <= 150; n++) {
      if (n === 3) s = act(s).state;
      if (n === 4) s = failSecondRack(s).state;
      s = advanceReading(s).state;
      expect(breaches(s), `reading ${n}`).toEqual([]);
    }
    expect(s.racks['A-03'].down).toBe(true);
    expect(s.ended).toBe('fail');
  });

  it('after an "ok" resolution, pushing the heat load up still ends in shutdown', () => {
    // Same gate, different road in: the resolved incident, then the demo slider at 100%.
    let s = startIncident(createInitialState(2), { autoSecond: false }).state;
    for (let n = 0; n < 80 && s.ended !== 'ok'; n++) {
      if (s.racks['B-07'].state !== 'calm' && s.racks['B-07'].acted === null) s = act(s).state;
      s = advanceReading(s).state;
    }
    expect(s.ended).toBe('ok');
    // Past CRAC-3's stand-down (which resets the heat load), then the slider up.
    for (let n = 0; n < 10 && s.boosted; n++) s = advanceReading(s).state;
    expect(s.boosted).toBe(false);
    s = setHeatLoad(s, 100);
    for (let n = 0; n < 300; n++) {
      s = advanceReading(s).state;
      expect(breaches(s), `reading ${n}`).toEqual([]);
    }
    expect(s.racks['B-07'].down).toBe(true);
  });
});

/** Small seeded PRNG for the action schedule (mulberry32), separate from the sim's own seed. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Action = { name: string; apply: (s: SimState, r: () => number) => SimState };
const step = (f: (s: SimState) => StepResult) => (s: SimState) => f(s).state;

/**
 * Every operator- and panel-reachable action, callable at any moment — not
 * just when the UI would offer it — so the invariant holds for anything that
 * drives the sim, not only for the current UI's gating.
 */
const ACTIONS: Action[] = [
  { name: 'run', apply: (s, r) => startIncident(s, { autoSecond: r() < 0.7, fromLock: r() < 0.5 }).state },
  { name: 'act', apply: step(act) },
  { name: 'override', apply: step(override) },
  { name: 'undo', apply: step(undo) },
  { name: 'failSecond', apply: (s, r) => failSecondRack(s, { headStart: r() < 0.7 }).state },
  { name: 'heat', apply: (s, r) => setHeatLoad(s, Math.floor(r() * 101)) },
  { name: 'focus', apply: (s, r) => switchFocus(s, RACK_IDS[Math.floor(r() * RACK_IDS.length)]) },
  { name: 'dispatch', apply: step(dispatchTech) },
  { name: 'holdBusy', apply: (s, r) => setHoldBusy(s, r() < 0.5) },
  { name: 'openLock', apply: (s) => openLock(s) },
  { name: 'dismissIntro', apply: (s) => dismissIntro(s) },
  { name: 'reset', apply: (s, r) => ({ ...createInitialState(Math.floor(r() * 2 ** 32)), introDismissed: s.introDismissed }) },
];

describe('invariant: no live rack ever exceeds 38°C, under random action sequences', () => {
  const RUNS = 400;
  const READINGS = 260;

  it(`${RUNS} seeded runs × ${READINGS} readings, random actions between readings`, () => {
    let checked = 0;
    for (let run = 1; run <= RUNS; run++) {
      const r = prng(run * 7919);
      let s = createInitialState(run);
      const trail: string[] = [];
      for (let n = 0; n < READINGS; n++) {
        // Mostly let time pass; sometimes act, sometimes a burst of actions within one reading.
        while (r() < 0.12) {
          const a = ACTIONS[Math.floor(r() * ACTIONS.length)];
          s = a.apply(s, r);
          trail.push(`r${n}:${a.name}`);
        }
        s = advanceReading(s).state;
        const bad = breaches(s);
        if (bad.length) expect.fail(`run ${run}, reading ${n}: ${bad.join('; ')}\nactions: ${trail.slice(-25).join(' ')}`);
        checked++;
      }
    }
    expect(checked).toBe(RUNS * READINGS);
  });
});
