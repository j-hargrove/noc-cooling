import {
  AFTERSHOCK_READINGS,
  FOCUS_HANDOFF_READINGS,
  RACK_IDS,
  RAMP,
  RECOMMENDED_C,
  RESOLUTION_MIN_READINGS,
  SEV,
  SHUTDOWN_C,
  SIM_SECONDS_PER_READING,
  STAND_DOWN_READINGS,
  START_CLOCK_S,
  THROTTLE_C,
} from './constants';
import {
  actAnnouncement,
  actEventPill,
  actLogText,
  dispatchAnnouncement,
  dispatchLogText,
  incidentStartAnnouncement,
  incidentStartEventPill,
  incidentStartLogText,
  overrideAnnouncement,
  overrideLogText,
  resolvedMixedAnnouncement,
  resolvedMixedLogText,
  resolvedOkAnnouncement,
  resolvedOkLogText,
  secondRackFaultAnnouncement,
  secondRackFaultEventPill,
  secondRackFaultLogText,
  shutdownAnnouncement,
  shutdownLogText,
  shutdownNotify,
  standDownEventPill,
  standDownLogText,
  stateChangeAnnouncement,
  stateChangeLogText,
  stateNotify,
  undoLogText,
} from './copy';
import { fmt } from './format';
import { cloneRack, classify, makeRack, rate, target } from './rack';
import { nextSigned, type Seed } from './rng';
import { nextUnhandled, others, resolveAim } from './selectors';
import type { AlertState, LogEntry, Outcome, RackId, SimEvent, SimState } from './types';

export type StepResult = { state: SimState; events: SimEvent[] };

export function createInitialState(seed: Seed): SimState {
  const [b07, s1] = makeRack('B-07', seed);
  const [a03, s2] = makeRack('A-03', s1);
  return {
    seed: s2,
    heat: 30,
    incident: null,
    boosted: false,
    focus: 'B-07',
    clock: START_CLOCK_S,
    log: [],
    n: 0,
    secondAt: null,
    started: false,
    ended: null,
    lastAim: null,
    startClock: 0,
    startN: 0,
    phase: 0,
    phaseRack: null,
    phaseN: 0,
    dispatched: {},
    racks: { 'B-07': b07, 'A-03': a03 },
    focusHandoffAt: null,
    focusHandoffFrom: null,
    standDownAt: null,
    autoSecond: true,
    holdBusy: false,
    introDismissed: false,
    locked: false,
  };
}

function cloneState(state: SimState): SimState {
  return {
    ...state,
    log: [...state.log],
    dispatched: { ...state.dispatched },
    racks: { 'B-07': cloneRack(state.racks['B-07']), 'A-03': cloneRack(state.racks['A-03']) },
  };
}

function addLog(s: SimState, events: SimEvent[], text: string, kind: LogEntry['kind']) {
  const entry: LogEntry = { t: fmt(s.clock), text, kind };
  s.log = [entry, ...s.log];
  events.push({ type: 'log', entry });
}
const announce = (events: SimEvent[], urgency: 'polite' | 'assertive', message: string) =>
  events.push({ type: 'announce', urgency, message });
const haptic = (events: SimEvent[], pattern: number[]) => events.push({ type: 'haptic', pattern });
const eventPill = (events: SimEvent[], text: string, cool = false) => events.push({ type: 'event-pill', text, cool });

function switchFocusInternal(s: SimState, id: RackId) {
  s.focus = id;
}

/**
 * Mirrors the prototype's setState(): applies the new state, logs and
 * announces it, and runs the focus rule — never moving the operator's
 * attention off a rack they haven't acted on yet.
 */
function setRackState(s: SimState, events: SimEvent[], id: RackId, t: AlertState) {
  const m = s.racks[id];
  const up = SEV[t] > SEV[m.state];
  m.state = t;
  addLog(s, events, stateChangeLogText(id, t), 'sys');
  const a = stateChangeAnnouncement(id, t, m.T);
  announce(events, a.urgency, a.message);
  if (t === 'critical') {
    m.critAt = s.clock;
    haptic(events, [70, 50, 70]);
    events.push({ type: 'shock', rackId: id });
  }
  if (t === 'rising' || t === 'critical') {
    const content = stateNotify(id, t, m.T);
    events.push({ type: 'notify', rackId: id, ...content });
  }

  const f = s.racks[s.focus];
  if (id !== s.focus) {
    if (up && SEV[t] >= 2 && (f.state === 'calm' || f.acted !== null || f.down) && !s.holdBusy) {
      switchFocusInternal(s, id);
    }
  } else if (t === 'calm') {
    const nx = others(s)[0];
    if (nx) switchFocusInternal(s, nx.id);
  }
}

function evaluateInternal(s: SimState, events: SimEvent[], id: RackId) {
  const m = s.racks[id];
  const t = classify(m);
  const a = SEV[t];
  const b = SEV[m.state];
  if (a > b) {
    setRackState(s, events, id, t);
    s.racks[id].stable = 0;
  } else if (a < b) {
    m.stable += 1;
    if (m.stable >= 3) {
      setRackState(s, events, id, t);
      s.racks[id].stable = 0;
    }
  } else {
    m.stable = 0;
  }
}

/** Scheduling side effects that follow any outcome (docs/decisions.md). */
function scheduleFollowOn(s: SimState, kind: Outcome) {
  if (s.phase === 1 && s.autoSecond && !s.racks['A-03'].fault) {
    s.secondAt = s.n + AFTERSHOCK_READINGS;
  }
  if ((kind === 'ok' || kind === 'mixed') && s.boosted) {
    s.standDownAt = s.n + STAND_DOWN_READINGS;
  }
}

function shutdownRackInternal(s: SimState, events: SimEvent[], id: RackId) {
  const m = s.racks[id];
  m.down = true;
  m.flare = 0;
  m.downAt = fmt(s.clock);
  s.ended = 'fail';
  haptic(events, [200, 80, 200]);
  addLog(s, events, shutdownLogText(id), 'sys');
  announce(events, 'assertive', shutdownAnnouncement(id));
  if (s.focus !== id) switchFocusInternal(s, id);
  events.push({ type: 'notify', rackId: id, ...shutdownNotify(id) });
  events.push({ type: 'outcome', kind: 'fail', rackId: id });
  scheduleFollowOn(s, 'fail');
}

function checkResolvedInternal(s: SimState, events: SimEvent[]) {
  if (!s.started || s.ended || s.n < s.phaseN + RESOLUTION_MIN_READINGS) return;
  const all = RACK_IDS.map((id) => s.racks[id]);
  const live = all.filter((m) => !m.down);
  if (!live.every((m) => m.state === 'calm')) return;
  const pr = s.phaseRack ? s.racks[s.phaseRack] : undefined;
  if (!pr || pr.down || pr.peak < RECOMMENDED_C) return;
  const downs = all.filter((m) => m.down);
  const kind: Outcome = downs.length ? 'mixed' : 'ok';
  s.ended = kind;
  if (kind === 'ok') {
    addLog(s, events, resolvedOkLogText, 'sys');
    announce(events, 'polite', resolvedOkAnnouncement);
  } else {
    const downIds = downs.map((d) => d.id);
    addLog(s, events, resolvedMixedLogText(pr.id, downIds), 'sys');
    announce(events, 'polite', resolvedMixedAnnouncement(pr.id, downIds));
  }
  events.push({ type: 'outcome', kind, rackId: pr.id });
  scheduleFollowOn(s, kind);
}

function applyScheduledHandoff(s: SimState) {
  if (s.focusHandoffAt == null || s.n < s.focusHandoffAt) return;
  const fromId = s.focusHandoffFrom;
  s.focusHandoffAt = null;
  s.focusHandoffFrom = null;
  if (!fromId) return;
  const nx = nextUnhandled(s);
  if (nx && s.focus === fromId && !s.holdBusy) switchFocusInternal(s, nx.id);
}

function applyScheduledStandDown(s: SimState, events: SimEvent[]) {
  if (s.standDownAt == null || s.n < s.standDownAt) return;
  s.standDownAt = null;
  // Re-checked at fire time: a lot can change in two readings (docs/decisions.md
  // "unaddressed critical runs away") — an aftershock may have reopened things.
  if (!s.boosted || !s.ended || s.ended === 'fail') return;
  s.boosted = false;
  s.heat = 30;
  s.incident = null;
  const b = s.racks['B-07'];
  if (b.acted === 'fix') b.acted = null;
  addLog(s, events, standDownLogText, 'sys');
  eventPill(events, standDownEventPill, true);
  events.push({ type: 'stand-down' });
}

function failSecondRackInternal(s: SimState, events: SimEvent[], opts: { headStart?: boolean }) {
  const a = s.racks['A-03'];
  if (a.fault) return;
  a.fault = true;
  a.flare = 1;
  if (opts.headStart) a.faultLvl = 0.2;
  if (!s.started) {
    s.started = true;
    s.startClock = s.clock;
    s.startN = s.n;
    s.phase = 2;
    s.phaseRack = 'A-03';
    s.phaseN = s.n;
  } else if (s.ended) {
    s.phase = 2;
    s.phaseRack = 'A-03';
    s.phaseN = s.n;
    s.ended = null;
  }
  addLog(s, events, secondRackFaultLogText, 'sys');
  const isNewAlert = s.phase === 2 && s.startN !== s.phaseN;
  eventPill(events, secondRackFaultEventPill(isNewAlert));
  announce(events, 'polite', secondRackFaultAnnouncement);
}

/**
 * Runs the classify → hysteresis → setState pipeline for one rack, in
 * isolation from thermal physics. Used by advanceReading each tick, and
 * exported so tests can drive escalation/hysteresis precisely (see
 * src/sim/engine.hysteresis.test.ts) without waiting on organic temperature
 * convergence.
 */
export function stepRackClassification(state: SimState, id: RackId): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  evaluateInternal(s, events, id);
  return { state: s, events };
}

/** One reading: the sim's fundamental tick. Every 1.5s of demo time in the prototype. */
export function advanceReading(state: SimState): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  s.n += 1;

  if (s.incident != null) {
    s.heat = Math.min(s.incident, s.heat + 15);
    if (s.heat >= s.incident) s.incident = null;
  }
  if (s.secondAt != null && s.n >= s.secondAt) {
    s.secondAt = null;
    failSecondRackInternal(s, events, {});
  }
  s.clock += SIM_SECONDS_PER_READING;

  for (const id of RACK_IDS) {
    const m = s.racks[id];
    if (m.fault) m.faultLvl = Math.min(1, m.faultLvl + 0.11);
    if (!m.down) {
      m.prog = m.acted === 'fix' ? Math.min(1, m.prog + RAMP[id]) : Math.max(0, m.prog - 0.34);
      if (m.state === 'critical' && m.acted !== 'fix') m.runaway = Math.min(9, m.runaway + 0.3);
      else m.runaway = Math.max(0, m.runaway - 0.6);
    }
    const [noise, nextSeed] = nextSigned(s.seed, 0.1);
    s.seed = nextSeed;
    m.T += (target(s, m) - m.T) * rate(m) + noise;
    m.hist.push(m.T);
    if (m.hist.length > 48) m.hist.shift();
    const hn = m.hist.length;
    m.slope = (m.hist[hn - 1] - m.hist[hn - 4]) / 3;
    if (m.down) continue;
    m.peak = Math.max(m.peak, m.T);
    if (m.T >= THROTTLE_C) m.thr += 1;
    if (m.T >= SHUTDOWN_C && s.ended !== 'ok') {
      shutdownRackInternal(s, events, id);
      continue;
    }
    evaluateInternal(s, events, id);
  }

  checkResolvedInternal(s, events);
  applyScheduledHandoff(s);
  applyScheduledStandDown(s, events);
  s.lastAim = resolveAim(s).lastAim;

  return { state: s, events };
}

/** "Hold to boost CRAC-3" / "Hold to cool A-03" confirmed — the primary fix. */
export function act(state: SimState): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  const id = s.focus;
  const m = s.racks[id];
  m.acted = 'fix';
  m.actAt = fmt(s.clock);
  m.fresh = true;
  s.boosted = true;
  haptic(events, [30]);
  addLog(s, events, actLogText(id), 'act');
  eventPill(events, actEventPill(id), true);
  announce(events, 'polite', actAnnouncement(id));
  s.focusHandoffAt = s.n + FOCUS_HANDOFF_READINGS;
  s.focusHandoffFrom = id;
  return { state: s, events };
}

/** "Override and handle manually" — logged, reversible. */
export function override(state: SimState): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  const id = s.focus;
  const m = s.racks[id];
  m.acted = 'manual';
  m.actAt = fmt(s.clock);
  addLog(s, events, overrideLogText(id), 'act');
  announce(events, 'polite', overrideAnnouncement(id));
  s.focusHandoffAt = s.n + FOCUS_HANDOFF_READINGS;
  s.focusHandoffFrom = id;
  return { state: s, events };
}

/** "Revert boost" / "Revert cooling" / "Resume recommendations". No announcement (matches prototype). */
export function undo(state: SimState): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  const id = s.focus;
  const m = s.racks[id];
  const wasManual = m.acted === 'manual';
  addLog(s, events, undoLogText(id, wasManual), 'act');
  if (!wasManual) {
    if (id === 'B-07') s.boosted = false;
    else s.boosted = s.racks['B-07'].acted === 'fix';
  }
  m.acted = null;
  return { state: s, events };
}

/** Operator selects a queue card. No log/announce — matches the prototype. */
export function switchFocus(state: SimState, id: RackId): SimState {
  if (state.focus === id) return state;
  return { ...cloneState(state), focus: id };
}

/** Toggle while a hold-to-confirm or keyboard arming window is in progress. */
export function setHoldBusy(state: SimState, holdBusy: boolean): SimState {
  if (state.holdBusy === holdBusy) return state;
  return { ...state, holdBusy };
}

/** "Look around first" — dismisses the intro without starting anything. */
export function dismissIntro(state: SimState): SimState {
  if (state.introDismissed) return state;
  return { ...state, introDismissed: true };
}

/** Tapping the lock-screen notification — the operator opens the app. */
export function openLock(state: SimState): SimState {
  if (!state.locked) return state;
  return { ...state, locked: false };
}

/**
 * "Run the incident" — B-07's heat load starts spiking. Always dismisses the
 * intro (matches the prototype: both "Start the incident" and its intro-screen
 * twin close the intro before running). `fromLock` mirrors the demo panel's
 * "Start from lock screen" checkbox: the lock screen only actually engages if
 * the focused rack is calm at the moment the incident starts.
 */
export function startIncident(state: SimState, options: { autoSecond?: boolean; fromLock?: boolean } = {}): StepResult {
  const { autoSecond = true, fromLock = false } = options;
  const s = cloneState(state);
  const events: SimEvent[] = [];
  s.incident = 88;
  s.racks['B-07'].flare = 1;
  s.autoSecond = autoSecond;
  s.introDismissed = true;
  s.locked = fromLock && s.racks[s.focus].state === 'calm';
  s.started = true;
  s.startClock = s.clock;
  s.startN = s.n;
  s.phase = 1;
  s.phaseRack = 'B-07';
  s.phaseN = s.n;
  addLog(s, events, incidentStartLogText, 'sys');
  eventPill(events, incidentStartEventPill);
  announce(events, 'polite', incidentStartAnnouncement);
  return { state: s, events };
}

/**
 * "Fail a second rack" from the demo panel, or on demand. `headStart`
 * (default true, matching the panel button) skips the fan's first few
 * readings of ramp-up; the automatic aftershock inside advanceReading
 * calls the internal path with no head start.
 */
export function failSecondRack(state: SimState, opts: { headStart?: boolean } = { headStart: true }): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  failSecondRackInternal(s, events, opts);
  return { state: s, events };
}

/** Outcome sheet primary button, once a rack is down. */
export function dispatchTech(state: SimState): StepResult {
  const s = cloneState(state);
  const events: SimEvent[] = [];
  if (s.ended === 'ok') return { state: s, events };
  const downIds = RACK_IDS.map((id) => s.racks[id])
    .filter((m) => m.down && !s.dispatched[m.id])
    .map((m) => m.id);
  if (downIds.length === 0) return { state: s, events };
  downIds.forEach((id) => {
    s.dispatched[id] = true;
  });
  addLog(s, events, dispatchLogText(downIds), 'act');
  announce(events, 'polite', dispatchAnnouncement);
  return { state: s, events };
}
