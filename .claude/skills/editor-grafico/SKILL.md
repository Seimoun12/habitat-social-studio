---
name: editor-grafico
description: Come estendere l'editor grafico di Habitat (post, storie, reel): nuovi modelli, elementi, proprietà, animazioni, formati o opzioni di esportazione. Usala quando chiedono funzioni "tipo Canva", modifiche all'editor o allo stile del cliente.
---

# Estendere l'editor grafico

File in `public/js/editor/`:

- `model.js`: formati (`FORMATS`), caratteri (`FONTS`, con spec Google Fonts), ruoli dello stile (`BRAND_COLORS`, `BRAND_FONTS`), costruttori dei livelli (`textLayer`, `shapeLayer`, `imageLayer`), modelli (`POST_TEMPLATES`, `REEL_TEXTS`) e animazioni (`ANIMS`).
- `render.js`: **unico punto di disegno**. Anteprima, PNG/JPG, anteprime della galleria e fotogrammi del video passano da `renderDoc`. Una proprietà nuova si disegna qui, mai solo nell'interfaccia.
- `reel.js`: timeline, riproduzione (`ReelEngine`), durata dei file (`mediaDuration`), esportazione (`exportReel`).
- `editor.js`: interfaccia (tela, maniglie, pannelli, timeline, cronologia, salvataggio automatico).

## Ricette

- **Nuovo modello**: aggiungi un oggetto a `POST_TEMPLATES` con `build({ w, h })` che restituisce livelli in coordinate proporzionali. Usa i riferimenti allo stile (`'@primary'`, `'@heading'`, `assetId: '@logo'`), così il modello si adatta a ogni cliente. I testi sono istruzioni ("Scrivi qui..."), mai contenuti finti.
- **Nuova proprietà di un livello**: valore predefinito nel costruttore in `model.js`, disegno in `render.js`, campo in `renderProps()` di `editor.js` con `data-prop` (e `data-type="number"` o `"bool"` se serve). Checkbox e menu entrano nella cronologia subito, gli altri campi al `change`.
- **Nuova animazione**: voce in `ANIMS`, calcolo in `renderDoc` (blocco `layer.anim`).
- **Nuovo formato**: voce in `FORMATS` di `model.js` e in `FORMATS` di `server/index.js` (validazione).

## Vincoli

- I progetti si salvano sul server (`PUT /api/designs/:id`) con un ritardo di circa un secondo; l'anteprima PNG va in `data/thumbs`.
- L'esportazione video è in tempo reale e richiede la scheda in primo piano. Non togliere la sorgente di silenzio in `exportReel`: senza audio Chrome tronca l'MP4.
- I file WebM registrati dai browser non dichiarano la durata: usa sempre `mediaDuration`.
- Dopo ogni modifica: `npm run ui-check` (prova editor post e reel ed esporta un MP4) e guarda `light-editor-*.png`.
