import type { AlertState, RackId } from '../sim/types';
import { buildLut } from './colorLut';
import { drawField } from './draw';
import type { ModeledRackInput, FieldSimState } from './diffusion';
import { norm, step } from './diffusion';
import { buildGeometry, type Geometry } from './geometry';
import { createStreamlineTracer } from './streamlines';
import { DEVICE_PIXEL_RATIO_CAP, FIELD_FRAME_THROTTLE_MS, FIELD_RESET_STEPS, GH, GW, MODELED_RACK_IDS, REDUCED_MOTION_STEPS_PER_READING } from './tokens';

export interface FieldRackInput {
  T: number;
  down: boolean;
  /** Raw sim slope (°C/reading), not ratePerMin. */
  slope: number;
  state: AlertState;
  /** RackView.flare — the sim's raw one-shot trigger. The engine detects 0->nonzero edges to (re)kick its own decaying pulse (see docs on `flare` below). */
  flareFlag: number;
}

export interface FieldInputs {
  racks: Record<RackId, FieldRackInput>;
  focus: RackId;
  boosted: boolean;
  aim: RackId;
  reducedMotion: boolean;
  /**
   * Sim reading count. Under reduced motion the field advances
   * REDUCED_MOTION_STEPS_PER_READING steps once per *reading*
   * (contract/a11y-spec.md §3) — not once per setInputs call, which also
   * fires on focus changes, actions and the like. Omitted by static callers
   * (/states), which never tick.
   */
  reading?: number;
}

export interface FieldEngine {
  /** Call whenever the inputs change (a new reading, a focus/aim change, ...). */
  setInputs(next: FieldInputs): void;
  destroy(): void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Owns everything reference/prototype.html's thermal field does: the
 * diffusion grid, plumes, CRAC-3 streamlines, and the canvas draw loop.
 * Imperative and isolated (docs/BUILD_BRIEF.md) — the React component
 * (src/ui/ThermalField.tsx) only creates one, feeds it inputs, and tears
 * it down; no React state lives in here.
 */
export function createFieldEngine(canvas: HTMLCanvasElement, initialInputs: FieldInputs): FieldEngine {
  const geometry: Geometry = buildGeometry();
  const lut = buildLut();
  const streamlinesFn = createStreamlineTracer(geometry);

  const N = GW * GH;
  const sim: FieldSimState = {
    U: new Float32Array(N).fill(norm(19)),
    V: new Float32Array(N),
    flare: { 'B-07': 0, 'A-03': 0 },
  };
  /** Last seen raw sim flare flag per rack, to detect the 0->nonzero rising edge that (re)triggers `sim.flare`'s decay pulse. */
  const prevFlareFlag: Record<RackId, number> = { 'B-07': 0, 'A-03': 0 };

  let inputs = initialInputs;
  let hasSettled = false;

  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) throw new Error('ThermalField: 2D canvas context unavailable');
  // Re-bound with an explicit non-null type: TS doesn't carry the narrowing
  // above into the closures below (draw/frame), which could in principle
  // run at any later time.
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = GW;
  offscreenCanvas.height = GH;
  const offCtxOrNull = offscreenCanvas.getContext('2d');
  if (!offCtxOrNull) throw new Error('ThermalField: offscreen 2D canvas context unavailable');
  const offCtx: CanvasRenderingContext2D = offCtxOrNull;
  const heatImage = offCtx.createImageData(GW, GH);

  let cw = 0;
  let ch = 0;

  function toModeled(): Record<RackId, ModeledRackInput> {
    const out = {} as Record<RackId, ModeledRackInput>;
    for (const id of MODELED_RACK_IDS) {
      const r = inputs.racks[id];
      out[id] = { id, T: r.T, down: r.down, slope: r.slope, state: r.state };
    }
    return out;
  }

  function updateFlareTriggers() {
    for (const id of MODELED_RACK_IDS) {
      const r = inputs.racks[id];
      if (r.down) sim.flare[id] = 0;
      else if (prevFlareFlag[id] === 0 && r.flareFlag > 0) sim.flare[id] = 1;
      prevFlareFlag[id] = r.flareFlag;
    }
  }

  const stepOnce = () => step(sim, geometry, toModeled(), inputs.boosted);

  function paintHeatImage() {
    for (let i = 0; i < N; i++) {
      const j = clamp((sim.U[i] * 255) | 0, 0, 255) * 3;
      heatImage.data[i * 4] = lut[j];
      heatImage.data[i * 4 + 1] = lut[j + 1];
      heatImage.data[i * 4 + 2] = lut[j + 2];
      heatImage.data[i * 4 + 3] = 255;
    }
  }

  function draw() {
    if (!cw || !ch) return;
    paintHeatImage();
    drawField({
      ctx,
      cw,
      ch,
      heatImage,
      offscreen: offCtx,
      geometry,
      modeled: toModeled(),
      focus: inputs.focus,
      boosted: inputs.boosted,
      aim: inputs.aim,
      streamlines: streamlinesFn,
      reducedMotion: inputs.reducedMotion,
    });
  }

  const resizeObserver = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(DEVICE_PIXEL_RATIO_CAP, window.devicePixelRatio || 1);
    cw = rect.width;
    ch = rect.height;
    canvas.width = Math.max(1, cw * dpr);
    canvas.height = Math.max(1, ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  });
  resizeObserver.observe(canvas);

  let rafId = 0;
  let lastFrameTs = 0;
  function frame(ts: number) {
    if (!inputs.reducedMotion && !document.hidden && ts - lastFrameTs > FIELD_FRAME_THROTTLE_MS) {
      stepOnce();
      stepOnce();
      draw();
      lastFrameTs = ts;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  function setInputs(next: FieldInputs) {
    const prevReading = inputs.reading;
    inputs = next;
    updateFlareTriggers();
    if (!hasSettled) {
      sim.U.fill(norm(19));
      for (let i = 0; i < FIELD_RESET_STEPS; i++) stepOnce();
      hasSettled = true;
      draw();
      return;
    }
    if (inputs.reducedMotion) {
      if (inputs.reading !== prevReading) {
        for (let i = 0; i < REDUCED_MOTION_STEPS_PER_READING; i++) stepOnce();
      }
      draw();
    }
    // else: the continuous rAF loop above picks up the new inputs on its next tick.
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
  }

  return { setInputs, destroy };
}
