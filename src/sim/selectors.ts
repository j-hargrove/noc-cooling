import { RACK_IDS, SEV, SIM_SECONDS_PER_READING } from './constants';
import type { RackId, RackModel, SimState } from './types';

export function focused(state: Pick<SimState, 'racks' | 'focus'>): RackModel {
  return state.racks[state.focus];
}

const bySeverityThenTemp = (a: RackModel, b: RackModel) => SEV[b.state] - SEV[a.state] || b.T - a.T;

/** Other racks needing attention — what fills the queue card(s). */
export function others(state: Pick<SimState, 'racks' | 'focus'>): RackModel[] {
  return RACK_IDS.map((id) => state.racks[id])
    .filter((m) => m.id !== state.focus && m.state !== 'calm')
    .sort(bySeverityThenTemp);
}

/** The next rack the operator hasn't acted on yet, most severe first. */
export function nextUnhandled(state: Pick<SimState, 'racks' | 'focus'>): RackModel | undefined {
  return RACK_IDS.map((id) => state.racks[id])
    .filter((m) => m.id !== state.focus && !m.acted && SEV[m.state] >= 2)
    .sort(bySeverityThenTemp)[0];
}

/**
 * Airflow stays where the operator sent it: the hottest actively-cooled
 * rack, or the rack CRAC-3 was last aimed at if it's still being cooled, or
 * whichever cooled rack comes first — never a fallback that flickers.
 * Pure: callers apply `lastAim` to state themselves (see engine.ts).
 */
export function resolveAim(state: Pick<SimState, 'racks' | 'lastAim'>): {
  aim: RackId;
  lastAim: RackId | null;
} {
  const acted = RACK_IDS.map((id) => state.racks[id]).filter((m) => m.acted === 'fix' && !m.down);
  const hottestActive = acted.filter((m) => m.state !== 'calm').sort((a, b) => b.T - a.T)[0];
  const stickyMatch = acted.find((m) => m.id === state.lastAim);
  const t = hottestActive ?? stickyMatch ?? acted[0];
  const lastAim = t ? t.id : state.lastAim;
  return { aim: lastAim ?? 'B-07', lastAim };
}

export function throttledSeconds(state: Pick<SimState, 'racks'>): number {
  return RACK_IDS.reduce((sum, id) => sum + state.racks[id].thr, 0) * SIM_SECONDS_PER_READING;
}

export function actionsCount(state: Pick<SimState, 'log'>): number {
  return state.log.filter((e) => e.kind === 'act').length;
}

export function incidentDuration(state: Pick<SimState, 'clock' | 'startClock'>): number {
  return state.clock - state.startClock;
}
