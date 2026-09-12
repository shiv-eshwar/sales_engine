# Chapter 7: Working with Images

## Core Idea
Photography and icons have an intended size and contrast range. Do not scale them as if they were fluid layout, and never assume a photo is a safe text background or that user uploads will respect your grid.

## Frameworks Introduced
- **Use good photos**: A weak photo wrecks a strong layout. Placeholder → "we'll shoot it on a phone later" never works.
  - When to use: Hero, empty states, marketing, feature sections.
  - How: Specific needs → hire a photographer (lighting, composition, color — not just a camera). Generic needs → paid stock or high-grade free (e.g. Unsplash). Design with *final-quality* images.

- **Text needs consistent contrast (the photo is the problem)**: Heroes fail because photos contain both near-white and near-black. White type dies in the lights; dark type dies in the darks.
  - When to use: Any type on photography.
  - How — pick one or combine:
    1. **Overlay**: Black overlay helps light text; white overlay helps dark text. Cheap, affects the whole frame.
    2. **Lower image contrast** and retune brightness (more control than a flat overlay).
    3. **Colorize**: Lower contrast → desaturate → solid fill with **multiply**. Also binds the photo to brand hue.
    4. **Text shadow as glow**: Large blur, **no offset** — contrast only behind glyphs. Still flatten the photo some; the glow lets you flatten less.

- **Everything has an intended size**: Upscaling bitmaps goes fuzzy — known. The rest is less known.
  - **Don't scale up icons**: 16–24px SVG blown to 3–4× stays legally sharp and looks **chunky / low-detail**. Keep the glyph near native size; fill the large hole with a container (circle, tile), not a 64px stroke-4 icon.
  - **Don't scale down screenshots**: 70% shrink turns 16px UI type into ~4px. Capture at a smaller breakpoint (tablet layout), use a **crop/partial**, or **draw a simplified UI** (text → lines) when the slot is tiny.
  - **Don't scale down icons either**: 128px logos as 16px favicons turn to mush. **Redraw** a simplified mark at the target size so *you* choose the compromises.

- **Beware user-uploaded content**: You cannot grade, crop, or color-match every upload.
  - **Control shape and size**: Intrinsic ratios smash grids. Center in a **fixed box** and crop overflow. CSS: image as background, `background-size: cover` (or `object-fit: cover` on `<img>`).
  - **Prevent background bleed**: Upload bg ≈ page bg → the photo loses its rectangle. Prefer a **subtle inner `box-shadow`** over a hard border (borders clash with photo colors). If the inset look bothers you, a **semi-transparent inner border** is the alternative. Most people never notice the shadow.

## Key Concepts
- **Dynamic range of photos**: Local lights and darks that fight one text color.
- **Overlay / flatten / colorize / glow**: Four contrast equalizers, from blunt to local.
- **Intended size**: The pixel size the asset was drawn or captured for.
- **Container, not upscale**: Grow the frame around a small icon.
- **Simplified screenshot**: Lines instead of live type when scaled display would be unreadable.
- **Target-size redraw**: Favicons and small marks are new drawings.
- **Cover crop**: Fixed aspect; lose edges, keep layout.
- **Bleed**: Subject merges with page; inner shadow restores the edge.

## Mental Models
- Use **final photos in comps** the way you use final type — placeholders lie.
- Think of **type-on-image as a contrast-consistency problem**, not a "pick a better hex" problem.
- Use **native size + chrome** when a feature grid wants "big icons."
- Think of **user media as hostile content**: lock the box, lock the edge.

## Anti-patterns
- **Phone snapshots replacing Unsplash placeholders** on ship day.
- **White H1 on an ungraded photo** and cycling type color for an hour.
- **24px icon font at 96px** in a "features" row.
- **Full desktop screenshot in a 320px card**.
- **Brand logo squashed to favicon**.
- **`<img>` at intrinsic aspect** in a gallery of user photos.
- **1px grey border** to separate avatars from a white page (fights every photo).

## Code Examples
```css
/* Hero: flatten + glow so one text color holds */
.hero {
  background:
    linear-gradient(hsl(220 30% 10% / 0.45), hsl(220 30% 10% / 0.45)),
    url("hero.jpg") center / cover;
  color: white;
}
.hero h1 {
  text-shadow: 0 0 24px hsl(220 30% 5% / 0.6); /* glow, no offset */
}

/* Colorize via multiply (when not doing it in an editor) */
.hero--brand::after {
  content: "";
  position: absolute; inset: 0;
  background: hsl(221 83% 40%);
  mix-blend-mode: multiply;
}

/* User media: fixed box, crop, anti-bleed */
.avatar {
  width: 48px; height: 48px;
  background: url("user.jpg") center / cover;
  box-shadow: inset 0 0 0 1px hsl(220 10% 10% / 0.12);
}

/* Equivalent with <img> */
.thumb img {
  width: 100%;
  height: 160px;
  object-fit: cover;
}
```

- **What it demonstrates**: Overlay + glow, multiply colorize, `cover` crop, inner-edge instead of a border.

## Reference Tables
| Type on photo | Control | Cost |
|---|---|---|
| Overlay | Fast, global | Washes good regions too |
| Lower contrast + brightness | More surgical | Needs an editor or CSS filters |
| Colorize (contrast → grey → multiply) | Brand-coherent | Loses photo color |
| Glow text-shadow | Local to glyphs | Still needs some flattening |

| Asset | Upsize | Downsize |
|---|---|---|
| Photo (bitmap) | Soft/fuzzy — don't | OK until detail/type dies |
| 16–24px icon (vector) | Chunky, undetailed — don't; use a container | Usually OK |
| Large illustrated icon | Usually OK | Choppy — redraw small |
| App screenshot | — | Unreadable type — recapture, crop, or simplify |
| Logo → favicon | — | Mush — redraw 16px mark |

| User upload risk | Fix |
|---|---|
| Random aspect | Fixed box + `cover` |
| Bg matches page | Inner shadow or translucent inner border |
| Ugly content | Process cannot save it; constrain presentation |

## Worked Example
**SaaS hero.** Headline on a conference photo: white fails on shirts, black fails on the hall. 40% black overlay + `text-shadow: 0 0 24px` holds 36px type across the frame without turning the photo into a muddy slab.

**Features row.** Designer drops Heroicons (24px) at 80px. Legally SVG-sharp, optically like clip art. Fix: 48px circle in brand-100, 24px icon centered. The *module* is large; the *glyph* is still a 24px drawing.

**Customer logos / avatars.** User PNG on white, page is white → logos vanish. `box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%)` restores the rectangle without a border that hits a red logo and a blue logo differently.

## Key Takeaways
1. Design with real, good photography; placeholders do not predict the final.
2. Equalize photo contrast before fighting type color; overlay, flatten, colorize, glow.
3. Honor intended size: don't blow up small icons, crush screenshots, or shrink logos to favicons — recapture, crop, container, or redraw.
4. User images: fixed crop (`cover`) and an inner edge so they cannot break layout or bleed.

## Connects To
- **Ch 2 / 5**: Contrast is hierarchy and accessibility; photos are just an extreme background.
- **Ch 6**: Inner shadow as a quiet edge (bleed) is the same tool as inset depth.
- **Ch 8**: Empty states often need illustration — same "intended size" rules.
