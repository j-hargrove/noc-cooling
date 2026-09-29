import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as F from './tokens';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'contract', 'tokens.json'), 'utf8'));
const cf = tokens.color.field;
const cs = tokens.color.state;
const field = tokens.field;
const sf = tokens.stroke.field;
const timing = tokens.timing;

describe('src/field/tokens.ts stays in sync with contract/tokens.json', () => {
  it('color.field scalars', () => {
    expect(F.FIELD_BACKGROUND).toBe(cf.background);
    expect(F.RACK_FILL).toBe(cf.rackFill);
    expect(F.RACK_STROKE_CALM).toBe(cf.rackStrokeCalm);
    expect(F.RACK_LABEL_CALM).toBe(cf.rackLabelCalm);
    expect(F.RACK_DOWN_FILL).toBe(cf.rackDownFill);
    expect(F.RACK_DOWN_STROKE).toBe(cf.rackDownStroke);
    expect(F.CHIP_BG).toBe(cf.chipBg);
    expect(F.CHIP_STROKE_CALM).toBe(cf.chipStrokeCalm);
    expect(F.CHIP_INK).toBe(cf.chipInk);
    expect(F.CRAC_FILL).toBe(cf.cracFill);
    expect(F.CRAC_STROKE_IDLE).toBe(cf.cracStrokeIdle);
    expect(F.CRAC_STROKE_BOOSTED).toBe(cf.cracStrokeBoosted);
    expect(F.CRAC_INK_IDLE).toBe(cf.cracInkIdle);
    expect(F.CRAC_INK_BOOSTED).toBe(cf.cracInkBoosted);
    expect(F.STREAM_FAR).toBe(cf.streamFar);
    expect(F.STREAM_ALPHA_IDLE).toBe(cf.streamAlphaIdle);
    expect(F.STREAM_ALPHA_BOOSTED).toBe(cf.streamAlphaBoosted);
    expect(F.STREAM_MID_ALPHA_FACTOR).toBe(cf.streamMidAlphaFactor);
  });

  it('streamNear/streamMid substitute alpha into the templated token', () => {
    expect(F.streamNear(0.5)).toBe(cf.streamNear.replace('ALPHA', '0.5'));
    expect(F.streamMid(0.5)).toBe(cf.streamMid.replace('ALPHA', '0.5'));
  });

  it('color.field.lut', () => {
    expect(F.LUT_STOPS).toEqual(cf.lut.map((pair: [number, string]) => pair));
  });

  it('color.state', () => {
    expect(F.STATE_COLOR).toEqual({ calm: cs.calm, recovering: cs.recovering, rising: cs.rising, critical: cs.critical });
  });

  it('field geometry', () => {
    expect(F.GW).toBe(field.grid.width);
    expect(F.GH).toBe(field.grid.height);
    expect(F.RACK_GEOM).toEqual({ xLeft: field.rack.xLeft, xRight: field.rack.xRight, w: field.rack.w, yStart: field.rack.yStart, yStep: field.rack.yStep, h: field.rack.h });
    expect(F.CRAC).toEqual({ x: field.crac.x, w: field.crac.w, y: field.crac.y, h: field.crac.h, minPixelHeight: field.crac.minPixelHeight });
    expect(F.AISLE_L).toBe(field.aisle.left);
    expect(F.AISLE_R).toBe(field.aisle.right);
    expect(F.AISLE_C).toBe(field.aisle.center);
    expect(F.DIFFUSION).toBe(field.diffusion);
    expect(F.SUPPLY_BLEED).toBe(field.supplyBleed);
    expect(F.STREAMLINES_IDLE).toBe(field.streamlines.idle);
    expect(F.STREAMLINES_BOOSTED).toBe(field.streamlines.boosted);
    expect(F.STREAMLINE_TRACE_STEPS).toBe(field.streamlines.traceSteps);
    expect(F.STREAMLINE_SEED_SPREAD).toBe(field.streamlines.seedSpread);
    expect(F.STREAMLINE_SEED_EXPONENT).toBe(field.streamlines.seedExponent);
    expect(F.DEVICE_PIXEL_RATIO_CAP).toBe(field.devicePixelRatioCap);
  });

  it('stroke.field', () => {
    expect(F.STROKE_RACK_CALM).toBe(sf.rackCalm);
    expect(F.STROKE_RACK_ALERT).toBe(sf.rackAlert);
    expect(F.STROKE_RACK_FOCUSED).toBe(sf.rackFocused);
    expect(F.STROKE_RACK_DOWN).toBe(sf.rackDown);
    expect(F.STROKE_RACK_DOWN_DASH).toEqual(sf.rackDownDash);
    expect(F.STROKE_CHIP).toBe(sf.chip);
    expect(F.STROKE_CRAC_IDLE).toBe(sf.cracIdle);
    expect(F.STROKE_CRAC_BOOSTED).toBe(sf.cracBoosted);
    expect(F.STROKE_STREAM_IDLE).toBe(sf.streamIdle);
    expect(F.STROKE_STREAM_BOOSTED).toBe(sf.streamBoosted);
    expect(F.STREAM_DASH_IDLE).toEqual(sf.streamDashIdle);
    expect(F.STREAM_DASH_BOOSTED).toEqual(sf.streamDashBoosted);
    expect(F.STREAM_DASH_SPEED_IDLE).toBe(sf.streamDashSpeedIdle);
    expect(F.STREAM_DASH_SPEED_BOOSTED).toBe(sf.streamDashSpeedBoosted);
    expect(F.STREAM_BASE_ALPHA).toBe(sf.streamBaseAlpha);
    expect(F.STREAM_DASH_WIDTH_IDLE).toBe(sf.streamDashWidthIdle);
    expect(F.STREAM_DASH_WIDTH_BOOSTED).toBe(sf.streamDashWidthBoosted);
  });

  it('timing', () => {
    expect(F.FIELD_FRAME_THROTTLE_MS).toBe(timing.fieldFrameThrottleMs);
    expect(F.FIELD_STEPS_PER_FRAME).toBe(timing.fieldStepsPerFrame);
    expect(F.FIELD_RESET_STEPS).toBe(timing.fieldResetSteps);
    expect(F.REDUCED_MOTION_STEPS_PER_READING).toBe(timing.reducedMotionStepsPerReading);
  });
});
