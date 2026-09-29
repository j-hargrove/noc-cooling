import type { AlertState, RackId } from '../sim/types';
import type { Geometry } from './geometry';
import { DIFFUSION, GH, GW, MODELED_RACK_IDS, SUPPLY_BLEED } from './tokens';

export interface ModeledRackInput {
  id: RackId;
  T: number;
  down: boolean;
  /** Raw sim slope (°C per reading), not ratePerMin. */
  slope: number;
  state: AlertState;
}

export interface FieldSimState {
  U: Float32Array;
  V: Float32Array;
  /** Per-rack decaying visual pulse, owned by the field (see engine.ts) — NOT the sim's own one-shot flare flag. */
  flare: Record<RackId, number>;
}

export const norm = (t: number) => clamp((t - 18) / 20, 0, 1);
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function rackTemp(k: number, geometry: Geometry, modeled: Record<RackId, ModeledRackInput>): number {
  const r = geometry.racks[k];
  const direct = (MODELED_RACK_IDS as string[]).includes(r.id) ? modeled[r.id as RackId] : undefined;
  if (direct) {
    if (direct.down) return 22;
    return r.id === 'A-03' ? 22 + (direct.T - 22) * 0.62 : direct.T;
  }
  let t = 22.5 + r.jit;
  for (const id of MODELED_RACK_IDS) {
    const m = modeled[id];
    const h = geometry.racks[geometry.rackIndex[id]];
    const d = Math.abs(r.row - h.row) + (r.side !== h.side ? 2 : 0);
    t = Math.max(t, 22.5 + (m.T - 22.5) * (0.5 / (1 + d * 0.9)) + r.jit);
  }
  return t;
}

/**
 * One diffusion + plume tick (reference/prototype.html's step()). Mutates
 * `state` in place: writes the next field into V, then swaps U/V. Flare's
 * decay lives here (frame-rate, not reading-rate) — see engine.ts for how
 * it gets (re)triggered from sim events.
 */
export function step(state: FieldSimState, geometry: Geometry, modeled: Record<RackId, ModeledRackInput>, boosted: boolean): void {
  const { U, V } = state;
  const { rackOf, cracCell } = geometry;
  const maxT = Math.max(...MODELED_RACK_IDS.map((id) => (modeled[id].down ? 22 : modeled[id].T)));
  const sup = norm((boosted ? 16.5 : 18.5) + Math.max(0, maxT - 26) * 0.9);
  const rt = geometry.racks.map((_, k) => norm(rackTemp(k, geometry, modeled)));
  const cr = norm(boosted ? 10 : 17.5);

  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (rackOf[i] >= 0) {
        V[i] = rt[rackOf[i]];
        continue;
      }
      if (cracCell[i]) {
        V[i] = cr;
        continue;
      }
      const u = U[i];
      const l = x > 0 ? U[i - 1] : u;
      const r = x < GW - 1 ? U[i + 1] : u;
      const t = y > 0 ? U[i - GW] : u;
      const b = y < GH - 1 ? U[i + GW] : u;
      const v = u + DIFFUSION * (l + r + t + b - 4 * u);
      V[i] = v + (sup - v) * SUPPLY_BLEED;
    }
  }

  // plume off each modeled rack: strength tracks temperature, spread rate tracks the trend
  for (const id of MODELED_RACK_IDS) {
    const m = modeled[id];
    state.flare[id] = (state.flare[id] || 0) * 0.996;
    if (m.down) continue;
    const gain = id === 'A-03' ? 0.5 : 1; // the fan-failure rack reads quieter than the main incident
    const src = gain * (clamp((m.T - 25.5) / 8, 0, 1) * 0.085 + state.flare[id] * 0.08) * (1 + Math.max(0, m.slope) * 5);
    if (src < 0.002) continue;
    const h = geometry.racks[geometry.rackIndex[id]];
    const dir = h.side ? -1 : 1;
    const fx = h.side ? h.x - 1 : h.x + h.w;
    const cap = id === 'A-03' ? norm(22 + (m.T - 22) * 0.8) : norm(m.T + 2.5); // plume never runs hotter than its source
    for (let y = Math.floor(h.y); y < Math.ceil(h.y + h.h); y++) {
      for (let c = 0; c < 3; c++) {
        const i = y * GW + fx + dir * c;
        V[i] = Math.max(V[i], Math.min(cap, V[i] + src * (1 - c * 0.3) * (0.7 + Math.random() * 0.6)));
      }
    }
  }

  state.U = V;
  state.V = U;
}
