# Habitat visual direction

## Identity
Habitat is a social studio workspace. It helps a social media manager move between client profiles while keeping shared studio work, appointments and the content plan, in one place, and it makes each client's graphics in that client's own style.

## Audience and mood
For social media managers coordinating several clients across Instagram, Facebook, and TikTok. The interface feels like a contemporary creative studio: composed, tactile, and energetic in a few deliberate moments. It favors useful evidence over promotional language.

> Reading this as a multi-client social studio workspace for social media managers, in a composed creative-studio visual language, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Visual system
- Core colors: forest green `#173a32`, soft paper `#f6f7f0`, and ink `#17231f`. Acid leaf `#c8ec68` is the single accent, reserved for selected navigation, primary "create" actions and the selected editor tool. Download and report actions use the ink button, so leaf always means "this is where you are or what you add next".
- `DM Sans` carries dense controls and data legibly. `Playfair Display` gives client, section and report headings an editorial voice that separates the workspace from generic analytics software. Both are served locally (`@fontsource`) so the app and the PDF work offline and look the same.
- The main frame is a compact studio rail beside a fluid work area. The rail has two groups: CLIENTE (Panoramica, Analisi, Studio grafico, which follow the client switcher) and STUDIO · TUTTI I CLIENTI (Contenuti, Appuntamenti, Clienti), so it is always clear which pages change with the selected client.
- Small uppercase eyebrows (10px, 1px tracking) carry context only, "CLIENTE · SEZIONE", so the large Playfair title can stay a sentence. They never repeat the title.
- Navigation glyphs are drawn in CSS from the same 1.5px line as the chart axes: they belong to the studio, not to an icon library, and each one maps to its page (sheet, chart, frame, list, calendar, person).
- The wordmark mark is a lowercase "h." on a leaf petal shape, the initial of Habitat (the prototype still carried the "b." of an earlier name).
- Section titles are questions ("Quante persone ti seguono?", "Quale formato rende di più?"): each chart answers the question above it, in the same voice as the PDF sent to the client.
- Every number carries its comparison in one short form: value, signed change with arrow, and the dates of the previous period. Green and red never carry meaning alone.
- Flat white panels organize comparisons. Radii: 5px for controls, 8px for panels and dialogs. Shadows only on things that really lift: menus, dialogs, the editor canvas.
- Charts use the forest green series on a light wash, one series per chart. The leaf dot marks the latest value.
- Dark theme: the paper becomes a deep forest, leaf replaces forest green as the emphasis color so contrast stays AA. It follows the system preference until the user picks one.

## Editor
- The editor takes the whole window (the studio rail hides; "‹ Studio grafico" returns) because the canvas is the work. Tools on the left, canvas in the middle on a light checkerboard so transparent areas read as transparent, properties on the right, timeline under the canvas for reels.
- Client style colors appear as round swatches before any custom color: the fastest choice is always the on-brand one. Templates are drawn live with the client's colors, fonts and logo.
- Selection uses the focus green outline with white square handles and a leaf rotation handle; snapping guides are magenta because they must never be confused with content colors.

## Liveliness dials
ENERGY 2 / RHYTHM 2 / MOTION 1. Motion is limited to brief state transitions (menu opening, toast, button lift) and to the animations users add to their own reels. `prefers-reduced-motion` removes interface motion.

## Content and data
Demo client names, numbers, audience breakdowns and post titles are generated demonstration data. Whenever a channel is not connected the screen and the PDF say "Dati demo". Connected channels show the platform's own numbers; anything a platform does not provide is explained, not shown as zero. Template texts are instructions to replace ("Scrivi qui il titolo del post"), never fake content.
