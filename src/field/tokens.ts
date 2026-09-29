/**
 * Canvas drawing needs real values (colors, numbers), not CSS var()
 * references — duplicated here from contract/tokens.json for the same
 * reason as src/sim/constants.ts: src/ is the TS build root, contract/
 * sits outside it. src/field/tokens.test.ts cross-checks every value here
 * against contract/tokens.json so the two can't silently drift.
 */
import type { AlertState, RackId } from '../sim/types';

// ---- color.field ----
export const FIELD_BACKGROUND = '#10263A';
export const LUT_STOPS: [number, string][] = [
  [0, '#132C3E'],
  [0.3, '#1C4A62'],
  [0.5, '#3A5566'],
  [0.64, '#6B2E2A'],
  [0.78, '#C94A26'],
  [0.9, '#E88A45'],
  [1, '#F6DDC0'],
];
export const RACK_FILL = 'rgba(30,52,68,.92)';
export const RACK_STROKE_CALM = 'rgba(227,236,241,.3)';
export const RACK_LABEL_CALM = 'rgba(227,236,241,.72)';
export const RACK_DOWN_FILL = 'rgba(2,5,8,.97)';
export const RACK_DOWN_STROKE = '#8FA4B2';
export const CHIP_BG = 'rgba(10,24,34,.9)';
export const CHIP_STROKE_CALM = 'rgba(227,236,241,.2)';
export const CHIP_INK = '#E3ECF1';
export const CRAC_FILL = 'rgba(30,52,68,.94)';
export const CRAC_STROKE_IDLE = 'rgba(227,236,241,.34)';
export const CRAC_STROKE_BOOSTED = '#74CFEA';
export const CRAC_INK_IDLE = 'rgba(227,236,241,.8)';
export const CRAC_INK_BOOSTED = '#74CFEA';
export const streamNear = (alpha: number) => `rgba(150,222,245,${alpha})`;
export const streamMid = (alpha: number) => `rgba(116,207,234,${alpha})`;
export const STREAM_FAR = 'rgba(116,207,234,0)';
export const STREAM_ALPHA_IDLE = 0.22;
export const STREAM_ALPHA_BOOSTED = 0.75;
export const STREAM_MID_ALPHA_FACTOR = 0.45;

// ---- color.state (the four alert colors; offline reuses steel) ----
export const STATE_COLOR: Record<AlertState, string> = {
  calm: '#74CFEA',
  recovering: '#9ED9C4',
  rising: '#FFB547',
  critical: '#C96764',
};

// ---- field (geometry, grid units) ----
export const GW = 28;
export const GH = 48;
export const RACK_GEOM = { xLeft: 1, xRight: 21, w: 6, yStart: 1.5, yStep: 5.1, h: 4.4 };
export const CRAC = { x: 8, w: 12, y: 43.6, h: 3.4, minPixelHeight: 16 };
export const AISLE_L = 7.3;
export const AISLE_R = 20.7;
export const AISLE_C = 14;
export const DIFFUSION = 0.23;
export const SUPPLY_BLEED = 0.0035;
export const STREAMLINES_IDLE = 8;
export const STREAMLINES_BOOSTED = 16;
export const STREAMLINE_TRACE_STEPS = 400;
export const STREAMLINE_SEED_SPREAD = 3.2;
export const STREAMLINE_SEED_EXPONENT = 1.6;
export const DEVICE_PIXEL_RATIO_CAP = 2;

// ---- stroke.field ----
export const STROKE_RACK_CALM = 1;
export const STROKE_RACK_ALERT = 1;
export const STROKE_RACK_FOCUSED = 1.5;
export const STROKE_RACK_DOWN = 1;
export const STROKE_RACK_DOWN_DASH: [number, number] = [3, 3];
export const STROKE_CHIP = 1;
export const STROKE_CRAC_IDLE = 1;
export const STROKE_CRAC_BOOSTED = 1;
export const STROKE_STREAM_IDLE = 0.8;
export const STROKE_STREAM_BOOSTED = 1;
export const STREAM_DASH_IDLE: [number, number] = [14, 40];
export const STREAM_DASH_BOOSTED: [number, number] = [26, 30];
export const STREAM_DASH_SPEED_IDLE = 28;
export const STREAM_DASH_SPEED_BOOSTED = 90;
export const STREAM_BASE_ALPHA = 0.35;
export const STREAM_DASH_WIDTH_IDLE = 1.1;
export const STREAM_DASH_WIDTH_BOOSTED = 1.6;

// ---- timing ----
export const FIELD_FRAME_THROTTLE_MS = 33;
export const FIELD_STEPS_PER_FRAME = 2;
export const FIELD_RESET_STEPS = 400;
export const REDUCED_MOTION_STEPS_PER_READING = 40;

/** The two racks the sim actually models; every other grid cell is ambient. */
export const MODELED_RACK_IDS: RackId[] = ['B-07', 'A-03'];
