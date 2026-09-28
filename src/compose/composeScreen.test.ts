import { describe, expect, it } from 'vitest';
import { createInitialState, dismissIntro, openLock, startIncident } from '../sim/engine';
import { withRack } from '../sim/test-support';
import type { Outcome, ShownState, SimState } from '../sim/types';
import { composeScreen } from './composeScreen';
import { MULTI_RACK_OVERRIDE, ROW_WEIGHTS } from './layoutTokens';

/** A single-rack scenario: B-07 shows the given state, A-03 stays calm (so multiRack is false). */
function soloState(seed: number, shown: ShownState): SimState {
  let s = dismissIntro(createInitialState(seed)); // out of the way for state/outcome/multi tests
  s = withRack(s, 'A-03', { state: 'calm', T: 24 });
  if (shown === 'offline') {
    s = withRack(s, 'B-07', { state: 'critical', down: true, T: 39 });
  } else {
    s = withRack(s, 'B-07', { state: shown, T: 28 });
  }
  return { ...s, focus: 'B-07' };
}

const SHOWN_STATES: ShownState[] = ['calm', 'recovering', 'rising', 'critical', 'offline'];

describe('composeScreen: one row-weight set per state (contract/tokens.json → layout.weights)', () => {
  for (const shown of SHOWN_STATES) {
    it(`${shown}: weights match ROW_WEIGHTS.${shown}, no queue, not multi-rack`, () => {
      const layout = composeScreen(soloState(100 + SHOWN_STATES.indexOf(shown), shown));
      expect(layout.shown).toBe(shown);
      expect(layout.multiRack).toBe(false);
      expect(layout.weights).toEqual(ROW_WEIGHTS[shown]);
      expect(layout.regions).toEqual({ field: true, queue: false, readout: true, action: true });
    });
  }
});

describe('composeScreen: outcome, per kind', () => {
  const KINDS: Outcome[] = ['ok', 'mixed', 'fail'];
  for (const kind of KINDS) {
    it(`reports outcome "${kind}" straight from state.ended`, () => {
      let s = soloState(200 + KINDS.indexOf(kind), 'calm');
      s = { ...s, ended: kind };
      expect(composeScreen(s).outcome).toBe(kind);
    });
  }

  it('reports no outcome while nothing has resolved', () => {
    expect(composeScreen(soloState(210, 'calm')).outcome).toBeNull();
  });
});

describe('composeScreen: multi-rack override (contract/tokens.json → layout.multiRackOverride)', () => {
  it('overrides field, queue and readout, but leaves action at the state\'s own weight', () => {
    let s = dismissIntro(createInitialState(300));
    s = withRack(s, 'B-07', { state: 'calm', T: 24 });
    s = withRack(s, 'A-03', { state: 'critical', T: 33 });
    s = { ...s, focus: 'B-07' };

    const layout = composeScreen(s);
    expect(layout.multiRack).toBe(true);
    expect(layout.regions.queue).toBe(true);
    expect(layout.weights.field).toBe(MULTI_RACK_OVERRIDE.field);
    expect(layout.weights.queue).toBe(MULTI_RACK_OVERRIDE.queue);
    expect(layout.weights.readout).toBe(MULTI_RACK_OVERRIDE.readout);
    expect(layout.weights.action).toBe(ROW_WEIGHTS.calm.action); // not overridden
  });

  it('applies on top of whichever state the focused rack is actually in', () => {
    let s = dismissIntro(createInitialState(301));
    s = withRack(s, 'B-07', { state: 'critical', T: 33 });
    s = withRack(s, 'A-03', { state: 'rising', T: 29 });
    s = { ...s, focus: 'B-07' };

    const layout = composeScreen(s);
    expect(layout.shown).toBe('critical');
    expect(layout.weights.action).toBe(ROW_WEIGHTS.critical.action);
    expect(layout.weights.field).toBe(MULTI_RACK_OVERRIDE.field);
  });

  it('is not triggered by a calm other rack (queue stays empty, base weights apply)', () => {
    const layout = composeScreen(soloState(302, 'rising'));
    expect(layout.multiRack).toBe(false);
    expect(layout.regions.queue).toBe(false);
    expect(layout.weights).toEqual(ROW_WEIGHTS.rising);
  });

  it('is not triggered by the down rack itself queuing behind its own offline readout', () => {
    // offline is a rack condition, not a second rack — B-07 alone, down, nothing else alerting
    const layout = composeScreen(soloState(303, 'offline'));
    expect(layout.multiRack).toBe(false);
    expect(layout.weights).toEqual(ROW_WEIGHTS.offline);
  });
});

describe('composeScreen: overlays', () => {
  it('shows the intro before it has been dismissed, regardless of anything else', () => {
    const layout = composeScreen(createInitialState(400));
    expect(layout.overlay).toBe('intro');
  });

  it('shows no overlay once the intro is dismissed and the lock is not engaged', () => {
    const layout = composeScreen(dismissIntro(createInitialState(401)));
    expect(layout.overlay).toBe('none');
  });

  it('shows the lock screen once the incident starts from lock', () => {
    const s = startIncident(createInitialState(402), { fromLock: true }).state;
    expect(composeScreen(s).overlay).toBe('lock');
  });

  it('drops back to no overlay once the lock is opened', () => {
    let s = startIncident(createInitialState(403), { fromLock: true }).state;
    s = openLock(s);
    expect(composeScreen(s).overlay).toBe('none');
  });

  it('the intro always wins over a pending lock (dismissing it is a precondition, not a race)', () => {
    // Constructed directly: locked true but intro not yet dismissed should never
    // occur via the real action sequence (startIncident always dismisses the
    // intro), but composeScreen's precedence is defined either way.
    const s: SimState = { ...createInitialState(404), locked: true, introDismissed: false };
    expect(composeScreen(s).overlay).toBe('intro');
  });

  it('overlay is independent of the outcome sheet — both can be reported at once', () => {
    let s = startIncident(createInitialState(405), { fromLock: true }).state;
    s = { ...s, ended: 'ok' };
    const layout = composeScreen(s);
    expect(layout.overlay).toBe('lock');
    expect(layout.outcome).toBe('ok');
  });
});

describe('composeScreen: regions', () => {
  it('field, readout and action are always present', () => {
    for (const shown of SHOWN_STATES) {
      const layout = composeScreen(soloState(500 + SHOWN_STATES.indexOf(shown), shown));
      expect(layout.regions.field).toBe(true);
      expect(layout.regions.readout).toBe(true);
      expect(layout.regions.action).toBe(true);
    }
  });

  it('queue exactly tracks multiRack', () => {
    const solo = composeScreen(soloState(510, 'rising'));
    expect(solo.regions.queue).toBe(solo.multiRack);

    let multi = dismissIntro(createInitialState(511));
    multi = withRack(multi, 'B-07', { state: 'rising', T: 29 });
    multi = withRack(multi, 'A-03', { state: 'critical', T: 33 });
    const layout = composeScreen(multi);
    expect(layout.regions.queue).toBe(layout.multiRack);
    expect(layout.regions.queue).toBe(true);
  });
});
