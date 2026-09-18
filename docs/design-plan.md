# Design plan

Required by `DESIGN.md` §0.1, written before any UI code. It records the tokens in use, the layout
concept per screen, what makes this interface memorable, and the self-critique against §12.

## Tokens

Taken verbatim from `DESIGN.md` §3.4 — the `--moss-900 … --slate-500` palette, Source Serif 4 and
Public Sans, control radius 6 / panel radius 10 / chip 999 / map 0, and the single shadow
`0 1px 3px rgba(34, 51, 43, 0.22)` reserved for elements floating over the map.

Two things are enforced structurally rather than by discipline:

- **No component contains a hex literal.** Mapbox and Chart.js cannot read CSS custom properties, so
  a small bridge (`lib/tokens.js`) resolves them via `getComputedStyle` and hands them over. That is
  what makes a second theme cost one block of overrides instead of a parallel stylesheet.
- **No inline `style` objects.** The single exception is passing a custom property to parameterise a
  class, e.g. `--map-height`, which configures a rule rather than overriding it.

## Layout concept per screen

**Shell.** A 56 px header holding the product name as text, one nav item, and the signed-in user.
Below it the map is edge to edge and panels sit _beside_ it. Panels are surfaces on a working
canvas, never cards floating on an empty background.

**Projects.** A ledger on the left, an overview map on the right. The ledger carries name with a
one-line description, a type chip, site count, right-aligned area in hectares, and a relative
last-updated. There are no stat tiles: a count of projects is already visible as rows, and a tile
restating it is decoration.

**Project workspace.** Three columns — project meta and site ledger, map, analytics drawer. Drawing
is a mode of the map rather than a separate screen: a hint bar appears, area updates live in
hectares as corners are placed, and naming happens in the left panel where the ledger will show the
result.

**Analytics drawer.** 520 px over the map, so the site stays visible while its numbers are read.
Ordered by what is asked first: what is this site, which indicator, what is the latest value and
which direction it moved, then the series behind it, then what the number means.

**Auth.** A 480 px form column beside a real satellite image of a real landscape with real polygons
and its coordinates. The product's subject matter is the decoration.

## What makes this memorable

The ledger and the map are one instrument, not two panels that happen to share a screen. Hovering a
row lights its polygon; selecting a polygon selects its row and opens its analytics. Everything else
is deliberately quiet so that link is the thing you notice — it is also the accessibility story,
because the ledger row does everything the polygon does and is reachable by keyboard.

The second decision doing quiet work: **the interface never claims more than it knows.** Seeded
figures are labelled "Sample data" wherever they appear, change is written as a signed number with
words rather than a coloured arrow, and every metric carries one fixed sentence saying what it
measures and which direction is good. For a tool whose users have to trust the numbers, restraint
about provenance is a feature.

## Critique against §12

Checked before building, and again after each screen.

| Anti-pattern                                     | How this design avoids it                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Stat tile row on Projects                        | None. The ledger is the summary.                                                                                          |
| Grid of identical rounded cards                  | Ledger tables with 48 px rows and aligned figures.                                                                        |
| One radius everywhere, same shadow on everything | Radius is hierarchical (6 / 10 / 999 / 0). Panels are flat with a 1 px border; only map-floating elements get the shadow. |
| Icons in coloured circles, emoji icons           | Lucide at 16 px, only for close, draw, delete, overflow. No decorative icons.                                             |
| All-caps eyebrow labels, "01 / 02 / 03"          | Sentence case throughout. No eyebrows.                                                                                    |
| Monospace for data, "→" on buttons               | Tabular figures in Public Sans. Buttons state the result: "Create project", "Save site".                                  |
| Fade-up on every section, hover lifts            | One orchestrated `flyTo` after sign-in. Otherwise motion only answers an action.                                          |
| Unmodified library theme, Inter as the only face | Two families with distinct roles; no component library defaults.                                                          |
| Gradients, glassmorphism, neon on near-black     | Flat surfaces, one accent, light-first.                                                                                   |
| Marketing language                               | Copy names what the user does.                                                                                            |
| **Fake numbers presented as real**               | Every figure is computed from the API. Seeded data is chipped "Sample data".                                              |

### Revised after the first pass

Three things in the earlier interface failed this list and were removed rather than adjusted: a row
of four stat tiles on Projects (two of which were invented constants), a card grid where the spec
asks for a ledger, and a marketing landing page with an eyebrow label and an arrow-suffixed button.
Demo access moved onto the sign-in screen, which the spec already defines, so one-click entry
survived without a screen the spec does not want.

## Deviations from DESIGN.md

Recorded deliberately, with reasons.

1. **Dark mode is retained** (§3.1 asks for light only). Light is the default and the documented
   theme; dark is opt-in. Because no component holds a hex literal, the cost is one override block.
   The map style control stays independent of the theme — satellite tiles have no dark variant, so
   coupling them would break the spec's own default.
2. **Chart.js rather than Highcharts** (§8 prefers Highcharts, allows Chart.js). Highcharts needs a
   commercial licence for non-personal use, which is a needless risk in a work sample. The spec's
   Highcharts theme is mapped option-for-option onto Chart.js.
3. **Stored areas come from PostGIS, not `@turf/area`** (§7). `ST_Area(geography)` is geodesic and
   authoritative, and keeps one source of truth server-side. Turf is used only for the live readout
   while a polygon is still being drawn and has no server-side area yet.
