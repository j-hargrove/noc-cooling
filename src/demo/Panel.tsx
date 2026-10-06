import type { LogEntry } from '../sim/types';

export interface PanelProps {
  heatLoad: number;
  heatLocked: boolean;
  running: boolean;
  secondArmed: boolean;
  fromLock: boolean;
  autoSecond: boolean;
  log: LogEntry[];
  onHeatLoad: (v: number) => void;
  onRun: () => void;
  onFailSecond: () => void;
  onReset: () => void;
  onToggleFromLock: (v: boolean) => void;
  onToggleAutoSecond: (v: boolean) => void;
  /**
   * 'controls' (embed mode) drops the page chrome — back link, heading,
   * framing paragraph and "Try it" steps, which the host page supplies —
   * and keeps the controls and the action log.
   */
  variant?: 'full' | 'controls';
}

/**
 * The demo panel (contract/components.md §9): framing copy, the "Try it"
 * steps, the controls, and the action log. Copy is the prototype's,
 * verbatim. There is deliberately no motion control here — reduced motion
 * follows the OS setting only (docs/decisions.md).
 */
export function Panel({
  heatLoad,
  heatLocked,
  running,
  secondArmed,
  fromLock,
  autoSecond,
  log,
  onHeatLoad,
  onRun,
  onFailSecond,
  onReset,
  onToggleFromLock,
  onToggleAutoSecond,
  variant = 'full',
}: PanelProps) {
  const chrome = variant === 'full';
  return (
    <aside className="panel" id="panel" aria-label={chrome ? undefined : 'Demo controls'}>
      {chrome && (
        <>
          <a className="to-app" href="#app">
            Back to the app
          </a>
          <h1>Cooling alert, critical state</h1>
          <p>
            A working prototype, not a mockup. The sensor feed is simulated and time runs ten times fast. The state logic, hysteresis,
            action log and screen reader announcements are real.
          </p>
          <ol className="steps">
            <li>Run the incident, then tap the alert on the lock screen.</li>
            <li>Hold the button to cool the rack, and watch the air follow.</li>
            <li>Or do nothing, and watch it fail.</li>
            <li>Stay for the second rack.</li>
          </ol>
        </>
      )}
      <div className="ctrl">
        <label htmlFor="heatIn">
          Rack B-07 heat load <output htmlFor="heatIn">{heatLoad}%</output>
        </label>
        <input type="range" id="heatIn" min={0} max={100} value={heatLoad} disabled={heatLocked} onChange={(e) => onHeatLoad(Number(e.currentTarget.value))} />
      </div>
      <div className="btns">
        <button type="button" className="btn primary" disabled={running} onClick={onRun}>
          {running ? 'Incident running' : 'Run the incident'}
        </button>
        <button type="button" className="btn" disabled={!secondArmed} onClick={onFailSecond}>
          Fail a second rack
        </button>
        <button type="button" className="btn" onClick={onReset}>
          Reset
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={fromLock} onChange={(e) => onToggleFromLock(e.currentTarget.checked)} /> Start from the lock screen
      </label>
      <label className="check check-second">
        <input type="checkbox" checked={autoSecond} onChange={(e) => onToggleAutoSecond(e.currentTarget.checked)} /> Second rack fails after the
        first incident ends
      </label>
      <h2>Action log</h2>
      <ol className="log">
        {log.length === 0 ? (
          <li>
            <span />
            <span className="sys">Nothing logged yet.</span>
          </li>
        ) : (
          log.map((e, i) => (
            // Newest first and append-only: index-from-the-end is a stable identity.
            <li key={log.length - i} className={e.kind}>
              <time>{e.t}</time>
              <span>{e.text}</span>
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
