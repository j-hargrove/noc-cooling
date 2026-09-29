import { advanceReading, createInitialState, startIncident } from '../sim/engine';
import type { SimState } from '../sim/types';

const PREVIEW_SEED = 7;

/**
 * The narrow-embed static preview: the incident's most telling moment —
 * B-07 just gone critical, action on offer — composed by running the real
 * sim, so the picture can never show a state the app wouldn't.
 */
export function buildPreviewState(): SimState {
  let s = startIncident(createInitialState(PREVIEW_SEED), { autoSecond: false }).state;
  for (let i = 0; i < 60 && s.racks['B-07'].state !== 'critical'; i++) s = advanceReading(s).state;
  // Two more readings so the rate and projection read as a clear climb.
  s = advanceReading(advanceReading(s).state).state;
  return s;
}
