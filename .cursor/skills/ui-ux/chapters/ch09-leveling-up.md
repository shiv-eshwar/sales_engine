# Chapter 9: Leveling Up

## Core Idea
The book is a starter toolkit, not a ceiling. Grow by hunting decisions you would not have made, then by rebuilding interfaces you admire *without* looking at the implementation.

## Frameworks Introduced
- **Look for decisions you wouldn't have made**: Taste grows from noticing non-default moves in work you already like.
  - When to use: Any time a UI impresses you; design-critique of competitors and tools you use daily.
  - How: Ask, explicitly: "Did they do anything here I would never have thought to do?" Collect those moves. Examples from the book: inverted background on a datepicker; a submit **inside** a text input instead of beside it; **two colors in one headline**.
  - Why it works / failure mode: Defaults are invisible until contrasted with a weird-but-right choice. Failure mode: copying the whole screen instead of extracting the unexpected decision.

- **Rebuild your favorite interfaces**: Recreation without cheating is how micro-rules get internalized.
  - When to use: After you can apply Ch 1–8 and still cannot name why a target UI feels "finished."
  - How: Recreate from scratch. **Do not peek at developer tools.** The gap between your replica and the original *is* the curriculum — you will independently discover "tighter line-height on headings," "letter-spacing on uppercase," "two shadows," etc.
  - Thin chapter: This is a practice loop, not a new visual system. Depth is in the reps.

## Key Concepts
- **Unintuitive decision**: A move that violates your current defaults and still looks right.
- **Blind rebuild**: Recreate without inspector, computed styles, or tracing.
- **Gap as teacher**: Difference between replica and original = missing rules.
- **Ongoing toolkit**: Hierarchy, space, type, color, depth, images, polish — then observation.

## Mental Models
- Use the **wouldn't-have-done question** as a standing filter while browsing.
- Think of **rebuilds as spaced repetition** for Ch 2–8, not as pixel-perfect cargo cult.

## Anti-patterns
- **Closing the book and only shipping defaults**: The systems atrophy without new observations.
- **Inspect-element cloning**: You copy values, you do not earn the why.
- **Whole-page theft**: Steal the unexpected decision, not the brand.

## Worked Example
**Datepicker that inverts the header.** Your default: white calendar, grey chrome, brand on the selected day. Theirs: inverted (dark) month header, light grid. You would not have painted half the widget the opposite value. Extract the decision: *one region flipped to create a local raised/sunken read* (Ch 6 value-as-depth) — apply it later to a filter bar, not by cloning their calendar.

**Blind rebuild of a settings page.** Recreate type, space, and a card grid from memory. Yours feels louder. Diff without DevTools: they used `line-height: ~1.1` on the page title, extra tracking on `GENERAL`, and two shadows on the menu. Those three gaps are now tokens in your system.

## Key Takeaways
1. When you like a UI, name one decision you would not have made.
2. Rebuild favorites blind; let the mismatch teach (leading, tracking, dual shadows, and the rest).
3. Keep adding tools for years by studying work that already inspires you.

## Connects To
- **Ch 1–8**: The catalog you compare against ("I would have used a border; they used space").
- **Ch 4**: Letter-spacing and heading line-height — classic rebuild discoveries.
- **Ch 6**: Dual shadows — another classic discovery.
- **Steal Like an Artist (Kleon)**: Collect, then transform; here the collection target is *decisions*, not vibes.
