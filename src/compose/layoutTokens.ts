import type { ShownState } from '../sim/types';

/**
 * Row weights for the four-row body ("field", "queue", "readout", "action"),
 * duplicated from contract/tokens.json's "layout" section — not imported,
 * for the same reason as src/sim/constants.ts: src/ is the TS build root
 * and contract/ sits outside it. src/sim/tokens-sync.test.ts reads
 * contract/tokens.json at test time and cross-checks every value here
 * against it, so the two can't silently drift.
 */
export interface RowWeights {
  field: string;
  queue: string;
  readout: string;
  action: string;
}

/** contract/tokens.json → layout.weights. Offline uses the critical shape. */
export const ROW_WEIGHTS: Record<ShownState, RowWeights> = {
  calm: { field: '1.25fr', queue: '0fr', readout: '.8fr', action: '.36fr' },
  recovering: { field: '1.5fr', queue: '0fr', readout: '.85fr', action: '.6fr' },
  rising: { field: '1.7fr', queue: '0fr', readout: '.9fr', action: '.72fr' },
  critical: { field: '1.8fr', queue: '0fr', readout: '.95fr', action: '.72fr' },
  offline: { field: '1.8fr', queue: '0fr', readout: '.95fr', action: '.72fr' },
};

/**
 * contract/tokens.json → layout.multiRackOverride. Applied on top of
 * ROW_WEIGHTS[shown] when a second rack is queued: overrides field, queue
 * and readout; action keeps its state's own value.
 */
export const MULTI_RACK_OVERRIDE: Pick<RowWeights, 'field' | 'queue' | 'readout'> = {
  field: '1.5fr',
  queue: '.36fr',
  readout: '.95fr',
};
