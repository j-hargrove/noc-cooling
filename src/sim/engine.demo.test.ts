import { describe, expect, it } from 'vitest';
import { act, advanceReading, createInitialState, failSecondRack, override, setHeatLoad, startIncident } from './engine';
import { withRack } from './test-support';
import type { SimState } from './types';

describe('heat-load slider (demo panel)', () => {
  it('sets the aisle heat load directly', () => {
    const s = setHeatLoad(createInitialState(501), 65);
    expect(s.heat).toBe(65);
  });

  it("cancels an incident's ramp in flight — the operator's hand on the slider wins", () => {
    const running = startIncident(createInitialState(502)).state;
    expect(running.incident).toBe(88);
    const s = setHeatLoad(running, 40);
    expect(s.incident).toBeNull();
    expect(advanceReading(s).state.heat).toBe(40); // no longer ramping toward 88
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
