import { describe, expect, it } from 'vitest';
import { createInitialState, stepRackClassification } from './engine';
import { withRack } from './test-support';

describe('escalation and hysteresis (docs/decisions.md: "Hysteresis: 3 steady readings before any downgrade. Escalation is immediate.")', () => {
  it('escalates on a single qualifying reading', () => {
    let s = createInitialState(1);
    s = withRack(s, 'B-07', { T: 33, slope: 0, state: 'calm', stable: 0 });
    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('critical');
  });

  it('does not downgrade after only one or two steady readings', () => {
    let s = createInitialState(2);
    s = withRack(s, 'B-07', { T: 26, slope: 0, state: 'critical', stable: 0 });

    let r = stepRackClassification(s, 'B-07');
    s = r.state;
    expect(s.racks['B-07'].state).toBe('critical');
    expect(s.racks['B-07'].stable).toBe(1);

    r = stepRackClassification(s, 'B-07');
    s = r.state;
    expect(s.racks['B-07'].state).toBe('critical');
    expect(s.racks['B-07'].stable).toBe(2);
  });

  it('downgrades on the third consecutive steady reading', () => {
    let s = createInitialState(3);
    s = withRack(s, 'B-07', { T: 26, slope: 0, state: 'critical', stable: 2 });
    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('calm');
    expect(state.racks['B-07'].stable).toBe(0);
  });

  it('downgrades through recovering, not straight to calm, when the trajectory says so', () => {
    let s = createInitialState(4);
    s = withRack(s, 'B-07', { T: 29, slope: -0.02, state: 'critical', stable: 2 });
    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('recovering');
  });

  it('resets the steady-reading count on any reading that is not still lower than the current state', () => {
    let s = createInitialState(5);
    // two steady (lower) readings banked, then a reading that's back at the current severity
    s = withRack(s, 'B-07', { T: 33, slope: 0, state: 'critical', stable: 2 });
    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('critical');
    expect(state.racks['B-07'].stable).toBe(0);
  });

  it('re-escalation from mid-hysteresis is immediate, not blocked by the pending downgrade', () => {
    let s = createInitialState(6);
    // one steady (lower) reading banked at 'rising', then it jumps straight to critical
    s = withRack(s, 'B-07', { T: 33, slope: 0, state: 'rising', stable: 1 });
    const { state } = stepRackClassification(s, 'B-07');
    expect(state.racks['B-07'].state).toBe('critical');
    expect(state.racks['B-07'].stable).toBe(0);
  });
});

describe('critical announcement copy (contract/a11y-spec.md §1)', () => {
  it('matches the specified wording for B-07 (recommend boosting CRAC-3)', () => {
    let s = createInitialState(7);
    s = withRack(s, 'B-07', { T: 32.4, slope: 1, state: 'rising', stable: 0 });
    const { events } = stepRackClassification(s, 'B-07');
    expect(events).toContainEqual({
      type: 'announce',
      urgency: 'assertive',
      message: 'Critical. Rack B-07 inlet 32.4 degrees and rising. Recommended: boost CRAC-3 fan.',
    });
  });

  it('matches the specified wording for A-03 (fan failure, recommend cooling A-03)', () => {
    let s = createInitialState(8);
    s = withRack(s, 'A-03', { T: 32.4, slope: 1, state: 'rising', stable: 0 });
    const { events } = stepRackClassification(s, 'A-03');
    expect(events).toContainEqual({
      type: 'announce',
      urgency: 'assertive',
      message: 'Critical. Rack A-03 inlet 32.4 degrees and rising. Fan failure. Recommended: cool A-03.',
    });
  });

  it('fires a shock event and a haptic pattern on entry to critical', () => {
    let s = createInitialState(9);
    s = withRack(s, 'B-07', { T: 33, slope: 0, state: 'rising', stable: 0 });
    const { events } = stepRackClassification(s, 'B-07');
    expect(events).toContainEqual({ type: 'shock', rackId: 'B-07' });
    expect(events).toContainEqual({ type: 'haptic', pattern: [70, 50, 70] });
  });

  it('does not fire a shock or critical haptic on a non-critical transition', () => {
    let s = createInitialState(10);
    s = withRack(s, 'B-07', { T: 28, slope: 1, state: 'calm', stable: 0 });
    const { events } = stepRackClassification(s, 'B-07');
    expect(events.some((e) => e.type === 'shock')).toBe(false);
    expect(events.some((e) => e.type === 'haptic')).toBe(false);
  });
});
