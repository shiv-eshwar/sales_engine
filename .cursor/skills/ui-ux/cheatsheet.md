# Cheatsheet — Refactoring UI

## Start here

| If | Then | Because |
|---|---|---|
| Blank canvas / "design the app" | Draw one feature's controls | Shell needs features as data |
| High-fidelity too early | Sharpie + grayscale | Detail and color hide weak structure |
| Mock includes unscoped extras | Cut them from v1 | Nice-to-haves freeze shippable cores |
| 12 vs 13px agony | Use the scale; compare neighbors | Unconstrained choice has no wrong answer |
| UI "doesn't look designed" | Rank, don't decorate | Hierarchy ≫ extra styling |
| Feels cramped | Overshoot space, then remove | Adding-to-minimum undershoots |
| Filling 1400px because you can | Size to the job | Width is not a quota |
| Five hexes from a generator | Build shade systems | Real UIs need greys × 8–10 + multi-shade brand |
| Photo + headline fight | Flatten the photo | Dynamic range, not the type hex |
| Feature ships to empty data | Design the empty state first | That is the actual first screen |

## Decision tree: ranking a screen

- Name the one primary thing.
  - Can it get louder (weight/color/z)? Do that **once**.
  - Still lost? **Quiet everything else** (inactive nav, sidebar fill, competing buttons).
- Text roles → dark / grey / lighter grey (**on white only**).
- On a colored fill → same-hue secondary, never grey, never white@opacity.
- Actions → one solid primary, outline secondary, link tertiary.
- Destroy is not primary → quiet control; red only on confirm.

## Decision tree: space and width

- Need a size? Pick a 16px-base token (~25% from its neighbors). Never 1px nudge.
- Grouping by space? Inner gap < outer gap.
- Sidebar / chrome: **fixed**. Main: fluid. Card: `max-width`, shrink only when the viewport is smaller.
- Percentage width only if you *want* it to scale.
- Don't lock padding/type as `em` ratios across breakpoints — large shrinks faster.

## Decision tree: type

```
Need a size? → type ramp (px/rem), not nested em
Paragraphs? → 45–75ch (20–35em); images may be wider
Mixed sizes in a row? → baseline, not center
Leading? → long or small → taller; headlines → ~1
Links in an app chrome? → weight/color; hover-only if ancillary
Numbers in tables? → right-align
All-caps? → more letter-spacing
Justified? → hyphenate or don't justify
```

## Color system (defaults)

| Bucket | Count | 500 means | Ends |
|---|---|---|---|
| Greys | 8–10 | — | 900 body text, 100 off-white; tint warm/cool; no `#000` |
| Primary | 1–2 hues × 5–10 shades | Button-worthy | 100 alert tint, 900 text on tint |
| Accents | Few, still multi-shade | Same | Use sparingly |

- Author in **HSL** (not hex, not HSB).
- Leave 50% L → **raise sat**. Optional hue rotate ≤20–30° toward Y/C/M (lighter) or R/G/B (darker).
- WCAG: 4.5:1 normal, 3:1 large. White-on-brand screams → **flip** to dark-on-tint.
- Meaning: hue **plus** icon/label/lightness.

## Elevation (defaults)

| z job | Shadow |
|---|---|
| Button rest | Tight, sharp, tiny blur |
| Button press / well | Less or inset; light from above |
| Menu | Medium |
| Modal | Largest; **contact shadow gone** |
| Flat brand | Lighter fill, 0-blur offset, overlap + ground-colored gap |

Raised: light **top**. Inset: light **bottom**, shadow inside top. Hand-pick highlights (no translucent white).

## Images and icons

| Asset | Don't | Do |
|---|---|---|
| 16–24px icon | Draw at 4× | Native size in a larger container |
| Screenshot | Shrink 70% | Recapture small breakpoint, crop, or simplify |
| Logo as favicon | Downscale 128→16 | Redraw 16px mark |
| Type on photo | Swap hexes | Overlay / flatten / multiply / glow (no offset) |
| User upload | Intrinsic ratio + border | `cover` crop + inner shadow |

## Finish / smells

| You see | You're probably in |
|---|---|
| Nav designed, no features | Shell-first trap |
| Every action is a solid button | No pyramid |
| `h1` shouting "Settings" | Document size ≠ visual rank |
| Label: value dump | Hierarchy abdicated |
| Grey text on blue | Contrast bug, not a grey |
| Sidebar at 25% | Grid religion |
| Every gap 16px | Ambiguous grouping |
| `font-size: 2.5em` on mobile | Relative sizing myth |
| 35 blues in the CSS | No shade system |
| Red vs green only | Color-only encoding |
| Empty table + dead filters | Empty state last |
| Border on every box | Separator addiction |
| 24px icon at 96px | Intended-size violation |

**Personality lock**: one radius family, one type vibe, one language tone, one palette — then stop mixing.
