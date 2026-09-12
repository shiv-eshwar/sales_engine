# Chapter 4: Designing Text

## Core Idea
Hand-craft a type scale in `px`/`rem` (not `em`), then tune line length, baseline alignment, line-height, links, alignment, and letter-spacing as separate decisions — not as a single "font size" knob.

## Frameworks Introduced
- **Establish a type scale (hand-crafted, not modular)**: Unlimited sizes produce every pixel from 10–24 in the same product.
  - When to use: Any UI without a locked type ramp.
  - How: Linear ramps fail (46 vs 48 is noise). **Modular scales** (4:5, 2:3, golden ratio) look pure but yield fractional pixels and too-few UI sizes (rounded 3:4 → 12/16/21/28 — you will want 14 and 18). **Hand-pick** integers that densify at the small end and align with the spacing scale. Round yourself if you ever use a ratio.
  - Why it works / failure mode: UI needs more mid-small sizes than article type. Failure mode: outsourcing the ramp to a ratio, then fighting it.

- **Avoid `em` for the scale**: Nested `em` computes values *not on the scale*.
  - When to use: Always, when defining the ramp.
  - How: `px` or `rem` only. Example: parent `1.25em` (20px) × child `.875em` = **17.5px**, a ghost size.

- **Use good fonts (heuristics, not a degree)**: Taste takes years; filters are immediate.
  - When to use: Picking a UI family under time pressure.
  - How: Neutral sans is the safe UI default. Distrust taste → **system stack**. Prefer families with **≥5 weights** (Google Fonts: filter 10+ styles to include italics — ~85% of library drops). Match purpose: UI/small → taller x-height, wider tracking; headlines → tighter, shorter x-height. Skip condensed/short-x-height for body UI. Sort by popularity; inspect sites whose type you respect.

- **Line length 45–75 characters**: Fit the column to reading, not the layout to the grid.
  - When to use: Paragraphs, help text, docs, marketing body.
  - How: `width: 20–35em` is the practical CSS band. Wider content (images) can span more; **paragraphs stay narrow**. >75 is risky.

- **Baseline, not center**: Mixed sizes on one row align on the **baseline**, not the box center.
  - When to use: Large title + small actions on a card header; any adjacent different point sizes.
  - How: Center looks OK with lots of gap; close together, staggered baselines look sloppy. Align to the line letters sit on.

- **Line-height is proportional (two axes)**: "1.5 everywhere" is a starting rumor, not a rule.
  - When to use: Body vs headlines; narrow vs wide columns.
  - How: Longer lines need taller line-height (up to ~2) so the eye can find the next row. Larger type needs *less* extra leading; headlines can sit at `1`. **Line-height ∝ line length, ∝ 1/font-size**.

- **Not every link needs a color**: In-paragraph links must pop; in an app where most things are clickable, "link blue" is an alarm on every row.
  - When to use: Nav, tables, list rows, ancillary actions.
  - How: Weight or darker color for most. Truly ancillary: underline/color **on hover only**.

- **Align with readability**: Match the language direction (English → left).
  - When to use: Headlines vs paragraphs vs numeric tables vs justified magazine look.
  - How: Don't center >2–3 lines (rewrite shorter if you want a centered block). **Right-align numbers** in tables so decimals line up. Justified text **must hyphenate** or word gaps appear.

- **Letter-spacing is a scalpel**: Trust the designer; two exceptions.
  - When to use: Body-font used as a headline; all-caps labels.
  - How: Tighten tracking on wide-spaced UI fonts used as titles (mimic a display face). Never the reverse — display faces stay bad at small size even with extra tracking. **Increase** tracking on all-caps (uniform letter height → fewer shape cues).

## Key Concepts
- **Type scale**: Discrete, integer sizes; denser at the small end.
- **`rem`/`px` vs `em`**: Absolute-to-root vs compounding current size.
- **System font stack**: OS UI faces; safe, familiar, unambitious.
- **x-height / purpose**: Body faces vs display faces are different tools.
- **Measure (line length)**: 45–75 characters.
- **Baseline alignment**: Shared sitting line for mixed sizes.
- **Proportional leading**: Width up, leading up; size up, leading down.
- **Hover-only affordance**: For low-priority links in click-dense UIs.

## Mental Models
- Use a **hand-crafted ramp** when a modular scale leaves you "between sizes."
- Think of **`em` nesting** as silently leaving the system.
- Use **45–75** when a layout grid is stretching paragraphs into a ruler.
- Think of **leading** as a function of jump distance (width) and already-visible size.

## Anti-patterns
- **Every pixel 10–24 in production**: No scale, slow and inconsistent.
- **Modular-scale piety**: Fractions and missing UI sizes.
- **Nested `em` type**: Off-ramp computed sizes.
- **Condensed short-x-height for UI body**: Pretty at 48px, muddy at 14px.
- **Paragraphs as wide as the images**: Unreadable measure.
- **Vertically centering mixed type**: Dual baselines.
- **`line-height: 1.5` on 48px headlines and 72-char lines alike**.
- **Chrome-blue every `<a>`** in an application.
- **Centered paragraphs**; **left-aligned money columns**; **justified without hyphens**.
- **Opening tracking on a display face to "make it work" at 12px**.

## Code Examples
```css
:root {
  /* Hand-crafted UI ramp (reconstructed from "denser at the small end") */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
}

body {
  font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans",
    Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
}

.prose p { max-width: 28em; }          /* 20–35em → ~45–75ch */
.prose p { line-height: 1.6; }         /* mid measure */
.prose--wide p { line-height: 1.8; }   /* long measure */
.headline { font-size: var(--text-3xl); line-height: 1.1; }

.card-header { display: flex; align-items: baseline; } /* not center */

a.app-link { color: inherit; font-weight: 600; text-decoration: none; }
a.quiet:hover { text-decoration: underline; }

td.numeric { text-align: right; font-variant-numeric: tabular-nums; }
.justified { text-align: justify; hyphens: auto; }
.kicker { text-transform: uppercase; letter-spacing: 0.08em; }
```

- **What it demonstrates**: Integer ramp, system stack from the book, measure in `em`, baseline row, quiet links, numeric alignment, hyphenated justify, caps tracking.

## Reference Tables
| Job | Prefer | Avoid |
|---|---|---|
| UI body | Neutral sans, ≥5 weights, tall x-height | Condensed display faces |
| Unknown taste | System stack | Random Google Font at 2 weights |
| Scale units | `px` / `rem` | Nested `em` |
| Paragraph width | 45–75ch / 20–35em | Full-bleed body copy |
| Mixed sizes on one line | `align-items: baseline` | Vertical center |
| Small / long text | Taller line-height | 1.2 on a wide column of 14px |
| Headlines | `line-height` near 1 | 1.5 creating holes |
| App links | Weight/color; hover for ancillary | Always saturated underline |
| Numbers in tables | Right + tabular | Left-aligned 10 / 1000 / 9.99 |
| Justify | + `hyphens: auto` | Justify alone |
| All-caps | Extra letter-spacing | Default tracking |

## Worked Example
**Card header.** Left: 20px title. Right: 13px "Edit · Share". `align-items: center` puts the small text optically high. `align-items: baseline` sits both on one line; the row looks like one sentence of mixed emphasis.

**Docs page with screenshots.** Images need ~720px. Paragraphs at 720px run ~100 characters. Keep images wide; wrap `p` at `28em`. Two widths in one column looks more polished, not broken.

**Nav + in-article links.** Article: color + underline so links in sentences are findable. App sidebar: nearly everything is a link — inherit color, `font-weight: 600` for current, underline on hover for "Docs" footer. Same `<a>`, two hierarchy jobs.

## Key Takeaways
1. Hand-build an integer type scale; do not live on a musical ratio or a 1px continuum.
2. Define sizes in `px`/`rem` so nesting cannot invent off-scale values.
3. 45–75 characters; paragraphs can be narrower than sibling media.
4. Baseline-align mixed sizes; set leading from measure and point size.
5. Treat links, alignment, and tracking as hierarchy/readability tools, not defaults.

## Connects To
- **Ch 1**: Font family is a personality lever; this chapter operationalizes it.
- **Ch 2**: Weight/color hierarchy continues here as ramps and link treatment.
- **Ch 3**: Same ~25% / hand-crafted philosophy as spacing; `em` traps rhyme.
- **Ch 5**: Color of text vs background; don't use hue as the only link cue.
