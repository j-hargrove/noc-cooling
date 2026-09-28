/** Clock text, 'HH:MM:SS', wrapping at 24h. Matches the prototype's fmt(). */
export function fmt(clockSeconds: number): string {
  const s = Math.floor(clockSeconds);
  const parts = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  return parts.map((n) => String(n).padStart(2, '0')).join(':');
}

/** Duration text: '4m 05s' or, under a minute, '38s'. Matches the prototype's dur(). */
export function dur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mnt = Math.floor(s / 60);
  const sec = s % 60;
  return mnt ? `${mnt}m ${String(sec).padStart(2, '0')}s` : `${sec}s`;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
