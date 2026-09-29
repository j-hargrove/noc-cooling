import { useEffect, useRef } from 'react';
import type { RackView } from '../compose/rackView';
import { createFieldEngine, type FieldEngine, type FieldInputs } from '../field';
import type { RackId } from '../sim/types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Unchanged since the SVG stand-in (docs/BUILD_BRIEF.md step 5: "keep the
 * same props contract so callers don't change"). Instrument and /states
 * don't know or care that the field is now a real canvas engine underneath.
 */
export interface ThermalFieldProps {
  racks: Record<RackId, RackView>;
  focus: RackId;
  boosted: boolean;
  aim: RackId | null;
}

const MODELED: readonly RackId[] = ['B-07', 'A-03'];

function toFieldInputs(rackViews: Record<RackId, RackView>, focus: RackId, boosted: boolean, aim: RackId | null, reducedMotion: boolean): FieldInputs {
  const racks = {} as FieldInputs['racks'];
  for (const id of MODELED) {
    const r = rackViews[id];
    racks[id] = { T: r.tempC, down: r.down, slope: r.slope, state: r.state, flareFlag: r.flare };
  }
  return { racks, focus, boosted, aim: aim ?? 'B-07', reducedMotion };
}

export function ThermalField({ racks, focus, boosted, aim }: ThermalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FieldEngine | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // One engine per mount — imperative and isolated (docs/BUILD_BRIEF.md),
  // driven by the props below via setInputs, not recreated on every render.
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createFieldEngine(canvasRef.current, toFieldInputs(racks, focus, boosted, aim, reducedMotion));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setInputs(toFieldInputs(racks, focus, boosted, aim, reducedMotion));
  }, [racks, focus, boosted, aim, reducedMotion]);

  const hottest = racks[focus];
  return (
    <section className="field" aria-label="Thermal map of cold aisle 4">
      <canvas ref={canvasRef} role="img" aria-label={`Thermal map. Heat is concentrated at rack ${hottest.id}.`} />
    </section>
  );
}
