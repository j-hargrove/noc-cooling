import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RackView } from '../compose/rackView';
import { createFieldEngine, type FieldEngine, type FieldInputs } from '../field';
import type { RackId } from '../sim/types';
import { restartClass } from './restartClass';
import { EVENT_VISIBLE_MS } from './timing';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** A transient line at the top of the map. `key` changes each time one fires, so a repeat replays. */
export interface EventPillCue {
  text: string;
  cool: boolean;
  key: number;
}

/**
 * Unchanged since the SVG stand-in (docs/BUILD_BRIEF.md step 5: "keep the
 * same props contract so callers don't change"). Instrument and /states
 * don't know or care that the field is now a real canvas engine underneath.
 * `reading` and `event` are optional additions for the live app (step 6);
 * /states passes neither.
 */
export interface ThermalFieldProps {
  racks: Record<RackId, RackView>;
  focus: RackId;
  boosted: boolean;
  aim: RackId | null;
  /** Sim reading count — paces the reduced-motion field (see FieldInputs.reading). */
  reading?: number;
  event?: EventPillCue | null;
  /** Render one settled frame and never animate — for a static picture of the app (the narrow-embed preview). */
  still?: boolean;
}

const MODELED: readonly RackId[] = ['B-07', 'A-03'];

function toFieldInputs(
  rackViews: Record<RackId, RackView>,
  focus: RackId,
  boosted: boolean,
  aim: RackId | null,
  reducedMotion: boolean,
  reading: number | undefined,
): FieldInputs {
  const racks = {} as FieldInputs['racks'];
  for (const id of MODELED) {
    const r = rackViews[id];
    racks[id] = { T: r.tempC, down: r.down, slope: r.slope, state: r.state, flareFlag: r.flare };
  }
  return { racks, focus, boosted, aim: aim ?? 'B-07', reducedMotion, reading };
}

/**
 * The event pill ("Heat load spiking at rack B-07", "CRAC-3 back to 60%").
 * `on` and `cool` are toggled imperatively, never through className: the
 * slide-in is a CSS transition that needs the element painted without `on`
 * first, and a React re-render must not strip a class mid-flight.
 */
function EventPill({ cue }: { cue: EventPillCue | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !cue) return;
    el.classList.toggle('cool', cue.cool);
    restartClass(el, 'on');
    const t = setTimeout(() => el.classList.remove('on'), EVENT_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [cue]);
  return (
    <div ref={ref} className="event" aria-hidden="true">
      {cue?.text}
    </div>
  );
}

export function ThermalField({ racks, focus, boosted, aim, reading, event, still = false }: ThermalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FieldEngine | null>(null);
  // Still is reduced motion's field behaviour: no per-frame loop, no dash scroll.
  const reducedMotion = usePrefersReducedMotion() || still;

  // One engine per mount — imperative and isolated (docs/BUILD_BRIEF.md),
  // driven by the props below via setInputs, not recreated on every render.
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createFieldEngine(canvasRef.current, toFieldInputs(racks, focus, boosted, aim, reducedMotion, reading));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setInputs(toFieldInputs(racks, focus, boosted, aim, reducedMotion, reading));
  }, [racks, focus, boosted, aim, reducedMotion, reading]);

  const hottest = racks[focus];
  return (
    <section className="field" aria-label="Thermal map of cold aisle 4">
      <EventPill cue={event} />
      <canvas ref={canvasRef} role="img" aria-label={`Thermal map. Heat is concentrated at rack ${hottest.id}.`} />
    </section>
  );
}
