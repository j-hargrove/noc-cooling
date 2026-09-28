import type { ActionSlabCopy } from '../compose/actionCopy';
import { useHoldToConfirm } from './useHoldToConfirm';

export interface ActionSlabProps {
  copy: ActionSlabCopy;
  onConfirm: () => void;
  onOverride: () => void;
  onUndo: () => void;
  /** Suppresses the sim's scheduled focus handoff while a gesture is mid-flight (contract/a11y-spec.md §2). */
  onHoldBusyChange?: (busy: boolean) => void;
  /** So the readout's projection path can track the same gesture live. */
  onHoldProgressChange?: (progress: number) => void;
}

export function ActionSlab({ copy, onConfirm, onOverride, onUndo, onHoldBusyChange, onHoldProgressChange }: ActionSlabProps) {
  const { label, progress, handlers } = useHoldToConfirm({
    baseLabel: copy.holdLabel,
    onConfirm,
    onBusyChange: onHoldBusyChange,
    onProgressChange: onHoldProgressChange,
  });
  const { calm } = copy;

  return (
    <section className="action">
      <div className="slab">
        <p className="calm-msg" hidden={!calm}>
          {copy.calmMessage}
        </p>
        <p className="why" hidden={calm}>
          {copy.why}
        </p>
        {copy.status !== null && (
          <p key={copy.actedAt} className={`status${copy.statusDone ? ' done' : ''} fresh`}>
            {copy.status}
          </p>
        )}
        <button type="button" className="hold" hidden={!copy.offerAction} aria-describedby="holdHint" {...handlers}>
          <span className="fill" style={{ ['--p' as string]: progress }} />
          <span className="lbl">{label}</span>
        </button>
        <span className="sr-only" id="holdHint">
          Press and hold to confirm. With a keyboard or screen reader, activate twice.
        </span>
        <div className="row">
          <button type="button" className="ghost" hidden={!copy.offerAction} onClick={onOverride}>
            Override and handle manually
          </button>
          <button type="button" className="ghost" hidden={copy.undoLabel === null} onClick={onUndo}>
            {copy.undoLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
