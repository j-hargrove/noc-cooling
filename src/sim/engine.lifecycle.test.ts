import { describe, expect, it } from 'vitest';
import { RESOLUTION_MIN_READINGS } from './constants';
import { act, advanceReading, createInitialState, failSecondRack, startIncident } from './engine';
import { runReadings, withRack } from './test-support';
import type { SimEvent, SimState } from './types';

/** A state one tick away from a clean resolution: both racks calm, B-07 was the incident. */
function nearResolvedState(seed: number): SimState {
  let s: SimState = { ...createInitialState(seed), started: true, phase: 1, phaseRack: 'B-07', phaseN: 0, n: 10, boosted: true };
  s = withRack(s, 'B-07', { state: 'calm', T: 24, peak: 30, acted: 'fix' });
  s = withRack(s, 'A-03', { state: 'calm', T: 24 });
  return s;
}

describe('resolution outcomes', () => {
  it('resolves "ok" once every live rack is back to calm and the incident rack actually peaked', () => {
    const { state } = advanceReading(nearResolvedState(401));
    expect(state.ended).toBe('ok');
  });

  it('does not resolve before the phase has run its minimum duration', () => {
    let s: SimState = { ...createInitialState(402), started: true, phase: 1, phaseRack: 'B-07', phaseN: 5, n: 5 };
    s = withRack(s, 'B-07', { state: 'calm', T: 24, peak: 30 });
    s = withRack(s, 'A-03', { state: 'calm', T: 24 });
    const { state } = advanceReading(s); // n -> 6, still short of phaseN + RESOLUTION_MIN_READINGS (8)
    expect(state.n).toBeLessThan(5 + RESOLUTION_MIN_READINGS);
    expect(state.ended).toBeNull();
  });

  it('resolves "mixed" when the phase rack recovers but another rack is still down', () => {
    let s: SimState = { ...createInitialState(403), started: true, phase: 1, phaseRack: 'B-07', phaseN: 0, n: 10 };
    s = withRack(s, 'B-07', { state: 'calm', T: 24, peak: 33, acted: 'fix' });
    s = withRack(s, 'A-03', { state: 'critical', T: 39, down: true, downAt: '02:20:00' });

    const { state, events } = advanceReading(s);
    expect(state.ended).toBe('mixed');
    expect(events).toContainEqual({ type: 'outcome', kind: 'mixed', rackId: 'B-07' });
    expect(events.some((e) => e.type === 'log' && e.entry.text === 'B-07 recovered; A-03 still offline')).toBe(true);
  });
});

describe('CRAC-3 stands down after every resolution (docs/decisions.md)', () => {
  it('schedules stand-down ~2 readings after an "ok" resolution while boosted', () => {
    const { state } = advanceReading(nearResolvedState(410));
    expect(state.ended).toBe('ok');
    expect(state.boosted).toBe(true);
    expect(state.standDownAt! - state.n).toBe(2);
  });

  it('stands down: clears the boost, resets heat, and un-acts B-07', () => {
    let s = advanceReading(nearResolvedState(411)).state;
    let events: SimEvent[] = [];
    for (let i = 0; i < 5 && s.boosted; i++) {
      const r = advanceReading(s);
      s = r.state;
      events = r.events;
    }
    expect(s.boosted).toBe(false);
    expect(s.heat).toBe(30);
    expect(s.incident).toBeNull();
    expect(s.racks['B-07'].acted).toBeNull();
    expect(events).toContainEqual({ type: 'stand-down' });
    expect(events.some((e) => e.type === 'log' && e.entry.text === 'CRAC-3 returned to 60%')).toBe(true);
  });

});

/** Runs the incident, boosting B-07 the moment it alerts (as the hold button allows). Returns the state just after boosting. */
function boostedIncident(seed: number, autoSecond = true): SimState {
  let s = startIncident(createInitialState(seed), { autoSecond }).state;
  while (s.racks['B-07'].state === 'calm') s = advanceReading(s).state;
  return act(s).state;
}

/** Steps until `done`, failing the test if it takes more than `max` readings. */
function until(s: SimState, done: (s: SimState) => boolean, max = 200): { state: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  for (let i = 0; i < max && !done(s); i++) {
    const r = advanceReading(s);
    s = r.state;
    events.push(...r.events);
  }
  expect(done(s), 'condition reached').toBe(true);
  return { state: s, events };
}

const logged = (events: SimEvent[], text: string) => events.some((e) => e.type === 'log' && e.entry.text === text);

describe('the boost ends on its holders\' terms, not the incident outcome', () => {
  it('regression: A-03 failed while B-07 is boosted and shuts down before anything resolves', () => {
    // Bug path 1: A-03 rising holds resolution back, its shutdown makes the
    // outcome "fail", and the boost used to stay on forever.
    for (const seed of [1, 7]) {
      let s = failSecondRack(boostedIncident(seed)).state;
      const { state, events } = until(s, (x) => x.racks['A-03'].down && !x.boosted);
      s = state;
      expect(s.ended).toBe('fail');
      expect(s.racks['B-07'].state).toBe('calm');
      expect(logged(events, 'CRAC-3 returned to 60%')).toBe(true);
      expect(s.standDownAt).toBeNull();
    }
  });

  it('regression: A-03 failed inside the stand-down window after an "ok" resolution', () => {
    // Bug path 2: the reopened incident (ended = null) used to swallow the pending stand-down.
    for (const seed of [1, 7]) {
      let s = until(boostedIncident(seed), (x) => x.ended === 'ok').state;
      expect(s.standDownAt).not.toBeNull();
      s = failSecondRack(s).state;
      expect(s.ended).toBeNull();
      const { state, events } = runReadings(s, 2);
      expect(state.boosted).toBe(false);
      expect(events).toContainEqual({ type: 'stand-down' });
      const done = until(state, (x) => x.racks['A-03'].down).state;
      expect(done.boosted).toBe(false);
    }
  });

  it('boost then resolve: single-rack timing is unchanged — stand-down 2 readings after the "ok"', () => {
    const { state: resolved, events: before } = until(boostedIncident(3, false), (x) => x.ended === 'ok');
    expect(before.some((e) => e.type === 'stand-down')).toBe(false);
    expect(resolved.standDownAt! - resolved.n).toBe(2);
    const one = advanceReading(resolved);
    expect(one.state.boosted).toBe(true);
    const two = advanceReading(one.state);
    expect(two.state.boosted).toBe(false);
    expect(two.state.heat).toBe(30);
    expect(two.events).toContainEqual({ type: 'event-pill', text: 'CRAC-3 back to 60%', cool: true });
  });

  it('boost on A-03, then A-03 shuts down: the boost clears, the heat load is left alone', () => {
    let s: SimState = { ...createInitialState(412), started: true, boosted: true, heat: 100, focus: 'A-03' };
    s = withRack(s, 'A-03', { T: 39, state: 'critical', acted: 'fix', fault: true, faultLvl: 1 });
    s = advanceReading(s).state;
    expect(s.racks['A-03'].down).toBe(true);
    expect(s.boosted).toBe(true);
    expect(s.standDownAt! - s.n).toBe(2);

    const { state, events } = runReadings(s, 2);
    expect(state.boosted).toBe(false);
    expect(state.heat).toBe(100);
    expect(logged(events, 'CRAC-3 returned to 60%: A-03 offline')).toBe(true);
    expect(events).toContainEqual({ type: 'event-pill', text: 'CRAC-3 back to 60%', cool: true });
    expect(events).toContainEqual({ type: 'stand-down' });
  });

  it('boost on B-07, then B-07 shuts down: same, with the rack named', () => {
    let s: SimState = { ...createInitialState(413), started: true, boosted: true, heat: 100 };
    s = withRack(s, 'B-07', { T: 39, runaway: 9, state: 'critical', acted: 'fix' });
    const { state, events } = runReadings(s, 3);
    expect(state.racks['B-07'].down).toBe(true);
    expect(state.ended).toBe('fail');
    expect(state.boosted).toBe(false);
    expect(state.heat).toBe(100);
    expect(logged(events, 'CRAC-3 returned to 60%: B-07 offline')).toBe(true);
  });

  it('waits for every holder: B-07 calm does not stand down while A-03 is still being cooled', () => {
    let s: SimState = { ...createInitialState(414), started: true, boosted: true, n: 10 };
    s = withRack(s, 'B-07', { state: 'calm', T: 24, acted: 'fix' });
    s = withRack(s, 'A-03', { state: 'critical', T: 34, acted: 'fix', fault: true, faultLvl: 1, prog: 0.2 });
    const { state } = runReadings(s, 4);
    expect(state.racks['A-03'].state).not.toBe('calm');
    expect(state.boosted).toBe(true);
    expect(state.standDownAt).toBeNull();
  });

  it('a revert inside the window cancels the stand-down: no log, no pill', () => {
    let s = advanceReading(nearResolvedState(415)).state;
    s = { ...s, boosted: false }; // undo() on B-07
    const { events } = runReadings(s, 3);
    expect(events.some((e) => e.type === 'stand-down')).toBe(false);
  });

  it('reset mid-boost: a fresh state carries no boost and no pending stand-down', () => {
    // The live reset (src/live/useLiveSim.ts) swaps in createInitialState and
    // clears its wall-clock timers; the stand-down is a reading count in SimState.
    const fresh = createInitialState(416);
    expect(fresh.boosted).toBe(false);
    expect(fresh.standDownAt).toBeNull();
    const { events } = runReadings(fresh, 20);
    expect(events.some((e) => e.type === 'stand-down')).toBe(false);
  });
});

describe('the aftershock (docs/decisions.md: "~14 readings after the first outcome")', () => {
  it('schedules automatically, exactly 14 readings out, only after the first (phase 1) incident', () => {
    const { state } = advanceReading(nearResolvedState(420));
    expect(state.ended).toBe('ok');
    expect(state.secondAt! - state.n).toBe(14);
  });

  it('fires on schedule and faults A-03 with no head start', () => {
    let s = advanceReading(nearResolvedState(421)).state;
    expect(s.racks['A-03'].fault).toBe(false);

    let firedAtDelta = -1;
    const start = s.n;
    for (let i = 0; i < 20; i++) {
      s = advanceReading(s).state;
      if (s.racks['A-03'].fault) {
        firedAtDelta = s.n - start;
        break;
      }
    }
    expect(firedAtDelta).toBe(14);
    // No head start: within the same reading the fault begins, degradation has
    // had exactly one tick to apply (fault is set, then that reading's
    // degradation step runs), not the 0.2 head start the manual trigger gives.
    expect(s.racks['A-03'].faultLvl).toBeCloseTo(0.11, 6);
  });

  it('does not schedule an aftershock for a phase-2 (A-03-led) incident', () => {
    let s: SimState = { ...createInitialState(422), started: true, phase: 2, phaseRack: 'A-03', phaseN: 0, n: 10 };
    s = withRack(s, 'B-07', { state: 'calm', T: 24 });
    s = withRack(s, 'A-03', { state: 'calm', T: 24, peak: 30, fault: true, acted: 'fix' });
    const { state } = advanceReading(s);
    expect(state.ended).toBe('ok');
    expect(state.secondAt).toBeNull();
  });

  it('on demand from the panel reopens a resolved incident as phase 2, with a "new alert" pill', () => {
    let s = advanceReading(nearResolvedState(423)).state;
    expect(s.ended).toBe('ok');

    const { state, events } = failSecondRack(s); // manual panel trigger
    expect(state.ended).toBeNull();
    expect(state.phase).toBe(2);
    expect(state.phaseRack).toBe('A-03');
    expect(events).toContainEqual({ type: 'event-pill', text: 'New alert: fan failure on rack A-03', cool: false });
  });
});
