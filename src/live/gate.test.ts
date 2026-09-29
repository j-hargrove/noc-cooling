import { describe, expect, it } from 'vitest';
import { advanceReading, createInitialState, openLock, startIncident } from '../sim/engine';
import type { SimEvent, SimState } from '../sim/types';
import { gateEvents } from './gate';

const shock: SimEvent = { type: 'shock', rackId: 'B-07' };
const notify: SimEvent = { type: 'notify', rackId: 'B-07', critical: true, title: 't', body: 'b' };
const announce: SimEvent = { type: 'announce', urgency: 'assertive', message: 'm' };
const haptic: SimEvent = { type: 'haptic', pattern: [70, 50, 70] };

describe('gateEvents', () => {
  it('drops the shockwave while locked — it never fires behind the lock screen', () => {
    expect(gateEvents([shock], { locked: true, reducedMotion: false })).toEqual([]);
  });

  it('plays the shockwave once unlocked', () => {
    expect(gateEvents([shock], { locked: false, reducedMotion: false })).toEqual([shock]);
  });

  it('drops the shockwave under reduced motion, locked or not', () => {
    expect(gateEvents([shock], { locked: false, reducedMotion: true })).toEqual([]);
    expect(gateEvents([shock], { locked: true, reducedMotion: true })).toEqual([]);
  });

  it('plays lock-screen notifications only while locked', () => {
    expect(gateEvents([notify], { locked: true, reducedMotion: false })).toEqual([notify]);
    expect(gateEvents([notify], { locked: false, reducedMotion: false })).toEqual([]);
  });

  it('never gates announcements or haptics — a locked operator still needs them', () => {
    for (const ctx of [
      { locked: true, reducedMotion: true },
      { locked: false, reducedMotion: false },
    ]) {
      expect(gateEvents([announce, haptic], ctx)).toEqual([announce, haptic]);
    }
  });

  it('preserves order', () => {
    expect(gateEvents([announce, shock, haptic, notify], { locked: false, reducedMotion: false })).toEqual([announce, shock, haptic]);
  });
});

describe('an incident run from the lock screen, end to end through the gate', () => {
  /** Runs readings with the gate applied exactly as the live controller applies it (post-step `locked`). */
  function run(state: SimState, readings: number) {
    let s = state;
    const raw: SimEvent[] = [];
    const played: SimEvent[] = [];
    for (let i = 0; i < readings; i++) {
      const r = advanceReading(s);
      s = r.state;
      raw.push(...r.events);
      played.push(...gateEvents(r.events, { locked: s.locked, reducedMotion: false }));
    }
    return { state: s, raw, played };
  }

  it('the sim still emits a shock on escalation to critical, but none of it plays while locked', () => {
    const locked = startIncident(createInitialState(7), { fromLock: true }).state;
    expect(locked.locked).toBe(true);
    const { state, raw, played } = run(locked, 30);

    expect(state.racks['B-07'].state === 'critical' || state.racks['B-07'].down).toBe(true);
    expect(raw.some((e) => e.type === 'shock')).toBe(true); // the sim fires unconditionally…
    expect(played.some((e) => e.type === 'shock')).toBe(false); // …and the gate holds it back
    expect(played.some((e) => e.type === 'notify' && e.critical)).toBe(true); // the lock screen hears about it instead
  });

  it('once opened, the same escalation would play the shock and stop notifying', () => {
    // Open the lock before anything escalates, then run the same incident.
    const opened = openLock(startIncident(createInitialState(7), { fromLock: true }).state);
    const { played } = run(opened, 30);
    expect(played.some((e) => e.type === 'shock')).toBe(true);
    expect(played.some((e) => e.type === 'notify')).toBe(false);
  });
});
