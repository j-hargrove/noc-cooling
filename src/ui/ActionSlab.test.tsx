// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionSlabCopy } from '../compose/actionCopy';
import { ActionSlab } from './ActionSlab';

const offered: ActionSlabCopy = {
  calm: false,
  calmMessage: '',
  why: 'Above the 32°C allowable limit.',
  status: null,
  statusDone: false,
  offerAction: true,
  holdLabel: 'Hold to boost CRAC-3',
  undoLabel: null,
  actedAt: '',
};
const withdrawn: ActionSlabCopy = { ...offered, offerAction: false, why: 'Rack B-07 shut down at 38°C to protect hardware.' };

describe('ActionSlab status line', () => {
  const acted = (statusDone: boolean, status: string): ActionSlabCopy => ({ ...withdrawn, status, statusDone, undoLabel: 'Undo', actedAt: '02:14:30' });

  it('a landed fix slides in (motion.statusFresh) with its check', () => {
    const { container } = render(<ActionSlab copy={acted(true, 'CRAC-3 spinning up, 34%. Logged at 02:14:30.')} onConfirm={() => {}} onOverride={() => {}} onUndo={() => {}} />);
    expect(container.querySelector('.status')!.className).toBe('status done fresh');
  });

  it('an override does not slide in — the prototype only flags a fix as fresh', () => {
    const { container } = render(<ActionSlab copy={acted(false, 'Manual control of B-07 by J. Hargrove since 02:14:30. Logged.')} onConfirm={() => {}} onOverride={() => {}} onUndo={() => {}} />);
    expect(container.querySelector('.status')!.className).toBe('status');
  });
});

describe('ActionSlab hold-to-confirm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    // jsdom has no pointer capture.
    HTMLElement.prototype.setPointerCapture = () => {};
  });
  afterEach(() => vi.useRealTimers());

  const holdButton = () => screen.getByText('Hold to boost CRAC-3', { selector: '.lbl' }).closest('button')!;

  it('confirms after a full 750ms hold', () => {
    const onConfirm = vi.fn();
    render(<ActionSlab copy={offered} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} />);
    fireEvent.pointerDown(holdButton(), { pointerId: 1 });
    act(() => void vi.advanceTimersByTime(900));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a hold in progress when the action is withdrawn (rack shut down) never confirms', () => {
    const onConfirm = vi.fn();
    const onBusy = vi.fn();
    const { rerender } = render(<ActionSlab copy={offered} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} onHoldBusyChange={onBusy} />);
    fireEvent.pointerDown(holdButton(), { pointerId: 1 });
    act(() => void vi.advanceTimersByTime(400));
    rerender(<ActionSlab copy={withdrawn} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} onHoldBusyChange={onBusy} />);
    act(() => void vi.advanceTimersByTime(2000));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it('a keyboard arming is dropped when the action is withdrawn', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<ActionSlab copy={offered} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} />);
    fireEvent.click(holdButton(), { detail: 0 });
    expect(screen.getByText('Press again to confirm')).toBeTruthy();
    rerender(<ActionSlab copy={withdrawn} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} />);
    rerender(<ActionSlab copy={offered} onConfirm={onConfirm} onOverride={() => {}} onUndo={() => {}} />);
    fireEvent.click(holdButton(), { detail: 0 }); // arms afresh, doesn't confirm
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
