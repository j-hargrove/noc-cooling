import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EVENT_VISIBLE_MS,
  HOLD_HINT_REVERT_MS,
  HOLD_MS,
  INTRO_HIDDEN_AFTER_MS,
  KEYBOARD_ARM_WINDOW_MS,
  LIVE_REGION_RESET_MS,
  LOCK_HIDDEN_AFTER_MS,
  OUTCOME_FOCUS_MS,
  OUTCOME_REMOVE_AFTER_MS,
  READ_INTERVAL_MS,
} from './timing';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'contract', 'tokens.json'), 'utf8'));

describe('src/ui/timing.ts stays in sync with contract/tokens.json', () => {
  it('timing.holdMs', () => expect(HOLD_MS).toBe(tokens.timing.holdMs));
  it('timing.holdHintRevertMs', () => expect(HOLD_HINT_REVERT_MS).toBe(tokens.timing.holdHintRevertMs));
  it('timing.keyboardArmWindowMs', () => expect(KEYBOARD_ARM_WINDOW_MS).toBe(tokens.timing.keyboardArmWindowMs));
  it('timing.readIntervalMs', () => expect(READ_INTERVAL_MS).toBe(tokens.timing.readIntervalMs));
  it('timing.liveRegionResetMs', () => expect(LIVE_REGION_RESET_MS).toBe(tokens.timing.liveRegionResetMs));
  it('timing.outcomeFocusMs', () => expect(OUTCOME_FOCUS_MS).toBe(tokens.timing.outcomeFocusMs));
  it('motion.event.visibleMs', () => expect(EVENT_VISIBLE_MS).toBe(tokens.motion.event.visibleMs));
  it('motion.introOut.hiddenAfterMs', () => expect(INTRO_HIDDEN_AFTER_MS).toBe(tokens.motion.introOut.hiddenAfterMs));
  it('motion.lockOpen.hiddenAfterMs', () => expect(LOCK_HIDDEN_AFTER_MS).toBe(tokens.motion.lockOpen.hiddenAfterMs));
  it('motion.outcomeOut.removeAfterMs', () => expect(OUTCOME_REMOVE_AFTER_MS).toBe(tokens.motion.outcomeOut.removeAfterMs));
});
