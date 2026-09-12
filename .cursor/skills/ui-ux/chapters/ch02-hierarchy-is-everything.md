# Chapter 2: Hierarchy is Everything

## Core Idea
"Looks designed" is mostly visual hierarchy — a clear ranking of what matters — not extra styling. Size is a weak sole lever; weight, color, de-emphasis, and action rank do the real work.

## Frameworks Introduced
- **Visual hierarchy**: How important elements appear relative to each other. When everything competes, the UI is one wall of noise. De-emphasize secondary/tertiary content and highlight the few things that matter; color, typeface, and layout can stay the same and it still feels designed.
  - When to use: Any screen that feels busy, "off," or amateur without an obvious color problem.
  - How: Name primary, secondary, and tertiary information. Promote one; demote the rest with weight and contrast, not just font-size jumps.

- **Size isn't everything**: Font-size-only hierarchy makes primary type huge and secondary type unreadably small.
  - When to use: Headlines vs metadata, titles vs supporting copy, nav labels vs badges.
  - How: Prefer **weight** and **color** to do the same job at reasonable sizes. Two or three text colors. Two UI weights.
  - Why it works / failure mode: Weight and contrast change emphasis without wrecking readability. Failure mode: 11px grey metadata nobody can read, 40px titles nobody needed.

- **Don't use grey text on colored backgrounds**: Grey-on-white works because it is **reduced contrast**, not because grey is "secondary."
  - When to use: Secondary copy on brand-colored panels, images, or patterns.
  - How: Hand-pick a color with the **same hue** as the background; adjust saturation and lightness until contrast drops without looking faded. Do not fade with white+opacity (washes out, looks disabled, and background shows through on images).

- **Emphasize by de-emphasizing**: If the hero element cannot get louder, make everything else quieter.
  - When to use: Active nav that still does not pop; sidebar competing with main content.
  - How: Soften inactive items (weight, color) instead of painting the active item a louder accent. For a competing sidebar, drop its background so content sits on the page ground.

- **Labels are a last resort**: Naive `label: value` dumps give every field equal weight.
  - When to use: Profile cards, entity summaries, commerce facts — not form accessibility labels.
  - How: Drop labels when format or context is enough (`janedoe@example.com`, `$19.99`). Else combine ("12 left in stock", "3 bedrooms"). If a label is required (scannable dashboards), style it as supporting content. Invert only when users hunt for the *word* (spec sheets: "depth", not "7.6mm").

- **Separate visual hierarchy from document hierarchy**: Semantic `h1`/`h2` must not dictate visual size.
  - When to use: App chrome titles ("Manage Account"), section labels, dashboard modules.
  - How: Pick heading tags for document structure and a11y. Style them as small labels when the *content* is the focus. Hide visually if the content already speaks (keep in markup for assistive tech).

- **Balance weight and contrast**: Emphasis ≈ surface area of foreground vs background.
  - When to use: Solid icons next to text; 1px borders that vanish or scream.
  - How: Heavy icons → lower contrast (softer color) to match text. Weak low-contrast borders → increase **width**, not darkness, to keep a soft look.

- **Semantics are secondary (action pyramid)**: Button color is not "red because delete." Rank first, semantics second.
  - When to use: Pages with multiple actions.
  - How: One primary (solid, high contrast), few secondary (outline / lower-contrast fill), rare tertiary (link style). Destructive actions that are not the page primary stay secondary/tertiary; go big-red on the **confirmation** where destroy *is* primary.

## Key Concepts
- **Visual hierarchy**: Relative importance, independent of decoration.
- **Primary / secondary / tertiary text colors**: Dark for core content, grey for support, lighter grey for legal/footer.
- **UI font weights**: ~400/500 body, ~600/700 emphasis; avoid <400 at UI sizes.
- **Reduced contrast**: The actual mechanism behind "grey secondary text."
- **Combined label+value**: One stylable unit instead of two equally loud fields.
- **Document vs visual heading**: Semantic level ≠ point size.
- **Surface area**: Bold/icons cover more pixels → they read as louder.
- **Action pyramid**: One obvious primary, clear secondary, quiet tertiary.

## Mental Models
- Use **hierarchy before palette** when a screen "doesn't look designed" but the brand colors are fine.
- Think of **de-emphasis** as the main volume knob; boosting the hero is often already maxed out.
- Use **format-as-label** when the data shape is unambiguous; labels are for collision, not ritual.
- Think of **buttons as a pyramid**, not a semantic color chart.

## Anti-patterns
- **Everything same weight**: Chaos; nothing is designed because nothing is ranked.
- **Font-size-only hierarchy**: Giant titles, unreadable secondaries.
- **Grey (or white@opacity) on color**: Washed, disabled-looking, or see-through on photos.
- **Label: value for everything**: Database dump UI; no ranking possible.
- **h1 must be huge**: Account-page titles steal focus from the actual settings.
- **Icon at full text color**: The glyph outweighs the label.
- **Every button semantic-colored**: A page of competing primaries; destroy is red even when it is not the task.

## Code Examples
```css
:root {
  --text-primary: #1a1a1a;   /* headlines, names */
  --text-secondary: #6b7280; /* dates, captions — on white only */
  --text-tertiary: #9ca3af;  /* footer, legal */
  --weight-body: 400;
  --weight-emphasis: 600;
}

/* Secondary text on a colored panel: same hue, not grey, not opacity */
.panel--brand { background: hsl(221 83% 53%); }
.panel--brand .meta { color: hsl(221 70% 88%); } /* hand-picked, still blue */

/* Icon next to label: lower icon contrast to match text weight */
.nav-item svg { color: var(--text-secondary); }
.nav-item.is-active svg { color: var(--text-primary); }

/* Action pyramid */
.btn-primary { background: var(--color-primary); color: white; }
.btn-secondary { background: transparent; border: 1px solid var(--border); }
.btn-tertiary { background: none; color: var(--text-secondary); text-decoration: underline; }
```

- **What it demonstrates**: Hierarchy tokens (color, weight, contrast) instead of size gymnastics; destructive styling belongs on the confirm step, not every trash icon.

## Reference Tables
| Role | Color | Weight | Typical use |
|---|---|---|---|
| Primary | Near-black | 400–500 body, 600–700 for punch | Headlines, names, core values |
| Secondary | Mid grey **on white** | Regular | Dates, supporting sentences |
| Tertiary | Light grey | Regular | Copyright, hints |
| Avoid <400 at UI size | — | Light weights | Use color/size to de-emphasize instead |

| Action rank | Treatment | Example |
|---|---|---|
| Primary | Solid, high-contrast fill | Save, Search, Continue |
| Secondary | Outline or quiet fill | Cancel, View details |
| Tertiary | Link style | Learn more, Skip |
| Destructive, not primary | Secondary/tertiary | Trash on a settings page |
| Destructive, is primary | High-contrast danger on confirm | "Delete project" dialog |

| Label strategy | When |
|---|---|
| None | Format/context is unambiguous (email, phone, price) |
| Combined | Need a word but can fold it into the value |
| De-emphasized label | Dashboard scan; data is the point |
| Emphasized label | Spec sheets; user hunts the field *name* |

## Worked Example
**Article card.** Before: 28px title, 11px grey date, 11px author — size doing all the work, date unreadable. After: 18px/600 title, 14px/400 date in secondary grey. Same ranking, usable type.

**Employee row.** Before: `Name: Jane Doe` / `Email: jane@…` / `Dept: Customer Support`. After: **Jane Doe** as identifier, `jane@…` unlabeled (format), `Customer Support` unlabeled (context under a name). Hierarchy appears because labels stopped equalizing everything.

**Delete on a document page.** Primary is "Share" or "Save." Delete is a quiet tertiary control. The confirm modal's primary is the red **Delete** — that is the one moment severity and primacy coincide.

## Key Takeaways
1. Rank information before you decorate; hierarchy is the largest "looks designed" lever.
2. Use weight and color before ballooning or shrinking type.
3. On color, reduce contrast by matching hue — never grey or transparent white.
4. Quiet the surroundings when the focal element cannot get louder.
5. Treat labels, heading tags, icons, and buttons as hierarchy problems, not semantic rituals.

## Connects To
- **Ch 1**: Grayscale design is this chapter's training wheels — hierarchy without color.
- **Ch 4**: Type scale, link treatment, and alignment continue hierarchy in text.
- **Ch 5**: Accessible color that still ranks (flip contrast, don't rely on hue alone).
- **WCAG**: Contrast is a hierarchy tool and a legal floor; they are not the same job.
