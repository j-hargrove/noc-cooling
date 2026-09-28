# FRAME — Adaptive Data Center Cooling Alert (Mobile Generative UI Portfolio Piece)

## Concept
A two-stage portfolio piece demonstrating the gap between AI-generated visual design and AI-generated adaptive UI, built as a mobile data center cooling monitoring/alert experience.

## Business Problem
Cooling drift goes undetected long enough to cause thermal excursions because dashboards don't differentiate a 2°F drift from an actual CRAC failure. Operators either miss real problems buried in steady-state noise, or get alert fatigue from over-alerting on minor fluctuations. The cost of getting this wrong is measured in real downtime and SLA credits (documented industry incidents run into six figures per event) — the data exists, but nothing pulls operator attention to it at the right moment with the right urgency.

## Primary Users & Internal Stakeholders
- **NOC operator** — primary user, monitors the live dashboard, first to see a drift, decides whether to escalate or let it self-correct
- **On-call facilities/cooling engineer** — gets escalated to when a drift doesn't self-correct; needs enough context (which zone, trajectory, time-to-threshold) to act without re-deriving it themselves
- **Shift lead** — needs a rollup view across zones/rack rows, not per-alert detail; accountable for what got missed or over-escalated during a shift
- **SLA/uptime owner** (implied stakeholder, not a direct user) — cares about outcomes (time-to-attention, false-alarm rate), not the UI itself, but is who the "useful progress" metrics below are ultimately for

## The Experience (worked backward from)
A NOC operator's dashboard is normally steady-state — charts they've learned to tune out. A cooling zone starts drifting, not failed yet, just trending wrong. The interface's job is to pull exactly the right amount of attention: not a full-screen alarm for a 2°F drift, not a buried log line for an actual CRAC failure. Urgency and structure track the trajectory of the problem — collapsing back to calm if it self-corrects, escalating and reorganizing (which rack rows are at risk, which action is one tap away) if it doesn't.

Core thesis carried over from Human Legibility Layer / override-as-dominant-UI-element / Trust Budget: the interface should make a shift in confidence or trust legible in real time, not just report a new number.

## Why This Domain
- Data center cooling monitoring is a real, well-funded space (DCIM platforms, Ekkosense, Vigilent, etc.) — sophistication so far is entirely backend/ML-side.
- The front end across the market is still static charts and threshold alerts.
- A documented real-world failure mode exists: incidents where a dashboard technically had the data but nothing pulled operator attention to it in time, leading to real cost/downtime. That's precisely the gap generative UI addresses — a citable market weakness, not a hypothetical one.
- Sidesteps IoT/hardware framing entirely — this demos what the interface does with an alert once it exists, not the sensing layer.
- Rich visual surface for Stage 1: heat maps, rack-row grids, thermal gradients, trajectory lines.

## Data, Workflow & Trust Constraints
**Data:** Per-zone/per-rack-row temperature readings over time, feeding the rate-of-change, zone-isolation, and time-to-threshold signals referenced below. For the demo, this is simulated live-feeling data, not real sensor integration (deliberate — see "Why This Domain," sidesteps IoT/hardware).

**Workflow:** Drift detected → dashboard reorganizes to surface it at a magnitude proportional to trajectory, not just current reading → if it self-corrects, UI collapses back to calm state → if it doesn't, escalation path activates (on-call engineer notified, action becomes the dominant UI element) → resolution closes the loop and the UI returns to steady-state.

**Trust constraints:**
- False-positive tolerance is the central design tension — over-escalating trains operators to ignore the UI, which recreates the exact failure mode this piece is arguing against.
- The operator must be able to see *why* the UI escalated (which signal, what changed) — not just that it did. This is the Human Legibility Layer thread: confidence/trust shifts have to be legible, not just asserted.
- Override/dismiss needs to be available and logged — an operator downgrading or dismissing an escalation is itself a meaningful, auditable event, not a silent action.

## Two-Stage Structure
**Stage 1 — Claude Design**
Static, visually polished exploration of the alert states (calm / drifting / critical) as UI comps. Demonstrates fast visual ideation and design-system application. Intentionally cannot show the thing that matters most: real-time trajectory-driven reorganization.

**Stage 2 — Claude Code**
Functional, adaptive build. UI structure — not just color/copy — is computed from live-feeling signal input. This is where the "generative UI" claim has to be earned: the layout genuinely restructures based on data, it isn't a set of pre-built states swapped on a timer.

Both stages live on the same portfolio page as companion projects, same concept, so the Stage 1 → Stage 2 gap is the point of the piece.

## What Useful Progress Looks Like
**For the portfolio piece:** Both stages built and shipped on the portfolio page; a hiring manager can perceive the Stage 1 → Stage 2 gap — static comp vs. genuinely restructuring UI — in under a minute without narration.

**For the hypothetical product (the story being told, not something being validated here):** Time-to-operator-attention on a real drift would drop, and false-alarm-driven alert fatigue would drop, because urgency is proportional to trajectory rather than binary threshold-crossing.

## Realism & Data Fidelity
Three separate things make this read as real rather than a scripted demo — worth treating them separately since fake-looking demos usually fail at one, not all three.

**Data behavior:** Simulated feed needs noise and momentum, not a clean ramp — small oscillations around baseline, a brief partial recovery, then a resumed and faster climb. That "almost self-corrected, then didn't" texture is what makes rate-of-change worth computing; a straight linear ramp makes the signal logic look unnecessary.

**Domain accuracy:**
- Calm-state baseline grounded in ASHRAE's recommended data center temperature envelope (~64–80°F / 18–27°C), not arbitrary numbers.
- Real rack row / zone naming conventions ("Row A12," "Zone 3 — CRAC 2") instead of generic "Zone 1, Zone 2."
- One specific, named failure signature for the critical-state scenario — e.g. fast climb after near-flat readings (compressor/fan failure) vs. gradual drift (airflow blockage, filter fouling) — rather than a generic "temperature too high."

**Scenario over state machine:** Build one specific authored timeline (e.g. slow climb → brief dip toward baseline → resumes climbing faster → time-to-threshold crosses under 10 min → escalates) rather than clicking through three severity states. The near-miss dip is what proves the rate-of-change signal is doing real work instead of gating on a fixed threshold.

**Open question:** Hand-authored fixed demo timeline (deterministic, safer for narrating to a hiring manager) vs. procedurally generated (different each load, more replayable but less controllable). Undecided — revisit before building the data layer.

## Signal Set & Layout Logic
Two computed values drive the UI, on separate axes:

**Urgency score** — derived from trajectory (rate-of-change over time), translated into time-to-threshold for human legibility. Note: these are not two independent signals — time-to-threshold is rate-of-change extrapolated to the limit, presented in a form a human reads instantly. Raw temperature delta alone never gates escalation; it's the input the trajectory is computed from, not the trigger itself.

Hysteresis rule: urgency downgrades only after N consecutive stable readings (N to be tuned during build, not a single-reading flip). Without this, the intentionally-designed "near-miss dip" scenario (climb → partial recovery → resumes climbing) would cause the UI to flap up/down/up in quick succession, which undermines the trust thesis this piece is arguing for rather than supporting it.

**Isolation state** — single-zone vs. multi-zone drift. This is the one signal that drives an actual different layout template, not just a different urgency level:
- Single-zone: detail view for the affected rack row
- Multi-zone: comparison view across diverging zones

This is treated as two real UI surfaces to design and build (not a modifier badge on one layout) — accepted scope, not a stretch goal.

## Open — Next (EXPLORE/DECIDE)
Signal set and layout logic are now locked (see above). Remaining open items: tune N for the hysteresis rule during build; decide hand-authored vs. procedurally generated demo data timeline (see Realism & Data Fidelity).
