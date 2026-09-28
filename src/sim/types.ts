/**
 * Shared vocabulary. Mirrors contract/components.md's "Shared vocabulary"
 * section — RackView there is a rendering-ready projection of RackModel here.
 */

export type AlertState = 'calm' | 'recovering' | 'rising' | 'critical';
export type ShownState = AlertState | 'offline';
export type ActedAs = null | 'fix' | 'manual';
export type Outcome = 'ok' | 'mixed' | 'fail';

/** The authored scenario has exactly these two racks (docs/decisions.md). */
export type RackId = 'B-07' | 'A-03';

export interface RackModel {
  id: RackId;
  /** Inlet temperature, °C. */
  T: number;
  /** Up to 48 readings, oldest first. */
  hist: number[];
  /** °C per reading, trailing 3-reading slope. */
  slope: number;
  state: AlertState;
  /** Consecutive readings classifying below `state`, toward a downgrade. */
  stable: number;
  acted: ActedAs;
  /** Clock text ('' until acted). */
  actAt: string;
  /** One-shot: the status line just changed, play the "fresh" cue once. */
  fresh: boolean;
  /** Plume/shock decay accumulator, 0..1. */
  flare: number;
  /** A-03 only: the fan has failed and is degrading. */
  fault: boolean;
  /** How degraded the fault is, 0..1, ramps ~0.11/reading while `fault`. */
  faultLvl: number;
  /** Unaddressed critical feeds on itself; decays once acted on or downgraded. */
  runaway: number;
  down: boolean;
  /** Clock text of shutdown ('' until down). */
  downAt: string;
  /** Clock time (seconds) the rack most recently entered critical. */
  critAt: number;
  /** Readings spent at/above the throttle threshold (35°C). */
  thr: number;
  /** Peak inlet reached, for outcome stats. */
  peak: number;
  /** How far a fix has landed, 0..1 (CRAC-3 spin-up / workload drain). */
  prog: number;
}

export interface LogEntry {
  /** Clock text, 'HH:MM:SS'. */
  t: string;
  text: string;
  kind: 'sys' | 'act';
}

/**
 * Behavior the sim produced this step, for the UI/demo layer to play.
 * The sim decides *whether* and *what*; the UI decides *how* (e.g. whether
 * the lock screen is currently showing, so a notify event should render).
 */
export type SimEvent =
  | { type: 'log'; entry: LogEntry }
  | { type: 'announce'; urgency: 'polite' | 'assertive'; message: string }
  | { type: 'haptic'; pattern: number[] }
  /** Fired on every transition into critical. Play only while unlocked. */
  | { type: 'shock'; rackId: RackId }
  /** Lock-screen notification content. Play only while locked. */
  | { type: 'notify'; rackId: RackId; critical: boolean; title: string; body: string }
  | { type: 'event-pill'; text: string; cool: boolean }
  | { type: 'outcome'; kind: Outcome; rackId: RackId }
  | { type: 'stand-down' };

export interface SimState {
  /** RNG cursor. Advances deterministically; never read directly. */
  seed: number;
  /** Aisle heat load, 0..100. */
  heat: number;
  /** Target heat load an incident is ramping toward, or null if none running. */
  incident: number | null;
  /** CRAC-3 boosted to 100%. */
  boosted: boolean;
  focus: RackId;
  /** Seconds since midnight. */
  clock: number;
  log: LogEntry[];
  /** Reading count, monotonic. */
  n: number;
  /** Reading count at which A-03's fan auto-fails, or null if none scheduled. */
  secondAt: number | null;
  started: boolean;
  ended: Outcome | null;
  /** Sticky airflow target — stays put until stand-down (no fallback flicker). */
  lastAim: RackId | null;
  startClock: number;
  startN: number;
  /** 0 = idle, 1 = B-07-led incident, 2 = A-03-led incident. */
  phase: number;
  phaseRack: RackId | null;
  /** Reading count the current phase started; resolution needs n >= phaseN + 3. */
  phaseN: number;
  dispatched: Partial<Record<RackId, boolean>>;
  racks: Record<RackId, RackModel>;
  /** Reading count to hand focus off at, or null if none pending. */
  focusHandoffAt: number | null;
  focusHandoffFrom: RackId | null;
  /** Reading count to stand CRAC-3 down at, or null if none pending. */
  standDownAt: number | null;
  /** Demo panel checkbox: auto-fail the second rack after the first outcome. */
  autoSecond: boolean;
  /** Operator is mid hold-to-confirm; suppresses the focus handoff timer. */
  holdBusy: boolean;
}
