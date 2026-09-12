# Chapter 8: Finishing Touches

## Core Idea
Polish is mostly amplifying what exists (defaults, one accent bar, background, empty state) and subtracting chrome (borders). When a component still looks like a wireframe of itself, break the template.

## Frameworks Introduced
- **Supercharge the defaults**: Flair often does not need new objects — restyle the ones you already have.
  - When to use: Lists, quotes, forms that feel "Bootstrap default."
  - How: Bullets → icons (checkmarks/arrows, or content-specific: padlock on security bullets). Testimonial quotes → large, colored glyph. Checkboxes/radios → custom, **selected state in brand color**. One brand fill on `:checked` often flips "browser junk" to "designed."

- **Add color with accent borders**: You do not need illustration talent to put a rectangle of brand color in the right place.
  - When to use: Cards, active nav, alerts, headlines, whole-app top edge that still feel beige after hierarchy/spacing/type are right.
  - How: Top of card; active nav underline/bar; leading edge of an alert; short bar under a headline; strip across the full layout. A colored rectangle is a valid personality injection.

- **Decorate your backgrounds**: When structure is good but the page is still a slab.
  - When to use: Long marketing pages, empty-feeling dashboards, consecutive same-y sections.
  - How: **Change fill** (panel emphasis or section distinction). Slight **gradient** with hues **≤ ~30° apart**. **Repeating pattern** (e.g. Hero Patterns) — full field or a single edge; keep contrast **low** so type wins. **One or two graphics**: geometry, a pattern chunk, a simplified map — again, low contrast.

- **Don't overlook empty states**: Sample-data mockups hide the first real screen: nothing.
  - When to use: Any feature that depends on user-generated content.
  - How: Treat empty as a first-class screen: illustration + loud CTA. Hide tabs/filters that do nothing until there is data. First impression of the feature; do not ship a blank table.

- **Use fewer borders**: Borders are one separator among many; stacked borders read as wireframe noise.
  - When to use: Card grids, table chrome, sidebar vs main, stacked list rows.
  - How — substitutes:
    1. **Box shadow** — outlines without the ink; works best when fill ≠ page fill.
    2. **Two background colors** — usually enough; if you have fill *and* a border, drop the border.
    3. **Extra spacing** — distinction with no new chrome.

- **Think outside the box**: Conditioned component shapes are optional.
  - When to use: High-importance dropdowns, tables, radios that still look like 2005 defaults.
  - How: Dropdown = a floating surface: sections, columns, supporting text, icons. Table: if a column isn't sortable, **merge related columns** and use hierarchy; cells can hold images and color. Radios that matter → **selectable cards**. Constraints help until they freeze a template.

## Key Concepts
- **Supercharged default**: Same component, louder useful parts (bullets, quotes, checked inputs).
- **Accent border**: Cheap brand color as structure, not decoration-for-its-own-sake.
- **Low-contrast ground**: Pattern/illustration that cannot fight type.
- **Empty state as onboarding**: Illustration + CTA; hide dead chrome.
- **Separator stack**: Shadow, fill, space — reach for border last.
- **Component unbundling**: Dropdown/table/radio are jobs, not clip art.

## Mental Models
- Use **supercharge** when you are about to add a new illustration but a bullet list is already there.
- Think of an **accent bar** as the non-designer personality move (Ch 1) that does not require photography.
- Use **empty-state-first** whenever the happy path is a populated table.
- Think of **borders as last-resort grouping** (pair with Ch 3 proximity).

## Anti-patterns
- **Browser checkboxes, default bullets, timid quotes** on an otherwise custom UI.
- **Adding illustrations** before trying a 4px brand bar.
- **High-contrast background pattern** under paragraphs.
- **Empty table + disabled filters** as v1 of a feature.
- **Border on every card, row, and column**.
- **"Dropdown = single column of links"** even when the menu is a primary nav.
- **One-datum-per-column** even when columns aren't sortable.

## Code Examples
```css
/* Supercharge: brand selected control */
input[type="checkbox"] { accent-color: var(--blue-500); }

/* Accent bar as personality */
.card { border-top: 3px solid var(--blue-500); }
.nav-link.is-active { box-shadow: inset 0 -2px 0 var(--blue-500); }
.alert { border-left: 4px solid var(--blue-500); }

/* Gradient ground: hues ≤ ~30° apart, low drama */
.band {
  background: linear-gradient(180deg, hsl(221 40% 97%), hsl(200 40% 96%));
}

/* Separator without a border */
.panel { background: white; box-shadow: var(--elev-1); } /* fill ≠ page */
.row + .row { margin-top: var(--space-6); } /* space as separator */

/* Selectable cards instead of radio dots */
.choice { border: 1px solid transparent; }
.choice:has(:checked) { border-color: var(--blue-500); background: var(--blue-100); }
```

- **What it demonstrates**: Brand on native controls, accent placements, quiet gradient, shadow/space instead of gridlines, radio-as-card.

## Reference Tables
| Separator needed | Try first | Border when |
|---|---|---|
| Card on grey page | Fill + light shadow | Never the default |
| Two page sections | Different fills | If fills must match |
| List groups | Extra gap (Ch 3) | Dense data, still maybe not |
| Active nav | Accent bar / weight | Full boxed "tab" chrome last |

| Empty-state checklist | Yes/no |
|---|---|
| Illustration or strong visual | Should have |
| Single obvious CTA | Should have |
| Filters/tabs/sort hidden | Until they have data |
| Looks like an error | Must not |

| "Default" | Supercharge |
|---|---|
| `ul` discs | Icons matching content |
| Quote marks | Oversized, brand-colored |
| Native checkbox | Brand `accent-color` / custom |
| Beige card | 3px top accent |
| Radio list | Selectable cards |

## Worked Example
**Security pricing card.** Before: grey disc bullets, 1px border, default checkbox in the footer form. After: padlock icons, `border-top: 3px solid` brand, `accent-color` on the checkbox. No new illustration file.

**"Projects" v1.** Mock showed six beautiful sample projects. Production: empty `<table>` and greyed-out status filters. Rebuild empty: isometric folder art, "Create your first project," filters omitted. After the first project exists, mount the table and filters.

**Team picker.** Native radios beside names. This *is* the page's primary action. Replace with cards: avatar, name, role, clickable surface, selected = brand ring + tint. Same input semantics, different hierarchy.

## Key Takeaways
1. Restyle existing bullets, quotes, and controls before adding art.
2. A brand-colored bar is legitimate polish.
3. Backgrounds: fill, close-hue gradient, quiet pattern, or a single low-contrast shape.
4. Empty states are the real first run; hide chrome that needs data.
5. Prefer shadow, fill, and space over borders; redesign dropdowns/tables/radios when they matter.

## Connects To
- **Ch 1**: Personality levers (color, radius) applied as tiny accents.
- **Ch 2**: Accent and empty-state CTA must respect the action pyramid — one primary.
- **Ch 3**: Spacing as separator.
- **Ch 5**: ≤30° gradient hues; brand on `:checked`.
- **Ch 9**: "Decisions you wouldn't have made" often live in these finishing moves.
