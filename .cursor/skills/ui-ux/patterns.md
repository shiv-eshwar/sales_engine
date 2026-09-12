# Patterns — Refactoring UI

## Feature-First Canvas
**When to use**: New product or flow; argument about nav has started before any screen exists.
**How**: Pick one job. List only its controls. Draw those. Defer shell.
**Trade-offs**: Early screens may look "unfinished" (no nav). That is information, not a bug.

## Grayscale Then Color
**When to use**: High-fidelity tools tempt polish too early.
**How**: Structure in grey so space, size, and contrast must work. Color last.
**Trade-offs**: Stakeholders may ask for "the real colors." Show hierarchy first.

## Cycle: Mock → Real → Next
**When to use**: Edge cases you cannot honestly invent (overflow, empty, collisions).
**How**: Smallest useful design, implement, fix in the running UI, then the next feature.
**Trade-offs**: Incomplete vision docs. Faster truth.

## Pessimist v1
**When to use**: Nice-to-haves (attachments, filters) threaten the core.
**How**: Omit optional work from the mock and the sprint. Add in a later cycle.
**Trade-offs**: You ship a thinner story; you ship.

## Constrained Scales + Elimination
**When to use**: Any numeric choice (type, space, radius, shadow, icon size).
**How**: Predefine noticeably different tokens. Guess mid, compare neighbors.
**Trade-offs**: Occasional "between sizes" feeling. Add a token rarely, not per component.

## Hierarchy via Weight and Color
**When to use**: Size-only type looks cartoonish or unreadable.
**How**: Two–three text colors, two UI weights; keep sizes reasonable.
**Trade-offs**: Needs a real grey/primary scale (Ch 5), not `#999` on a colored panel.

## Same-Hue Secondary on Color
**When to use**: Meta text on brand fills, photos, patterns.
**How**: Match hue; retune S/L. Never grey and never white-at-opacity.
**Trade-offs**: Hand-picking per fill; automate later as tokens, not as `opacity: .6`.

## De-emphasize the Crowd
**When to use**: Active item or main column still does not win.
**How**: Quiet siblings (weight/color) or drop competing backgrounds.
**Trade-offs**: Inactive items get less "affordance loudness"; hierarchy > equal chrome.

## Labels Last
**When to use**: Entity summaries, not form a11y.
**How**: Drop if format/context suffices; else combine; else small label.
**Trade-offs**: Screen readers may still need names — hide visually, keep semantically when needed.

## Action Pyramid
**When to use**: ≥2 actions on a page.
**How**: One solid primary; outline secondary; link tertiary. Danger styling on the confirm surface.
**Trade-offs**: Product may want every action "important." Rank anyway.

## Too-Much-Then-Remove Space
**When to use**: Cramped UI; timid +4px loops.
**How**: Jump up the spacing scale, then step down until the *page* (not the isolated widget) is right. Density by decision, not default.
**Trade-offs**: Early overshoot looks "too airy" in component isolation.

## Fixed vs Fluid Layout
**When to use**: Sidebars, auth cards, anything assigned N/12 columns by habit.
**How**: Fixed width for content-sized pieces; `max-width` + 100% for cards; fluid only when scaling is desired.
**Trade-offs**: Breaks "everything on the grid" purity; prevents fat rails and inverted breakpoints.

## Independent Component Scaling
**When to use**: Buttons, type, padding copied as `em` ratios across breakpoints.
**How**: Retune properties separately. Large elements shrink faster than small ones.
**Trade-offs**: More breakpoint CSS; less "zoom" distortion.

## Inner < Outer Gap
**When to use**: Forms, headings, lists, horizontal clusters.
**How**: Gap inside a group < gap between groups.
**Trade-offs**: "Inconsistent" spacing that is actually grouping.

## Hand-Crafted Type Ramp in rem/px
**When to use**: UI (not only long-form).
**How**: Integers, denser 12–20px, skip modular-ratio fractions, never nest `em` for the ramp.
**Trade-offs**: Less mathematical romance; more usable sizes.

## Measure-First Paragraphs
**When to use**: Body copy beside wide media.
**How**: 45–75ch / 20–35em for `p`; let images stay wide.
**Trade-offs**: Two widths in one column — looks intentional if spacing is clean.

## HSL Shade Systems (100–900)
**When to use**: Any product past a five-hex moodboard.
**How**: Greys 8–10, primary 5–10 shades, accents multi-shade. Base 500 = button. Edges from an alert. Fill mids. Compensate sat; optional hue rotate ≤30°.
**Trade-offs**: Up-front palette work; kills on-the-fly `lighten()`.

## Contrast Flip + Dual Encode
**When to use**: Colored buttons/badges, status, charts.
**How**: Dark-on-tint for WCAG without shouting fills; icons/labels/lightness with hue.
**Trade-offs**: Less "neon CTA"; more page-level hierarchy.

## Light-from-Above Elevation
**When to use**: Raised buttons, inset inputs, layered surfaces.
**How**: Lit lip toward sky; ~5 shadow tokens; dual cast+contact; press/drag change z; flat UIs use value, hard offset, overlap.
**Trade-offs**: Photoreal is out of scope; consistency beats fidelity.

## Image Contrast and Native Size
**When to use**: Heroes, icon grids, screenshots, favicons, user media.
**How**: Overlay/flatten/colorize/glow for type; don't upscale 24px icons or downscale screenshots/logos — container, recapture, crop, or redraw. User media: `cover` + inner edge.
**Trade-offs**: More art direction; fewer "sharp but chunky" SVGs.

## Supercharge and Subtract Borders
**When to use**: Almost-done UIs that still look like wireframes.
**How**: Brand on bullets/quotes/checks; accent bars; quiet grounds; empty-state as v1; shadow/fill/space instead of gridlines; redesign high-value dropdowns/tables/radios.
**Trade-offs**: Less "standard control" familiarity when you replace radios with cards — worth it when that control *is* the page.

## Blind Study Loop
**When to use**: After the systems exist but polish still feels mysterious.
**How**: Note one decision you wouldn't have made; rebuild favorites without DevTools.
**Trade-offs**: Slow. Compounds.
