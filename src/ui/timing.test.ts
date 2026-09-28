import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOLD_HINT_REVERT_MS, HOLD_MS, KEYBOARD_ARM_WINDOW_MS } from './timing';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'contract', 'tokens.json'), 'utf8'));

describe('src/ui/timing.ts stays in sync with contract/tokens.json → timing', () => {
  it('holdMs', () => expect(HOLD_MS).toBe(tokens.timing.holdMs));
  it('holdHintRevertMs', () => expect(HOLD_HINT_REVERT_MS).toBe(tokens.timing.holdHintRevertMs));
  it('keyboardArmWindowMs', () => expect(KEYBOARD_ARM_WINDOW_MS).toBe(tokens.timing.keyboardArmWindowMs));
});
