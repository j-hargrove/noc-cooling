/**
 * Test-only helpers. Not matched by vitest's `*.test.ts` include pattern,
 * so this never runs as a suite itself.
 */
import { advanceReading } from './engine';
import type { RackId, RackModel, SimEvent, SimState } from './types';

/** Directly patches a rack's fields, bypassing thermal physics — for precise scenario setup. */
export function withRack(state: SimState, id: RackId, patch: Partial<RackModel>): SimState {
  return { ...state, racks: { ...state.racks, [id]: { ...state.racks[id], ...patch } } };
}

/** Runs N readings in sequence, threading state through and collecting every event in order. */
export function runReadings(state: SimState, count: number): { state: SimState; events: SimEvent[] } {
  let s = state;
  const events: SimEvent[] = [];
  for (let i = 0; i < count; i++) {
    const r = advanceReading(s);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
