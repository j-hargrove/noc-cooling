import { CRAC, GH, GW, RACK_GEOM } from './tokens';

export interface GridRack {
  side: 0 | 1;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
  /** Per-rack ambient jitter, seeded once at geometry build time (Math.random(), matching reference/prototype.html). */
  jit: number;
}

export interface Geometry {
  racks: GridRack[];
  rackIndex: Record<string, number>;
  /** Grid cell index -> rack index, or -1 if the cell isn't inside any rack. */
  rackOf: Int8Array;
  /** Grid cell index -> 1 if inside CRAC-3's footprint. */
  cracCell: Uint8Array;
}

/**
 * The 16-rack grid and CRAC-3 footprint. Built once per field instance —
 * the layout and each rack's ambient jitter never change after mount,
 * exactly matching reference/prototype.html's module-level setup.
 */
export function buildGeometry(): Geometry {
  const racks: GridRack[] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 8; i++) {
      racks.push({
        side: side as 0 | 1,
        row: i,
        x: side ? RACK_GEOM.xRight : RACK_GEOM.xLeft,
        w: RACK_GEOM.w,
        y: RACK_GEOM.yStart + i * RACK_GEOM.yStep,
        h: RACK_GEOM.h,
        id: `${side ? 'B' : 'A'}-0${i + 1}`,
        jit: Math.random() * 0.8,
      });
    }
  }
  const rackIndex: Record<string, number> = {};
  racks.forEach((r, k) => {
    rackIndex[r.id] = k;
  });

  const N = GW * GH;
  const rackOf = new Int8Array(N).fill(-1);
  racks.forEach((r, k) => {
    for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y++) {
      for (let x = r.x; x < r.x + r.w; x++) rackOf[y * GW + x] = k;
    }
  });

  const cracCell = new Uint8Array(N);
  for (let y = Math.floor(CRAC.y); y < GH; y++) {
    for (let x = CRAC.x; x < CRAC.x + CRAC.w; x++) cracCell[y * GW + x] = 1;
  }

  return { racks, rackIndex, rackOf, cracCell };
}
