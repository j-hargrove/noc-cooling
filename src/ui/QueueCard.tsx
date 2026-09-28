import type { RackView } from '../compose/rackView';
import type { RackId } from '../sim/types';
import { Glyph } from './Glyphs';
import { STATE_WORD } from './stateWord';

export interface QueueCardProps {
  rack: RackView;
  urgent: boolean;
  onSelect: (id: RackId) => void;
}

/** Cause line, in priority order (contract/components.md §3). */
function causeText(rack: RackView): string {
  if (rack.down) return 'Offline, shut down at 38°C';
  if (rack.acted === 'manual') return 'Manual control, logged';
  if (rack.acted === 'fix') {
    if (rack.id === 'B-07') return 'CRAC-3 boosted, logged';
    return rack.fixProgress < 1 ? `Cooling, ${Math.round(rack.fixProgress * 100)}% load moved` : 'Cooled, logged';
  }
  return rack.id === 'B-07' ? 'Hot air recirculating, needs action' : 'Rack fan failure, needs action';
}

export function QueueCard({ rack, urgent, onSelect }: QueueCardProps) {
  const pm = rack.ratePerMin;
  const arrow = pm > 0.05 ? ' ▲' : pm < -0.05 ? ' ▼' : '';
  return (
    <button
      type="button"
      className="q"
      data-rack-state={rack.shown}
      style={{ ['--qc' as string]: `var(--color-state-${rack.shown})` }}
      onClick={() => onSelect(rack.id)}
      aria-label={`Switch to rack ${rack.id}, ${STATE_WORD[rack.shown]}, ${rack.tempC.toFixed(1)} degrees${urgent ? ', more urgent' : ''}`}
    >
      <Glyph className="glyph" kind={rack.shown} />
      <span className="qm">
        <span className="qh">
          <span className="qid">{rack.id}</span>
          <span className="qw">{STATE_WORD[rack.shown]}</span>
          <span className="qu" hidden={!urgent}>
            More urgent
          </span>
        </span>
        <span className="qc">{causeText(rack)}</span>
      </span>
      <span className="qt">
        {rack.tempC.toFixed(1)}°{arrow}
      </span>
    </button>
  );
}
