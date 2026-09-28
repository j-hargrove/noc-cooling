import { SEV, SIM_SECONDS_PER_READING } from '../sim/constants';
import { shownState } from '../sim/rack';
import { focused, others } from '../sim/selectors';
import type { ActedAs, AlertState, RackId, ShownState, SimState } from '../sim/types';

/**
 * Rendering-ready projection of a RackModel (contract/components.md "Shared
 * vocabulary": "RackView there is a rendering-ready projection of RackModel
 * [in src/sim]"). src/ui components take this, never a raw RackModel.
 */
export interface RackView {
  id: RackId;
  shown: ShownState;
  state: AlertState;
  down: boolean;
  tempC: number;
  ratePerMin: number;
  stable: 0 | 1 | 2 | 3;
  acted: ActedAs;
  actedAt: string;
  fixProgress: number;
  fresh: boolean;
  history: number[];
}

export function toRackView(state: SimState, id: RackId): RackView {
  const m = state.racks[id];
  return {
    id: m.id,
    shown: shownState(m),
    state: m.state,
    down: m.down,
    tempC: m.T,
    ratePerMin: m.slope * (60 / SIM_SECONDS_PER_READING),
    stable: Math.min(3, m.stable) as 0 | 1 | 2 | 3,
    acted: m.acted,
    actedAt: m.actAt,
    fixProgress: m.prog,
    fresh: m.fresh,
    history: m.hist,
  };
}

/** The focused rack's view, ready for the readout and action slab. */
export function focusedView(state: SimState): RackView {
  return toRackView(state, state.focus);
}

/**
 * Queue cards, most severe first, each flagged "more urgent" than the
 * focused rack — mirrors the prototype's renderQueue() urgency rule.
 */
export function queueEntries(state: SimState): { rack: RackView; urgent: boolean }[] {
  const f = focused(state);
  return others(state).map((m) => ({
    rack: toRackView(state, m.id),
    urgent: SEV[m.state] > SEV[f.state] || (SEV[m.state] === SEV[f.state] && !m.acted && f.acted !== null),
  }));
}
