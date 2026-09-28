import { RAMP } from '../sim/constants';
import { rate, target } from '../sim/rack';
import type { RackId, SimState } from '../sim/types';

const STEPS = 12;

export interface Projection {
  /** STEPS+1 points, starting at the current reading: where it's headed if nothing changes. */
  none: number[];
  /** STEPS+1 points: where it's headed if fixed now. */
  fixed: number[];
  verb: string;
}

/**
 * The readout's 3-minute projection (contract/components.md §4). Only
 * offered for a live, unacted, alerting rack — mirrors the prototype's
 * drawSpark()/future(). Pure: reuses the sim's own target()/rate(), so the
 * projected curve can never drift from what actually happens if the
 * operator holds the button.
 */
export function computeProjection(state: SimState, rackId: RackId): Projection | null {
  const m = state.racks[rackId];
  const showable = m.state !== 'calm' && m.state !== 'recovering' && m.acted === null && !m.down;
  if (!showable) return null;

  const future = (fix: boolean): number[] => {
    let t = m.T;
    let p = 0;
    const out = [t];
    for (let k = 1; k <= STEPS; k++) {
      if (fix) p = Math.min(1, p + RAMP[rackId]);
      t += (target(state, m, p) - t) * rate({ id: rackId, acted: fix ? 'fix' : null });
      out.push(t);
    }
    return out;
  };

  return { none: future(false), fixed: future(true), verb: rackId === 'B-07' ? 'with boost' : 'if cooled' };
}
