import { useLayoutEffect, useRef } from 'react';
import type { Projection } from '../compose/projection';
import type { RackView } from '../compose/rackView';
import { clamp } from '../sim/format';
import type { ShownState } from '../sim/types';
import { Glyph } from './Glyphs';
import { restartClass } from './restartClass';
import { STATE_WORD } from './stateWord';

export interface ReadoutProps {
  rack: RackView;
  shown: ShownState;
  multiRack: boolean;
  /** 0..1, drives how far the solid ("if fixed") projection path has drawn in. */
  holdProgress: number;
  projection: Projection | null;
  /**
   * Increments each time focus moves to a different rack; the readout
   * replays motion.readoutSwap so the operator sees the numbers now belong to
   * another rack (contract/components.md §4). 0/omitted = never swapped.
   */
  swapToken?: number;
}

function DigitStrip({ digit }: { digit: number }) {
  return (
    <span className="dg">
      <span className="strip" style={{ transform: `translateY(${-digit}em)` }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </span>
    </span>
  );
}

function Numeral({ tempC }: { tempC: number }) {
  const s = clamp(tempC, 10, 99.9).toFixed(1); // "24.2" -> tens, ones, '.', tenths
  return (
    <div className="num" aria-hidden="true">
      <DigitStrip digit={Number(s[0])} />
      <DigitStrip digit={Number(s[1])} />
      <span className="pt">.</span>
      <DigitStrip digit={Number(s[3])} />
      <span className="unit">°C</span>
    </div>
  );
}

const W = 300;
const H = 44;
const LO = 22;
const HI = 37;
const STEPS = 12;
const y = (t: number) => H - clamp((t - LO) / (HI - LO), 0, 1) * H;
const pathFrom = (pts: [number, number][]) => pts.map(([x, t], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y(t).toFixed(1)}`).join('');

export function Readout({ rack, shown, multiRack, holdProgress, projection, swapToken = 0 }: ReadoutProps) {
  const sectionRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (swapToken > 0 && sectionRef.current) restartClass(sectionRef.current, 'swap');
  }, [swapToken]);

  const proj = projection !== null;
  const HX = proj ? 205 : W;
  const history = rack.history;
  const dx = HX / 47;
  const x0 = HX - (history.length - 1) * dx;
  const historyPts: [number, number][] = history.map((t, i) => [x0 + i * dx, t]);
  const perMin = rack.ratePerMin;
  const rateText = Math.abs(perMin) < 0.05 ? 'Steady' : `${perMin > 0 ? '▲' : '▼'} ${Math.abs(perMin).toFixed(1)}°C/min`;

  let projPaths: { none: string; ghost: string; solid: string; caption: string } | null = null;
  if (projection) {
    const withX = (arr: number[]): [number, number][] => arr.map((t, k) => [HX + (k * (W - HX)) / STEPS, t]);
    const nonePts = withX(projection.none);
    const fixedPts = withX(projection.fixed);
    const solidPts = fixedPts.slice(0, 1 + Math.round(holdProgress * STEPS));
    projPaths = {
      none: pathFrom(nonePts),
      ghost: pathFrom(fixedPts),
      solid: solidPts.length > 1 ? pathFrom(solidPts) : '',
      caption: `In 3 min: ${projection.none[STEPS].toFixed(1)}°C if nothing changes, ${projection.fixed[STEPS].toFixed(1)}°C ${projection.verb}`,
    };
  }

  return (
    // font-size at multi-rack is set by CSS off the ancestor .app[data-multi]; this
    // attribute exists so the region is independently inspectable/testable.
    <section ref={sectionRef} className="readout" data-multi-rack={multiRack ? '1' : '0'}>
      <div className="state">
        <Glyph className="glyph" kind={shown} />
        <span>{STATE_WORD[shown]}</span>
        <span className="hyst" aria-hidden="true" data-on={rack.stable > 0 ? '1' : '0'} style={{ opacity: rack.stable > 0 ? 1 : undefined }}>
          <span>Steady</span>
          {[0, 1, 2].map((i) => (
            <i key={i} className={`tick${i < rack.stable ? ' f' : ''}`} />
          ))}
        </span>
      </div>

      <Numeral tempC={rack.tempC} />

      <div className="meta">
        <span>Rack {rack.id} inlet</span>
        <span className="rate">{rateText}</span>
      </div>

      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line className="lim" x1="0" x2={W} y1={y(27)} y2={y(27)} />
        <line className="lim" x1="0" x2={W} y1={y(32)} y2={y(32)} />
        {proj && <line className="now" x1={HX} x2={HX} y1="0" y2={H} />}
        {projPaths && <path className="pno" d={projPaths.none} />}
        {projPaths && <path className="pbg" d={projPaths.ghost} />}
        {projPaths && <path className="pb" d={projPaths.solid} />}
        <path className="ln" d={pathFrom(historyPts)} />
        <circle className="hd" cx={HX} cy={y(history[history.length - 1])} r={3} />
      </svg>

      {projPaths && <p className="proj">{projPaths.caption}</p>}
    </section>
  );
}
