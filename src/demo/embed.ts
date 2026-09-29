/**
 * Embed mode (contract/components.md §9): `?embed=1` renders only the
 * phone and the controls, with no page chrome and a transparent background,
 * for an iframe on the case-study page.
 */
export function isEmbed(search: string): boolean {
  return new URLSearchParams(search).get('embed') === '1';
}

/**
 * `?theme=` — the host page's colour scheme, so the embed can declare the
 * same one. Browsers back an iframe with an OPAQUE canvas whenever its
 * colour scheme differs from its embedder's, which would put a white (or
 * black) box behind a "transparent" embed. Matching it also switches the
 * panel's text to the palette that reads on that ground.
 *  - omitted: no declaration — matches a host that declares none (the web default, light)
 *  - `light` / `dark`: a host that declares exactly that
 *  - `auto`: a host that declares `color-scheme: light dark` (follows the OS)
 */
export type EmbedTheme = 'light' | 'dark' | 'auto';
export function embedTheme(search: string): EmbedTheme | null {
  const t = new URLSearchParams(search).get('theme');
  return t === 'light' || t === 'dark' || t === 'auto' ? t : null;
}

/** Applies embed mode to <html> before first render (see embed.css). */
export function applyEmbedRoot(root: HTMLElement, theme: EmbedTheme | null): void {
  root.classList.add('embed');
  if (theme) root.dataset.embedScheme = theme;
  // 'auto' keeps base.css's prefers-color-scheme switching; light/dark pin the panel palette.
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
}

/**
 * contract/tokens.json → meta.breakpoint.mobile. Below it an embed shows a
 * static preview instead of the live app: phone plus controls can't fit.
 */
export const MOBILE_BREAKPOINT_PX = 780;
export const NARROW_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;

/** The same page, full screen: the embed-only params dropped, everything else kept. */
export function fullScreenUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('embed');
  url.searchParams.delete('theme');
  url.hash = '';
  return url.toString();
}
