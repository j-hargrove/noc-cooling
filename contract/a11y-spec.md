# Accessibility contract

Binding alongside `contract/tokens.json` and `contract/components.md`. Measured
values in the contrast table were computed against the extracted tokens, not
estimated.

The thesis of this piece is that an interface can make a shift in confidence
legible in real time. An operator who cannot see the map has to get the same
shift, at the same moment, from the announcements. That is the standard this
spec is held to — not "it can be navigated".

---

## 1. Live regions

Two regions, both `.sr-only`, both permanently in the DOM:

| id | role | used for |
|---|---|---|
| `liveP` | `aria-live="polite"` | every state change except critical; recovery; resolution; action confirmations |
| `liveA` | `aria-live="assertive"` | escalation to critical, and rack shutdown |

**Announcing.** Set the region to `''`, then to the message after
`timing.liveRegionResetMs` (60ms). Without the clear, a repeated message is not
re-announced. This is the only permitted use of a timer for announcements.

**What is announced, verbatim in shape:**

- Escalation to critical (assertive):
  `Critical. Rack B-07 inlet 32.4 degrees and rising. Recommended: boost CRAC-3 fan.`
  For A-03: `… Fan failure. Recommended: cool A-03.`
- Any other state change (polite):
  `Rack B-07 drifting, rising. Inlet 28.1 degrees.`
- Return to calm (polite): `Rack B-07 back to normal.`
- Shutdown (assertive):
  `Rack B-07 has shut down. Servers powered off to protect hardware.`
- Action confirmed (polite): `Boost applied. CRAC-3 at 100 percent. Logged.` /
  `CRAC-3 boosting toward A-03, workloads shifting off. Logged.`
- Override (polite): `Override logged. Manual control of B-07.`
- Second rack (polite): `Fan failure on rack A-03.`
- Resolution (polite): `Incident resolved. All racks back in range.` /
  `Rack B-07 recovered. A-03 still offline.`
- Dispatch (polite): `Tech dispatched. Logged.`

**What is deliberately not announced.** The per-reading temperature tick. A
reading every 1.5s would make the polite queue useless and would bury the four
announcements that matter. The number is reachable on demand from the readout;
the *state change* is what gets pushed. This is the same judgement the visual
design makes — proportional attention, not a firehose.

**Non-text regions.**
- The thermal canvas is `role="img"` with a label naming where the heat is
  (`"Thermal map. Heat is concentrated at rack B-07."`), updated as focus moves.
- The rolling-digit numeral is `aria-hidden` — the digit strips read as a column
  of 0–9. The temperature reaches AT through the announcements and the
  readout's own labelled text, never through the strips.
- The sparkline, hysteresis meter, event pill and shock rings are all
  `aria-hidden`. Each has a text equivalent: the projection caption, the status
  line, the announcements.
- The feed clock carries `aria-label="Last reading"`.

---

## 2. Hold-to-confirm: the keyboard and AT path

The primary action is destructive-adjacent and is confirmed, never fired on a
single tap. Two paths, equal in standing:

**Pointer.** `pointerdown` starts a `timing.holdMs` (750ms) fill;
`pointerup` / `pointercancel` cancels. Pointer capture is taken so a finger
sliding off the button does not silently cancel. `contextmenu` is suppressed —
a long press must not open the OS menu on top of the gesture.

**Keyboard and assistive tech.** A `click` with `detail === 0` (the signature of
Enter, Space, or an AT activation — a real pointer click always reports a
detail) takes the double-activation path instead:

1. First activation arms. The label becomes `Press again to confirm`. The
   button stays armed for `timing.keyboardArmWindowMs` (3000ms), then disarms
   and the label reverts.
2. Second activation within the window confirms.

This is a genuine equivalent, not a fallback: both paths require two separate
deliberate acts, and neither can be triggered by a stray single press.

**Requirements.**
- `aria-describedby` points at a `.sr-only` hint present from first render:
  `Press and hold to confirm. With a keyboard or screen reader, activate twice.`
- The label change on arming must reach AT. The button's accessible name comes
  from its text content, so the change is announced by the name-change path;
  do not move the label into a `title` or a pseudo-element.
- Hold progress is visual only. Do not announce progress — it would talk over
  the arming prompt.
- **Focus after acting.** Confirming from the keyboard moves focus to the undo
  control, so the reversal is one key away from the action. Confirming by
  pointer leaves focus alone.
- The sim's focus hand-off (`timing.focusHandoffMs`) is suppressed while a hold
  or an arming window is in progress. The target must never move under a
  half-finished confirmation.

**Related controls.**
- `Override and handle manually` and the undo are single-activation. Override is
  reversible and logged, so it does not need a confirm gate.
- The outcome sheet's primary takes focus `timing.outcomeFocusMs` (300ms) after
  the sheet enters — only when the app is unlocked. It is never stolen from
  behind the lock screen.

---

## 3. Reduced motion

`prefers-reduced-motion: reduce` is read from the OS. There is no in-page
toggle, by decision. The setting is watched live and applied without a reload.

Reduced motion here is **a second choreography, not an absence of one**. The
escalation still has to be perceivable as an escalation.

**Removed.** All transitions and animations are zeroed
(`transition-duration: 0s`, `animation: none`): the row restructure, the
numeral's size/width sweep, the digit roll, the field tilt, the slab rise, the
outcome and lock transitions, the queue card entry, the feed-dot ring.

**Removed outright, not substituted.** The shock rings. There is no reduced
equivalent of an expanding ring; the escalation is already carried by the
crossfade, the announcement and the haptic.

**Substituted.** A state change crossfades the body
(`motion.reduced.crossfade`: 0.35s from 0.3 opacity). The layout still
restructures — it arrives at the new row weights instantly rather than sliding.
Shape change survives; the sliding does not.

**The thermal field.** It does not animate per frame. Per reading it advances
`timing.reducedMotionStepsPerReading` (40) steps and redraws once — the map
stays physically truthful and current, it simply does not move continuously.
Streamline dashes stop scrolling; the streamlines themselves remain drawn, so
where the air is going is still visible.

**Unaffected.** Colour, layout weights, copy, announcements, haptics, and every
threshold. Nothing that carries information is behind motion. Anything a
reduced-motion operator would miss visually has a text equivalent in §1.

**Also honoured.** The field loop pauses on `document.hidden` in both modes.

---

## 4. Contrast targets

**Target:** WCAG 2.2 AA — 4.5:1 for text under 18.66px/700, 3:1 for larger text,
UI component boundaries and focus indicators. Measured against the token the
element actually sits on, not against the app ground by default.

| Pair | Ratio | Against |
|---|---|---|
| frost `#E3ECF1` on app ground | 15.03 | AA, AAA |
| frost `#E3ECF1` on outcome `#0F2432` | 13.30 | AA, AAA |
| frost 82% over raise `#112836` | 8.98 | AA, AAA |
| steel `#8FA4B2` on app ground | 6.96 | AA, AAA |
| steel `#8FA4B2` on raise `#112836` | 5.88 | AA |
| calm `#74CFEA` on app ground | 10.16 | AA, AAA |
| recovering `#9ED9C4` on app ground | 11.29 | AA, AAA |
| rising `#FFB547` on app ground | 10.25 | AA, AAA |
| critical `#C96764` on app ground | 4.81 | AA |
| critical `#C96764` on raise `#112836` | 4.06 | below AA — not used for text there, see below |
| criticalOnRaised `#D4736F` on raise `#112836` | 4.69 | AA |
| white on critical button `#A84A48` | 5.62 | AA |
| `#1E1204` on warn button `#FFB547` | 10.45 | AA, AAA |
| `#06202B` on ok primary `#74CFEA` | 9.49 | AA, AAA |
| `#0A1822` on intro start `#E3ECF1` | 15.03 | AA, AAA |
| urgent chip ink `#1A0605` on critical | 5.23 | AA |
| offline numeral `#5D7282` on app ground | 3.60 | AA large text only (77px) |
| page ink `#0B1A24` on light ground | 14.57 | AA, AAA |
| page muted `#4A5E6B` on light ground | 5.57 | AA |
| page muted `#8196A4` on dark ground | 6.32 | AA, AAA |
| focus ring frost on app ground | 15.03 | AA |
| focus ring calm `#74CFEA` on intro scrim | 10.79 | AA |
| focus ring `#3E6652` on light ground | 5.36 | AA |
| focus ring `#7FA38F` on dark ground | 6.98 | AA |

**Two findings, ruled on by the proposer.**

1. **Critical red on the raised surface was 4.06:1, below AA.** The shortfall
   was specifically a *queued* rack that is critical: its state word (13.5px)
   and temperature (16px) render on `--c-raise` (`#112836`) inside the queue
   card. Ruling: add `color.state.criticalOnRaised` (`#D4736F`, 4.69:1 on
   raise) and use it only for text that sits on a raised surface — currently
   the queue card's `.qw` and `.qt`. The queue card's ground is unchanged, and
   `color.state.critical` (`#C96764`) stays the signal red everywhere else,
   including the queue card's border, glyph and urgent-chip fill (graphical
   objects, already ≥3:1). Recorded in `docs/decisions.md` under Color and in
   `contract/tokens.json` (`color.state.criticalOnRaised`) and
   `contract/components.md` (queue card).

2. **The offline numeral `#5D7282` is 3.60:1**, clearing AA only as large text.
   Ruling: kept, deliberately. Once a rack is offline its last temperature is
   stale — the numeral is dimmed on purpose, and state is carried at full
   contrast by the `Offline` word and the power glyph, not by the number. Rule:
   the offline numeral may never render below 24px (recorded as `minSize` on
   `type.readout.numeral.offline` in `contract/tokens.json`); the prototype's
   actual size (`min(77px,9.1cqh)`) is well above that floor, so this is a
   guard against a future re-tune shrinking it past the point where large-text
   AA no longer applies, not a change to current behaviour.

**Not colour-dependent.** Every state carries a distinct glyph shape and a
distinct word alongside its colour, so state is never conveyed by hue alone.
The queue's ▲/▼ markers duplicate the sign of the rate, which is also stated in
the readout's text.

---

## 5. Focus, structure, and input

- **Focus is always visible.** 3px ring, offset 2–3px, never removed. Ring
  colour differs by ground (`tokens.focus`) so it clears AA on each.
- **Focus order** follows the visual order of the layout: bar, queue cards,
  readout (non-interactive), slab action, override, undo. The row restructure
  changes row *size*, never DOM order.
- **Nothing is focusable while covered.** The lock screen and intro are overlays
  with the app behind them; the app's controls are not reachable until they
  close. When the lock opens, focus lands on the hold button if one is offered.
- **The outcome sheet is `role="dialog"`** with `aria-labelledby` on its title.
- **Touch targets:** hold button 44px, outcome primary 48px, intro start 50px,
  queue card ~44px, notification ~76px. The ghost links (override, undo) sit
  below 44px and are duplicated in intent by controls that do not — they are
  reversal affordances, never the only path to an outcome.
- **Haptics** (`timing.haptics`) accompany but never replace: escalation to
  critical, shutdown, and action confirmation each also announce.
- **Motion-independent timing.** Nothing requires a timed response from the
  operator. The incident escalates on its own, but every control stays
  available and every action stays reversible; the 3s keyboard arming window is
  the only timed interaction, it is generous, and expiry costs nothing but a
  re-press.
