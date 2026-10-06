import { describe, expect, it } from 'vitest';
import { act, advanceReading, createInitialState, failSecondRack, override, setHeatLoad, startIncident } from './engine';
import { withRack } from './test-support';
import type { SimState } from './types';

/** Steps until `done`, failing the test if it takes more than `max` readings. */
function until(s: SimState, done: (s: SimState) => boolean, max = 200): SimState {
  for (let i = 0; i < max && !done(s); i++) s = advanceReading(s).state;
  expect(done(s), 'condition reached').toBe(true);
  return s;
}

describe('incident heat ramp (docs/decisions.md: +35 per reading)', () => {
  it('ramps 30 → 65 → 88 and stops at the target', () => {
    let s = startIncident(createInitialState(530)).state;
    const heats: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = advanceReading(s).state;
      heats.push(s.heat);
    }
    expect(heats).toEqual([65, 88, 88, 88]);
    expect(s.incident).toBeNull();
  });

  it('first "drifting" notification lands on reading 3 from a fresh start (was 4 at +15)', () => {
    for (const seed of [1, 7, 42, 99, 12345]) {
      let s = startIncident(createInitialState(seed), { fromLock: true }).state;
      let at = 0;
      for (let n = 1; n <= 10 && !at; n++) {
        const r = advanceReading(s); // n = 1 is the reading the Run click fires immediately
        s = r.state;
        if (r.events.some((e) => e.type === 'notify' && !e.critical)) at = n;
      }
      expect(at, `seed ${seed}`).toBe(3);
    }
  });
});

describe('heat-load slider (demo panel)', () => {
  it('sets the aisle heat load directly', () => {
    const s = setHeatLoad(createInitialState(501), 65);
    expect(s.heat).toBe(65);
  });

  it('regression: locked while an incident runs — dragging to 20 on the next reading used to strand it', () => {
    // Run, then drag to 20 one reading in: the ramp was cancelled before
    // B-07 peaked, so the incident could never resolve (started, never ended).
    let s = advanceReading(startIncident(createInitialState(502)).state).state;
    expect(s.heat).toBe(65);
    expect(setHeatLoad(s, 20)).toBe(s);
    s = until(s, (x) => x.ended !== null, 200);
    expect(s.heat).toBe(88); // the ramp ran to its target
  });

  it('unlocks at the outcome, on stand-down and on reset; failing a second rack re-locks it', () => {
    let s = startIncident(createInitialState(507), { autoSecond: false }).state;
    s = until(s, (x) => x.racks['B-07'].state !== 'calm');
    s = act(s).state;
    s = until(s, (x) => x.ended === 'ok');
    expect(setHeatLoad(s, 50).heat).toBe(50); // outcome
    s = until(s, (x) => !x.boosted);
    expect(s.heat).toBe(30); // stand-down's reset, unchanged
    expect(setHeatLoad(s, 50).heat).toBe(50); // after stand-down
    const reopened = failSecondRack(s).state;
    expect(setHeatLoad(reopened, 50)).toBe(reopened); // incident running again
    expect(setHeatLoad(createInitialState(508), 50).heat).toBe(50); // reset / idle aisle
  });

  it('never lowered by starting an incident: a load above 88 stays put', () => {
    let s = startIncident(setHeatLoad(createInitialState(509), 100)).state;
    for (let i = 0; i < 3; i++) {
      s = advanceReading(s).state;
      expect(s.heat).toBe(100);
    }
    expect(s.incident).toBeNull();
    // Below the target it still ramps up as before: 30 → 65 → 88.
    let t = startIncident(createInitialState(510)).state;
    t = advanceReading(t).state;
    expect(t.heat).toBe(65);
    expect(advanceReading(t).state.heat).toBe(88);
  });

  it('clamps to 0..100 and rounds to whole percent', () => {
    expect(setHeatLoad(createInitialState(503), 140).heat).toBe(100);
    expect(setHeatLoad(createInitialState(504), -5).heat).toBe(0);
    expect(setHeatLoad(createInitialState(505), 42.6).heat).toBe(43);
  });

  it('is a no-op (same object) when nothing changes', () => {
    const s = createInitialState(506);
    expect(setHeatLoad(s, s.heat)).toBe(s);
  });
});

describe('an action that completes after the rack stopped offering one', () => {
  it('a hold that finishes after the rack shut down does nothing — no boost, no log', () => {
    const down = withRack(createInitialState(520), 'B-07', { state: 'critical', down: true, downAt: '02:21:45' });
    const { state, events } = act(down);
    expect(state).toBe(down);
    expect(events).toEqual([]);
    expect(state.boosted).toBe(false);
  });

  it('acting twice on the same rack logs once', () => {
    const rising = withRack(createInitialState(521), 'B-07', { state: 'rising', T: 28 });
    const once = act(rising).state;
    const again = act(once);
    expect(again.state).toBe(once);
    expect(again.events).toEqual([]);
  });

  it('override is guarded the same way', () => {
    const down = withRack(createInitialState(522), 'B-07', { state: 'critical', down: true });
    expect(override(down).events).toEqual([]);
  });
});

describe('second rack reopening an ended incident notifies the lock screen', () => {
  function resolved(seed: number): SimState {
    let s: SimState = { ...createInitialState(seed), started: true, phase: 1, phaseRack: 'B-07', phaseN: 0, n: 10, boosted: true };
    s = withRack(s, 'B-07', { state: 'calm', T: 24, peak: 30, acted: 'fix' });
    s = withRack(s, 'A-03', { state: 'calm', T: 24 });
    return advanceReading(s).state;
  }

  it('emits a rising notify for A-03 when the fault reopens the screen', () => {
    const s = resolved(510);
    expect(s.ended).toBe('ok');
    const { events } = failSecondRack(s);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'notify', rackId: 'A-03', critical: false, title: 'Rack A-03 inlet drifting' }),
    );
  });

  it('does not emit one when the fault lands mid-incident (nothing is being reopened)', () => {
    const s = startIncident(createInitialState(511)).state;
    const { events } = failSecondRack(s);
    expect(events.some((e) => e.type === 'notify')).toBe(false);
  });
});
