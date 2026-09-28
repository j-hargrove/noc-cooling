import { RACK_IDS } from '../sim/constants';
import { dur, fmt } from '../sim/format';
import { actionsCount, incidentDuration, throttledSeconds } from '../sim/selectors';
import type { Outcome, RackModel, SimState } from '../sim/types';

export interface OutcomeCopy {
  kind: Outcome;
  glyph: 'resolved' | 'offline';
  title: string;
  body: string;
  /** Always exactly three [label, value] pairs. */
  stats: [string, string][];
  primaryLabel: string;
  primaryDisabled: boolean;
}

/**
 * The outcome sheet's copy (contract/components.md §6). Composed here from
 * whichever rack the prototype's showOutcome(kind, m) would have been
 * called with: the phase rack for "ok"/"mixed" (still tracked exactly, as
 * state.phaseRack); for "fail", the down rack with the latest critAt when
 * more than one is down — title/body don't depend on which in that case
 * (they switch to the plural form), only the "To shutdown" stat does, and
 * "most recently went critical" is a deterministic, well-defined stand-in
 * for "most recently triggered this outcome" without extra bookkeeping.
 */
export function composeOutcome(state: SimState): OutcomeCopy | null {
  const kind = state.ended;
  if (!kind) return null;
  const all = RACK_IDS.map((id) => state.racks[id]);
  const downs = all.filter((r) => r.down);

  let stats: [string, string][];
  let title: string;
  let body: string;

  if (kind === 'ok' || kind === 'mixed') {
    const pr = state.phaseRack ? state.racks[state.phaseRack] : all[0];
    if (kind === 'ok') {
      const peakRack = all.reduce((a, b) => (b.peak > a.peak ? b : a));
      stats = [
        ['Duration', dur(incidentDuration(state))],
        ['Peak inlet', `${peakRack.peak.toFixed(1)}°`],
        ['Actions', String(actionsCount(state))],
      ];
      title = 'Incident resolved';
      const throttled = throttledSeconds(state);
      body = `All 16 racks back in range at ${fmt(state.clock)}. ${throttled ? `Servers throttled for ${dur(throttled)}.` : 'No servers throttled.'} Every action is in the log.`;
    } else {
      stats = [
        ['Duration', dur(incidentDuration(state))],
        ['Racks offline', String(downs.length)],
        ['Actions', String(actionsCount(state))],
      ];
      title = `${pr.id} recovered`;
      body = `${pr.id} is back in range at ${fmt(state.clock)}. ${downs.map((d) => `${d.id} is still offline after shutting down at ${d.downAt}`).join('. ')}. It needs hands on site.`;
    }
  } else {
    const m: RackModel = downs.reduce((a, b) => (b.critAt > a.critAt ? b : a));
    stats = [
      ['To shutdown', dur(state.clock - m.critAt)],
      ['Throttled', dur(throttledSeconds(state))],
      ['Actions', String(actionsCount(state))],
    ];
    title = downs.length > 1 ? `${downs.length} racks shut down` : `Rack ${m.id} shut down`;
    body =
      downs.length > 1
        ? `${downs.map((r) => r.id).join(' and ')} hit 38°C and powered off to protect their hardware, taking ${40 * downs.length} servers offline. Workloads are failing over to other racks.`
        : `Inlet hit 38°C at ${m.downAt}. The rack powered off to protect its hardware, taking 40 servers offline. Workloads are failing over to other racks.`;
  }

  const sent = kind !== 'ok' && downs.length > 0 && downs.every((d) => state.dispatched[d.id]);
  return {
    kind,
    glyph: kind === 'fail' ? 'offline' : 'resolved',
    title,
    body,
    stats,
    primaryLabel: kind === 'ok' ? 'Done' : sent ? 'Tech dispatched, logged' : 'Dispatch on-site tech',
    primaryDisabled: sent,
  };
}
