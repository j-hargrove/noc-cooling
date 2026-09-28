import type { ShownState } from '../sim/types';

export type GlyphKind = ShownState | 'resolved';

/** currentColor carries the state color; the inner "cutout" marks are fixed per glyph (see below). */
export function Glyph({ kind, className }: { kind: GlyphKind; className?: string }) {
  switch (kind) {
    case 'calm':
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'recovering':
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M6.5 8.5 10 12l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rising':
      // the cutout is always the app ground — it reads as punched through the state-colored shape
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2.5 18.5 17.5H1.5Z" fill="currentColor" />
          <path d="M10 7.5v5" stroke="var(--color-app-ground)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="15" r="1.1" fill="var(--color-app-ground)" />
        </svg>
      );
    case 'critical':
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6.3 1.5h7.4l4.8 4.8v7.4l-4.8 4.8H6.3L1.5 13.7V6.3Z" fill="currentColor" />
          <path d="M5.5 10h9" stroke="var(--color-app-ground)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'offline':
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 4.8a7 7 0 1 0 8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 2v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'resolved':
      // cutout matches the outcome sheet's own ground, not the app ground
      return (
        <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" fill="currentColor" />
          <path d="m6 10.2 2.7 2.7L14 7.5" fill="none" stroke="var(--color-surface-outcome)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
