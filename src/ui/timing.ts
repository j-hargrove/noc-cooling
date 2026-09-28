/**
 * UI gesture timers, in ms. Mirrors contract/tokens.json → timing.holdMs /
 * holdHintRevertMs / keyboardArmWindowMs. Kept separate from src/sim/constants.ts:
 * these are pointer/keyboard interaction timers (contract/a11y-spec.md §2),
 * not sim reading-count events. src/ui/timing.test.ts cross-checks them
 * against contract/tokens.json.
 */
export const HOLD_MS = 750;
export const HOLD_HINT_REVERT_MS = 2000;
export const KEYBOARD_ARM_WINDOW_MS = 3000;
