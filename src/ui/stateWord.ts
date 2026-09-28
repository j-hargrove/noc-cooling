import type { ShownState } from '../sim/types';

/** Presentation only (contract/components.md "Shared vocabulary"). */
export const STATE_WORD: Record<ShownState, string> = {
  calm: 'Normal',
  recovering: 'Drifting, recovering',
  rising: 'Drifting, rising',
  critical: 'Critical',
  offline: 'Offline',
};
