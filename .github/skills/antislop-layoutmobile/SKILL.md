---
name: antislop-layoutmobile
description: Use when implementing or checking Bynor layouts across phone, tablet, and desktop widths.
---

# Bynor responsive skill

Read `DESIGN.md` and `antislop.md`. Treat phone layout as a deliberate reflow, not a shrunken desktop.

- Set breakpoints where the client tools, metrics, content lists, or calendar stop fitting.
- Reflow analysis panels and content comparisons into a readable column. Keep the calendar week scanable without page-level horizontal overflow.
- Keep client switching and the three main destinations discoverable on narrow screens.
- Maintain text wrapping, visible focus, and minimum 44px interactive targets.
- Check narrow phone, intermediate tablet, and desktop widths. Inspect page `scrollWidth` against viewport width.
- Respect safe areas, browser zoom, and reduced motion. Fixed navigation must not cover content.