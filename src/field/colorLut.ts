import { LUT_STOPS } from './tokens';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** A 256-entry RGB lookup table interpolated through LUT_STOPS — the heat-map ramp. */
export function buildLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < LUT_STOPS.length - 2 && t > LUT_STOPS[k + 1][0]) k++;
    const [a, ca] = LUT_STOPS[k];
    const [b, cb] = LUT_STOPS[k + 1];
    const f = (t - a) / (b - a);
    const A = hex(ca);
    const B = hex(cb);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = A[c] + (B[c] - A[c]) * f;
  }
  return lut;
}
