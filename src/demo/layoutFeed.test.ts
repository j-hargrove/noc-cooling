import { describe, expect, it } from 'vitest';
import { MULTI_RACK_OVERRIDE, ROW_WEIGHTS } from '../compose/layoutTokens';
import { createInitialState, dismissIntro } from '../sim/engine';
import { withRack } from '../sim/test-support';
import type { SimState } from '../sim/types';
import { describeLayoutChange, hostOrigin, isAllowedHostOrigin, layoutMessage } from './layoutFeed';

/** B-07 focused at the given state, A-03 calm. */
function base(seed = 1): SimState {
  let s = dismissIntro(createInitialState(seed));
  s = withRack(s, 'A-03', { state: 'calm', T: 24 });
  s = withRack(s, 'B-07', { state: 'critical', T: 33 });
  return { ...s, focus: 'B-07' };
}

describe('layout feed: allowed hosts', () => {
  it('allows the case-study site and localhost on any port', () => {
    expect(isAllowedHostOrigin('https://jonathanhargrove.com')).toBe(true);
    expect(isAllowedHostOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedHostOrigin('http://localhost')).toBe(true);
    expect(isAllowedHostOrigin('https://localhost:8443')).toBe(true);
  });

  it('refuses everything else, including lookalikes', () => {
    for (const o of [
      'http://jonathanhargrove.com',
      'https://www.jonathanhargrove.com',
      'https://jonathanhargrove.com.evil.example',
      'https://evil.example',
      'https://localhost.evil.example',
      'http://localhost:5173/path',
      'file://localhost',
      'null',
      '',
      '*',
    ]) {
      expect(isAllowedHostOrigin(o), o).toBe(false);
    }
  });
});

describe('layout feed: host origin resolution', () => {
  const framed = (ancestorOrigins?: string[]) => {
    const location = { ancestorOrigins } as unknown as Location;
    return { parent: {} as Window, location };
  };

  it('is silent when not framed', () => {
    const win = { location: { ancestorOrigins: ['https://jonathanhargrove.com'] } as unknown as Location } as Pick<Window, 'parent' | 'location'>;
    (win as { parent: unknown }).parent = win;
    expect(hostOrigin(win, 'https://jonathanhargrove.com/')).toBeNull();
  });

  it('uses the immediate parent from ancestorOrigins when available', () => {
    expect(hostOrigin(framed(['http://localhost:4321', 'https://evil.example']), '')).toBe('http://localhost:4321');
  });

  it('trusts ancestorOrigins over a disagreeing referrer', () => {
    expect(hostOrigin(framed(['https://evil.example']), 'https://jonathanhargrove.com/work')).toBeNull();
  });

  it('falls back to the referrer origin without ancestorOrigins (Firefox)', () => {
    expect(hostOrigin(framed(undefined), 'https://jonathanhargrove.com/work/noc?x=1')).toBe('https://jonathanhargrove.com');
    expect(hostOrigin(framed(undefined), 'https://evil.example/')).toBeNull();
    expect(hostOrigin(framed(undefined), '')).toBeNull();
  });
});

describe('layout feed: messages', () => {
  it('posts the first layout with the payload shape the host expects', () => {
    const msg = layoutMessage(null, base());
    expect(msg).toEqual({
      type: 'noc-layout',
      regions: { field: true, queue: false, readout: true, action: true },
      weights: ROW_WEIGHTS.critical,
      state: 'critical',
      reason: 'initial layout: B-07 critical',
    });
  });

  it('stays silent while the layout is unchanged, even as temperatures move', () => {
    const s = base();
    expect(layoutMessage(s, withRack(s, 'B-07', { T: 34.5 }))).toBeNull();
  });

  it('second rack goes critical: queue added', () => {
    const s = base();
    const next = withRack(s, 'A-03', { state: 'critical', T: 33 });
    const msg = layoutMessage(s, next)!;
    expect(msg.reason).toBe('second rack (A-03) critical: queue added');
    expect(msg.regions.queue).toBe(true);
    expect(msg.weights).toEqual({ ...ROW_WEIGHTS.critical, ...MULTI_RACK_OVERRIDE });
  });

  it('focused rack changes state', () => {
    const s = withRack(base(), 'B-07', { state: 'rising', T: 29 });
    const msg = layoutMessage(s, withRack(s, 'B-07', { state: 'critical', T: 32.5 }))!;
    expect(msg.state).toBe('critical');
    expect(msg.reason).toBe('B-07 rising → critical');
  });

  it('focused rack shuts down', () => {
    const s = base();
    expect(layoutMessage(s, withRack(s, 'B-07', { down: true, T: 38 }))!.reason).toBe('B-07 critical → offline');
  });

  it('focus hands off to the queued rack: queue removed, no double mention', () => {
    let s = withRack(base(), 'A-03', { state: 'critical', T: 33 });
    s = withRack(s, 'B-07', { state: 'recovering', T: 30 });
    const next = { ...withRack(s, 'B-07', { state: 'calm', T: 26 }), focus: 'A-03' as const };
    expect(describeLayoutChange(s, next)).toBe('focus moved to second rack (A-03) (critical); queue removed');
  });

  it('queued rack settles: queue removed', () => {
    const s = withRack(base(), 'A-03', { state: 'recovering', T: 28 });
    const msg = layoutMessage(s, withRack(s, 'A-03', { state: 'calm', T: 26 }))!;
    expect(msg.reason).toBe('second rack (A-03) calm: queue removed');
    expect(msg.regions.queue).toBe(false);
  });

  it('combines simultaneous causes', () => {
    const s = withRack(base(), 'B-07', { state: 'rising', T: 29 });
    let next = withRack(s, 'B-07', { state: 'critical', T: 32.5 });
    next = withRack(next, 'A-03', { state: 'rising', T: 28 });
    expect(describeLayoutChange(s, next)).toBe('B-07 rising → critical; second rack (A-03) rising: queue added');
  });
});
