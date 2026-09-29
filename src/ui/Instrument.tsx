// Every consumer of Instrument needs these; co-located here rather than
// left as an easy-to-drop side-effect import at the app's entry point.
import './tokens.generated.css';
import './base.css';
import './app.css';

import { useLayoutEffect, useRef, useState } from 'react';
import type { ActionSlabCopy } from '../compose/actionCopy';
import type { LayoutSpec } from '../compose/composeScreen';
import type { OutcomeCopy } from '../compose/outcomeCopy';
import type { Projection } from '../compose/projection';
import type { RackView } from '../compose/rackView';
import { rackCenterFraction } from '../field';
import type { RackId } from '../sim/types';
import { ActionSlab } from './ActionSlab';
import { Intro, type IntroProps } from './Intro';
import { LockScreen, type LockNotification } from './LockScreen';
import { OutcomeSheet } from './OutcomeSheet';
import { QueueCard } from './QueueCard';
import { Readout } from './Readout';
import { restartClass } from './restartClass';
import { ThermalField, type EventPillCue } from './ThermalField';

/** Fires the two shock rings from a rack's centre. `key` changes per shock so a repeat replays. */
export interface ShockCue {
  rackId: RackId;
  key: number;
}

/** Asks the instrument to move keyboard focus. `key` changes per request. */
export interface FocusRequest {
  target: 'hold' | 'outcomePrimary';
  key: number;
}

export interface InstrumentProps {
  layout: LayoutSpec;
  site: string;
  aisle: string;
  clock: string;
  reducedMotion?: boolean;

  fieldRacks: Record<RackId, RackView>;
  boosted: boolean;
  aim: RackId | null;

  focusedRack: RackView;
  queue: { rack: RackView; urgent: boolean }[];
  onSelectRack: (id: RackId) => void;

  holdProgress?: number;
  projection: Projection | null;

  actionCopy: ActionSlabCopy;
  onConfirm: () => void;
  onOverride: () => void;
  onUndo: () => void;
  onHoldBusyChange?: (busy: boolean) => void;
  onHoldProgressChange?: (progress: number) => void;

  outcome: OutcomeCopy | null;
  onOutcomePrimary: () => void;
  onOutcomeAgain: () => void;

  lockDate: string;
  lockTime: string;
  lockNotification: LockNotification | null;
  onOpenLock: () => void;

  intro: Pick<IntroProps, 'kicker' | 'title' | 'body' | 'onStart' | 'onDismiss'>;

  // ---- Live choreography (step 6). All optional: /states renders settled snapshots and passes none. ----
  /** Sim reading count: the feed dot pulses once per reading, and the reduced-motion field steps on it. */
  beat?: number;
  /** Current text of the two live regions (contract/a11y-spec.md §1). The caller owns the clear-then-set timing. */
  announcements?: { polite: string; assertive: string };
  eventPill?: EventPillCue | null;
  shock?: ShockCue | null;
  /** Changes whenever the lock notification is (re)sent, replaying its slide-in. */
  lockNotificationKey?: number;
  /** The intro is fading out (motion.introOut) but still mounted over whatever comes next. */
  introLeaving?: boolean;
  /** The lock is scaling away (motion.lockOpen). */
  lockOpening?: boolean;
  /** The outcome sheet is dropping away because an aftershock reopened the incident (motion.outcomeOut). */
  outcomeLeaving?: boolean;
  focusRequest?: FocusRequest | null;
}

export function Instrument({
  layout,
  site,
  aisle,
  clock,
  reducedMotion = false,
  fieldRacks,
  boosted,
  aim,
  focusedRack,
  queue,
  onSelectRack,
  holdProgress = 0,
  projection,
  actionCopy,
  onConfirm,
  onOverride,
  onUndo,
  onHoldBusyChange,
  onHoldProgressChange,
  outcome,
  onOutcomePrimary,
  onOutcomeAgain,
  lockDate,
  lockTime,
  lockNotification,
  onOpenLock,
  intro,
  beat,
  announcements,
  eventPill,
  shock,
  lockNotificationKey,
  introLeaving = false,
  lockOpening = false,
  outcomeLeaving = false,
  focusRequest,
}: InstrumentProps) {
  const { weights } = layout;
  const appRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shockARef = useRef<HTMLDivElement>(null);
  const shockBRef = useRef<HTMLDivElement>(null);

  // Feed dot: one ring per reading (motion.feedDot). Not under reduced motion.
  const lastBeat = useRef(beat);
  useLayoutEffect(() => {
    if (beat === lastBeat.current) return;
    lastBeat.current = beat;
    const dot = dotRef.current;
    if (!dot) return;
    if (reducedMotion) dot.classList.remove('beat');
    else restartClass(dot, 'beat');
  }, [beat, reducedMotion]);

  // Reduced motion's substitute for the row restructure: the layout arrives
  // at its new shape instantly and the body crossfades (contract/a11y-spec.md §3).
  const lastShown = useRef(layout.shown);
  useLayoutEffect(() => {
    if (layout.shown === lastShown.current) return;
    lastShown.current = layout.shown;
    if (reducedMotion && bodyRef.current) restartClass(bodyRef.current, 'xfade');
  }, [layout.shown, reducedMotion]);

  // Readout swap: counted here, where both the old and new focus are known.
  // Derived during render (the "adjust state on prop change" pattern), so
  // the readout replays on the same commit the new rack's numbers arrive.
  const [focusSeen, setFocusSeen] = useState(focusedRack.id);
  const [swapToken, setSwapToken] = useState(0);
  if (focusSeen !== focusedRack.id) {
    setFocusSeen(focusedRack.id);
    setSwapToken((t) => t + 1);
  }

  // Shock rings, from the rack's centre as it sits in the (possibly tilted) field.
  useLayoutEffect(() => {
    const app = appRef.current;
    const field = app?.querySelector<HTMLElement>('.field');
    if (!shock || !app || !field) return;
    const a = app.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    const { fx, fy } = rackCenterFraction(shock.rackId);
    const x = f.left - a.left + fx * f.width;
    const y = f.top - a.top + fy * f.height;
    for (const el of [shockARef.current, shockBRef.current]) {
      if (!el) continue;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      restartClass(el, 'go');
    }
  }, [shock]);

  useLayoutEffect(() => {
    if (!focusRequest) return;
    const selector = focusRequest.target === 'hold' ? '.hold' : '.o-primary';
    const el = appRef.current?.querySelector<HTMLButtonElement>(selector);
    if (el && !el.hidden && !el.disabled) el.focus({ preventScroll: true });
  }, [focusRequest]);

  // Nothing behind a full-screen overlay is reachable (contract/a11y-spec.md §5).
  const covered = layout.overlay !== 'none';
  const showIntro = layout.overlay === 'intro' || introLeaving;

  return (
    <div
      ref={appRef}
      className="app"
      data-state={layout.shown}
      data-multi={layout.multiRack ? '1' : '0'}
      data-outcome={layout.outcome ?? undefined}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    >
      <header className="bar" inert={covered}>
        <div>
          <span className="site">{site}</span>
          <span className="aisle">{aisle}</span>
        </div>
        <div className="feed">
          <span ref={dotRef} className="dot" />
          <span aria-label="Last reading">{clock}</span>
        </div>
      </header>

      <div
        ref={bodyRef}
        className="body"
        inert={covered}
        style={{ gridTemplateRows: `${weights.field} ${weights.queue} ${weights.readout} ${weights.action}` }}
      >
        <ThermalField racks={fieldRacks} focus={focusedRack.id} boosted={boosted} aim={aim} reading={beat} event={eventPill} />

        {/* Always present (even empty): the grid's row weights, not DOM presence, collapse this
            to 0fr when there's nothing queued — same as the prototype. Removing it here would
            shift readout/action up a row under CSS grid auto-placement. */}
        <section className="queue" aria-label="Other racks needing attention">
          {layout.regions.queue &&
            queue.map(({ rack, urgent }) => <QueueCard key={rack.id} rack={rack} urgent={urgent} onSelect={onSelectRack} />)}
        </section>

        <Readout
          rack={focusedRack}
          shown={layout.shown}
          multiRack={layout.multiRack}
          holdProgress={holdProgress}
          projection={projection}
          swapToken={swapToken}
        />

        <ActionSlab copy={actionCopy} onConfirm={onConfirm} onOverride={onOverride} onUndo={onUndo} onHoldBusyChange={onHoldBusyChange} onHoldProgressChange={onHoldProgressChange} />
      </div>

      <div ref={shockARef} className="shock" aria-hidden="true" />
      <div ref={shockBRef} className="shock b" aria-hidden="true" />

      {outcome && <OutcomeSheet copy={outcome} onPrimary={onOutcomePrimary} onAgain={onOutcomeAgain} leaving={outcomeLeaving} covered={covered} />}

      {layout.overlay === 'lock' && (
        <LockScreen date={lockDate} time={lockTime} notification={lockNotification} onOpen={onOpenLock} opening={lockOpening} notificationKey={lockNotificationKey} />
      )}

      {showIntro && (
        <Intro kicker={intro.kicker} title={intro.title} body={intro.body} onStart={intro.onStart} onDismiss={intro.onDismiss} gone={layout.overlay !== 'intro'} />
      )}

      <div className="sr-only" aria-live="polite">
        {announcements?.polite}
      </div>
      <div className="sr-only" aria-live="assertive">
        {announcements?.assertive}
      </div>
    </div>
  );
}
