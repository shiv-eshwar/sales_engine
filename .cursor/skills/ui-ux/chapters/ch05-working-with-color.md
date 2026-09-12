# Chapter 5: Working with Color

## Core Idea
Design color in HSL, as large shade *systems* (8–10 greys, 5–10 shades per brand/accent, ~9 steps named 100–900), not as five generator hexes. Protect saturation as lightness moves, optionally rotate hue for perceived brightness, and never let hue be the only signal.

## Frameworks Introduced
- **Ditch hex for HSL**: Hex/RGB hide visual kinship. HSL matches perception: **hue** (0° red, 120° green, 240° blue), **saturation** (0% grey … 100% vivid), **lightness** (0% black, 100% white, 50% "pure" at that hue). At 0% saturation, hue is irrelevant.
  - When to use: Building palettes, tinting text on color, any "make this a bit darker."
  - How: Author in `hsl()`. **HSL ≠ HSB**: HSB 100% brightness is white only at 0% sat; at 100% sat it equals HSL 50% lightness. Design tools often show HSB; CSS speaks HSL.

- **You need more colors than you think**: Palette generators that emit five hexes produce toy UIs.
  - When to use: Real product chrome, not a Dribbble shot.
  - How: Three buckets — **greys** (most of the UI: text, surfaces, controls; 8–10 shades; skip true black, start at very dark grey), **primary** (one, maybe two "Facebook is blue" colors; 5–10 shades; ultra-light = alert tint, dark = text), **accents** (sparing: highlight, danger, warning, success; still multiple shades). Graphs/tags/calendars may need more. Complex UIs: ~10 hues × 5–10 shades is normal.

- **Define shades up front (100–900)**: `lighten()`/`darken()` at call time → 35 indistinguishable blues.
  - When to use: Before components, as soon as the brand hue exists.
  - How: Pick **base (500)** as a color that would work on a button. Pick **edges**: 900 ≈ text, 100 ≈ tinted background (an alert component is a good dual test). Fill 700 and 300 as mid-compromises, then 800/600/400/200. Greys: 900 = darkest body text, 100 = subtle off-white. Math gets you started; **trust eyes**, tweak sat/light after real use. Do not keep adding shades or the system dies.

- **Don't let lightness kill saturation**: Near 0% or 100% lightness, the same sat reads washed. Push **saturation up** as you leave 50% lightness. If base is already 100% sat, you cannot.
  - When to use: Light tints and dark shades of a vivid brand color.
  - How: Combine with **perceived brightness**: yellow looks lighter than blue at equal HSL lightness. Perceived brightness has local minima at R/G/B and maxima at Y/C/M. **Rotate hue** toward 60°/180°/300° to lighten, toward 0°/120°/240° to darken — preserves intensity better than only changing L. Cap rotation at **20–30°** or it becomes a different color. Yellow palettes: rotate toward orange as you darken so shades stay warm, not dead brown.

- **Greys don't have to be grey**: True grey is 0% sat, but usable "greys" are often strongly tinted. **Cool** = blue sat; **warm** = yellow/orange sat. Raise sat on the lightest and darkest greys too, or those ends look washed vs mid greys.

- **Accessible doesn't have to mean ugly**: WCAG: **≥4.5:1** normal text (under ~18px), **≥3:1** large text.
  - When to use: Colored buttons, badges, secondary text on tinted panels.
  - How: White-on-brand often forces a *very* dark fill — that fill then hijacks hierarchy. **Flip the contrast**: dark-colored text on a light tint. Colored-on-colored: lightness/sat alone races to white; **rotate toward a brighter hue** (cyan/magenta/yellow) to keep color while gaining contrast.

- **Don't rely on color alone**: Color-blind users (esp. red–green) miss hue-only meaning.
  - When to use: Up/down metrics, charts, status, required fields.
  - How: Add a second channel — icons, labels, position. On graphs, prefer **light vs dark** of related tones over a rainbow of hues. Color supports a message already in the design; it is never the only message.

## Key Concepts
- **HSL triad**: Hue / saturation / lightness as independent knobs.
- **Shade scale 100–900**: Nine named steps; 500 = button-worthy base.
- **Greys / primary / accents**: The three palette roles.
- **Saturation compensation**: More sat as L leaves 50%.
- **Hue rotation for brightness**: Steal perceived luminance from a neighboring hue.
- **Grey temperature**: Cool blue vs warm yellow in "neutral" surfaces.
- **Contrast flip**: Dark-on-tint instead of white-on-dark-brand.
- **Dual encoding**: Color + shape/contrast/label.

## Mental Models
- Use **HSL** when two colors "look related" but their hexes look random.
- Think of a **product palette as ~80 tokens**, not 5.
- Use **500 / edges / fill gaps** instead of `darken($brand, 12%)` in a component.
- Think of **hue rotation** as a brightness tool that does not spend saturation.
- Use **flip contrast** when an accessible colored button is visually screaming.

## Anti-patterns
- **Five-hex generator as the design system**.
- **True `#000` and three greys** for a whole app.
- **On-the-fly lighten/darken** producing a fog of near-duplicates.
- **Constant saturation across a shade ramp** → chalky tints, muddy darks.
- **Hue rotation >30°** "to darken yellow" → you designed orange and called it yellow.
- **0% sat greys** that feel dead, or inconsistent temperature at the ends of the grey ramp.
- **White text on a mid brand fill** that fails WCAG, then darkening the fill until it dominates the page.
- **Red vs green deltas with no icon**; **rainbow chart lines of similar lightness**.

## Code Examples
```css
:root {
  /* Primary: base ≈ 500, edges 100/900, gaps filled by eye */
  --blue-100: hsl(221 90% 96%);
  --blue-300: hsl(221 85% 78%);
  --blue-500: hsl(221 83% 53%); /* button-worthy */
  --blue-700: hsl(221 75% 38%);
  --blue-900: hsl(221 70% 22%); /* text on tint */

  /* Cool greys: sat rises at the ends so they do not wash out */
  --gray-100: hsl(220 16% 96%);
  --gray-500: hsl(220 10% 46%);
  --gray-900: hsl(220 18% 12%);
}

/* Flip contrast: accessible without a shouting fill */
.alert-danger {
  background: hsl(0 86% 96%);
  color: hsl(0 70% 32%);
  border-left: 4px solid hsl(0 72% 50%);
}

/* Yellow darkening via hue rotation toward orange (≤30°) */
--yellow-500: hsl(48 96% 53%);
--yellow-800: hsl(32 90% 38%); /* ~16° toward orange, not brown */

.metric-up { color: hsl(142 60% 32%); }
.metric-up::before { content: "▲"; } /* dual encode */
```

- **What it demonstrates**: Named shade scales, temperature in greys, flipped alert, hue-rotated yellow, icon+color for status.

## Reference Tables
| Need | Count | Notes |
|---|---|---|
| Greys | 8–10 | No true black; 900 = body text, 100 = off-white |
| Primary hues | 1–2 | 5–10 shades each |
| Accents | Few + extras for categories | Still multi-shade; use sparingly |
| Steps per hue | ≥5, often ~9 | 100…900; fill mids after edges |

| Brightness trick | Do | Cap |
|---|---|---|
| Lighten via hue | Rotate toward 60° / 180° / 300° | 20–30° |
| Darken via hue | Rotate toward 0° / 120° / 240° | 20–30° |
| Lighten via L only | Works, often chalky | Pair with more sat |
| WCAG normal text | ≥4.5:1 | Flip to dark-on-tint if fill would dominate |
| WCAG large text | ≥3:1 | Still dual-encode meaning |

| HSL vs HSB | 0 | 100% at full sat |
|---|---|---|
| HSL lightness | Black | White (pure color is ~50%) |
| HSB brightness | Black | Pure color (white needs sat 0) |

## Worked Example
**Building a blue primary.** 500 = a button you would actually ship (`hsl(221 83% 53%)`). 900 = text on a 100 tinted alert. 100 = that alert background. 700/300 = "the obvious in-between." Then the remaining four. After first screens, 300 was chalky → raise sat, not "add 350."

**Accessible "new" badge.** White on saturated pink fails 4.5:1 unless pink is almost maroon — then the badge outweighs the page title. Flip: maroon text on pink-100. Color still means "new"; hierarchy stays intact.

**Revenue cards.** Green/red numbers only: red–green blindness loses the story. Add ▲/▼ (or "up/down" copy). Chart series: one hue, stepped lightness, not seven hues at similar L.

## Key Takeaways
1. Author in HSL; do not confuse it with HSB from design apps.
2. Ship a large shade system (greys + primary + accents), defined up front, ~100–900.
3. Compensate saturation as lightness leaves 50%; rotate hue slightly for perceived brightness.
4. Tint greys for temperature; keep that temperature at the ramp ends.
5. Meet contrast by flipping or rotating — and always encode meaning twice.

## Connects To
- **Ch 1**: Color is a personality lever; this chapter is the system behind it.
- **Ch 2**: Hand-picked same-hue secondary text is this chapter's HSL workflow.
- **Ch 6**: Light/dark as depth, not only as palette.
- **WCAG 1.4.1 / 1.4.3**: Color not the only cue; contrast minimums.
