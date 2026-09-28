import { shutdownNotify, stateNotify } from '../sim/copy';
import { RACK_IDS } from '../sim/constants';
import { fmt } from '../sim/format';
import type { RackId, SimState } from '../sim/types';
import { composeActionSlab } from './actionCopy';
import { composeScreen } from './composeScreen';
import { composeOutcome } from './outcomeCopy';
import { computeProjection } from './projection';
import { focusedView, queueEntries, toRackView } from './rackView';

/** The lock screen's notification content (contract/components.md §7). */
export interface LockNotification {
  title: string;
  body: string;
  critical: boolean;
}

/** Site/aisle/intro copy — authored demo text (reference/prototype.html), constant regardless of state. */
export const SITE = 'Hall B';
export const AISLE = 'Cold aisle 4, 16 racks';
export const INTRO_KICKER = 'Hall B, cold aisle 4, 2:13 AM';
export const INTRO_TITLE = 'A cooling alert, live.';
export const INTRO_BODY = 'A rack is about to overheat. Watch the alert escalate, then decide: act on it, or let it fail.';
export const LOCK_DATE = 'Monday, September 28';

/** 'H:MM', no leading zero on the hour — matches the prototype's lock-screen clock exactly (distinct from fmt()'s 'HH:MM:SS'). */
export function lockTimeText(clockSeconds: number): string {
  const h = Math.floor(clockSeconds / 3600) % 24;
  const mm = String(Math.floor(clockSeconds / 60) % 60).padStart(2, '0');
  return `${h}:${mm}`;
}

/**
 * What the lock notification would say about the focused rack right now.
 * The live prototype tracks this as an event side-effect (a notification
 * fired at a moment in time, independent of the current reading); this is
 * a state-only approximation good enough for a static snapshot — exact
 * event-driven notification content is wired in step 6.
 */
export function currentLockNotification(state: SimState): LockNotification | null {
  const m = state.racks[state.focus];
  if (m.down) return shutdownNotify(m.id);
  if (m.state === 'rising' || m.state === 'critical') return stateNotify(m.id, m.state, m.T);
  return null;
}

export interface InstrumentHandlers {
  onSelectRack: (id: RackId) => void;
  onConfirm: () => void;
  onOverride: () => void;
  onUndo: () => void;
  onHoldBusyChange?: (busy: boolean) => void;
  onHoldProgressChange?: (progress: number) => void;
  onOutcomePrimary: () => void;
  onOutcomeAgain: () => void;
  onOpenLock: () => void;
  onIntroStart: () => void;
  onIntroDismiss: () => void;
}

/**
 * Assembles every prop Instrument needs, purely from SimState + the
 * caller's handlers. Used by /states (no-op handlers, no live loop) and,
 * from step 6, the live product route (real handlers dispatching sim
 * actions) — the same presenter either way.
 */
export function presentInstrument(state: SimState, handlers: InstrumentHandlers, holdProgress = 0) {
  const layout = composeScreen(state);
  const focusedRack = focusedView(state);
  const fieldRacks = Object.fromEntries(RACK_IDS.map((id) => [id, toRackView(state, id)])) as Record<RackId, ReturnType<typeof toRackView>>;

  return {
    layout,
    site: SITE,
    aisle: AISLE,
    clock: fmt(state.clock),
    fieldRacks,
    boosted: state.boosted,
    aim: state.lastAim,
    focusedRack,
    queue: queueEntries(state),
    onSelectRack: handlers.onSelectRack,
    holdProgress,
    projection: computeProjection(state, state.focus),
    actionCopy: composeActionSlab(state),
    onConfirm: handlers.onConfirm,
    onOverride: handlers.onOverride,
    onUndo: handlers.onUndo,
    onHoldBusyChange: handlers.onHoldBusyChange,
    onHoldProgressChange: handlers.onHoldProgressChange,
    outcome: composeOutcome(state),
    onOutcomePrimary: handlers.onOutcomePrimary,
    onOutcomeAgain: handlers.onOutcomeAgain,
    lockDate: LOCK_DATE,
    lockTime: lockTimeText(state.clock),
    lockNotification: currentLockNotification(state),
    onOpenLock: handlers.onOpenLock,
    intro: { kicker: INTRO_KICKER, title: INTRO_TITLE, body: INTRO_BODY, onStart: handlers.onIntroStart, onDismiss: handlers.onIntroDismiss },
  };
}
