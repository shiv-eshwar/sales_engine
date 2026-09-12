---
name: ui-ux
description: "Knowledge base from \"Refactoring UI\" by Adam Wathan and Steve Schoger. Use when applying their UI systems for visual hierarchy, spacing scales, type ramps, HSL palettes, elevation, images, empty states, or referencing chapters while designing or reviewing interfaces."
---

<!-- argument-hint: [topic, framework name, or chapter number] -->

# Refactoring UI
**Author**: Adam Wathan & Steve Schoger | **Pages**: ~218 | **Chapters**: 9 | **Generated**: 2026-09-12

## How to Use This Skill

- **Without arguments** — load core frameworks for reference
- **With a topic** — ask about `hierarchy`, `spacing scale`, `HSL`, `elevation`, or another indexed topic; I find and read the relevant chapter
- **With chapter** — ask for `ch05`; I load that specific chapter
- **Browse** — ask "what chapters do you have?" to see the full index

When you ask about a topic not covered in Core Frameworks below, I will read
the relevant chapter file before answering.

---

## Core Frameworks & Mental Models

### Start with a feature, not a layout (Ch 1)
Use **feature-first** when the blank file is tempting you to pick top-nav vs sidebar. An app is features; chrome is a guess until a few real jobs exist. Draw the controls for one job (flight search: two cities, two dates, a button). Google-shaped UI is a legal v1. **Work in cycles**: simple design → working software → next feature. Imagination is a bad engine for 2000-row, error, and collision states. **Be a pessimist**: if attachments are optional, omit them from the comment mock — a comments system that ships beats one frozen on uploads.

### Personality is four levers, then freeze (Ch 1)
Font (serif/classic, rounded/playful, neutral sans), color (blue is safe; gold reads expensive; pink reads unserious), radius (`0` formal, small neutral, large playful — **do not mix**), language (official vs casual). Steal category tone from sites your audience already uses; do not clone a competitor.

### Limit choices: systems + elimination (Ch 1, 3, 4, 5, 6)
Infinite pickers make 12 vs 13px torture. Predefine type, space, color shades, shadows, radius, opacity. **Process of elimination**: guess a token, try both neighbors, keep the only non-wrong one. Introduce a scale the second time a decision repeats.

### Hierarchy is everything (Ch 2)
"Looks designed" is ranking, not decoration. Size-only hierarchy → giant titles and unreadable meta. Prefer **weight** (400/500 body, 600/700 punch; no <400 at UI size) and **color** (dark / grey / lighter grey **on white**). **Grey on a colored fill is wrong** — grey-on-white works because of reduced contrast; on brand, hand-pick the **same hue**, lower contrast. Never white@opacity (washed, disabled, see-through on photos). If the hero cannot get louder, **quiet the siblings** (inactive nav, drop sidebar fill). **Labels are a last resort** for displayed data (not form a11y): drop when format/context is enough; else combine ("12 left in stock"); else small supporting labels; invert only on spec sheets where users hunt the *word*. Semantic `h1` is not a size. Icons are heavy — lower their contrast. **Action pyramid**: one solid primary, outline secondary, link tertiary. Destructive red lives on the **confirm** surface unless destroy is already the page primary.

### Space: overshoot, then a 16px scale (Ch 3)
Adding padding until "not ugly" undershoots. Start with too much, remove until the *page* is right. Dense dashboards are an explicit exception. **~25% between adjacent tokens** from a **16px** base (tight at the small end). Width follows the job: 600px is legal on a 1400px display; full-width nav does not obligate full-width forms. Shrink the canvas (~400px) if a large artboard inflates everything. **Grids are optional**: sidebars want **fixed** width; login cards want `max-width` and should shrink only when the viewport is smaller — column recipes can make a medium card *wider* than a large one. **Relative sizing doesn't scale**: `2.5em` headlines and `padding: 1em` buttons are zooms, not responsive design; large things shrink faster; small buttons get *disproportionately* tight padding. **Ambiguous spacing**: inner gap < outer gap or the form/list does not group.

### Type: hand-crafted ramp, measure, baseline (Ch 4)
Modular/musical scales yield fractions and missing UI sizes. Hand-pick integers in **`px`/`rem`**. Nested `em` leaves the scale (1.25 × 0.875 = 17.5px). Safe UI face: neutral sans, **≥5 weights** (Google Fonts 10+ styles). Distrust taste → system stack: `-apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue`. Body faces need taller x-height; don't put condensed display faces in UI chrome. **45–75 characters** (`20–35em`); paragraphs may be narrower than sibling images. Mixed sizes on one row → **baseline**, not center. Leading ∝ measure, ∝ 1/size (headlines ~1; long 14px up toward 2). In apps, not every `<a>` is link-blue — weight/color; hover-only for ancillary. Don't center >2–3 lines. Right-align numbers. Justify only with hyphenation. Tracking: trust the face; tighten UI fonts used as titles; **open up all-caps**.

### Color: HSL systems, not five hexes (Ch 5)
Hex hides kinship. **HSL** (not HSB: 100% B at full sat = HSL 50% L). Real palettes: **8–10 greys** (no true black), **1–2 primaries × 5–10 shades**, accents still multi-shade. Define **100–900 up front** (500 = button-worthy; 100/900 from an alert; fill 700/300 then the rest). Ban on-the-fly `lighten()`. As L leaves 50%, **raise sat**. Optional **hue rotate ≤20–30°** toward Y/C/M to lighten, R/G/B to darken (yellow darkens toward orange, not brown). Greys can be **cool (blue) or warm (yellow)**; keep sat at the ends. WCAG **4.5:1 / 3:1**: white-on-brand often forces a screaming fill → **flip** to dark-on-tint. Colored-on-colored: rotate toward a brighter hue before racing to white. **Never hue-only meaning** (▲/▼, labels, light vs dark series).

### Depth: light from above + ~5 elevations (Ch 6)
Raised: light **top**, sharp little shadow below. Inset: light **bottom** lip, dark inset at top. Hand-pick highlights — translucent white desaturates. Blur ≈ distance to the user: button small, dropdown medium, modal large. **~5 tokens**. Press = drop elevation; drag = raise. Nice shadows are **two**: big soft cast + tight contact; **kill contact as z grows**. Flat UIs still layer: lighter than ground = closer; 0-blur Y offset; overlap a background seam; overlapping photos need a **ground-colored gap**.

### Images: intended size and hostile uploads (Ch 7)
Placeholders lie — use real good photos (hire or high-grade stock). Type-on-photo fails because of dynamic range: overlay, flatten+brightness, colorize via multiply, or **glow** text-shadow (large blur, no offset). Don't upscale 16–24px icons (chunky) — grow a **container**. Don't downscale screenshots (16px → 4px type) — recapture, crop, or simplify. Don't downscale logos to favicons — **redraw** 16px. User media: fixed box + `cover`; inner shadow (not a fighting border) against bleed.

### Finish: amplify, accent, empty, subtract (Ch 8)
Supercharge bullets (icons), quotes (big/colored), checkboxes (brand selected). Accent **bars** are legitimate personality. Backgrounds: fill, gradient hues ≤~30°, quiet pattern, one low-contrast shape. **Empty state is v1** of user-generated features (illustration + CTA; hide dead filters). Separators: shadow, two fills, extra space — **borders last**. Dropdowns/tables/radios are jobs, not clip-art: columns, merged cells, selectable cards.

### Level up (Ch 9)
Ask of every admired UI: "What would I never have done?" Rebuild favorites **without DevTools**; the gap is the lesson (heading leading, caps tracking, dual shadows).

---

## Chapter Index

| # | Title | Key Frameworks |
|---|-------|----------------|
| [ch01](chapters/ch01-starting-from-scratch.md) | Starting from Scratch | Feature-first, cycles, pessimist v1, personality levers, systems + elimination |
| [ch02](chapters/ch02-hierarchy-is-everything.md) | Hierarchy is Everything | Weight/color over size, same-hue secondary, de-emphasize, labels last, action pyramid |
| [ch03](chapters/ch03-layout-and-spacing.md) | Layout and Spacing | Too-much-then-remove, 16px/~25% scale, fixed vs fluid, inner < outer gap |
| [ch04](chapters/ch04-designing-text.md) | Designing Text | Hand-crafted ramp, rem/px, 45–75ch, baseline, proportional leading |
| [ch05](chapters/ch05-working-with-color.md) | Working with Color | HSL, 100–900 shades, sat compensation, hue rotation, contrast flip, dual encode |
| [ch06](chapters/ch06-creating-depth.md) | Creating Depth | Light from above, elevation tokens, dual shadow, flat depth |
| [ch07](chapters/ch07-working-with-images.md) | Working with Images | Contrast equalizers, intended size, cover crop, anti-bleed |
| [ch08](chapters/ch08-finishing-touches.md) | Finishing Touches | Supercharge defaults, accent borders, empty states, fewer borders |
| [ch09](chapters/ch09-leveling-up.md) | Leveling Up | Unintuitive decisions, blind rebuilds |

## Topic Index

- **Accent borders** → ch08
- **Accessibility / WCAG contrast** → ch05
- **Action pyramid / buttons** → ch02
- **Alignment (text, numbers, justify)** → ch04
- **Ambiguous spacing / proximity** → ch03
- **Baseline vs center** → ch04
- **Blind rebuild** → ch09
- **Border radius / personality** → ch01, ch08
- **Borders (use fewer)** → ch08
- **Color palette / HSL / shades** → ch05
- **Cover crop / user uploads** → ch07
- **Destructive actions** → ch02
- **Document vs visual headings** → ch02
- **Dual shadows / elevation** → ch06
- **Empty states** → ch08
- **Feature-first / shell** → ch01
- **Favicons / intended size** → ch07
- **Fonts / system stack / x-height** → ch01, ch04
- **Grayscale first** → ch01
- **Grids vs fixed width** → ch03
- **Hierarchy** → ch02
- **Hue rotation / saturation** → ch05
- **Icons (scale, weight)** → ch02, ch07
- **Labels** → ch02
- **Letter-spacing / all-caps** → ch04
- **Line-height / line length** → ch04
- **Links (not every one is blue)** → ch04
- **max-width / don't fill the screen** → ch03
- **Personality** → ch01
- **Photos / overlays / colorize** → ch07
- **Process of elimination** → ch01
- **Relative sizing / em trap** → ch03, ch04
- **Screenshots** → ch07
- **Spacing scale** → ch03
- **Supercharge defaults** → ch08
- **Type scale** → ch04
- **White space** → ch03
- **Work in cycles / pessimist v1** → ch01

## Supporting Files

- [glossary.md](glossary.md) — all key terms with definitions
- [patterns.md](patterns.md) — all techniques and design patterns
- [cheatsheet.md](cheatsheet.md) — quick reference tables and decision guides

---

## Scope & Limits

This skill covers *Refactoring UI* only (practical interface construction: hierarchy, space, type, color, depth, images, polish). It is not a UX-research, information-architecture, or accessibility-audit handbook — WCAG numbers appear where the book uses them as design constraints. For implementation in a specific codebase, combine with that project's design tokens and components.
