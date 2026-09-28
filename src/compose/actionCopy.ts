import { OPERATOR, SIM_SECONDS_PER_READING } from '../sim/constants';
import type { SimState } from '../sim/types';

export interface ActionSlabCopy {
  /** Whether the calm message (vs. the why/status pair) should show. */
  calm: boolean;
  calmMessage: string;
  why: string;
  /** null when there is nothing to report (rack unacted and not critical/rising). */
  status: string | null;
  /** rack.acted === 'fix' — the status line gets a leading check. */
  statusDone: boolean;
  offerAction: boolean;
  /** The button's resting label ("Hold to boost CRAC-3" / "Hold to cool A-03"). */
  holdLabel: string;
  /** null when there is nothing to undo. */
  undoLabel: string | null;
  /**
   * Changes exactly when a new action lands (act/override), and only then —
   * unlike `status`, which also changes every reading during ramp-up. The
   * UI keys the "fresh" replay off this, not off `status` (see ActionSlab).
   */
  actedAt: string;
}

/**
 * One recommendation, one reason, one status line (contract/components.md
 * §5). Composed here, not in the component — the slab renders sentences,
 * it doesn't build them.
 */
export function composeActionSlab(state: SimState): ActionSlabCopy {
  const m = state.racks[state.focus];
  const st = m.state; // NOT shownState: the down override is applied separately below
  const calm = st === 'calm';
  const isB07 = m.id === 'B-07';
  const perMin = m.slope * (60 / SIM_SECONDS_PER_READING);

  const calmMessage = state.boosted ? 'All 16 racks in range. CRAC-3 boost is still on.' : 'All 16 racks in range. Nothing needs your attention.';

  let eta = 'Holding above the limit.';
  if (m.T >= 35) {
    eta = perMin > 0.1 ? `Servers are throttling now. Shutdown at 38°C in about ${Math.max(1, Math.round((38 - m.T) / perMin))} min.` : 'Servers are throttling now.';
  } else if (perMin > 0.1) {
    eta = `Servers throttle at 35°C in about ${Math.max(1, Math.round((35 - m.T) / perMin))} min.`;
  }

  let why = '';
  if (st === 'recovering') why = 'Falling back toward the recommended range.';
  else if (isB07) {
    if (st === 'rising') why = 'Inlet passed the 27°C recommended limit and is climbing. Recommended: raise CRAC-3 fan to 100%.';
    if (st === 'critical') why = `Above the 32°C allowable limit. ${eta}`;
  } else {
    if (st === 'rising') why = 'Rack fan failure. Recommended: aim CRAC-3 at A-03 and shift its workloads off.';
    if (st === 'critical') why = `Rack fan failure, above the 32°C limit. ${eta}`;
  }
  if (m.down) why = `Rack ${m.id} shut down at 38°C to protect hardware.`;

  const offerAction = !calm && m.acted === null && st !== 'recovering' && !m.down;

  let status: string | null = null;
  if (m.acted === 'manual') {
    // manual control is reported regardless of calm
    status = `Manual control of ${m.id} by ${OPERATOR} since ${m.actAt}. Logged.`;
  } else if (m.acted === 'fix' && !calm) {
    // a landed fix is reported only while there's still something to report (hidden once calm)
    const pct = Math.round(m.prog * 100);
    status = isB07
      ? m.prog < 1
        ? `CRAC-3 spinning up, ${pct}%. Logged at ${m.actAt}.`
        : `CRAC-3 at 100% since ${m.actAt}. Inlet should start falling within a minute. Logged.`
      : m.prog < 1
        ? `CRAC-3 boosting A-03, workloads ${pct}% moved. Logged at ${m.actAt}.`
        : `CRAC-3 on A-03, workloads moved. Inlet falling. Logged at ${m.actAt}.`;
  }

  const holdLabel = isB07 ? 'Hold to boost CRAC-3' : 'Hold to cool A-03';
  const undoLabel = m.acted === null ? null : m.acted === 'manual' ? 'Resume recommendations' : isB07 ? 'Revert boost' : 'Revert cooling';

  return { calm, calmMessage, why, status, statusDone: m.acted === 'fix', offerAction, holdLabel, undoLabel, actedAt: m.actAt };
}
