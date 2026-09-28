import { describe, expect, it } from 'vitest';
import { createInitialState, dismissIntro, openLock, startIncident } from './engine';
import { withRack } from './test-support';

describe('intro overlay', () => {
  it('starts visible (not dismissed)', () => {
    expect(createInitialState(1).introDismissed).toBe(false);
  });

  it('"Look around first" dismisses it without starting anything', () => {
    const s = dismissIntro(createInitialState(2));
    expect(s.introDismissed).toBe(true);
    expect(s.started).toBe(false);
    expect(s.incident).toBeNull();
  });

  it('is idempotent', () => {
    const once = dismissIntro(createInitialState(3));
    const twice = dismissIntro(once);
    expect(twice).toEqual(once);
  });

  it('starting the incident always dismisses the intro too', () => {
    const s = startIncident(createInitialState(4)).state;
    expect(s.introDismissed).toBe(true);
  });
});

describe('lock screen', () => {
  it('starts hidden', () => {
    expect(createInitialState(10).locked).toBe(false);
  });

  it('engages when the incident starts "from lock" and the focused rack is calm', () => {
    const s = startIncident(createInitialState(11), { fromLock: true }).state;
    expect(s.locked).toBe(true);
  });

  it('does not engage from lock if the focused rack is not calm at that moment', () => {
    const notCalm = withRack(createInitialState(12), 'B-07', { state: 'rising' });
    const s = startIncident(notCalm, { fromLock: true }).state;
    expect(s.locked).toBe(false);
  });

  it('does not engage unless fromLock is requested', () => {
    const s = startIncident(createInitialState(13), { fromLock: false }).state;
    expect(s.locked).toBe(false);
    const sDefault = startIncident(createInitialState(14)).state;
    expect(sDefault.locked).toBe(false);
  });

  it('opens on tap, regardless of anything else about the incident', () => {
    let s = startIncident(createInitialState(15), { fromLock: true }).state;
    expect(s.locked).toBe(true);
    s = openLock(s);
    expect(s.locked).toBe(false);
  });

  it('opening an already-open lock is a no-op', () => {
    const s = createInitialState(16);
    expect(openLock(s)).toEqual(s);
  });
});
