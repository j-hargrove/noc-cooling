import { useEffect, useRef, useState } from 'react';
import { composeScreen, type LayoutSpec } from '../compose/composeScreen';
import { shownState } from '../sim/rack';
import { others } from '../sim/selectors';
import type { RackId, ShownState, SimState } from '../sim/types';

/**
 * Composer feed (embed mode only): each time the composed layout changes,
 * the embed tells its host page what the layout is now and why, so the
 * case-study page can narrate the restructuring alongside the live phone.
 */
export interface LayoutMessage {
  type: 'noc-layout';
  regions: LayoutSpec['regions'];
  weights: LayoutSpec['weights'];
  state: ShownState;
  reason: string;
}

const PRODUCTION_HOST = 'https://jonathanhargrove.com';

/**
 * Hosts allowed to receive the feed: the case-study site, and localhost on
 * any port for developing it. The value must be a bare origin (no path),
 * exactly as the browser reports it.
 */
export function isAllowedHostOrigin(origin: string): boolean {
  if (origin === PRODUCTION_HOST) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === 'localhost' && url.origin === origin;
  } catch {
    return false;
  }
}

/**
 * The parent frame's origin, if it may receive the feed; otherwise null (the
 * feed stays silent). postMessage needs one exact targetOrigin, so the
 * "localhost on any port" rule is applied here, to the origin the browser
 * reports for the parent, rather than by posting to '*'.
 * ancestorOrigins (Chromium, Safari) is authoritative; Firefox lacks it, so
 * fall back to the referrer's origin. Either way the browser itself refuses
 * delivery if the parent's actual origin doesn't match what we pass.
 */
export function hostOrigin(win: Pick<Window, 'parent' | 'location'>, referrer: string): string | null {
  if (win.parent === win) return null;
  let origin: string | null = win.location.ancestorOrigins?.[0] ?? null;
  if (origin === null && referrer) {
    try {
      origin = new URL(referrer).origin;
    } catch {
      origin = null;
    }
  }
  return origin !== null && isAllowedHostOrigin(origin) ? origin : null;
}

/** A-03 is "the second rack" in the product's own words (docs/decisions.md). */
function rackName(id: RackId): string {
  return id === 'A-03' ? 'second rack (A-03)' : id;
}

function sameLayout(a: LayoutSpec, b: LayoutSpec): boolean {
  return (
    a.shown === b.shown &&
    (Object.keys(a.regions) as (keyof LayoutSpec['regions'])[]).every((k) => a.regions[k] === b.regions[k]) &&
    (Object.keys(a.weights) as (keyof LayoutSpec['weights'])[]).every((k) => a.weights[k] === b.weights[k])
  );
}

/**
 * Why the layout went from `prev` to `next`, in a few words, read off the
 * same inputs composeScreen uses: which rack has focus, its shown state, and
 * which other racks are queued. `prev` null is the first layout reported.
 */
export function describeLayoutChange(prev: SimState | null, next: SimState): string {
  const nextRack = next.racks[next.focus];
  const nextShown = shownState(nextRack);
  if (prev === null) return `initial layout: ${rackName(next.focus)} ${nextShown}`;

  const parts: string[] = [];
  const prevShown = shownState(prev.racks[prev.focus]);
  if (prev.focus !== next.focus) {
    parts.push(`focus moved to ${rackName(next.focus)} (${nextShown})`);
  } else if (prevShown !== nextShown) {
    parts.push(`${rackName(next.focus)} ${prevShown} → ${nextShown}`);
  }

  const prevQueued = others(prev);
  const nextQueued = others(next);
  if (prevQueued.length === 0 && nextQueued.length > 0) {
    const q = nextQueued[0];
    parts.push(`${rackName(q.id)} ${shownState(q)}: queue added`);
  } else if (prevQueued.length > 0 && nextQueued.length === 0) {
    const was = prevQueued[0];
    // Emptied either because focus moved onto the queued rack (already said above) or because it settled.
    parts.push(was.id === next.focus ? 'queue removed' : `${rackName(was.id)} ${shownState(next.racks[was.id])}: queue removed`);
  }

  return parts.length > 0 ? parts.join('; ') : 'layout updated';
}

/**
 * The message to post for `next`, or null when its layout (regions,
 * weights, shown state) is the same as the last one posted, `prev`.
 */
export function layoutMessage(prev: SimState | null, next: SimState): LayoutMessage | null {
  const layout = composeScreen(next);
  if (prev !== null && sameLayout(composeScreen(prev), layout)) return null;
  return {
    type: 'noc-layout',
    regions: layout.regions,
    weights: layout.weights,
    state: layout.shown,
    reason: describeLayoutChange(prev, next),
  };
}

/**
 * Posts the layout feed to an allowed parent frame (see hostOrigin) on
 * mount and on every layout change. A no-op when `enabled` is false, when
 * not framed, or when the parent is not an allowed host.
 */
export function useLayoutFeed(sim: SimState, enabled: boolean): void {
  const [target] = useState(() => (enabled ? hostOrigin(window, document.referrer) : null));
  const lastPosted = useRef<SimState | null>(null);
  useEffect(() => {
    if (target === null) return;
    const msg = layoutMessage(lastPosted.current, sim);
    if (msg === null) return;
    window.parent.postMessage(msg, target);
    lastPosted.current = sim;
  }, [sim, target]);
}
