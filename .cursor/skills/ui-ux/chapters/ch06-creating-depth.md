# Chapter 6: Creating Depth

## Core Idea
Depth is simulated light (from above) plus a small elevation system — not photorealism. Flat UIs still need depth, via value, solid offsets, and overlap.

## Frameworks Introduced
- **Emulate a light source (light comes from above)**: Raised vs inset is readable from a still image because of lighting, not 3D meshes.
  - When to use: Buttons, inputs, wells, checkboxes — anything that should feel in front of or cut into the surface.
  - How: Raised panel: top edge lighter (faces sky), bottom in shadow. Inset: shadow under the upper lip, lighter bottom lip. Viewers look slightly *down* at screens, so for a flat-sided raised block, reveal a hint of the **top** face, not the bottom.
  - Why it works / failure mode: One lighting rule, consistently applied. Failure mode: hours of skeuomorphic tweaking until the UI is busy and unclear — borrow cues, do not render a photo.

- **Raised elements (recipe)**: Lighter top (border or inset `box-shadow` with small positive Y). Hand-pick the light color — **not** translucent white (desaturates). Small dark drop shadow, slight Y offset, **tiny blur** (sharp, like a wall-outlet shadow).

- **Inset elements (recipe)**: Lighter **bottom** lip (bottom border or inset shadow with negative Y). Dark inset shadow at the top with small positive Y so it does not leak out the bottom. Same recipe for text inputs and checkboxes.

- **Shadows convey elevation**: Tight, small blur = slightly off the page; large blur = in the user's face (and therefore in focus).
  - When to use: Buttons (small), dropdowns (medium), modals (large).
  - How: **Elevation system of ~5 shadows**. Define smallest and largest first; fill the middle linearly. Do not invent a new shadow per component.

- **Shadows as interaction**: Elevation is a z-axis story, including motion.
  - When to use: Drag handles, pressable buttons.
  - How: Drag start → larger shadow (lifts above siblings). Press → smaller or no shadow (pushed in). Pick the shadow by asking "where on z?" not "which CSS looks fancy?"

- **Shadows can have two parts**: Nice shadows are often **two** `box-shadow`s with jobs.
  1. Large, soft, bigger Y and blur — the cast from a direct light.
  2. Tight, darker, smaller Y and blur — the contact/ambient occlusion under the object.
  - When to use: Cards, popovers, anything that looked "cheap" with one shadow.
  - How: Keep the large one subtle, the tight one defined. As elevation **increases**, fade the tight contact shadow (in the real world it disappears as the object leaves the desk). Distinct at low elevation; almost gone at modal height.

- **Even flat designs can have depth**: "Flat" means no fake light, not no z-axis.
  - How: **Value**: lighter than ground → raised; darker → inset (works in non-flat UIs too). **Solid shadows**: short Y offset, **zero blur** — a flat card that still stands off. **Overlap**: straddle a background change; make a child taller than its parent; carousel controls sitting on the image. Overlapping photos clash → **invisible border** the color of the ground so a gap always remains.

## Key Concepts
- **Light from above**: The single physical rule to fake.
- **Raised vs inset profile**: Which lips are lit vs shaded.
- **Elevation tokens**: ~5 named shadows, not one-off CSS.
- **Z-axis interaction**: Press and drag as elevation changes.
- **Dual shadow**: Cast + contact.
- **Contact shadow vs elevation**: Contact dies as z grows.
- **Flat depth**: Value, hard offset, overlap (with matching-color gap).

## Mental Models
- Use **door vs cabinet panelling** when you cannot tell if a control should look raised or inset: which edges are light?
- Think of **blur radius as distance to the user**, not as "how stylish."
- Use **two shadows** when a single shadow is either a muddy blob or a harsh outline.
- Think of **overlap across a band of color** as cheap, honest layering.

## Anti-patterns
- **Photoreal lighting pass** on a CRUD app: busy, unclear.
- **Translucent white highlight** on a saturated button: chalky top edge.
- **Huge blur on a tiny control**: a button that feels like a modal.
- **One shadow recipe for button, menu, and dialog**.
- **Keeping the tight contact shadow at high elevation**: physically wrong, visually "stuck to the page" while also huge.
- **True-flat with no value change, offset, or overlap**: a pancake; hierarchy has nowhere to go.
- **Overlapping photos with no gap**: edges fight.

## Code Examples
```css
:root {
  /* ~5 elevations: small → modal. Dual-shadow; contact fades as z grows */
  --elev-1: 0 1px 2px hsl(220 20% 10% / 0.12),
            0 1px 1px hsl(220 20% 10% / 0.08);
  --elev-2: 0 4px 12px hsl(220 20% 10% / 0.10),
            0 1px 2px hsl(220 20% 10% / 0.06);
  --elev-3: 0 12px 24px hsl(220 20% 10% / 0.12),
            0 2px 4px hsl(220 20% 10% / 0.04);
  --elev-4: 0 20px 40px hsl(220 20% 10% / 0.16),
            0 0 0 transparent; /* contact almost gone */
}

/* Raised button: hand-picked light top, sharp little shadow */
.btn {
  background: hsl(221 83% 53%);
  border-top: 1px solid hsl(221 83% 62%); /* not #fff at 30% */
  box-shadow: 0 1px 2px hsl(221 50% 20% / 0.35);
}
.btn:active { box-shadow: none; transform: translateY(1px); } /* pressed in */

/* Inset well / input */
.input {
  box-shadow:
    inset 0 1px 2px hsl(220 20% 10% / 0.12),
    0 1px 0 hsl(0 0% 100% / 0.6); /* lighter bottom lip */
}

/* Flat depth: hard offset, no blur */
.card-flat { box-shadow: 0 3px 0 hsl(220 20% 20%); }

/* Overlap without clash */
.avatar { box-shadow: 0 0 0 3px var(--page-bg); }
```

- **What it demonstrates**: Elevation tokens with fading contact, hand-picked highlight, press = lower z, inset well, solid flat shadow, gap ring for overlap.

## Reference Tables
| Element | Elevation | Interaction |
|---|---|---|
| Resting button | 1 (tight, sharp) | Active → 0 (pressed) |
| Dragging row | 2–3 | Shadow appears on pointer-down |
| Dropdown / popover | 3 | Static above page |
| Modal | 4–5 | Highest; contact shadow gone |

| Technique | Flat-friendly? | Notes |
|---|---|---|
| Gradient / lit edges | No (classic skeuomorph) | Use sparingly |
| Dual blur shadows | No | Best for layered "material" UIs |
| Lighter/darker fill than ground | Yes | Raised vs well |
| 0-blur Y offset | Yes | "Sticker" depth |
| Overlap + matching gap | Yes | Layers without photoreal light |

| Raised | Inset |
|---|---|
| Light on **top** | Light on **bottom** lip |
| Dark shadow **below** | Dark shadow **inside top** |
| Button, card, knob | Input, well, checkbox trough |

## Worked Example
**Sortable list.** Resting rows: no shadow (z = 0). On pointer-down, `--elev-3`. The row reads as "in hand" without a drag ghost. Drop: shadow off. The shadow is the affordance.

**Modal vs button.** Same single `0 10px 40px` on both: the button feels like a dialog; the dialog feels like a slightly dirty button. Split the scale: button `--elev-1`, dialog `--elev-4` with the tight shadow removed.

**Flat dashboard widgets.** No blur allowed by brand. Widgets sit on grey-100; widget fill grey-50 (lighter = closer). Optional `0 2px 0` ink offset. A KPI card that crosses the hero/body color seam (overlap) beats a drop-shadow the brand forbids.

## Key Takeaways
1. Light comes from above; raised and inset are opposite lip treatments.
2. Hand-pick highlights; keep functional shadows sharp and small unless elevation is high.
3. Name ~5 elevations; drive press/drag by z, not by taste.
4. Two-part shadows: big cast + tight contact; kill contact as z grows.
5. Flat UIs still layer via value, hard offset, and overlap with a ground-colored gap.

## Connects To
- **Ch 1 / 3 / 5**: Elevation is another predefined system — same "limit choices" move.
- **Ch 2**: Closer on z = more focus; do not put a huge shadow on a tertiary control.
- **Ch 7**: Invisible border / inner shadow on images is the overlap-gap idea again.
- **Material elevation**: Same z metaphor; this book stays lighter and more physical.
