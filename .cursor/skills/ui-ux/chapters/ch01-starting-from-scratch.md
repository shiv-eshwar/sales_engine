# Chapter 1: Starting from Scratch

## Core Idea
Design the next useful feature, not the app chrome. Constrain personality and numeric choices up front so every later screen is a process of elimination, not a hunt through infinite options.

## Frameworks Introduced
- **Start with a feature, not a layout**: An app is a collection of features. The shell (top nav vs sidebar, logo placement, full-width vs contained) cannot be decided until a few real features exist.
  - When to use: Blank canvas, new product, new major flow.
  - How: Pick one job (e.g. "search for a flight"). List only the controls that job needs. Draw those first. Chrome comes after the feature teaches you what navigation it actually requires.
  - Why it works / failure mode: Shell-first work is imaginary architecture. Failure mode: days spent on a nav bar for an app whose core screen does not exist yet.

- **Detail comes later (Sharpie + grayscale)**: Low-level type, shadow, and icon choices are not first-order problems.
  - When to use: Earliest layout exploration, especially inside high-fidelity tools that invite polishing.
  - How: Sketch with a thick marker so micro-detail is physically impossible. When you move to a design tool or the browser, stay grayscale so spacing, contrast, and size must carry hierarchy.
  - Why it works / failure mode: Color and typeface hide weak structure. Failure mode: a pretty mock that falls apart when you try to build it.

- **Work in cycles**: Design a simple version → make it real → iterate on the working UI → next feature.
  - When to use: Any product where edge cases (empty, overflow, collision) are cheaper to see than to imagine.
  - How: Ship the smallest useful version. Do not design 2000-contact states, form errors, or calendar overlaps in the abstract first. Fix them in software you can click.

- **Be a pessimist (smallest useful version)**: Do not imply functionality you are not ready to build.
  - When to use: Spec'ing a feature with "nice-to-haves" (attachments, filters, integrations).
  - How: If a piece is optional, omit it from v1. A comments system without attachments ships; a comments system blocked on attachments ships nothing.

- **Choose a personality**: Personality is not vibe — it is four concrete levers used consistently.
  - When to use: Before a type scale or color palette, once you know who the product is for.
  - How: Set font family, color temperature, border radius, and language tone together. Stay consistent; mixing square and rounded corners in one UI almost always looks worse.

- **Limit your choices / define systems in advance**: Infinite option space makes every 12px-vs-13px decision torture.
  - When to use: As soon as you leave grayscale sketches.
  - How: Pre-pick 8–10 shades per color, a restrictive type scale, and a spacing scale. Reuse those values; do not reopen the color picker per component.

- **Designing by process of elimination**: On a constrained scale, adjacent values look obviously different, so the wrong ones drop out fast.
  - When to use: Any numeric choice (icon size, padding, type size, radius).
  - How: Guess a middle value. Compare the neighbors. If both neighbors are worse, you are done. If an outer value wins, recenter and repeat.

- **Systematize everything**: Treat every repeating numeric decision as a scale candidate.
  - When to use: The second time you make the same kind of choice.
  - How: Add a token for font size, weight, line-height, color, margin, padding, width, height, shadow, radius, border width, opacity. You do not need every scale on day one — introduce them as decisions recur.

## Key Concepts
- **Shell**: Navigation, logo, page frame — the parts people reach for first and should reach for last.
- **Feature-first canvas**: Start from actual controls a user needs to complete one job.
- **Disposable fidelity**: Sketches and wireframes exist to discard; users cannot use them.
- **Personality levers**: Font, color, radius, language — four knobs that set "bank vs startup."
- **Constrained option set**: A small menu of noticeably different values, not a continuous slider.
- **Process of elimination**: Compare a candidate to its two neighbors on the scale.
- **System-focused mindset**: Prefer inventing a scale over inventing a one-off value.

## Mental Models
- Use **feature-first** when you catch yourself arguing about top-nav vs sidebar with no screens designed.
- Think of **grayscale** as a hierarchy stress test: if it does not work in grey, color will not save it.
- Use **pessimist v1** when a mock includes a control whose implementation cost is unknown.
- Think of **systems** as paying decision-tax once, then spending tokens instead of taste on every screen.

## Anti-patterns
- **Design the app first**: Picking chrome before features. You lack the information the shell needs.
- **Design every feature before implementation**: Edge cases in the abstract produce fiction, then frustration.
- **Over-invest in mockups**: High-fidelity statics delay the only artifact users can use.
- **Include nice-to-haves in v1**: One hard extra (file attachments) can freeze a shippable core.
- **Borrow a competitor's personality wholesale**: You look like a second-rate copy; steal category tone, not their UI.
- **Open-ended pixel tweaking**: 12 vs 13px, 10% vs 15% shadow — unbounded choice with no wrong answer, so no confident one.

## Code Examples
```css
/* Personality: stay on one radius family */
:root {
  --radius: 8px; /* or 0 for formal; or 16px+ for playful — pick one */
}

/* Process of elimination: icon size from a pre-defined scale */
.icon { width: 16px; height: 16px; } /* guess */
/* Compare 12px and 24px. Keep the only one that does not look wrong. */
```

- **What it demonstrates**: Personality is a token, not a per-component whim; size is chosen from a scale by comparison, not by dragging.

## Reference Tables
| Lever | Serious / professional | Neutral | Playful |
|---|---|---|---|
| Font | Serif or restrained sans | Neutral sans / system stack | Rounded sans |
| Color | Gold, deep navy, restrained | Blue (familiar, rarely rejected) | Pink, bright accents |
| Radius | `0` (square) | Small (`4–8px`) | Large (`12px+`) |
| Language | Official, less personal | Direct | Casual, friendlier |

| Recurring decision | Turn into a system |
|---|---|
| Type size / weight / line-height | Type scale |
| Color | 8–10 greys + 5–10 shades per brand/accent |
| Space and size | Spacing scale (Ch 3) |
| Elevation | Shadow scale (Ch 6) |
| Radius, border, opacity | Small discrete sets |

## Worked Example
**Flight search, not the airline homepage.** Need: departure city, destination, departure date, return date, search button. Do not start with logo, marketing nav, or a 12-column marketing grid. Google-search-shaped UI is a valid v1 if that is the feature.

**Comment thread without attachments.** Temptation: draw a paperclip because "we'll want files someday." Implementation of uploads is a project. Design comments only. Ship. Add attachments as a later cycle if still needed.

**Icon size by elimination.** Scale: 12 / 16 / 24 / 32. Guess 16. Compare 12 (too timid) and 24 (too loud for the row). Keep 16. If 24 had won, compare 16 / 24 / 32 next.

## Key Takeaways
1. Start with a real feature's controls; delay the shell until features teach you what nav you need.
2. Explore layout in low fidelity and grayscale; color is a later enhancer, not a structure tool.
3. Cycle: simple design → working software → next feature. Imagination is a bad edge-case engine.
4. Design the smallest useful version; park nice-to-haves until the core exists.
5. Lock personality (font, color, radius, copy) and numeric systems early so later work is elimination, not agony.

## Connects To
- **Ch 3**: Spacing and sizing systems are the first concrete "limit your choices" implementation.
- **Ch 4**: Type scale and font personality.
- **Ch 5**: Color personality and shade systems.
- **Lean / vertical slice**: Ship a thin end-to-end feature instead of a complete facade.
