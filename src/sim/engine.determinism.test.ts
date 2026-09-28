import { describe, expect, it } from 'vitest';
import { act, advanceReading, createInitialState, override, startIncident, switchFocus, undo } from './engine';
import type { SimEvent, SimState } from './types';

function runScenario(seed: number) {
  let s = createInitialState(seed);
  const events: SimEvent[] = [];
  const step = (r: { state: SimState; events: SimEvent[] }) => {
    s = r.state;
    events.push(...r.events);
  };
  step(startIncident(s));
  for (let i = 0; i < 5; i++) step(advanceReading(s));
  step(act(s));
  for (let i = 0; i < 5; i++) step(advanceReading(s));
  s = switchFocus(s, 'A-03');
  step(override(s));
  for (let i = 0; i < 5; i++) step(advanceReading(s));
  step(undo(s));
  for (let i = 0; i < 3; i++) step(advanceReading(s));
  return { state: s, events };
}

describe('determinism', () => {
  it('the same seed and the same action sequence produce an identical trace', () => {
    const a = runScenario(2024);
    const b = runScenario(2024);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('different seeds produce different initial rack temperatures', () => {
    const s1 = createInitialState(1);
    const s2 = createInitialState(2);
    expect(s1.racks['B-07'].T).not.toBe(s2.racks['B-07'].T);
  });

  it('createInitialState is itself deterministic', () => {
    expect(createInitialState(77)).toEqual(createInitialState(77));
  });
});

describe('purity: sim functions never mutate their input state', () => {
  it('advanceReading leaves the input state untouched', () => {
    const before = createInitialState(88);
    const snapshot = structuredClone(before);
    advanceReading(before);
    expect(before).toEqual(snapshot);
  });

  it('act leaves the input state untouched', () => {
    const before = createInitialState(89);
    const snapshot = structuredClone(before);
    act(before);
    expect(before).toEqual(snapshot);
  });

  it('a chain of actions never retroactively changes an earlier snapshot', () => {
    const s0 = createInitialState(90);
    const snap0 = structuredClone(s0);
    const s1 = startIncident(s0).state;
    const snap1 = structuredClone(s1);
    advanceReading(s1);
    expect(s0).toEqual(snap0);
    expect(s1).toEqual(snap1);
  });
});
