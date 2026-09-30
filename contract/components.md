# Component contracts

One contract per region. These are the boundary between the proposer (the
published artifact, `reference/prototype.html`) and the committer (this repo).
`src/ui` implements exactly these; it consumes `contract/tokens.json` and
nothing else, and holds no business logic.

Everything a region needs arrives as props. No region reads the sim, the clock,
`matchMedia`, or the DOM. `composeScreen(simState) -> LayoutSpec` decides which
regions render and at what row weight; a region never decides whether it exists.

---

## Shared vocabulary

```ts
type AlertState = 'calm' | 'recovering' | 'rising' | 'critical'
type ShownState = AlertState | 'offline'   // offline is a rack condition, not a fifth alert state
type ActedAs    = null | 'fix' | 'manual'
type Outcome    = 'ok' | 'mixed' | 'fail'
type RackId     = string                   // 'B-07' | 'A-03' in the authored scenario

interface RackView {
  id: RackId
  shown: ShownState        // 'offline' when down, else state
  state: AlertState
  down: boolean
  tempC: number            // inlet, one decimal shown
  ratePerMin: number       // +/- °C per minute, derived from slope
  stable: 0 | 1 | 2 | 3    // consecutive steady readings toward a downgrade
  acted: ActedAs
  actedAt: string          // 'HH:MM:SS' clock text, '' when not acted
  fixProgress: number      // 0..1, how far the fix has landed
  fresh: boolean           // status line just changed; play the fresh cue once
  history: number[]        // up to 48 readings, oldest first
}

interface LayoutSpec {
  regions: { field: boolean; queue: boolean; readout: boolean; action: boolean }
  weights: { field: string; queue: string; readout: string; action: string }  // fr strings
  shown: ShownState
  multiRack: boolean
  outcome: Outcome | null
}
```

Word and glyph mapping is fixed and lives with the UI, not the sim:

| shown | word | glyph |
|---|---|---|
| `calm` | Normal | open circle |
| `recovering` | Drifting, recovering | circle with a chevron down |
| `rising` | Drifting, rising | filled triangle, exclamation |
| `critical` | Critical | filled octagon, minus bar |
| `offline` | Offline | power symbol, outline |

A sixth glyph, `resolved` (filled disc with a check), is used only by the
outcome sheet.

---

## 1. App shell and status bar

**Purpose.** Holds the four-row body and carries the state attribute every other
region reads its colour from. The bar states, once, where the operator is.

**States and variants.**
- `data-state` ∈ `calm | recovering | rising | critical | offline`. Binds
  `--sc` to `color.state[...]`. This is the only place state colour is resolved.
- `data-multi` ∈ `0 | 1`. Set when at least one non-focused rack is not calm.
- `data-outcome` ∈ `ok | mixed | fail`. `fail` desaturates the canvas
  (`motion.failDesaturate`).
- `data-motion` ∈ `full | reduced`. Set from the OS setting only. There is no
  in-page toggle.
- At `critical` the shell carries an inset vignette (`motion.criticalVignette`).
  It is a wash, not a border — no accent stripe anywhere.
- The feed dot pulses once per reading (`motion.feedDot.ring`), suppressed under
  reduced motion.

**Tokens.** `color.app.*`, `color.state.*`, `radius.app`, `radius.device`,
`space.bar`, `type.bar.*`, `layout.weights`, `layout.multiRackOverride`,
`motion.restructure`, `motion.criticalVignette`, `motion.feedDot`,
`shadow.device`, `color.surface.device`.

**Data.**
```ts
{ spec: LayoutSpec, site: string, aisle: string, clock: string,
  beat: number /* increments per reading */, reducedMotion: boolean }
```

**Notes.** The row transition (`motion.restructure`, 0.75s) is the escalation.
It must animate `grid-template-rows` on the container — regions must not animate
their own height, or the choreography desynchronises.

---

## 2. Thermal map (`field`)

**Purpose.** The hero. A live thermal field of cold aisle 4: 16 racks, a plume
off each modelled rack, and CRAC-3's airflow drawn as streamlines. It is the
one region that shows *where* the heat is rather than what it measures.

**States and variants.**
- **Per rack:** calm (neutral outline), alerting (outline in state colour,
  label in state colour, weight 650), focused (outline 2.2px plus a glow of the
  state colour), down (near-black fill, dashed steel outline, `"<id> off"`).
- **Chip** on the aisle side of each modelled rack: temperature to one decimal;
  at ≥35°C reads `"35.4° throttling"`; when down reads `"Offline"`. The chip on
  the rack currently being cooled lifts by 80% of the rack height so the airflow
  path stays legible.
- **CRAC-3** reads `CRAC-3 at 60%` idle, `CRAC-3 at 100%` boosted, and takes a
  cyan outline when boosted.
- **Streamlines:** 8 idle, 16 boosted. Boosted lines steer into the intake of
  the *aimed* rack. Aim stays on the rack the operator acted on until CRAC-3
  stands down — it never falls back to another rack mid-incident and never
  flickers between them.
- **Plumes:** strength tracks temperature, spread rate tracks trend, and a plume
  is capped so it never renders hotter than its source. A down rack emits
  nothing. A-03 reads at 0.5 gain and a lower cap — the fan failure is the
  quieter of the two incidents.
- **Tilt:** at critical the whole field tilts (`motion.fieldTilt`,
  `perspective(900px) rotateX(15deg)`), pushing the map up under the readout.
- **Shock rings:** two expanding rings fire from the rack's centre on entry to
  critical. Suppressed entirely under reduced motion.
- **Event pill:** a transient line at the top of the map
  (`"Heat load spiking at rack B-07"`, `"CRAC-3 back to 60%"`), 3.8s.
  Cool variant takes a cyan dot; default takes a red dot.

**Tokens.** `color.field.*`, `field.*` (all geometry), `radius.field`,
`radius.canvasRack`, `radius.canvasCrac`, `radius.canvasChip`, `space.field`,
`space.event`, `type.fieldCanvas.*`, `type.event`, `stroke.field.*`,
`motion.fieldTilt`, `motion.shock`, `motion.event`, `shadow.focusedRackGlow`,
`timing.fieldFrameThrottleMs`, `timing.fieldStepsPerFrame`,
`timing.fieldResetSteps`, `timing.reducedMotionStepsPerReading`.

**Data.** Imperative, driven through a ref — not re-rendered by React.
```ts
interface FieldInput {
  racks: Record<RackId, RackView>
  focus: RackId
  boosted: boolean
  aim: RackId | null       // sticky: the rack CRAC-3 is pointed at
  heatLoad: number         // 0..100
  reducedMotion: boolean
}
```

**Notes.** The simulation loop pauses when `document.hidden`. Under reduced
motion the field does not animate per frame; it advances
`timing.reducedMotionStepsPerReading` steps per reading and redraws once, so
the map stays truthful without moving continuously.

---

## 3. Queue card

**Purpose.** The other rack that needs attention. Present only when a
non-focused rack is off calm — this is what turns the single-zone layout into
the comparison layout.

**States and variants.**
- Colour (`--qc`) is the rack's own state colour, not the focused rack's. It
  sets the border, the glyph icon and the urgent chip fill.
- **Text is the one exception:** the card sits on `color.app.raise`, and
  `color.state.critical` only clears 4.1:1 there — below AA for the state
  word and temperature. When the queued rack is critical, `.qw` and `.qt` use
  `color.state.criticalOnRaised` instead; the border, glyph and chip fill keep
  using `color.state.critical` (they're graphical objects/large fills, not
  body text, and already clear 3:1). No other state needs the substitution.
- **"More urgent"** chip when the queued rack outranks the focused one, or
  ranks equal while the focused rack has already been acted on and it has not.
- Cause line, in priority order: `Offline, shut down at 38°C` → `Manual
  control, logged` → `CRAC-3 boosted, logged` / `Cooling, 40% load moved` /
  `Cooled, logged` → `Hot air recirculating, needs action` / `Rack fan failure,
  needs action`.
- Trailing temperature with ▲ / ▼ / no marker at |rate| < 0.05.
- Enters with `motion.queueCardIn`; leaves by unmounting.

**Tokens.** `color.app.raise`, `color.app.frost`, `color.app.steel`,
`color.state.*`, `color.state.criticalOnRaised` (`.qw`/`.qt` text when
critical), `color.state.criticalInk` (urgent chip ink),
`radius.queueCard`, `radius.urgentChip`, `space.queue`, `type.queue.*`,
`motion.queueCardIn`, `focus.queueCard`.

**Data.**
```ts
{ rack: RackView, urgent: boolean, onSelect: (id: RackId) => void }
```

**Notes.** It is a `<button>`, one per rack, sorted by severity then
temperature. Selecting it moves focus, which is an operator action — the sim's
focus rule never moves focus into or out of the queue on its own while the
focused rack is unacted.

---

## 4. Readout

**Purpose.** What the focused rack is doing, and where it is heading. The
numeral is the escalation made typographic: it widens and thickens as the state
climbs, which is why the width axis is a token and not a style choice.

**States and variants.**
- **State line:** glyph + word in the state colour, plus the hysteresis meter.
- **Hysteresis meter:** three ticks, `stable` of them filled, visible only while
  `stable > 0`. It is the visible reason a downgrade has not happened yet.
- **Numeral:** three rolling digit strips (`NN.N`) plus a `°C` unit. Size, width
  and weight per `type.readout.numeral[state]`. `offline` renders in
  `color.surface.numOffline`, not in state colour. With a queued rack the size
  drops to `multiRack` while width/weight stay on the state.
- **Rate:** `Steady` under 0.05°C/min, else `▲ 1.4°C/min`.
- **Sparkline:** 48 readings, 22–37°C window, with dashed limit lines at 27 and
  32°C. When the rack is alerting, unacted and live, the line compresses to 68%
  of the width and the remaining third shows a 3-minute projection: a dashed
  "if nothing changes" path, a faint ghost of the fixed path, and a solid path
  that draws in proportion to hold progress. Holding the button is what reveals
  the outcome of holding it.
- **Projection caption** mirrors that: `In 3 min: 36.8°C if nothing changes,
  28.1°C with boost`.

**Tokens.** `type.readout.*`, `color.state.*`, `color.app.frost`,
`color.app.steel`, `color.surface.numOffline`, `space.readout`,
`stroke.spark.*`, `motion.numeral`, `motion.digitRoll`, `motion.stateColor`,
`motion.hysteresisTicks`, `motion.readoutSwap`, `radius.tick`.

**Data.**
```ts
{ rack: RackView, shown: ShownState, multiRack: boolean,
  holdProgress: number,          // 0..1, drives the solid projection path
  projection: { none: number[]; fixed: number[]; verb: string } | null }
```

**Notes.** The whole readout plays `motion.readoutSwap` when focus changes
racks — the slide is what tells the operator the numbers now belong to a
different rack.

---

## 5. Action slab

**Purpose.** One recommendation, one reason, one action. The slab is
transparent at calm and becomes a raised surface the moment there is something
to decide — the surface appearing *is* the escalation cue.

**States and variants.**
- **calm:** transparent, no button. A single line: `All 16 racks in range.
  Nothing needs your attention.` (or `… CRAC-3 boost is still on.`)
- **recovering:** raised, reason line only (`Falling back toward the
  recommended range.`), no button — a recovering rack is not asking for a
  decision.
- **rising:** raised, rises in with `motion.slabRiseSoft`. Reason names the
  threshold crossed and the recommendation. Hold button in `color.action.holdBg`.
- **critical:** raised, rises in with `motion.slabRise` (longer, later, further).
  Reason carries the time-to-threshold: `Servers throttle at 35°C in about
  4 min.` → `Servers are throttling now. Shutdown at 38°C in about 2 min.`
  Button switches to `color.action.holdCriticalBg` on white.
- **offline / acted:** no button. Status line only.
- **Hold button:** a fill scales from the left over `timing.holdMs`. Label
  changes through `Hold to boost CRAC-3` → `Keep holding` → (on release early)
  `Hold for one second to confirm`, reverting after
  `timing.holdHintRevertMs`. Keyboard and AT path is two activations:
  `Press again to confirm`, armed for `timing.keyboardArmWindowMs`.
- **Status line** after acting, with a leading check when the fix is applied:
  `CRAC-3 spinning up, 34%. Logged at 02:14:15.` → `CRAC-3 at 100% since
  02:14:15. Inlet should start falling within a minute. Logged.` Manual control
  reads `Manual control of B-07 by you since 02:14:15. Logged.`
- **Ghost row:** `Override and handle manually` (while an action is offered) and
  an undo — `Revert boost` / `Revert cooling` / `Resume recommendations`
  (whenever the rack has been acted on). Override is manual control: logged and
  reversible.

**Tokens.** `color.action.*`, `color.app.raise`, `color.app.frost82`,
`radius.slab`, `radius.hold`, `space.action`, `type.action.*`,
`motion.slab`, `motion.slabRise`, `motion.slabRiseSoft`, `motion.statusFresh`,
`focus.app`, `timing.holdMs`, `timing.holdHintRevertMs`,
`timing.keyboardArmWindowMs`, `timing.haptics.confirmAction`.

**Data.**
```ts
{ rack: RackView, shown: ShownState, boosted: boolean, operator: string,
  why: string, status: string | null, calmMessage: string,
  offerAction: boolean, holdLabel: string,
  onConfirm(): void, onOverride(): void, onUndo(): void }
```

Copy is composed by the sim layer and passed in; the slab does not build
sentences from state.

---

## 6. Outcome sheet

**Purpose.** Closes the loop. Names what happened, what it cost, and the one
thing left to do.

**States and variants.**
- **`ok` — Incident resolved.** Check glyph in cyan. Stats: Duration, Peak
  inlet, Actions. Primary button `Done`, which dismisses.
- **`mixed` — `B-07` recovered.** Glyph and primary in warn. Stats: Duration,
  Racks offline, Actions. Body names the recovered rack and each rack still
  offline with its shutdown time. Primary `Dispatch on-site tech`.
- **`fail` — `Rack B-07 shut down`** (or `2 racks shut down`). Glyph in
  critical, primary in `color.surface.outcomePrimaryFailBg`. Stats: To
  shutdown, Throttled, Actions. Primary `Dispatch on-site tech`, becoming
  `Tech dispatched, logged` and disabled once sent.
- Enters with `motion.outcomeIn`. If a second rack fails while the sheet is up,
  it leaves with `motion.outcomeOut` and the screen reopens — the sheet is not
  a terminal state.
- Secondary `Run it again` resets and restarts.

**Tokens.** `color.surface.outcome*`, `color.app.rule`, `color.state.*`,
`radius.outcome`, `radius.outcomePrimary`, `space.outcome`, `type.outcome.*`,
`motion.outcomeIn`, `motion.outcomeOut`, `shadow.outcome`, `focus.app`,
`timing.outcomeFocusMs`.

**Data.**
```ts
{ kind: Outcome, title: string, body: string,
  stats: [label: string, value: string][],   // always three
  primaryLabel: string, primaryDisabled: boolean,
  onPrimary(): void, onAgain(): void }
```

---

## 7. Lock screen

**Purpose.** The entry point, and the honest one: an operator meets this alert
on a locked phone at 2:13 AM, not on an open dashboard.

**States and variants.**
- Date and time over a heavy blur of the live app
  (`blur.lock` — the thermal map is genuinely visible through it).
- **Notification**, hidden until the rack escalates. Standard variant for
  `rising`; `crit` variant (warmer ground, critical-coloured title) for
  `critical` and for a shutdown. It updates in place as the incident moves.
- Escalation while locked never fires the shock rings — they belong to the
  unlocked app.
- Tapping the notification opens: the lock scales to 1.08 and fades
  (`motion.lockOpen`), then the shock rings fire if the rack is critical and
  focus lands on the hold button.

**Tokens.** `color.surface.lockScrim`, `color.surface.notif`,
`color.surface.notifCritical`, `color.state.critical`, `color.app.frost*`,
`radius.notif`, `space.lock`, `type.lock.*`, `blur.lock`, `motion.lockOpen`,
`motion.notifIn`, `focus.app`.

**Data.**
```ts
{ date: string, time: string,
  notification: { title: string, body: string, critical: boolean } | null,
  onOpen(): void }
```

---

## 8. Intro

**Purpose.** Tells the visitor what they are about to see and hands them the
choice, in one screen, before anything moves.

**States and variants.**
- Scrim gradient over the live calm app, lightly blurred — the instrument is
  visible and already running behind it.
- Kicker (`Hall B, cold aisle 4, 2:13 AM`), title, one paragraph.
- `Start the incident` (primary, frost on dark) starts the run.
  `Look around first` dismisses without starting.
- Leaves by fading (`motion.introOut`), then unmounting.

**Tokens.** `color.surface.introScrim`, `color.surface.introStartBg`,
`color.surface.introStartInk`, `radius.introStart`, `space.intro`,
`type.intro.*`, `blur.intro`, `motion.introOut`, `focus.intro`.

**Data.**
```ts
{ kicker: string, title: string, body: string,
  onStart(): void, onDismiss(): void }
```

---

## 9. Demo harness (wrapper — `src/demo`, never imported by `src/ui`)

**Purpose.** Everything that frames the product rather than being it: the device
bezel, the explanation, the "Try it" steps, the controls, and the action log.

**States and variants.**
- **Panel** (desktop: beside the device; mobile: below it): title, framing
  paragraph, four numbered steps, heat-load slider, three buttons
  (`Run the incident` / `Fail a second rack` / `Reset`), two checkboxes
  (start from lock screen, auto second rack), and the log.
- **Controls use the desaturated green accent.** Never blue — blue reads as
  cold air inside the instrument. The heat-load slider alone uses
  `color.demo.heatSlider`.
- **Action log** distinguishes `sys` (muted) from `act` (operator, emphasised).
  Newest first, with the sim clock.
- **Mobile:** the app fills the screen, and a floating `Demo controls` pill
  jumps to the panel. The pill hides when the app is less than half on screen.
- **Embed mode (`?embed=1`):** only the phone and the controls. No page chrome,
  transparent background, sized for an iframe. Below the mobile breakpoint it
  renders a static preview with an `Open full screen` link instead.

**Tokens.** `color.page.*`, `color.demo.*`, `radius.demoButton`, `radius.pill`,
`space.demo`, `type.demo.*`, `motion.demoPill`, `blur.demoPill`, `focus.demo`,
`color.surface.demoPillBg`, `color.surface.demoPillBorder`.

**Data.**
```ts
{ heatLoad: number, running: boolean, secondArmed: boolean,
  fromLock: boolean, autoSecond: boolean,
  log: { t: string, text: string, kind: 'sys' | 'act' }[],
  onHeatLoad(v: number): void, onRun(): void, onFailSecond(): void,
  onReset(): void, onToggleFromLock(v: boolean): void,
  onToggleAutoSecond(v: boolean): void }
```
