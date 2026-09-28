import { shownState } from '../sim/rack';
import { focused, others } from '../sim/selectors';
import type { Outcome, ShownState, SimState } from '../sim/types';
import { MULTI_RACK_OVERRIDE, ROW_WEIGHTS, type RowWeights } from './layoutTokens';

/**
 * The two full-screen overlays that can currently cover the app. Mutually
 * exclusive by construction (see composeScreen below): the intro is shown
 * until dismissed, and only once it's gone can the lock screen apply. The
 * outcome sheet is not one of these — it's a partial overlay that coexists
 * with the live body (contract/components.md §6), reported separately below.
 */
export type Overlay = 'intro' | 'lock' | 'none';

export interface LayoutSpec {
  regions: { field: boolean; queue: boolean; readout: boolean; action: boolean };
  /** fr strings for the four body rows, from contract/tokens.json via layoutTokens.ts. */
  weights: RowWeights;
  shown: ShownState;
  multiRack: boolean;
  outcome: Outcome | null;
  overlay: Overlay;
}

/**
 * Rules-based now; Stage 2 swaps in a generative composer behind this same
 * signature (docs/BUILD_BRIEF.md). Pure and total: every SimState maps to
 * exactly one LayoutSpec, with no reference to the DOM, the clock, or
 * anything outside the state passed in.
 */
export function composeScreen(state: SimState): LayoutSpec {
  const shown = shownState(focused(state));
  const multiRack = others(state).length > 0;
  const weights: RowWeights = multiRack ? { ...ROW_WEIGHTS[shown], ...MULTI_RACK_OVERRIDE } : ROW_WEIGHTS[shown];
  const overlay: Overlay = !state.introDismissed ? 'intro' : state.locked ? 'lock' : 'none';

  return {
    regions: { field: true, queue: multiRack, readout: true, action: true },
    weights,
    shown,
    multiRack,
    outcome: state.ended,
    overlay,
  };
}
