import { presentInstrument, type InstrumentHandlers } from './compose/present';
import { createInitialState, dismissIntro } from './sim/engine';
import { Instrument } from './ui/Instrument';

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

/**
 * The product route. Static for now (docs/BUILD_BRIEF.md order of work):
 * the live loop, demo harness and interactivity are wired in step 6. This
 * proves the same Instrument used on /states renders standalone too.
 */
export function App() {
  const state = dismissIntro(createInitialState(1));
  const props = presentInstrument(state, INERT_HANDLERS);
  return (
    <main className="stage">
      <div className="device">
        <Instrument {...props} />
      </div>
    </main>
  );
}
