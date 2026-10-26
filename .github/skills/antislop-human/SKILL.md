---
name: antislop-human
description: Use for keyboard, focus, contrast, form, and assistive-technology behavior in Bynor.
---

# Bynor accessibility skill

Read `antislop.md` before changing interactive UI.

- Keep all navigation, selects, date inputs, tabs, buttons, and dialogs reachable and operable with a keyboard.
- Preserve a clear `:focus-visible` treatment. Dialogs close with Escape and return focus to their trigger.
- Label every form control. Explain validation errors in text and associate them with the affected form.
- Keep headings, regions, selected navigation, and live status changes available to assistive technology.
- Meet WCAG AA contrast for text and maintain visible boundaries for controls and chart segments.
- Never rely on color alone to communicate a result or status.
- Respect zoom and reduced-motion settings. Do not clip text to preserve a fixed layout.
- When an API is introduced, design informative loading, empty, permission, and error states with a next action.