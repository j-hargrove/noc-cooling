import type { LockNotification } from '../compose/present';

export type { LockNotification };

export interface LockScreenProps {
  date: string;
  time: string;
  notification: LockNotification | null;
  onOpen: () => void;
  /** True for the brief window the lock is animating away (contract/components.md §7). */
  opening?: boolean;
}

export function LockScreen({ date, time, notification, onOpen, opening = false }: LockScreenProps) {
  return (
    <div className={`lock${opening ? ' opening' : ''}`}>
      <div className="lock-date">{date}</div>
      <div className="lock-time">{time}</div>
      {notification && (
        <button type="button" className={`notif in${notification.critical ? ' crit' : ''}`} onClick={onOpen}>
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
