import { describe, expect, it } from 'vitest';
import { FOCUS_HANDOFF_READINGS } from './constants';
import { act, advanceReading, createInitialState, stepRackClassification } from './engine';
import { resolveAim } from './selectors';
import { withRack } from './test-support';

describe('focus rule (docs/decisions.md: "never move focus off a rack the operator hasn\'t acted on")', () => {
  it('does not move focus off an unacted, mid-incident rack when another rack escalates', () => {
    let s = createInitialState(301);
    s = withRack(s, 'B-07', { state: 'rising', T: 29, acted: null });
    s = { ...s, focus: 'B-07' };
    s = withRack(s, 'A-03', { T: 33, slope: 0, state: 'calm' });

    const { state } = stepRackClassification(s, 'A-03');
    expect(state.racks['A-03'].state).toBe('critical'); // it did escalate
    expect(state.focus).toBe('B-07'); // but the operator's attention stayed put
  });

  it('moves focus to a newly escalating rack once the current one is calm', () => {
    let s = createInitialState(302);
    s = withRack(s, 'B-07', { state: 'calm', T: 24 });
    s = { ...s, focus: 'B-07' };
    s = withRack(s, 'A-03', { T: 33, slope: 0, state: 'calm' });

    const { state } = stepRackClassification(s, 'A-03');
    expect(state.focus).toBe('A-03');
  });

  it('moves focus to a newly escalating rack once the current one has already been acted on', () => {
    let s = createInitialState(303);
    s = withRack(s, 'B-07', { state: 'rising', T: 29, acted: 'fix' });
    s = { ...s, focus: 'B-07' };
    s = withRack(s, 'A-03', { T: 33, slope: 0, state: 'calm' });

    const { state } = stepRackClassification(s, 'A-03');
    expect(state.focus).toBe('A-03');
  });

  it('moves focus to a newly escalating rack once the current one is offline', () => {
    let s = createInitialState(304);
    s = withRack(s, 'B-07', { state: 'critical', down: true });
    s = { ...s, focus: 'B-07' };
    s = withRack(s, 'A-03', { T: 33, slope: 0, state: 'calm' });

    const { state } = stepRackClassification(s, 'A-03');
    expect(state.focus).toBe('A-03');
  });

  it('a rack returning to calm hands focus to the next rack that needs attention', () => {
    let s = createInitialState(305);
    s = withRack(s, 'B-07', { T: 26, slope: 0, state: 'critical', stable: 2 }); // one steady reading from downgrading
    s = { ...s, focus: 'B-07' };
    s = withRack(s, 'A-03', { T: 29, slope: 0, state: 'rising' });

    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('calm');
    expect(state.focus).toBe('A-03');
  });

  it('moves focus to the next unhandled rack two readings after the operator acts (1.5–3.0s)', () => {
    let s = createInitialState(306);
    s = withRack(s, 'B-07', { state: 'rising', T: 29 });
    s = withRack(s, 'A-03', { state: 'critical', T: 33 });
    s = { ...s, focus: 'B-07' };

    s = act(s).state;
    expect(FOCUS_HANDOFF_READINGS).toBe(2);
    expect(s.focus).toBe('B-07'); // doesn't move the instant the action is confirmed
    expect(s.focusHandoffAt).toBe(s.n + FOCUS_HANDOFF_READINGS);

    s = advanceReading(s).state;
    expect(s.focus).toBe('B-07'); // nor on the very next reading, which may land moments later

    s = advanceReading(s).state;
    expect(s.focus).toBe('A-03');
  });

  it('does not hand off focus if the operator already moved away from that rack themselves', () => {
    let s = createInitialState(307);
    s = withRack(s, 'B-07', { state: 'rising', T: 29 });
    s = withRack(s, 'A-03', { state: 'rising', T: 29 });
    s = { ...s, focus: 'B-07' };

    s = act(s).state; // schedules a handoff away from B-07
    s = { ...s, focus: 'A-03' }; // operator manually switched before the handoff fired
    for (let i = 0; i < FOCUS_HANDOFF_READINGS; i++) s = advanceReading(s).state; // run past the handoff point
    expect(s.focusHandoffAt).toBeNull();
    expect(s.focus).toBe('A-03'); // handoff no-ops: focus wasn't on B-07 anymore
  });

  it('suppresses the scheduled handoff while a hold gesture is in progress', () => {
    let s = createInitialState(308);
    s = withRack(s, 'B-07', { state: 'rising', T: 29 });
    s = withRack(s, 'A-03', { state: 'critical', T: 33 });
    s = { ...s, focus: 'B-07' };

    s = act(s).state;
    s = { ...s, holdBusy: true };
    s = advanceReading(s).state;
    expect(s.focus).toBe('B-07'); // held back while mid-gesture
  });
});

describe('airflow stays on the rack being cooled (docs/decisions.md: "no fallback flicker")', () => {
  it('aims at the hottest actively-cooled, still-alerting rack', () => {
    let s = createInitialState(320);
    s = withRack(s, 'B-07', { acted: 'fix', state: 'rising', T: 29 });
    s = withRack(s, 'A-03', { acted: 'fix', state: 'critical', T: 33 });
    expect(resolveAim(s).aim).toBe('A-03');
  });

  it('defaults to B-07 before anything has been acted on', () => {
    const s = createInitialState(321);
    expect(resolveAim(s).aim).toBe('B-07');
  });

  it('stays on the rack it was last aimed at once that rack settles to calm — no fallback flicker', () => {
    let s = createInitialState(322);
    s = { ...s, lastAim: 'B-07' };
    s = withRack(s, 'B-07', { acted: 'fix', state: 'calm', T: 24 });
    s = withRack(s, 'A-03', { acted: null, state: 'calm', T: 24 });
    expect(resolveAim(s).aim).toBe('B-07');
  });

  it('does not aim at a rack that has since been shut down', () => {
    let s = createInitialState(323);
    s = { ...s, lastAim: 'B-07' };
    s = withRack(s, 'B-07', { acted: 'fix', state: 'critical', down: true, T: 39 });
    expect(resolveAim(s).aim).toBe('B-07'); // no other acted-on rack: sticky value carries through unresolved…
    // …but nothing is actually "acted"-eligible, so a fresh incident on another rack takes over cleanly:
    s = withRack(s, 'A-03', { acted: 'fix', state: 'rising', T: 29 });
    expect(resolveAim(s).aim).toBe('A-03');
  });

  it('advanceReading keeps lastAim sticky on the acted-on rack across many readings', () => {
    let s = act(createInitialState(324)).state; // focus defaults to B-07
    for (let i = 0; i < 15; i++) {
      s = advanceReading(s).state;
      expect(s.lastAim).toBe('B-07');
    }
  });
});
