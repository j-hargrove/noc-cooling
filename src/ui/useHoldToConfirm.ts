import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { HOLD_HINT_REVERT_MS, HOLD_MS, KEYBOARD_ARM_WINDOW_MS } from './timing';

export interface HoldToConfirmOptions {
  /** The button's resting label; restored once the gesture ends or the arm window expires. */
  baseLabel: string;
  onConfirm: () => void;
  /** Mirrors holdBusy up to the caller — suppresses the sim's scheduled focus handoff (contract/a11y-spec.md §2). */
  onBusyChange?: (busy: boolean) => void;
  /** 0..1, for a live consumer (e.g. the readout's projection path) to track alongside. */
  onProgressChange?: (progress: number) => void;
}

/**
 * Pointer hold-to-confirm (750ms fill) plus the keyboard/AT equivalent
 * (two activations, armed for 3s) — contract/a11y-spec.md §2. Both paths are
 * full equivalents: each requires two distinct deliberate acts, and neither
 * fires on a single stray press.
 */
export function useHoldToConfirm({ baseLabel, onConfirm, onBusyChange, onProgressChange }: HoldToConfirmOptions) {
  const [label, setLabel] = useState(baseLabel);
  const [progress, setProgress] = useState(0);
  const armedRef = useRef(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef(0);
  const progressRef = useRef(0);
  const idleRef = useRef(true); // not mid-gesture and no pending hint — safe to follow baseLabel changes

  useEffect(() => {
    if (idleRef.current) setLabel(baseLabel);
  }, [baseLabel]);

  const setBusy = useCallback((busy: boolean) => onBusyChange?.(busy), [onBusyChange]);
  const setProg = useCallback(
    (p: number) => {
      progressRef.current = p;
      setProgress(p);
      onProgressChange?.(p);
    },
    [onProgressChange],
  );

  const cancel = useCallback(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    const p = progressRef.current;
    setProg(0);
    setBusy(false);
    if (p > 0 && p < 1) {
      idleRef.current = false;
      setLabel('Hold for one second to confirm');
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => {
        idleRef.current = true;
        setLabel(baseLabel);
      }, HOLD_HINT_REVERT_MS);
    } else {
      idleRef.current = true;
      setLabel(baseLabel);
    }
  }, [baseLabel, setBusy, setProg]);

  // A ref, not the closure itself: requestAnimationFrame only reads this
  // once the callback actually runs (never during tick's own creation), but
  // routing the recursive call through a ref avoids a callback referencing
  // its own not-yet-initialized binding.
  const tickRef = useRef<() => void>(undefined);
  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
    setProg(p);
    if (p >= 1) {
      cancel();
      onConfirm();
      return;
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current?.());
  }, [cancel, onConfirm, setProg]);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      clearTimeout(hintTimerRef.current);
      idleRef.current = false;
      setBusy(true);
      setLabel('Keep holding');
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    },
    [setBusy, tick],
  );

  const onPointerUp = useCallback(() => cancel(), [cancel]);
  const onPointerCancel = useCallback(() => cancel(), [cancel]);
  const onContextMenu = useCallback((e: ReactMouseEvent) => e.preventDefault(), []);

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (e.detail !== 0) return; // a real pointer click always reports a nonzero detail
      if (armedRef.current) {
        clearTimeout(armTimerRef.current);
        armedRef.current = false;
        idleRef.current = true;
        setBusy(false);
        setLabel(baseLabel);
        onConfirm();
      } else {
        armedRef.current = true;
        idleRef.current = false;
        setBusy(true);
        setLabel('Press again to confirm');
        armTimerRef.current = setTimeout(() => {
          armedRef.current = false;
          idleRef.current = true;
          setBusy(false);
          setLabel(baseLabel);
        }, KEYBOARD_ARM_WINDOW_MS);
      }
    },
    [baseLabel, onConfirm, setBusy],
  );

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      clearTimeout(armTimerRef.current);
      clearTimeout(hintTimerRef.current);
    },
    [],
  );

  return {
    label,
    progress,
    handlers: { onPointerDown, onPointerUp, onPointerCancel, onContextMenu, onClick },
  };
}
