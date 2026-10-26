# Anti-slop project rules

This project applies the purpose test, liveliness dials, and delivery checks from [anti-slop](https://github.com/miqdadbadjuber/anti-slop). These notes are the project's working filter, not a replacement for its upstream rulebook.

## Core filter
- Every major choice in palette, type, structure, spacing, motion, and components needs a product reason recorded in `DESIGN.md` or the change.
- Use a strong product identity, but do not imitate a named product. A technique is allowed when it serves hierarchy, clarity, or Habitat's identity.
- Never invent customer claims, testimonials, account connections, names, statistics, or performance outcomes. Mark sample content and values as demo data wherever they appear.
- Every link and control must reach an existing destination or change real state. Keep keyboard operation and visible focus. Give data views useful empty, loading, and error states when they depend on asynchronous data.
- Keep navigation aligned with shipped views. Remove dead destinations.
- Avoid generic marketing language, decorative emoji, em dashes, template layouts, unexplained iconography, and repeated decoration without function.
- Mobile is a first-class layout: reflow content, avoid page-level horizontal overflow, and provide touch targets of at least 44px.
- Respect reduced-motion preferences and maintain WCAG AA text contrast. Focus indicators and control boundaries must remain visible.

## Design read
Reading this as a multi-client social studio workspace for social media managers, in a composed creative-studio visual language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

The selected client controls client-specific analysis and reporting. The appointments calendar is global to the studio and must never be filtered by the selected client.

## Delivery gate
Before handing off interface changes, verify:
1. No fabricated claim or realistic sample presented as real; the demo label remains visible.
2. Every control works by pointer and keyboard, has visible focus, and reaches a real state or destination.
3. Dialogs close with Escape; forms validate and report a visible outcome.
4. Data has clear empty, loading, and error handling wherever asynchronous sources exist.
5. Desktop, intermediate, and narrow layouts have no accidental overflow or clipped content.
6. Motion, palette, type, and layout match `DESIGN.md`; reduced motion remains supported.
7. The site has been run; note the tested routes, interactions, viewport sizes, and any limits such as unconnected social APIs.