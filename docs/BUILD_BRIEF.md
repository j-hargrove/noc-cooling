# BUILD BRIEF — NOC Cooling Alert, Stage 2

Repo: noc-cooling. Contains reference/prototype.html (final working prototype,
source of truth for behavior and look) and docs/frame.md (project frame).
Read both before starting.

## Step 0a: Record decisions
Save the following as docs/decisions.md, verbatim. Treat it as binding.

(See docs/decisions.md — recorded verbatim.)

## Step 0b: Extract the contract, then STOP
1. Scaffold Vite + React + TypeScript (keep reference/ and docs/). Add Vitest and
   Playwright. Connect to Vercel (main deploys, PRs get previews). Save this
   brief as docs/BUILD_BRIEF.md. Commit and push.
2. Write contract/tokens.json: every color, type axis, size, radius, spacing,
   motion duration/easing, taken exactly from the prototype. Keep every tuned
   value as-is.
3. Write contract/components.md: one contract per region (thermal map, queue card,
   readout, action slab, outcome sheet, lock screen, intro): purpose, states and
   variants, which tokens it uses, what data it takes.
4. Write contract/a11y-spec.md: live regions, hold-to-confirm keyboard/AT path,
   reduced-motion choreography, contrast targets.
>>> STOP. Show me the contract files for review before any other work.

## Structure (after contract approval)
- src/sim/      Pure TS, no DOM. All behavior in docs/decisions.md. Deterministic
                given a seed. Prototype setTimeouts (stand-down, focus hand-off,
                aftershock) become sim events driven by reading count.
- src/compose/  composeScreen(simState) -> LayoutSpec: which regions show and
                their row weights. Rules-based now; Stage 3 swaps in a generative
                composer behind the same signature.
- src/field/    Canvas thermal field, plumes, heat caps, CRAC-3 streamlines.
                Imperative, isolated, driven by sim state via a ref. Pauses when
                the tab is hidden.
- src/ui/       React components implementing contract/components.md. Styles
                consume contract/tokens.json only. No business logic.
- src/demo/     Intro, controls panel, "Try it" steps, mobile pill. Wraps the
                product; never imported by src/ui.

## Order of work (one step per commit)
1. Port sim with Vitest tests, including these regressions:
   - hysteresis holds 3 readings; escalation is immediate
   - unaddressed critical throttles at 35°C and shuts down at 38°C
   - a shut-down rack stops radiating heat
   - fix ramps and fan degradation are gradual
   - focus never moves off an unacted rack; moves after acting
   - aftershock fires ~14 readings after the first outcome
   - CRAC-3 stands down after every resolution
   - airflow stays on the rack being cooled until stand-down (no fallback flicker)
2. composeScreen + tests: one per state and per outcome, asserting regions.
   >>> STOP. Show me the test output before starting UI.
3. UI components rendering static LayoutSpecs, plus a /states page showing every
   state and outcome side by side (the verification page).
4. Verification: Playwright screenshots of /states at 390x844 as approved
   baselines; CI fails on visual diff. Show me the baselines to approve.
5. Port the canvas field and streamlines.
6. Wire the live loop, demo harness, lock screen, and outcome sheets.
   UI gates shockwave and notify events on locked; the shockwave never
   fires behind the lock screen.
7. Embed mode: ?embed=1 renders only the phone and controls (no page chrome,
   transparent background), sized for an iframe. On narrow viewports, a static
   preview with an "Open full screen" link instead.
8. Side-by-side check against reference/prototype.html at 390x844.

## Done when
- Every behavior in docs/decisions.md works, including reduced motion.
- Sim, compose, and visual-diff checks pass in CI.
- /states renders every state and outcome without running the sim.
- Vercel URL works full screen on a phone and in an iframe with ?embed=1.
