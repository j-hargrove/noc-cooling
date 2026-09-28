// Every consumer of Instrument needs these; co-located here rather than
// left as an easy-to-drop side-effect import at the app's entry point.
import './tokens.generated.css';
import './base.css';
import './app.css';

import type { ActionSlabCopy } from '../compose/actionCopy';
import type { LayoutSpec } from '../compose/composeScreen';
import type { OutcomeCopy } from '../compose/outcomeCopy';
import type { Projection } from '../compose/projection';
import type { RackView } from '../compose/rackView';
import type { RackId } from '../sim/types';
import { ActionSlab } from './ActionSlab';
import { Intro, type IntroProps } from './Intro';
import { LockScreen, type LockNotification } from './LockScreen';
import { OutcomeSheet } from './OutcomeSheet';
import { QueueCard } from './QueueCard';
import { Readout } from './Readout';
import { ThermalField } from './ThermalField';

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
}: InstrumentProps) {
  const { weights } = layout;
  return (
    <div className="app" data-state={layout.shown} data-multi={layout.multiRack ? '1' : '0'} data-outcome={layout.outcome ?? undefined} data-motion={reducedMotion ? 'reduced' : 'full'}>
      <header className="bar">
        <div>
          <span className="site">{site}</span>
          <span className="aisle">{aisle}</span>
        </div>
        <div className="feed">
          <span className="dot" />
          <span aria-label="Last reading">{clock}</span>
        </div>
      </header>

      <div className="body" style={{ gridTemplateRows: `${weights.field} ${weights.queue} ${weights.readout} ${weights.action}` }}>
        <ThermalField racks={fieldRacks} focus={focusedRack.id} boosted={boosted} aim={aim} />

        {/* Always present (even empty): the grid's row weights, not DOM presence, collapse this
            to 0fr when there's nothing queued — same as the prototype. Removing it here would
            shift readout/action up a row under CSS grid auto-placement. */}
        <section className="queue" aria-label="Other racks needing attention">
          {layout.regions.queue &&
            queue.map(({ rack, urgent }) => <QueueCard key={rack.id} rack={rack} urgent={urgent} onSelect={onSelectRack} />)}
        </section>

        <Readout rack={focusedRack} shown={layout.shown} multiRack={layout.multiRack} holdProgress={holdProgress} projection={projection} />

        <ActionSlab copy={actionCopy} onConfirm={onConfirm} onOverride={onOverride} onUndo={onUndo} onHoldBusyChange={onHoldBusyChange} onHoldProgressChange={onHoldProgressChange} />
      </div>

      {outcome && <OutcomeSheet copy={outcome} onPrimary={onOutcomePrimary} onAgain={onOutcomeAgain} />}

      {layout.overlay === 'intro' && <Intro kicker={intro.kicker} title={intro.title} body={intro.body} onStart={intro.onStart} onDismiss={intro.onDismiss} />}

      {layout.overlay === 'lock' && <LockScreen date={lockDate} time={lockTime} notification={lockNotification} onOpen={onOpenLock} />}

      <div className="sr-only" aria-live="polite" />
      <div className="sr-only" aria-live="assertive" />
    </div>
  );
}
