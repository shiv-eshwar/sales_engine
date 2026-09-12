# Glossary — Refactoring UI

**Accent border** — A short strip of brand color (card top, nav underline, alert edge, headline bar) used as cheap personality instead of illustration (Ch 8).

**Accent colors** — Sparing extra hues for highlight, danger, warning, success, and categories; still need multiple shades (Ch 5).

**Action pyramid** — One primary action (solid), few secondary (outline/quiet fill), rare tertiary (link style). Semantics (including destructive) sit inside this rank (Ch 2).

**Adjacent 25% rule** — Neighboring spacing/size tokens should differ by about 25% so choosing is elimination, not 120 vs 125 (Ch 3).

**Ambiguous spacing** — Inner gap equals outer gap, so groups fail to parse; fix by more space *around* than *within* (Ch 3).

**Baseline alignment** — Mixed font sizes on one row share the alphabetic baseline, not vertical center (Ch 4).

**Be a pessimist** — Do not mock functionality you are unready to build; ship the smallest useful version (Ch 1).

**Blind rebuild** — Recreate an admired UI without inspector/DevTools; the mismatch teaches missing rules (Ch 9).

**Combined label+value** — Fold the noun into the data ("3 bedrooms") so one unit can take hierarchy (Ch 2).

**Contact shadow** — Tight, dark, low-blur shadow under an object (ambient occlusion); fade it as elevation increases (Ch 6).

**Cover crop** — Fixed frame + `background-size: cover` / `object-fit: cover` so user images cannot break layout (Ch 7).

**De-emphasize to emphasize** — If the focal element cannot get louder, quiet everything else (Ch 2).

**Destructive-on-confirm** — Big/red only when destroy is the primary action of *that* surface, not on every trash control (Ch 2).

**Document vs visual hierarchy** — Semantic `h1`–`h6` must not dictate visual size in app UI (Ch 2).

**Dual encoding** — Never communicate meaning by hue alone; add icon, label, or lightness contrast (Ch 5).

**Dual shadow** — Large soft cast (direct light) + tight contact shadow (occlusion) (Ch 6).

**Elevation system** — ~5 named shadows from slightly raised to modal-close; pick by z-axis job (Ch 6).

**em nesting trap** — Child `em` sizes compute off the type scale (e.g. 1.25em × 0.875em = 17.5px) (Ch 4).

**Empty state** — First-run screen for user-generated features: illustration + CTA; hide filters until data exists (Ch 8).

**Feature-first** — Design a real job's controls before app chrome (nav, logo, shell) (Ch 1).

**Flip contrast** — Dark-colored text on a light tint instead of white text on a dark brand fill, for contrast without hierarchy theft (Ch 5).

**Greys (8–10)** — The bulk of UI color; start near-black grey, not `#000`; may be warm or cool (Ch 5).

**Hand-crafted type scale** — Integer sizes denser at the small end; preferred over modular/musical ratios for UI (Ch 4).

**HSL** — Hue / saturation / lightness. CSS-native; not the same as HSB/HSV in design tools (Ch 5).

**Hue rotation for brightness** — Rotate toward Y/C/M to lighten, toward R/G/B to darken, ≤20–30°, to change perceived brightness without chalk (Ch 5).

**Intended size** — Pixel size an icon, logo, or screenshot was drawn/captured for; do not treat as arbitrarily scalable (Ch 7).

**Labels as last resort** — Skip or fold labels when format/context is enough; if required, style as supporting copy (Ch 2).

**Light from above** — Raised: light top, shadow below. Inset: shadow in top, light bottom lip (Ch 6).

**Line length (measure)** — ~45–75 characters per line; CSS ballpark `20–35em` (Ch 4).

**Modular scale** — Type sizes from a ratio (4:5, 2:3, golden). Alluring; often fractional and too sparse for UI (Ch 4).

**Personality levers** — Font, color, border radius, and language tone, applied consistently (Ch 1).

**Primary color** — One or two brand hues that make the product recognizable; 5–10 shades each (Ch 5).

**Process of elimination** — Guess a scale token, compare neighbors, keep the only non-wrong one (Ch 1).

**Proportional line-height** — Taller leading for long/small text; near-1 for large headlines (Ch 4).

**Relative sizing doesn't scale** — Locking ratios (`2.5em`, padding = 1em) fails across breakpoints and component sizes (Ch 3).

**Saturation compensation** — Increase saturation as lightness leaves 50% so tints/shades do not wash out (Ch 5).

**Shade scale 100–900** — Named steps; 500 ≈ button-worthy base; pick edges, then fill mids (Ch 5).

**Shell** — Nav, logo, page frame — decide after features exist (Ch 1).

**Solid (flat) shadow** — Y-offset, zero blur; depth without skeuomorphic light (Ch 6).

**Spacing scale** — 16px-based tokens, tight at the small end, ~25% jumps (Ch 3).

**Supercharge the defaults** — Restyle bullets, quotes, and native controls before adding new art (Ch 8).

**System font stack** — `-apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica Neue` (Ch 4).

**Systematize everything** — Recurring numeric decisions become tokens (type, space, color, shadow, radius, …) (Ch 1).

**Tertiary action** — Discoverable but quiet; usually link-styled (Ch 2).

**Text-on-image equalizers** — Overlay, lower contrast, colorize+multiply, glow text-shadow (no offset) (Ch 7).

**Unintuitive decision** — A move you would not have made in an admired UI; the unit of study for leveling up (Ch 9).

**Visual hierarchy** — Relative importance of elements; the largest "looks designed" lever (Ch 2).

**Work in cycles** — Design a thin slice → build it → iterate in working UI → next feature (Ch 1).

**x-height / purpose** — Body faces: taller x-height, wider tracking. Display: tighter, shorter x-height. Do not swap jobs (Ch 4).
