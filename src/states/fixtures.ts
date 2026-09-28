import {
  act,
  createInitialState,
  dismissIntro,
  failSecondRack,
  advanceReading,
  openLock,
  override,
  startIncident,
} from '../sim/engine';
import type { RackId, RackModel, SimState } from '../sim/types';

function withRack(state: SimState, id: RackId, patch: Partial<RackModel>): SimState {
  return { ...state, racks: { ...state.racks, [id]: { ...state.racks[id], ...patch } } };
}

function run(state: SimState, count: number): SimState {
  let s = state;
  for (let i = 0; i < count; i++) s = advanceReading(s).state;
  return s;
}

export interface Fixture {
  id: string;
  label: string;
  description: string;
  state: SimState;
  /**
   * Seeds the readout/action-slab hold progress for display (0..1), default 0.
   * A fixed value, not a driven gesture: driving a real hold via timed mouse
   * events would make the "critical-holding" baseline depend on exactly how
   * long the pointer was held, which isn't reproducible across runs/machines.
   */
  holdProgress?: number;
}

/** A settled, post-intro starting point every fixture builds from. */
function base(seed: number): SimState {
  return dismissIntro(createInitialState(seed));
}

function calm(): Fixture {
  return { id: 'calm', label: 'Calm', description: 'B-07 focused, all racks in range.', state: base(1) };
}

function recovering(): Fixture {
  const state = withRack(base(2), 'B-07', { T: 28.4, slope: -0.02, state: 'recovering', stable: 1 });
  return { id: 'recovering', label: 'Drifting, recovering', description: 'Falling back toward the recommended range; hysteresis holding at 1 of 3.', state };
}

function rising(): Fixture {
  const state = withRack(base(3), 'B-07', { T: 29.1, slope: 0.03, state: 'rising' });
  return { id: 'rising', label: 'Drifting, rising', description: 'Passed 27°C recommended and climbing; the fix is offered.', state };
}

function critical(): Fixture {
  const state = withRack(base(4), 'B-07', { T: 33.2, slope: 0.02, state: 'critical' });
  return { id: 'critical', label: 'Critical', description: 'Above the 32°C allowable limit.', state };
}

function criticalHolding(): Fixture {
  const state = withRack(base(5), 'B-07', { T: 33.2, slope: 0.02, state: 'critical' });
  return { id: 'critical-holding', label: 'Critical, hold in progress', description: 'The projection path mid-confirm: what happens with the fix vs. without it.', state, holdProgress: 0.5 };
}

function offline(): Fixture {
  const state = withRack(base(6), 'B-07', { T: 26.5, slope: -0.3, state: 'critical', down: true, downAt: '02:19:15', critAt: 8000, peak: 39.4, thr: 6 });
  return { id: 'offline', label: 'Offline', description: 'Shut down at 38°C; cooling toward ambient, radiating nothing further.', state };
}

function multiRack(): Fixture {
  let state = base(7);
  state = withRack(state, 'B-07', { T: 24.1, slope: 0, state: 'calm' });
  state = withRack(state, 'A-03', { T: 33.5, slope: 0.02, state: 'critical', fault: true, faultLvl: 0.7 });
  return { id: 'multi-rack', label: 'Multi-rack (queue + override)', description: 'B-07 calm and focused; A-03 critical and queued — the multi-rack row-weight override.', state };
}

function outcomeOk(): Fixture {
  let state = startIncident(base(10), { autoSecond: false }).state;
  state = run(state, 6);
  state = act(state).state; // fix B-07
  state = run(state, 40); // let it land and resolve
  return { id: 'outcome-ok', label: 'Outcome: resolved', description: 'A full incident, fixed and closed out.', state };
}

function outcomeMixed(): Fixture {
  // "mixed" is only reachable one way (src/sim/engine.ts's checkResolvedInternal
  // guards on `!state.ended`, and shutdown always sets it to 'fail' first):
  // B-07 fails unaddressed, the aftershock/A-03 trigger reopens the incident
  // (ended -> null, phase 2), and *that* incident resolving while B-07 is
  // still down is what produces "mixed" — not two racks failing at once.
  let state = { ...startIncident(base(11), { autoSecond: false }).state, heat: 100 };
  state = run(state, 400); // B-07 unaddressed: throttles, shuts down (ended='fail')
  state = failSecondRack(state).state; // reopens: ended=null, phase=2, phaseRack='A-03'
  state = run(state, 15); // A-03 escalates; focus rule pulls focus onto it (B-07 is down)
  state = act(state).state; // fix A-03, now focused
  state = run(state, 200); // lands and resolves -> 'mixed' (A-03 recovered, B-07 still down)
  return { id: 'outcome-mixed', label: 'Outcome: mixed (partial)', description: 'One rack recovered, the other shut down — needs hands on site.', state };
}

function outcomeFail(): Fixture {
  let state = { ...startIncident(base(12), { autoSecond: false }).state, heat: 100 };
  state = run(state, 400); // unaddressed: throttles, then shuts down
  return { id: 'outcome-fail', label: 'Outcome: shut down', description: 'Left unaddressed: throttled, then shut down at 38°C.', state };
}

function overlayIntro(): Fixture {
  return { id: 'overlay-intro', label: 'Overlay: intro', description: '"Start the incident" — the intro before anything moves.', state: createInitialState(20) };
}

function overlayLock(): Fixture {
  let state = startIncident(createInitialState(21), { fromLock: true }).state;
  state = run(state, 6);
  return { id: 'overlay-lock', label: 'Overlay: lock screen', description: 'The incident already running behind a locked phone.', state };
}

function overlayLockOpening(): Fixture {
  let state = startIncident(createInitialState(22), { fromLock: true }).state;
  state = run(state, 6);
  state = openLock(state);
  return { id: 'overlay-lock-opened', label: 'Overlay: lock opened', description: 'Same incident, just after the operator taps the notification.', state };
}

function manualOverride(): Fixture {
  let state = withRack(base(30), 'B-07', { T: 33.2, slope: 0.02, state: 'critical' });
  state = override(state).state;
  return { id: 'manual-override', label: 'Manual override', description: 'Operator took manual control instead of confirming the recommended fix.', state };
}

export function buildFixtures(): Fixture[] {
  return [
    calm(),
    recovering(),
    rising(),
    critical(),
    criticalHolding(),
    offline(),
    multiRack(),
    manualOverride(),
    outcomeOk(),
    outcomeMixed(),
    outcomeFail(),
    overlayIntro(),
    overlayLock(),
    overlayLockOpening(),
  ];
}
