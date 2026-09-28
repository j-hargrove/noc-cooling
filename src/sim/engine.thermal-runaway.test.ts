import { describe, expect, it } from 'vitest';
import { advanceReading, createInitialState } from './engine';
import { shownState, target } from './rack';
import { runReadings, withRack } from './test-support';
import type { SimEvent, SimState } from './types';

/** Forces B-07 hot with nothing done about it: heat load pinned high, never acted on. */
function unaddressedHotState(seed: number): SimState {
  return { ...createInitialState(seed), heat: 100 };
}

describe('unaddressed critical runs away (docs/decisions.md)', () => {
  it('throttles (counts readings at/above 35°C) before it shuts down at 38°C', () => {
    let s = unaddressedHotState(101);
    let shutdownAt = -1;
    let firstThrottleAt = -1;
    for (let i = 1; i <= 400; i++) {
      const r = advanceReading(s);
      s = r.state;
      if (firstThrottleAt < 0 && s.racks['B-07'].thr > 0) firstThrottleAt = i;
      if (r.events.some((e) => e.type === 'outcome' && e.kind === 'fail')) {
        shutdownAt = i;
        break;
      }
    }
    expect(firstThrottleAt).toBeGreaterThan(0);
    expect(shutdownAt).toBeGreaterThan(0);
    expect(firstThrottleAt).toBeLessThan(shutdownAt);
    expect(s.racks['B-07'].down).toBe(true);
    expect(s.racks['B-07'].T).toBeGreaterThanOrEqual(38);
    expect(s.racks['B-07'].downAt).not.toBe('');
    expect(s.ended).toBe('fail');
  });

  it('shutdown is announced assertively and logged, and emits the shutdown lock notification', () => {
    let s = unaddressedHotState(102);
    let events: SimEvent[] = [];
    for (let i = 0; i < 400; i++) {
      const r = advanceReading(s);
      s = r.state;
      events = r.events;
      if (s.racks['B-07'].down) break;
    }
    expect(s.racks['B-07'].down).toBe(true);
    expect(events).toContainEqual({
      type: 'announce',
      urgency: 'assertive',
      message: 'Rack B-07 has shut down. Servers powered off to protect hardware.',
    });
    expect(events.some((e) => e.type === 'log' && e.entry.text === 'B-07 shut down at 38°C to protect hardware')).toBe(true);
    expect(events).toContainEqual({
      type: 'notify',
      rackId: 'B-07',
      title: 'Rack B-07 shut down',
      body: 'Inlet hit 38°C. Servers powered off to protect hardware.',
      critical: true,
    });
  });

  it('a shut-down rack stops radiating heat: its target collapses to ambient', () => {
    const down = withRack(createInitialState(103), 'B-07', { down: true, T: 39, runaway: 9, faultLvl: 1 });
    expect(target(down, down.racks['B-07'])).toBe(24);
  });

  it('a shut-down rack cools toward ambient and never throttles or re-escalates again', () => {
    let s = unaddressedHotState(104);
    for (let i = 0; i < 400 && !s.racks['B-07'].down; i++) {
      s = advanceReading(s).state;
    }
    expect(s.racks['B-07'].down).toBe(true);
    const thrAtShutdown = s.racks['B-07'].thr;
    const stateAtShutdown = s.racks['B-07'].state;
    const tAtShutdown = s.racks['B-07'].T;

    const after = runReadings(s, 60).state;
    expect(after.racks['B-07'].thr).toBe(thrAtShutdown); // frozen: down racks are never evaluated for throttling
    expect(after.racks['B-07'].state).toBe(stateAtShutdown); // frozen: never reclassified
    expect(shownState(after.racks['B-07'])).toBe('offline');
    expect(after.racks['B-07'].T).toBeLessThan(tAtShutdown); // cooling, not still climbing
    expect(after.racks['B-07'].T).toBeGreaterThan(23.5); // settles toward ambient (24°C ± reading noise)
    expect(after.racks['B-07'].T).toBeLessThan(24.5);
  });
});
