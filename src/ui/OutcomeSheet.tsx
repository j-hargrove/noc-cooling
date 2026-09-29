import type { OutcomeCopy } from '../compose/outcomeCopy';
import { Glyph } from './Glyphs';

export interface OutcomeSheetProps {
  copy: OutcomeCopy;
  onPrimary: () => void;
  onAgain: () => void;
  /** True for the brief window an aftershock reopens the incident over this sheet (contract/components.md §6). */
  leaving?: boolean;
  /** A full-screen overlay (lock, intro) is over the sheet: it must not be reachable (contract/a11y-spec.md §5). */
  covered?: boolean;
}

export function OutcomeSheet({ copy, onPrimary, onAgain, leaving = false, covered = false }: OutcomeSheetProps) {
  const classes = ['outcome', copy.kind === 'mixed' && 'mixed', copy.kind === 'fail' && 'fail', leaving && 'leaving'].filter(Boolean).join(' ');
  return (
    <div className={classes} role="dialog" aria-labelledby="oTitle" inert={covered}>
      <div className="o-head">
        <Glyph className="glyph" kind={copy.glyph} />
        <h2 id="oTitle">{copy.title}</h2>
      </div>
      <p>{copy.body}</p>
      <dl className="o-stats">
        {copy.stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="o-btns">
        <button type="button" className="o-primary" onClick={onPrimary} disabled={copy.primaryDisabled}>
          {copy.primaryLabel}
        </button>
        <button type="button" className="ghost" onClick={onAgain}>
          Run it again
        </button>
      </div>
    </div>
  );
}
