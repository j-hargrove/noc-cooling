import { useEffect, useMemo, useRef, useState } from 'react';
import { composeOutcome, type OutcomeCopy } from '../compose/outcomeCopy';
import { presentInstrument, type InstrumentHandlers, type LockNotification } from '../compose/present';
import {
  act,
  advanceReading,
  createInitialState,
  dismissIntro,
  dispatchTech,
  failSecondRack,
  openLock,
  override,
  setHeatLoad,
  setHoldBusy,
  startIncident,
  switchFocus,
  undo,
  type StepResult,
} from '../sim/engine';
import { shownState } from '../sim/rack';
import { focused, incidentActive } from '../sim/selectors';
import type { LogEntry, SimEvent, SimState } from '../sim/types';
import type { FocusRequest, InstrumentProps, ShockCue } from '../ui/Instrument';
import type { EventPillCue } from '../ui/ThermalField';
import {
  INTRO_HIDDEN_AFTER_MS,
  LIVE_REGION_RESET_MS,
  LOCK_HIDDEN_AFTER_MS,
  OUTCOME_FOCUS_MS,
  OUTCOME_REMOVE_AFTER_MS,
  READ_INTERVAL_MS,
} from '../ui/timing';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion';
import { gateEvents } from './gate';

/** The demo panel's two checkboxes, read at the moment an incident starts. */
export interface RunOptions {
  fromLock: boolean;
  autoSecond: boolean;
}

export interface LiveSimOptions {
  seed: number;
  /** Reading interval. Defaults to timing.readIntervalMs; the e2e suite shortens it. */
  readMs?: number;
  getRunOptions: () => RunOptions;
}

/** What the demo panel (src/demo) needs — contract/components.md §9's data, minus the panel-local checkboxes. */
export interface LiveDemoControls {
  heatLoad: number;
  /** The slider is locked while an incident is running (see setHeatLoad). */
  heatLocked: boolean;
  running: boolean;
  secondArmed: boolean;
  log: LogEntry[];
  onHeatLoad: (v: number) => void;
  onRun: () => void;
  onFailSecond: () => void;
  onReset: () => void;
}

type Urgency = 'polite' | 'assertive';
type Timer = ReturnType<typeof setTimeout>;

const noEvents = (state: SimState): StepResult => ({ state, events: [] });

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every browser allows it without a gesture; haptics only ever accompany an announcement.
  }
}

/**
 * The live product loop (docs/BUILD_BRIEF.md step 6). Owns the running
 * SimState, ticks it once per reading, and plays each step's events —
 * through gateEvents(), so the shockwave never fires behind the lock screen
 * and lock notifications never render over the open app.
 *
 * The sim stays pure and deterministic: everything with a wall-clock
 * duration (a CSS exit animation finishing, the live-region clear-then-set,
 * the outcome focus delay) is choreography and lives here, not in src/sim.
 */
export function useLiveSim({ seed, readMs = READ_INTERVAL_MS, getRunOptions }: LiveSimOptions) {
  const reducedMotion = usePrefersReducedMotion();

  const [sim, setSim] = useState(() => createInitialState(seed));
  const [holdProgress, setHoldProgress] = useState(0);
  const [announcements, setAnnouncements] = useState({ polite: '', assertive: '' });
  const [eventPill, setEventPill] = useState<EventPillCue | null>(null);
  const [shock, setShock] = useState<ShockCue | null>(null);
  const [notification, setNotification] = useState<{ content: LockNotification; key: number } | null>(null);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [lockOpening, setLockOpening] = useState(false);
  const [outcomeDismissed, setOutcomeDismissed] = useState(false);
  const [leavingOutcome, setLeavingOutcome] = useState<OutcomeCopy | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [runArmed, setRunArmed] = useState(true);
  const [feedEpoch, setFeedEpoch] = useState(0);

  // Latest values for the stable handlers below (built once; they read through refs).
  const simRef = useRef(sim);
  const reducedRef = useRef(reducedMotion);
  const runOptionsRef = useRef(getRunOptions);
  useEffect(() => {
    reducedRef.current = reducedMotion;
    runOptionsRef.current = getRunOptions;
  });

  const ctl = useMemo(() => {
    let cueKey = 0;
    const nextKey = () => ++cueKey;
    let seedCursor = seed;
    let outcomeDismissedNow = false;
    let lockOpeningNow = false;
    const timers = new Set<Timer>();
    const pending: Record<Urgency, string[]> = { polite: [], assertive: [] };
    const announceTimer: Partial<Record<Urgency, Timer>> = {};

    const later = (fn: () => void, ms: number): Timer => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      return t;
    };
    const cancel = (t: Timer | undefined) => {
      if (t === undefined) return;
      clearTimeout(t);
      timers.delete(t);
    };
    const clearAllTimers = () => {
      timers.forEach(clearTimeout);
      timers.clear();
      pending.polite = [];
      pending.assertive = [];
    };
    const exitMs = (ms: number) => (reducedRef.current ? 0 : ms);

    /**
     * contract/a11y-spec.md §1: clear the region, then set the message after
     * liveRegionResetMs so a repeat re-announces. Messages landing inside
     * that window (a state change and a resolution on the same reading, say)
     * are joined rather than letting the last one overwrite the rest.
     */
    const announce = (urgency: Urgency, message: string) => {
      pending[urgency].push(message);
      setAnnouncements((a) => ({ ...a, [urgency]: '' }));
      cancel(announceTimer[urgency]);
      announceTimer[urgency] = later(() => {
        const text = pending[urgency].join(' ');
        pending[urgency] = [];
        setAnnouncements((a) => ({ ...a, [urgency]: text }));
      }, LIVE_REGION_RESET_MS);
    };

    const setDismissed = (v: boolean) => {
      outcomeDismissedNow = v;
      setOutcomeDismissed(v);
    };

    const play = (e: SimEvent, next: SimState) => {
      switch (e.type) {
        case 'announce':
          announce(e.urgency, e.message);
          break;
        case 'haptic':
          vibrate(e.pattern);
          break;
        case 'shock':
          setShock({ rackId: e.rackId, key: nextKey() });
          break;
        case 'notify':
          setNotification({ content: { title: e.title, body: e.body, critical: e.critical }, key: nextKey() });
          break;
        case 'event-pill':
          setEventPill({ text: e.text, cool: e.cool, key: nextKey() });
          break;
        case 'outcome':
          setDismissed(false);
          setLeavingOutcome(null);
          // Never stolen from behind the lock screen (contract/a11y-spec.md §2).
          if (!next.locked) later(() => setFocusRequest({ target: 'outcomePrimary', key: nextKey() }), OUTCOME_FOCUS_MS);
          break;
        case 'log':
        case 'stand-down':
          break; // the log renders straight from SimState; stand-down's visible parts are its log + pill
      }
    };

    /** Apply one sim step: swap in the new state, run overlay exits, and play the step's gated events. */
    const commit = ({ state: next, events }: StepResult) => {
      const prev = simRef.current;
      simRef.current = next;
      setSim(next);

      if (!prev.introDismissed && next.introDismissed) {
        setIntroLeaving(true);
        later(() => setIntroLeaving(false), exitMs(INTRO_HIDDEN_AFTER_MS));
      }
      // A fresh lock screen starts with no notification: it appears when the rack escalates.
      if (!prev.locked && next.locked) setNotification(null);
      // The aftershock reopened the incident: the sheet drops away rather than vanishing.
      if (prev.ended && !next.ended) {
        const copy = outcomeDismissedNow ? null : composeOutcome(prev);
        if (copy) {
          setLeavingOutcome(copy);
          later(() => setLeavingOutcome(null), exitMs(OUTCOME_REMOVE_AFTER_MS));
        }
      }

      for (const e of gateEvents(events, { locked: next.locked, reducedMotion: reducedRef.current })) play(e, next);
    };

    const tick = () => commit(advanceReading(simRef.current));
    /** prototype startFeed(): respond on the click, then restart the interval from now. */
    const readNowAndRestartFeed = () => {
      tick();
      setFeedEpoch((n) => n + 1);
    };

    const run = () => {
      commit(startIncident(simRef.current, runOptionsRef.current()));
      setRunArmed(false);
      readNowAndRestartFeed();
    };

    const failSecond = () => {
      commit(failSecondRack(dismissIntro(simRef.current), { headStart: true }));
      readNowAndRestartFeed();
    };

    const reset = () => {
      clearAllTimers();
      seedCursor = (seedCursor + 1) >>> 0;
      // Reset doesn't bring the intro back (reference/prototype.html reset()).
      const fresh: SimState = { ...createInitialState(seedCursor), introDismissed: simRef.current.introDismissed };
      simRef.current = fresh;
      setSim(fresh);
      setNotification(null);
      lockOpeningNow = false;
      setLockOpening(false);
      setIntroLeaving(false);
      setDismissed(false);
      setLeavingOutcome(null);
      setHoldProgress(0);
      setRunArmed(true);
    };

    const setHeat = (v: number) => {
      if (incidentActive(simRef.current)) return;
      setRunArmed(true);
      commit(noEvents(setHeatLoad(simRef.current, v)));
    };

    const openLockScreen = () => {
      if (lockOpeningNow || !simRef.current.locked) return;
      lockOpeningNow = true;
      setLockOpening(true);
      // The lock stays up (and the sim stays locked, so the gate still holds
      // shocks back) until its exit finishes; only then does the app open,
      // fire the shock if the rack is critical, and hand focus to the action.
      later(() => {
        lockOpeningNow = false;
        setLockOpening(false);
        const opened = openLock(simRef.current);
        const f = focused(opened);
        commit({ state: opened, events: shownState(f) === 'critical' ? [{ type: 'shock', rackId: f.id }] : [] });
        setFocusRequest({ target: 'hold', key: nextKey() });
      }, exitMs(LOCK_HIDDEN_AFTER_MS));
    };

    const handlers: InstrumentHandlers = {
      onSelectRack: (id) => commit(noEvents(switchFocus(simRef.current, id))),
      onConfirm: () => commit(act(simRef.current)),
      onOverride: () => commit(override(simRef.current)),
      onUndo: () => commit(undo(simRef.current)),
      onHoldBusyChange: (busy) => commit(noEvents(setHoldBusy(simRef.current, busy))),
      onHoldProgressChange: setHoldProgress,
      onOutcomePrimary: () => {
        if (simRef.current.ended === 'ok') setDismissed(true);
        else commit(dispatchTech(simRef.current));
      },
      onOutcomeAgain: () => {
        reset();
        run();
      },
      onOpenLock: openLockScreen,
      onIntroStart: run,
      onIntroDismiss: () => commit(noEvents(dismissIntro(simRef.current))),
    };

    return { tick, run, failSecond, reset, setHeat, handlers, clearAllTimers };
    // Built once: every handler reads live values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The feed: one reading every readMs, from mount — the instrument is live
  // behind the intro too. Restarted (not just continued) after run/failSecond.
  useEffect(() => {
    const id = setInterval(ctl.tick, readMs);
    return () => clearInterval(id);
  }, [ctl, readMs, feedEpoch]);

  useEffect(() => () => ctl.clearAllTimers(), [ctl]);

  const base = useMemo(() => presentInstrument(sim, ctl.handlers), [sim, ctl]);
  const shownOutcome = leavingOutcome ?? (outcomeDismissed ? null : base.outcome);

  const instrumentProps: InstrumentProps = {
    ...base,
    reducedMotion,
    holdProgress,
    lockNotification: notification?.content ?? null,
    lockNotificationKey: notification?.key,
    outcome: shownOutcome,
    outcomeLeaving: leavingOutcome !== null && base.outcome === null,
    beat: sim.n,
    announcements,
    eventPill,
    shock,
    introLeaving,
    lockOpening,
    focusRequest,
  };

  const demo: LiveDemoControls = {
    heatLoad: sim.heat,
    heatLocked: incidentActive(sim),
    running: !runArmed,
    secondArmed: !sim.racks['A-03'].fault,
    log: sim.log,
    onHeatLoad: ctl.setHeat,
    onRun: ctl.run,
    onFailSecond: ctl.failSecond,
    onReset: ctl.reset,
  };

  return { sim, instrumentProps, demo };
}
