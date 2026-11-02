# CLAUDE.md

Habitat: spazio di lavoro per una social media manager che segue più clienti. Analisi Instagram/Facebook/TikTok per cliente, report PDF, piano contenuti e appuntamenti condivisi dallo studio, editor grafico per post e reel con lo stile salvato per ogni cliente. Interfaccia e testi in italiano.

Nato dalla fusione di due progetti: la grafica e la struttura di Habitat, le funzioni (server, connettori, analisi, PDF) di sitosimona.

## Regole sempre attive

- **Anti-slop, modalità DURING.** Per ogni lavoro su interfaccia, testi o commenti carica le skill in `.claude/skills/antislop*` (core + quella pertinente) e chiudi con il report Delivery Gate PASS/FAIL di [antislop.md](antislop.md). La modalità è già scelta: non chiederla di nuovo.
- **Direzione visiva in [DESIGN.md](DESIGN.md)** (dial ENERGY 2 / RHYTHM 2 / MOTION 1). Ogni nuova scelta visiva va motivata lì.
- **Mai numeri inventati presentati come reali.** I dati demo restano etichettati come tali, a schermo e nel PDF.
- **I token di accesso non escono mai dal server** (`publicClient` in `server/store.js`, `metaPending` in `server/oauth.js`). Non loggarli.
- **Dall'esterno si vede solo il link del cliente.** Il filtro in cima a `server/index.js` lascia passare da tunnel o rete solo `/collega/*`, il login e i caratteri; un login senza link valido parte solo da localhost. Ogni nuova rotta pubblica va aggiunta lì di proposito.
- Il calendario appuntamenti è dello studio: non si filtra mai in automatico per il cliente selezionato.
- Niente em dash (—) nei testi visibili.

## Comandi

- `npm start`: avvia su http://localhost:3000 (`PORT` per cambiare).
- `npm run dev`: riavvio automatico a ogni modifica del server.
- `npm run check`: test API senza browser (server e dati temporanei).
- `npm run ui-check [cartella]`: click-through in Chrome di ogni sezione, editor ed esportazione video compresi, con screenshot chiaro/scuro/telefono. Richiede Chrome (`CHROME_PATH`).

Entrambi i test usano una cartella dati temporanea: non toccano `data/`.

## Architettura

```
server/
  index.js        API Express, file statici, caricamenti (corpo = file), /media/:id
  store.js        archivio JSON in data/db.json: clienti (+ stile), appuntamenti, contenuti,
                  progetti grafici, file; file in data/uploads, anteprime in data/thumbs
  oauth.js        login Meta e TikTok (PKCE), scelta Pagina/account, rinnovo token TikTok
  invite-page.js  pagina pubblica /collega/:link per il cliente (HTML dal server, senza script)
  analytics.js    UNICO punto di calcolo: periodo + confronto, totali, coinvolgimento, formati, classifiche
  summary.js      frasi della sintesi, costruite dai numeri (niente modelli generativi)
  report.js       PDF con pdfkit, caratteri e colori Habitat, stesse cifre della dashboard
  demo.js         dati demo deterministici, con gli stessi limiti delle API reali
  connectors/     instagram.js, facebook.js, tiktok.js, common.js (versione Graph in META_GRAPH_VERSION)
public/
  js/app.js       router: #/cliente/:id/(panoramica|analisi|studio[/tab]|editor/:progetto),
                  #/contenuti, #/appuntamenti, #/clienti; tema; ritorno da OAuth
  js/settings.js  Impostazioni (tema, tutorial) in localStorage "habitat-impostazioni"
  js/tour.js      tutorial di benvenuto: passi con route + selettore; se un selettore cambia, aggiorna STEPS
  js/views/       panoramica, analisi, analytics-common, report-dialog, calendar (settimana/mese),
                  contenuti, appuntamenti, clienti, studio
  js/editor/      model.js (formati, caratteri, stile, modelli), render.js (disegno unico per
                  anteprima ed esportazione), reel.js (riproduzione e registrazione MP4), editor.js (UI)
  css/app.css     token Habitat e componenti; css/editor.css
```

## Contratto dei connettori

Ogni connettore (`fetchX(conn, from, to)`) e `demoData()` restituiscono:

```js
{
  daily: [{ date, followers, gained, lost, views, reach, likes, comments, shares, saves }], // null = non disponibile
  posts: [{ id, date, format, caption, permalink, views, reach, likes, comments, shares, saves }],
  demographics: { gender: [{label, value}], age: [...], locations: [...] } | null, // value = quota 0..1
  unavailable: { demographics?: string, gainedLost?: string },
  warnings: [string],
  currentFollowers: number | null,
  accountLabel: string | null,
}
```

Una metrica che la piattaforma non fornisce è `null`, mai `0`: l'interfaccia la nasconde.
I connettori reali non sono ancora stati provati con account veri.

## Modello dei progetti grafici

`design.doc = { w, h, background: {color, color2, angle}, layers: [...], clips?, audio?, clipVolume? }`.
Colori e caratteri possono essere riferimenti allo stile del cliente (`@primary`, `@heading`, logo `@logo`): restano collegati se lo stile cambia. `render.js` è l'unico punto di disegno: editor, PNG, anteprime e fotogrammi del video passano da lì. L'esportazione video registra la tela con MediaRecorder in tempo reale; una sorgente di silenzio tiene viva la traccia audio (senza, Chrome tronca l'MP4).

## Skill di progetto

- `avvia-dashboard`: avviare, verificare e fare screenshot.
- `collega-account`: login Meta/TikTok, token e errori dei connettori (guida utente in [COLLEGAMENTI.md](COLLEGAMENTI.md)).
- `aggiungi-metrica`: portare una nuova metrica da connettore a dashboard e PDF.
- `modifica-report-pdf`: cambiare sezioni e impaginazione del report.
- `editor-grafico`: aggiungere modelli, elementi, animazioni o formati all'editor.
- `antislop*`: regole anti-slop (MIT, da github.com/miqdadbadjuber/anti-slop).
