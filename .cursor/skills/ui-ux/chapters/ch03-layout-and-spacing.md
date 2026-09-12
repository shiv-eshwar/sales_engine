# Chapter 3: Layout and Spacing

## Core Idea
Start with too much space and a non-linear size scale (~25% jumps from a 16px base). Give each element the width it needs — grids, percentages, and proportional `em` scaling are optional tools, not religion.

## Frameworks Introduced
- **White space should be removed, not added**: Adding padding until "not actively bad" undershoots. Start with clearly too much space, then pull back until it feels right in the *whole* UI (not the isolated component).
  - When to use: Cramped cards, forms, marketing sections, anything that "needs polish."
  - How: Overshoot margin/padding from the scale, then step down one token at a time. Dense UIs (data dashboards) are a deliberate exception — choose density on purpose.
  - Why it works / failure mode: Isolated "a bit much" is often "just enough" in context. Failure mode: default-tight CSS, then timid +4px forever.

- **Spacing and sizing system (~25% rule)**: Linear "multiples of 4px" still leaves 120 vs 125 as a live debate. Adjacent tokens must differ by about **25%** so the next step is an obvious yes/no.
  - When to use: Any width, height, gap, padding, margin.
  - How: Base **16px** (divides cleanly; browser default font). Pack values tightly at the small end (icons, button padding); spread them at the large end (card width, hero gaps). Build from factors and multiples of 16, not arbitrary pixels.
  - Why it works / failure mode: 12→16 is +33% (visible); 500→520 is +4% (invisible). Same 4px rule cannot serve both.

- **You don't have to fill the whole screen**: 1200–1400px of canvas is not a quota. If 600px is right, use 600px. Full-width nav does not obligate full-width body.
  - When to use: Forms, article columns, settings, empty states, any "why does this feel stretched?"
  - How: Size to content. Add columns for supporting copy rather than widening a form. Shrink the artboard (~400px) and design mobile first if a large canvas keeps inflating things.

- **Grids are overrated**: A 12-column grid constrains *percentage* widths. Many things need **fixed** widths.
  - When to use: Tempted to put a sidebar, login card, or icon at N/12 columns.
  - How: Sidebar: fixed width optimized for its content; main pane flexes and may use an internal grid. Login card: `max-width` at the optimal size (e.g. ~500px); shrink only when the viewport is smaller than that — never because a column recipe says 50% then 66%.
  - Don't shrink until you need to: Fluid columns can make a card *wider* on a medium breakpoint than on large. That is the grid owning you.

- **Relative sizing doesn't scale**: `h1 { font-size: 2.5em }` is not a responsive strategy. Large things must shrink *faster* than already-small things; small screens need less extreme size range.
  - When to use: Type locked to body `em`; button padding locked to font-size; "everything -25% on mobile."
  - How: Tune properties independently per breakpoint. Small buttons: disproportionately tight padding. Large buttons: disproportionately generous padding. Not a zoom.

- **Avoid ambiguous spacing**: Grouping by space requires **more space around the group than inside it**.
  - When to use: Stacked label+input, heading above a section, lists, horizontal clusters.
  - How: If label-to-field gap equals field-to-next-label gap, the form is ungrouped. Increase between-group gap. Same for headings (space *above* more than below) and bullets (item gap ≠ line-height).

## Key Concepts
- **Remove-don't-add whitespace**: Overshoot, then subtract.
- **~25% adjacent jump**: The usefulness test for a spacing token.
- **16px base scale**: Factors/multiples of 16, denser at the small end.
- **Content-sized layout**: Width follows the job, not the monitor.
- **Fixed vs fluid**: Percentages only when you *want* the thing to scale.
- **max-width then wrap**: Optimal size until the viewport forces a shrink.
- **Independent scaling**: Properties of one component need not stay in proportion.
- **Proximity grouping**: Inner gap < outer gap, or the group dissolves.

## Mental Models
- Use **too-much-then-remove** whenever a UI feels "a bit tight" but you cannot say why.
- Think of the **spacing scale as a menu**, not a ruler: pick, then pick the neighbor, never 1px nudges.
- Use **fixed sidebar + fluid main** when a 25%/75% grid makes the rail too fat or too thin.
- Think of **ambiguous spacing** as a parsing bug: the eye cannot tell what belongs together.

## Anti-patterns
- **Add space until not ugly**: Systematic undershoot.
- **Linear 4px grid as the whole system**: 120 vs 125 remains a coin flip.
- **Fill the breakpoint**: Stretched forms, huge empty interiors, matching full-width because the header is full-width.
- **Sidebar on the 12-col grid**: Rail grows/shrinks with the window, starving or crushing content.
- **Card width = N columns per breakpoint**: Medium can exceed large; ignore `max-width`.
- **em-locked proportions**: Desktop 2.5× headline becomes a mobile billboard when body shrinks.
- **Equal gaps everywhere**: Labels detach from their fields; headings collide with previous sections.

## Code Examples
```css
/* Reconstructed 16px-base scale: ~25%+ jumps, tight at the small end */
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --space-10: 128px;
}

/* Form: inner gap < group gap */
.field { display: flex; flex-direction: column; gap: var(--space-2); }
.form { display: flex; flex-direction: column; gap: var(--space-6); }

/* Sidebar: fixed rail, fluid main — not 3/12 + 9/12 */
.shell { display: flex; }
.rail { width: 240px; flex: none; }
.main { flex: 1; min-width: 0; }

/* Login: optimal width until the viewport is smaller */
.card { width: 100%; max-width: 500px; }

/* Button padding tuned independently of font-size (not 1em zoom) */
.btn-sm { font-size: 12px; padding: 6px 10px; }
.btn-md { font-size: 14px; padding: 8px 14px; }
.btn-lg { font-size: 16px; padding: 12px 20px; }
```

- **What it demonstrates**: Tokens instead of 1px fights; grouping by gap; fixed vs fluid; `max-width`; non-proportional component sizes.

## Reference Tables
| Problem | Default instinct | Author's move |
|---|---|---|
| Tight UI | Add a little padding | Start with too much, remove |
| Dashboard density | Same airy spacing | Compact *on purpose* |
| Wide monitor | Fill 1200px+ | Use the width the content needs |
| Hard to design small | Work on a huge artboard | Shrink canvas (~400px), mobile first |
| Narrow form on wide page | Stretch fields | Column: help text \| form |
| Sidebar | 25% / 75% grid | Fixed rail, fluid main |
| Login card | 6/12 then 8/12 | `max-width`; shrink only when forced |
| Grouped fields with equal gaps | "Consistent spacing" | More space *between* groups than *inside* |

| Scale zone | Typical jobs | Jump size |
|---|---|---|
| Small (4–16px) | Icon, hairline gap, button padding | A few px = huge % |
| Mid (16–48px) | Stack gaps, control height | ~25–50% |
| Large (64px+) | Section padding, card width | Tens of px still subtle |

## Worked Example
**Stacked form.** Label, input, label, input, all `margin-bottom: 12px`. The eye cannot tell pairing. Change to `gap: 8px` inside `.field` and `gap: 32px` between fields. Same components, suddenly a form instead of a list.

**Settings on a 1440px desktop.** Instinct: full-width inputs. Better: ~32rem column, leftover as margin. If the page also has explanatory copy, two columns — copy beside the form — rather than 800px-wide text fields.

**12-col login.** Large: 6 columns centered. Medium: 8 columns "because it looked skinny." At some widths the medium card is *wider* than the large card. Replace with `max-width: 500px; width: 100%`.

## Key Takeaways
1. Overshoot whitespace, then remove; density is a choice, not a default.
2. Build a 16px-based scale whose neighbors differ by ~25%; stop 1px tweaking.
3. Width follows content, not canvas or sibling chrome.
4. Use grids for things that should be fluid; fix the rest; `max-width` beats column recipes.
5. Do not lock sizes in `em` proportions; group with inner < outer gaps.

## Connects To
- **Ch 1**: This is "limit your choices" applied to space.
- **Ch 4**: Type scale uses the same non-linear, hand-crafted logic; avoid `em` for the same reason.
- **Proximity (Gestalt)**: Ambiguous spacing is failed grouping.
