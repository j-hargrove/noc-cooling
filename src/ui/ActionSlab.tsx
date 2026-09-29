import { useCallback, useEffect, useRef } from 'react';
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
  // Focus after acting (contract/a11y-spec.md §2): a keyboard/AT confirm, or
  // an override, puts the reversal one key away. The undo only appears once
  // the sim reports the rack acted on, so the move waits for that render.
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusUndoPending = useRef(false);
  useEffect(() => {
    if (focusUndoPending.current && copy.undoLabel !== null) {
      focusUndoPending.current = false;
      undoRef.current?.focus({ preventScroll: true });
    }
  }, [copy.undoLabel]);

  const handleConfirm = useCallback(
    (via: 'pointer' | 'keyboard') => {
      if (via === 'keyboard') focusUndoPending.current = true;
      onConfirm();
    },
    [onConfirm],
  );
  const handleOverride = useCallback(() => {
    focusUndoPending.current = true;
    onOverride();
  }, [onOverride]);

  const { label, progress, handlers } = useHoldToConfirm({
    baseLabel: copy.holdLabel,
    onConfirm: handleConfirm,
    onBusyChange: onHoldBusyChange,
    onProgressChange: onHoldProgressChange,
    offered: copy.offerAction,
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
          // The slide-in (motion.statusFresh) marks a fix landing — not an override,
          // matching the prototype, which only flags `fresh` in act().
          <p key={copy.actedAt} className={`status${copy.statusDone ? ' done fresh' : ''}`}>
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
          <button type="button" className="ghost" hidden={!copy.offerAction} onClick={handleOverride}>
            Override and handle manually
          </button>
          <button ref={undoRef} type="button" className="ghost" hidden={copy.undoLabel === null} onClick={onUndo}>
            {copy.undoLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
