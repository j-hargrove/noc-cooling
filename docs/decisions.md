# Decisions: NOC Cooling Alert, Stage 1

## Process
- Proposer was a published claude.ai artifact built through conversation
  (not Claude Design as originally framed). reference/prototype.html is its output.
- Claude Code is the Committer. The contract (tokens + component contracts) is
  the source of truth between them.

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
- Demo/panel controls: desaturated dark green (#3E6652 light, #7FA38F dark).
  Never blue (blue = cold air / calm).
- Thermal plume palette is a heat map, separate from alert color.
- No colored top/side accent borders or stripes anywhere.

## Behavior
- Four locked states: calm, drifting-recovering, drifting-rising, critical.
  Offline is a rack condition, not a fifth alert state.
- Hysteresis: 3 steady readings before any downgrade. Escalation is immediate.
- Unaddressed critical runs away: throttling at 35°C, shutdown at 38°C.
  A shut-down rack stops radiating heat.
- Fixes ramp in gradually (CRAC-3 spin-up, workload drain). Fan failure degrades
  gradually.
- Focus rule: never move focus off a rack the operator hasn't acted on. After
  acting, focus moves to the next unhandled rack.
- Airflow goes only where the operator sent it, stays on that rack until
  stand-down, and CRAC-3 stands down to 60% after every resolution.
- Second rack (A-03 fan failure) fails ~14 readings after the first outcome,
  or on demand from the panel. Its fix: "Hold to cool A-03" (CRAC-3 aimed at it
  plus workload shift).
- Outcomes: resolved, rack(s) shut down, partial (recovered with a rack offline).
- Override = manual control: logged, reversible. No expiry/audit modeling (scope).
- Celsius (ASHRAE thresholds: 27°C recommended, 32°C allowable).
- Reduced motion follows the OS setting only; no in-page toggle.
- Hold-to-confirm for primary actions; double activation for keyboard/AT.

## Demo
- Intro screen with "Start the incident"; lock screen entry; "Try it" steps.
- Mobile: app fills the screen; "Demo controls" pill jumps to the panel.
- Case study page (separate, later): hero loop, live embed, QR code on desktop.
