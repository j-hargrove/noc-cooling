/**
 * UI timers, in ms. Mirrors contract/tokens.json → timing.* and the
 * *Ms entries under motion.*. Kept separate from src/sim/constants.ts:
 * these are pointer/keyboard interaction timers (contract/a11y-spec.md §2)
 * and choreography hand-offs (an element's exit animation finishing), not
 * sim reading-count events. src/ui/timing.test.ts cross-checks every one
 * against contract/tokens.json.
 */
export const HOLD_MS = 750;
export const HOLD_HINT_REVERT_MS = 2000;
export const KEYBOARD_ARM_WINDOW_MS = 3000;

/** One sensor reading: the live loop's tick. */
export const READ_INTERVAL_MS = 1500;
/** Clear-then-set gap that makes a repeated message re-announce (contract/a11y-spec.md §1). */
export const LIVE_REGION_RESET_MS = 60;
/** The outcome primary takes focus this long after the sheet enters — only while unlocked. */
export const OUTCOME_FOCUS_MS = 300;
/** How long the event pill stays up. */
export const EVENT_VISIBLE_MS = 3800;
/** Exit animations: how long each overlay stays mounted after it starts leaving. */
export const INTRO_HIDDEN_AFTER_MS = 460;
export const LOCK_HIDDEN_AFTER_MS = 480;
export const OUTCOME_REMOVE_AFTER_MS = 600;
