# Embedding the demo

`?embed=1` renders only the phone and its controls: no page chrome, transparent
background, sized to the iframe (docs/BUILD_BRIEF.md step 7).

```html
<iframe
  src="https://noc-cooling.vercel.app/?embed=1"
  title="NOC cooling alert, live demo"
  style="border:0; width:100%; max-width:820px; height:844px"
></iframe>
```

- **Wide (≥781px):** the live app and the panel's controls and action log. The
  host page supplies the heading, framing copy and "Try it" steps; the embed
  leaves them out. At 820×844 the phone renders at its designed 390×844; a
  shorter frame (down to 640px) flexes the phone to fit rather than scroll.
- **Narrow (≤780px, `meta.breakpoint.mobile`):** a still frame of the
  instrument at critical, scaled to fit, with an **Open full screen** link
  (new tab). No live loop runs. The switch follows the iframe's own width, live.

## Match the host's colour scheme

Browsers back an iframe with an **opaque** canvas when its colour scheme
differs from the page embedding it, which would put a white box behind the
"transparent" embed on a dark page. Tell the embed which scheme the host uses:

| Host page declares | Add |
|---|---|
| nothing (the default) | nothing |
| `color-scheme: dark` | `&theme=dark` |
| `color-scheme: light` | `&theme=light` |
| `color-scheme: light dark` | `&theme=auto` |

`theme` also sets the panel's text palette to match (light ink on dark).

Other params: `?seed=<n>` makes a run reproducible. `?readMs=<ms>` speeds up
the sensor feed, and exists for the e2e suite; don't ship it on the page.
