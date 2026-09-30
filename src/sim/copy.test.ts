import { describe, expect, it } from 'vitest';
import { actLogText, dispatchLogText, overrideLogText, undoLogText } from './copy';

describe('operator attribution (docs/decisions.md: actions are "by you")', () => {
  it('log entries attribute actions to you', () => {
    expect(actLogText('B-07')).toBe('CRAC-3 fan boosted to 100% by you');
    expect(actLogText('A-03')).toBe('CRAC-3 boosted toward A-03 and workloads shifting off, by you');
    expect(overrideLogText('B-07')).toBe('Override: you took manual control of B-07');
    expect(undoLogText('B-07', false)).toBe('CRAC-3 boost reverted by you');
    expect(undoLogText('A-03', false)).toBe('A-03 cooling reverted by you');
    expect(dispatchLogText(['B-07', 'A-03'])).toBe('On-site tech dispatched to B-07 and A-03 by you');
  });

  it('capitalises you when it opens the sentence', () => {
    expect(undoLogText('A-03', true)).toBe('You resumed recommendations for A-03');
  });
});
