import { describe, expect, it } from 'vitest';
import { RESOLUTION_MIN_READINGS } from './constants';
import { advanceReading, createInitialState, failSecondRack } from './engine';
import { withRack } from './test-support';
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
    expect(events.some((e) => e.type === 'log' && e.entry.text === 'CRAC-3 returned to 60% after resolution')).toBe(true);
  });

  it('does not stand down after a "fail" outcome', () => {
    let s: SimState = { ...createInitialState(412), boosted: true, heat: 100 };
    s = withRack(s, 'B-07', { T: 39, runaway: 9, state: 'critical' });
    const { state } = advanceReading(s);
    expect(state.racks['B-07'].down).toBe(true);
    expect(state.ended).toBe('fail');
    expect(state.standDownAt).toBeNull();
    expect(state.boosted).toBe(true);
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
