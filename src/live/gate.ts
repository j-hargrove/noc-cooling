import type { SimEvent } from '../sim/types';

export interface GateContext {
  /** The lock screen is covering the app (SimState.locked, after the step that produced the events). */
  locked: boolean;
  /** OS prefers-reduced-motion. */
  reducedMotion: boolean;
}

/**
 * Which of a step's sim events the UI is allowed to play right now.
 *
 * The sim decides *whether* something happened and emits it unconditionally;
 * whether it can be *shown* depends on what's on screen, which is the UI's
 * call (src/sim/types.ts SimEvent docs, docs/BUILD_BRIEF.md step 6):
 *
 *  - `shock` belongs to the unlocked app. It never fires behind the lock
 *    screen (contract/components.md §7), and under reduced motion it's
 *    removed outright, with no substitute (contract/a11y-spec.md §3).
 *  - `notify` is lock-screen content. With the app open there's no
 *    notification to update, so it's dropped.
 *
 * Everything else (log, announce, haptic, event pill, outcome, stand-down)
 * plays regardless: announcements and haptics are exactly what a locked or
 * reduced-motion operator still needs.
 */
export function gateEvents(events: readonly SimEvent[], { locked, reducedMotion }: GateContext): SimEvent[] {
  return events.filter((e) => {
    if (e.type === 'shock') return !locked && !reducedMotion;
    if (e.type === 'notify') return locked;
    return true;
  });
}
