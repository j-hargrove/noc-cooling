import type { RackView } from '../compose/rackView';
import type { RackId } from '../sim/types';

/**
 * A structural, static stand-in for the field's canvas: the 16-rack grid
 * and CRAC-3, positioned from contract/tokens.json → field (the same
 * grid-unit coordinate system the canvas will use), colored from the two
 * modeled racks' live state. No diffusion, plumes, or streamlines — that's
 * the canvas engine, docs/BUILD_BRIEF.md step 5. Swapping it in later
 * doesn't change this component's contract: same props, same aria-label.
 */
export interface ThermalFieldProps {
  racks: Record<RackId, RackView>;
  focus: RackId;
  boosted: boolean;
  /** Sticky airflow target — null before anything has been acted on. */
  aim: RackId | null;
}

const GW = 28;
const GH = 48;
const RACK = { xLeft: 1, xRight: 21, w: 6, yStart: 1.5, yStep: 5.1, h: 4.4 };
const CRAC = { x: 8, w: 12, y: 43.6, h: 3.4 };

interface GridRack {
  id: string;
  x: number;
  y: number;
  modeled: RackId | null;
}

const GRID_RACKS: GridRack[] = (() => {
  const out: GridRack[] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 8; i++) {
      const id = `${side ? 'B' : 'A'}-0${i + 1}`;
      out.push({ id, x: side ? RACK.xRight : RACK.xLeft, y: RACK.yStart + i * RACK.yStep, modeled: id === 'B-07' || id === 'A-03' ? (id as RackId) : null });
    }
  }
  return out;
})();

export function ThermalField({ racks, focus, boosted, aim }: ThermalFieldProps) {
  const hottest = racks[focus];
  return (
    <section className="field" aria-label="Thermal map of cold aisle 4">
      <canvas hidden aria-hidden="true" />
      <svg className="field-viewport" viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none" role="img" aria-label={`Thermal map. Heat is concentrated at rack ${hottest.id}.`}>
        {GRID_RACKS.map((r) => {
          const view = r.modeled ? racks[r.modeled] : null;
          const alert = view ? view.shown !== 'calm' && !view.down : false;
          const down = view?.down ?? false;
          const focused = r.modeled === focus && alert;
          const stateColor = view ? `var(--color-state-${view.shown})` : undefined;
          return (
            <g key={r.id}>
              <rect
                className="field-rack"
                data-alert={alert ? '1' : '0'}
                data-focused={focused ? '1' : '0'}
                data-down={down ? '1' : '0'}
                x={r.x}
                y={r.y}
                width={RACK.w}
                height={RACK.h}
                rx={0.8}
                vectorEffect="non-scaling-stroke"
                style={alert || down ? { stroke: down ? undefined : stateColor } : undefined}
              />
              <text className="field-rack-label" data-alert={alert ? '1' : '0'} data-down={down ? '1' : '0'} x={r.x + RACK.w / 2} y={r.y + RACK.h / 2} fontSize={0.78} textAnchor="middle" dominantBaseline="central" style={alert ? { fill: stateColor } : undefined}>
                {down ? `${r.id} off` : r.id}
              </text>
            </g>
          );
        })}
        <rect className="field-crac" data-boosted={boosted ? '1' : '0'} x={CRAC.x} y={CRAC.y} width={CRAC.w} height={CRAC.h} rx={0.9} vectorEffect="non-scaling-stroke" />
        <text className="field-crac-label" data-boosted={boosted ? '1' : '0'} x={CRAC.x + CRAC.w / 2} y={CRAC.y + CRAC.h / 2} fontSize={0.8} textAnchor="middle" dominantBaseline="central">
          {boosted ? 'CRAC-3 at 100%' : 'CRAC-3 at 60%'}
        </text>
        {boosted && aim && (
          <text x={GW / 2} y={CRAC.y - 1.5} fontSize={0.55} textAnchor="middle" fill="var(--color-field-crac-stroke-boosted)">
            → {aim}
          </text>
        )}
      </svg>
    </section>
  );
}
