import { describe, expect, it } from 'vitest';
import { buildGeometry, rackCenterFraction } from './geometry';
import { GH, GW } from './tokens';

describe('rackCenterFraction', () => {
  it('agrees with buildGeometry for every rack', () => {
    for (const r of buildGeometry().racks) {
      const { fx, fy } = rackCenterFraction(r.id);
      expect(fx).toBeCloseTo((r.x + r.w / 2) / GW, 10);
      expect(fy).toBeCloseTo((r.y + r.h / 2) / GH, 10);
    }
  });
});
