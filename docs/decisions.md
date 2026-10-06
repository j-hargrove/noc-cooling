# Decisions: NOC Cooling Alert, Stage 2

## Process
- Proposer was a published claude.ai artifact built through conversation
  (not Claude Design as originally framed). reference/prototype.html is its output.
- Claude Code is the Committer. The contract (tokens + component contracts) is
  the source of truth between them.
- Stages: Stage 1 is the working prototype (reference/prototype.html). Stage 2
  is this production app, with the rules-based composer. Stage 3 is the
  generative composer (not built yet). Renumbered: earlier notes called the
  generative composer Stage 2 and this file Stage 1.

## Direction
- "Thermal Instrument": instrument-grade layout, dark UI, live thermal map as the
  hero, one typeface family (Archivo, variable width axis).
- Every motion encodes information. No decorative motion. No flashing.
- The escalation is choreographed: layout physically restructures by state
  (shape change, not style change).

## Color
- Red is reserved for signal: temperature, state word/glyph, rack outline, rate,
  and the single primary action. Never used for containers, panels, or borders.
- UI red #C96764 (AA on dark ground). Button fill #A84A48 with white text.
  Heat load slider #950606.
- Critical text on raised surfaces uses #D4736F to hold AA; #C96764 stays the
  red on the app ground.
- Demo/panel controls: desaturated dark green (#3E6652 light, #7FA38F dark).
  Never blue (blue = cold air / calm).
- Thermal plume palette is a heat map, separate from alert color.
- No colored top/side accent borders or stripes anywhere.

## Behavior
- Four locked states: calm, drifting-recovering, drifting-rising, critical.
  Offline is a rack condition, not a fifth alert state.
- Hysteresis: 3 steady readings before any downgrade. Escalation is immediate.
- Incident heat ramp increased from +15 to +35 per reading so escalation feels
  immediate — first notification at ~3s rather than ~4.5s. (~3s is the floor
  from a fresh page with the ease rate unchanged; ~1.5s if the page has idled.)
- Unaddressed critical runs away: throttling at 35°C, shutdown at 38°C.
  A shut-down rack stops radiating heat.
- Fixes ramp in gradually (CRAC-3 spin-up, workload drain). Fan failure degrades
  gradually.
- Focus rule: never move focus off a rack the operator hasn't acted on. After
  acting, focus moves to the next unhandled rack.
  The hand-off comes 2 readings after acting, so 1.5–3.0s by design, not the
  prototype's fixed 1.6s: timed events are reading counts throughout.
- Airflow goes only where the operator sent it, stays on that rack until
  stand-down. CRAC-3 stands down to 60% 2 readings after every rack holding
  the boost has settled back to calm or shut down, not on the incident
  outcome: another rack failing never keeps a boost on. If a holder shut down,
  the boost clears but the aisle heat load is left alone.
- Second rack (A-03 fan failure) fails ~14 readings after the first outcome,
  or on demand from the panel. Its fix: "Hold to cool A-03" (CRAC-3 aimed at it
  plus workload shift).
- Outcomes: resolved, rack(s) shut down, partial (recovered with a rack offline).
- Override = manual control: logged, reversible. No expiry/audit modeling (scope).
- Actions are attributed to "you", not a named operator: the visitor is the one
  acting ("CRAC-3 fan boosted to 100% by you", "Manual control of B-07 by you
  since 02:14:30"). Capitalised when it opens a sentence ("You resumed…").
  The artifact credits "you" too, so reference/prototype.html was updated to match.
- Celsius (ASHRAE thresholds: 27°C recommended, 32°C allowable).
- Reduced motion follows the OS setting only; no in-page toggle.
- Hold-to-confirm for primary actions; double activation for keyboard/AT.

## Demo
- Intro screen with "Start the incident"; lock screen entry; "Try it" steps.
- Mobile: app fills the screen; "Demo controls" pill jumps to the panel.
- Case study page (separate, later): hero loop, live embed, QR code on desktop.
