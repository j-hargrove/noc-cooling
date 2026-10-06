import { OPERATOR } from './constants';
import type { AlertState, RackId } from './types';

/**
 * Sentence composition for the log and the live-region announcements.
 * This is behavior, not presentation — contract/a11y-spec.md fixes these
 * strings verbatim, and src/sim/engine tests assert against them. It is
 * deliberately separate from the UI's WORD/GLYPH lookup
 * (contract/components.md "Shared vocabulary"), which is presentation only.
 */
const STATE_PHRASE: Record<AlertState, string> = {
  calm: 'normal',
  recovering: 'drifting, recovering',
  rising: 'drifting, rising',
  critical: 'critical',
};

const fmt1 = (t: number) => t.toFixed(1);

/** OPERATOR opening a sentence: "You took…", not "you took…". */
const OPERATOR_START = OPERATOR[0].toUpperCase() + OPERATOR.slice(1);

export const stateChangeLogText = (id: RackId, t: AlertState) => `${id} changed to ${STATE_PHRASE[t]}`;

export function stateChangeAnnouncement(id: RackId, t: AlertState, temp: number): { urgency: 'polite' | 'assertive'; message: string } {
  if (t === 'critical') {
    const advice = id === 'B-07' ? 'Recommended: boost CRAC-3 fan.' : 'Fan failure. Recommended: cool A-03.';
    return { urgency: 'assertive', message: `Critical. Rack ${id} inlet ${fmt1(temp)} degrees and rising. ${advice}` };
  }
  if (t === 'calm') return { urgency: 'polite', message: `Rack ${id} back to normal.` };
  return { urgency: 'polite', message: `Rack ${id} ${STATE_PHRASE[t]}. Inlet ${fmt1(temp)} degrees.` };
}

export function stateNotify(id: RackId, t: 'rising' | 'critical', temp: number): { title: string; body: string; critical: boolean } {
  if (t === 'critical') {
    const body = id === 'B-07' ? `Inlet ${fmt1(temp)}°C and rising. Boost CRAC-3 now.` : `Fan failure, inlet ${fmt1(temp)}°C. Cool ${id} now.`;
    return { title: `Critical: rack ${id} above 32°C`, body, critical: true };
  }
  return { title: `Rack ${id} inlet drifting`, body: `Inlet ${fmt1(temp)}°C and rising in cold aisle 4.`, critical: false };
}

export const shutdownLogText = (id: RackId) => `${id} shut down at 38°C to protect hardware`;
export const shutdownAnnouncement = (id: RackId) => `Rack ${id} has shut down. Servers powered off to protect hardware.`;
export const shutdownNotify = (id: RackId) => ({
  title: `Rack ${id} shut down`,
  body: 'Inlet hit 38°C. Servers powered off to protect hardware.',
  critical: true,
});

export function actLogText(id: RackId): string {
  return id === 'B-07' ? `CRAC-3 fan boosted to 100% by ${OPERATOR}` : `CRAC-3 boosted toward A-03 and workloads shifting off, by ${OPERATOR}`;
}
export function actEventPill(id: RackId): string {
  return id === 'B-07' ? 'CRAC-3 boosting to 100%' : 'Cooling A-03: CRAC-3 boost and load shift';
}
export function actAnnouncement(id: RackId): string {
  return id === 'B-07' ? 'Boost applied. CRAC-3 at 100 percent. Logged.' : 'CRAC-3 boosting toward A-03, workloads shifting off. Logged.';
}

export const overrideLogText = (id: RackId) => `Override: ${OPERATOR} took manual control of ${id}`;
export const overrideAnnouncement = (id: RackId) => `Override logged. Manual control of ${id}.`;

export function undoLogText(id: RackId, wasManual: boolean): string {
  if (wasManual) return `${OPERATOR_START} resumed recommendations for ${id}`;
  return id === 'B-07' ? `CRAC-3 boost reverted by ${OPERATOR}` : `A-03 cooling reverted by ${OPERATOR}`;
}

export const secondRackFaultLogText = 'Simulated: fan failure on rack A-03';
export const secondRackFaultAnnouncement = 'Fan failure on rack A-03.';
export function secondRackFaultEventPill(isReopen: boolean): string {
  return isReopen ? 'New alert: fan failure on rack A-03' : 'Fan failure on rack A-03';
}

export const resolvedOkLogText = 'Incident resolved: all racks back in range';
export const resolvedOkAnnouncement = 'Incident resolved. All racks back in range.';
export function resolvedMixedLogText(recoveredId: RackId, downIds: RackId[]): string {
  return `${recoveredId} recovered; ${downIds.join(', ')} still offline`;
}
export function resolvedMixedAnnouncement(recoveredId: RackId, downIds: RackId[]): string {
  return `Rack ${recoveredId} recovered. ${downIds.join(' and ')} still offline.`;
}

export const standDownLogText = 'CRAC-3 returned to 60%';
export function standDownOfflineLogText(offlineIds: RackId[]): string {
  return `CRAC-3 returned to 60%: ${offlineIds.join(' and ')} offline`;
}
export const standDownEventPill = 'CRAC-3 back to 60%';

export function dispatchLogText(downIds: RackId[]): string {
  return `On-site tech dispatched to ${downIds.join(' and ')} by ${OPERATOR}`;
}
export const dispatchAnnouncement = 'Tech dispatched. Logged.';

export const incidentStartLogText = 'Simulated incident started: heat load spiking at B-07';
export const incidentStartEventPill = 'Heat load spiking at rack B-07';
export const incidentStartAnnouncement = 'Heat load spiking at rack B-07.';
