import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MULTI_RACK_OVERRIDE, ROW_WEIGHTS } from '../compose/layoutTokens';
import {
  AFTERSHOCK_READINGS,
  FOCUS_HANDOFF_READINGS,
  INCIDENT_HEAT_STEP,
  STAND_DOWN_READINGS,
} from './constants';
import type { ShownState } from './types';

/**
 * src/ is the TS build root, so src/sim/constants.ts can't `import` from
 * contract/tokens.json (it's outside rootDir) — the values are duplicated by
 * hand instead. This test reads contract/tokens.json and docs/decisions.md
 * as plain files (fs, not a module import) and cross-checks the numbers, so
 * the two can't silently drift.
 */
// vitest runs from the repo root (see package.json's "test" script).
const repoRoot = process.cwd();
const tokens = JSON.parse(readFileSync(join(repoRoot, 'contract', 'tokens.json'), 'utf8'));
const decisions = readFileSync(join(repoRoot, 'docs', 'decisions.md'), 'utf8');

describe('the incident heat ramp is the same in the artifact, the contract and the sim', () => {
  const prototype = readFileSync(join(repoRoot, 'reference', 'prototype.html'), 'utf8');

  it('contract/tokens.json → timing.incidentHeatStep', () => {
    expect(INCIDENT_HEAT_STEP).toBe(tokens.timing.incidentHeatStep);
  });

  it('reference/prototype.html ramps S.heat by the same step', () => {
    const m = prototype.match(/S\.heat = Math\.min\(S\.incident, S\.heat \+ (\d+)\)/);
    expect(m, 'heat ramp line not found in reference/prototype.html').not.toBeNull();
    expect(Number(m![1])).toBe(INCIDENT_HEAT_STEP);
  });

  it('docs/decisions.md records the step', () => {
    expect(decisions).toContain(`+${INCIDENT_HEAT_STEP} per reading`);
  });
});

describe('sim constants stay in sync with contract/tokens.json', () => {
  it('the aftershock reading count matches (already reading-count-native in the prototype)', () => {
    expect(AFTERSHOCK_READINGS).toBe(tokens.timing.aftershockReadings);
  });

  it('the focus handoff conversion matches focusHandoffMs / readIntervalMs, rounded', () => {
    const expected = Math.round(tokens.timing.focusHandoffMs / tokens.timing.readIntervalMs);
    expect(FOCUS_HANDOFF_READINGS).toBe(expected);
  });

  it('the stand-down conversion matches standDownMs / readIntervalMs, rounded', () => {
    const expected = Math.round(tokens.timing.standDownMs / tokens.timing.readIntervalMs);
    expect(STAND_DOWN_READINGS).toBe(expected);
  });
});

describe('compose layer row weights stay in sync with contract/tokens.json → layout', () => {
  const SHOWN_STATES: ShownState[] = ['calm', 'recovering', 'rising', 'critical', 'offline'];

  for (const shown of SHOWN_STATES) {
    it(`layout.weights.${shown} matches ROW_WEIGHTS.${shown} field-for-field`, () => {
      expect(ROW_WEIGHTS[shown]).toEqual(tokens.layout.weights[shown]);
    });
  }

  it('layout.multiRackOverride matches MULTI_RACK_OVERRIDE field-for-field', () => {
    const { field, queue, readout } = tokens.layout.multiRackOverride;
    expect(MULTI_RACK_OVERRIDE).toEqual({ field, queue, readout });
  });

  it('every row in ROW_WEIGHTS matches the contract\'s declared row order', () => {
    expect(tokens.layout.rows).toEqual(['field', 'queue', 'readout', 'action']);
    for (const shown of SHOWN_STATES) {
      expect(Object.keys(ROW_WEIGHTS[shown]).sort()).toEqual([...tokens.layout.rows].sort());
    }
  });
});

describe('sim thresholds stay in sync with docs/decisions.md', () => {
  it('names the ASHRAE recommended and allowable limits', () => {
    expect(decisions).toMatch(/27.?°C recommended/);
    expect(decisions).toMatch(/32.?°C allowable/);
  });

  it('names the throttle and shutdown thresholds', () => {
    expect(decisions).toMatch(/throttling at 35.?°C/);
    expect(decisions).toMatch(/shutdown at 38.?°C/);
  });

  it('names the 3-reading hysteresis rule', () => {
    expect(decisions).toMatch(/3 steady readings/);
  });

  it('names the ~14-reading aftershock', () => {
    expect(decisions).toMatch(/~14 readings/);
  });
});
