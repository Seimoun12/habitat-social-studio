---
name: bynor-social-studio
description: Use when changing Habitat client profiles, social analytics, reporting, the content plan, the shared appointments calendar, or the graphic editor.
---

# Habitat product skill

Read `DESIGN.md` and `CLAUDE.md` before changing the product's structure.

- Clients live on the server (`data/db.json`). Each client has handles, channel connections (tokens never reach the browser) and a style: five colors, heading and body fonts, logo, notes.
- Channels: Instagram, Facebook, TikTok. Not connected = generated demo data, always labelled "Dati demo" on screen and in the PDF. Connections come from the Meta/TikTok login (`server/oauth.js`) or tokens pasted by hand.
- Analysis compares every number with the previous period of equal length. Periods: 7, 30, 90 days or a custom inclusive range ending yesterday at the latest.
- The PDF report is generated on the server with pdfkit from the same analytics object as the dashboard.
- Content plan and appointments are shared by the studio, span every client, and are never filtered automatically by the client switcher. Content is planned, not published.
- Graphic editor: posts, stories and reels per client. Colors and fonts can reference the client style (`@primary`, `@heading`, `@logo`). One renderer (`public/js/editor/render.js`) draws preview and exports; reels export as MP4 in real time via MediaRecorder.
