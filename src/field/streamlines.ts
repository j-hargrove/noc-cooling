import type { RackId } from '../sim/types';
import type { Geometry } from './geometry';
import { AISLE_C, AISLE_L, AISLE_R, CRAC, STREAMLINES_BOOSTED, STREAMLINES_IDLE, STREAMLINE_SEED_EXPONENT, STREAMLINE_SEED_SPREAD, STREAMLINE_TRACE_STEPS } from './tokens';

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

interface Particle {
  x: number;
  y: number;
  k: number;
  ph: number;
  w: number;
  ty: number;
}

/** One velocity sample: a focused jet up the aisle, steered into the aimed rack's intake while boosted. */
function flow(p: Particle, boost: boolean, aim: RackId, geometry: Geometry): [number, number] {
  const dir = p.x < AISLE_C ? -1 : 1;
  let vx = dir * p.k - (p.x - AISLE_C) * 0.004 + Math.sin(p.y * 0.28 + p.ph) * 0.02;
  let vy = -0.3;
  if (boost && p.w) {
    const h = geometry.racks[geometry.rackIndex[aim]];
    const ty = h.y + h.h / 2 + p.ty;
    const tx = h.side ? AISLE_R + 0.6 : AISLE_L - 0.6;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const steer = p.w * clamp(1.2 - d / 14, 0.35, 1);
    vx = vx * (1 - steer) + (dx / d) * 0.3 * steer;
    vy = vy * (1 - steer) + (dy / d) * 0.3 * steer;
  }
  return [vx, vy];
}

export type Streamline = [number, number][];

/**
 * Streamlines are traced once through the flow field and cached by
 * (boost, aim); moving dashes carry the air along them at draw time.
 * One tracer per field instance — geometry (and therefore rack positions)
 * is fixed per instance, so the cache lives alongside it.
 */
export function createStreamlineTracer(geometry: Geometry) {
  const cache = new Map<string, Streamline[]>();

  return function streamlines(boost: boolean, aim: RackId): Streamline[] {
    const key = `${boost}${aim}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const n = boost ? STREAMLINES_BOOSTED : STREAMLINES_IDLE;
    const out: Streamline[] = [];
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const spread = Math.sign(u) * Math.pow(Math.abs(u), STREAMLINE_SEED_EXPONENT); // cluster seeds at the center
      const p: Particle = {
        x: AISLE_C + spread * STREAMLINE_SEED_SPREAD,
        y: CRAC.y - 0.2,
        k: 0.001 + ((i * 7) % 5) * 0.0015,
        ph: i * 0.9,
        w: i % 4 === 0 ? 0 : 0.75 + ((i * 5) % 3) * 0.12,
        ty: (((i * 7) % 5) - 2) * 0.75,
      };
      const pts: Streamline = [[p.x, p.y]];
      for (let t = 0; t < STREAMLINE_TRACE_STEPS; t++) {
        const [vx, vy] = flow(p, boost, aim, geometry);
        p.x += vx;
        p.y += vy;
        pts.push([p.x, p.y]);
        if (p.x < AISLE_L || p.x > AISLE_R || p.y < 0.6) break;
      }
      out.push(pts);
    }
    cache.set(key, out);
    return out;
  };
}
