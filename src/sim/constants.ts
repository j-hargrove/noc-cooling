import type { AlertState, RackId } from './types';

/**
 * Values mirror contract/tokens.json ("timing") and docs/decisions.md.
 * Duplicated here rather than imported: src/ is the TS build root and
 * contract/ sits outside it. src/sim/tokens-sync.test.ts reads
 * contract/tokens.json at test time (via fs, not a module import) and
 * asserts these can't silently drift from it.
 */

/**
 * Who acted, in the log and status lines. The demo's visitor is the operator,
 * so actions are theirs: "CRAC-3 fan boosted to 100% by you".
 */
export const OPERATOR = 'you';

/** Hall B, cold aisle 4 — the authored scenario opens at 2:13 AM. */
export const START_CLOCK_S = 2 * 3600 + 13 * 60;

export const SIM_SECONDS_PER_READING = 15;

/** ASHRAE thresholds, °C. */
export const RECOMMENDED_C = 27;
export const ALLOWABLE_C = 32;
export const THROTTLE_C = 35;
export const SHUTDOWN_C = 38;

/**
 * Heat-load points an incident adds per reading while ramping toward its
 * target (88). Raised from 15 so escalation feels immediate (docs/decisions.md).
 */
export const INCIDENT_HEAT_STEP = 35;

/** Escalation is immediate; a downgrade needs this many consecutive steady readings. */
export const HYSTERESIS_READINGS = 3;

/** How far a fix ramps in per reading (CRAC-3 spin-up / workload drain). */
export const RAMP: Record<RackId, number> = { 'B-07': 0.34, 'A-03': 0.12 };

export const SEV: Record<AlertState, number> = { calm: 0, recovering: 1, rising: 2, critical: 3 };

export const RACK_IDS: RackId[] = ['B-07', 'A-03'];

/**
 * setTimeouts in the prototype become sim events driven by reading count
 * (docs/BUILD_BRIEF.md). Converted at readIntervalMs = 1500ms:
 */
/**
 * Focus moves to the next unhandled rack 2 readings after acting: 1.5-3.0s,
 * depending on where in the reading interval the action lands. The
 * prototype's fixed 1600ms timer is deliberately not reproduced — reading-count
 * events are the architecture (docs/decisions.md). 1 reading (0-1.5s) could
 * move the target almost as the action lands.
 */
export const FOCUS_HANDOFF_READINGS = 2;
/** standDownMs 2500ms / 1500ms ≈ 1.67, rounded up to 2 readings. */
export const STAND_DOWN_READINGS = 2;
/** Already reading-count-native in the prototype (S.n + 14). */
export const AFTERSHOCK_READINGS = 14;
/** A resolution needs the phase to have run at least this many readings. */
export const RESOLUTION_MIN_READINGS = 3;

/** The manual "Fail a second rack" panel button gives the fault a head start. */
export const SECOND_RACK_HEAD_START_FAULT_LVL = 0.2;
