import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { presentInstrument, type InstrumentHandlers } from '../compose/present';
import { Instrument } from '../ui/Instrument';
import { DemoPage } from './DemoPage';
import { fullScreenUrl, NARROW_QUERY } from './embed';
import { buildPreviewState } from './previewState';
import { useMediaQuery } from './useMediaQuery';
import './embed.css';

const DEVICE_W = 390;
const DEVICE_H = 844;

const noop = () => {};
const INERT: InstrumentHandlers = {
  onSelectRack: noop,
  onConfirm: noop,
  onOverride: noop,
  onUndo: noop,
  onOutcomePrimary: noop,
  onOutcomeAgain: noop,
  onOpenLock: noop,
  onIntroStart: noop,
  onIntroDismiss: noop,
};

/**
 * Narrow embeds (below the mobile breakpoint): a phone and a panel can't
 * both fit, and a live app squeezed into a column would read as broken. So:
 * one still frame of the instrument at its most telling moment, scaled to
 * the frame, and a link out to the real thing full screen. No live loop runs.
 */
function EmbedPreview() {
  const props = useMemo(() => presentInstrument(buildPreviewState(), INERT), []);
  const hostRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const linkH = (linkRef.current?.offsetHeight ?? 0) + 16;
      const s = Math.min(1, host.clientWidth / DEVICE_W, (host.clientHeight - linkH) / DEVICE_H);
      setScale(Math.max(0.1, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const temp = props.focusedRack.tempC.toFixed(1);
  return (
    <main className="embed-preview" ref={hostRef}>
      <div
        className="embed-preview-frame"
        role="img"
        aria-label={`Preview of the cooling alert app: rack ${props.focusedRack.id} critical at ${temp}°C, with the recommended fix on offer.`}
        style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}
      >
        <div className="device" inert aria-hidden="true" style={{ transform: `scale(${scale})` }}>
          <Instrument {...props} still />
        </div>
      </div>
      <a ref={linkRef} className="embed-open" href={fullScreenUrl(window.location.href)} target="_blank" rel="noopener">
        Open full screen
      </a>
    </main>
  );
}

/**
 * `?embed=1` (contract/components.md §9): only the phone and the controls,
 * no page chrome, transparent background, sized for an iframe. Follows the
 * iframe's own width live — resizing the frame across the breakpoint swaps
 * between the live app and the static preview.
 */
export function EmbedPage() {
  const narrow = useMediaQuery(NARROW_QUERY);
  return narrow ? <EmbedPreview /> : <DemoPage embed />;
}
