import { useLayoutEffect, useRef } from 'react';
import type { LockNotification } from '../compose/present';

export type { LockNotification };

export interface LockScreenProps {
  date: string;
  time: string;
  notification: LockNotification | null;
  onOpen: () => void;
  /** True for the brief window the lock is animating away (contract/components.md §7). */
  opening?: boolean;
  /**
   * Changes every time the sim sends a new notification. The notification
   * "updates in place" but slides in again on each update
   * (motion.notifIn), as a real lock screen does. Omitted = render settled
   * (the /states snapshot).
   */
  notificationKey?: number;
}

export function LockScreen({ date, time, notification, onOpen, opening = false, notificationKey }: LockScreenProps) {
  const notifRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const el = notifRef.current;
    if (!el || notificationKey === undefined) return;
    // `in` is in the markup so a static render is settled; replaying means
    // stripping it, committing that, then adding it back a frame later.
    el.classList.remove('in');
    void el.offsetWidth;
    const raf = requestAnimationFrame(() => el.classList.add('in'));
    return () => {
      cancelAnimationFrame(raf);
      el.classList.add('in');
    };
  }, [notificationKey]);

  return (
    <div className={`lock${opening ? ' opening' : ''}`}>
      <div className="lock-date">{date}</div>
      <div className="lock-time">{time}</div>
      {notification && (
        <button ref={notifRef} type="button" className={`notif in${notification.critical ? ' crit' : ''}`} onClick={onOpen}>
          <span className="n-app">Cooling, Hall B</span>
          <span className="n-when">now</span>
          <strong>{notification.title}</strong>
          <span className="n-body">{notification.body}</span>
        </button>
      )}
      <p className="lock-hint">Tap the alert to open</p>
    </div>
  );
}
