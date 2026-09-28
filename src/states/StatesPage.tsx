import { useState } from 'react';
import { presentInstrument, type InstrumentHandlers } from '../compose/present';
import { Instrument } from '../ui/Instrument';
import { buildFixtures, type Fixture } from './fixtures';
import './StatesPage.css';

const noop = () => {};
const INERT_HANDLERS: InstrumentHandlers = {
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

function FixtureCard({ fixture }: { fixture: Fixture }) {
  const [holdProgress, setHoldProgress] = useState(0);
  const props = presentInstrument(
    fixture.state,
    { ...INERT_HANDLERS, onHoldProgressChange: setHoldProgress },
    holdProgress,
  );
  return (
    <div className="states-card" data-fixture={fixture.id}>
      <h2>{fixture.label}</h2>
      <p>{fixture.description}</p>
      <div className="device">
        <Instrument {...props} />
      </div>
    </div>
  );
}

/**
 * The verification page (docs/BUILD_BRIEF.md step 3): every state and
 * outcome, composed from hand-built SimState snapshots — no live loop, no
 * timers. Each card's hold button is still genuinely interactive (it's
 * local component state), it just doesn't advance any incident.
 */
export function StatesPage() {
  const fixtures = buildFixtures();
  return (
    <div className="states-page">
      <h1>NOC cooling alert — states</h1>
      <p>
        Every locked state and outcome (docs/decisions.md), composed from static SimState snapshots via composeScreen()
        — nothing here is animated or ticking.
      </p>
      <div className="states-grid">
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </div>
  );
}
