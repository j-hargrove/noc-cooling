// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeProjection, focusedView } from '../compose';
import { createInitialState } from '../sim/engine';
import type { SimState } from '../sim/types';
import { Readout } from './Readout';

function critical(): SimState {
  const s = createInitialState(1);
  return { ...s, racks: { ...s.racks, 'B-07': { ...s.racks['B-07'], state: 'critical', T: 33.2, slope: 0.1 } } };
}

describe('Readout projection caption', () => {
  it('colours the two outcomes like the prototype: "if nothing changes" in .a, the fix in .b', () => {
    const s = critical();
    const { container } = render(<Readout rack={focusedView(s)} shown="critical" multiRack={false} holdProgress={0} projection={computeProjection(s, 'B-07')} />);
    const proj = container.querySelector('.proj')!;
    expect(proj.textContent).toMatch(/^In 3 min: \d+\.\d°C if nothing changes, \d+\.\d°C with boost$/);
    expect(proj.querySelector('.a')!.textContent).toMatch(/°C if nothing changes$/);
    expect(proj.querySelector('.b')!.textContent).toMatch(/°C with boost$/);
  });
});
