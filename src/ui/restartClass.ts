/**
 * Replays a one-shot CSS animation/transition keyed off a class: remove it,
 * force a reflow so the browser commits the "without" state, add it back.
 * The same idiom reference/prototype.html uses (`void el.offsetWidth`).
 */
export function restartClass(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
