---
name: avvia-dashboard
description: Avvia Habitat (dashboard clienti social ed editor grafico), verifica che funzioni (test API e click-through in Chrome) e produce screenshot. Usala quando chiedono di avviare, provare, verificare o fotografare l'app, o prima di consegnare qualsiasi modifica.
---

# Avviare e verificare la dashboard

## Avvio

1. Dipendenze: `npm install` (serve Node 20 o più recente).
2. `npm start` avvia su http://localhost:3000. Con `PORT=4000 npm start` cambia porta.
3. Per sviluppo: `npm run dev` (si riavvia quando cambiano i file in `server/`). I file in `public/` non richiedono riavvio: basta ricaricare la pagina.

Avvia il server in background e fermalo alla fine **per PID della porta**, non uccidendo tutti i processi `node`:

```bash
pid=$(netstat -ano | grep ":3000 .*LISTENING" | awk '{print $5}' | head -1); taskkill //F //PID $pid
```

## Verifica (obbligatoria prima di consegnare, regola anti-slop R-35)

1. `npm run check`: controlli sulle API (analisi per ogni canale e periodo, validazioni, PDF, clienti, appuntamenti, token che non escono dal server). Deve finire con `0 falliti`.
2. `npm run ui-check <cartella>`: apre Chrome, genera foto e video di prova nel browser e prova ogni sezione: Panoramica (canale, periodo, intervallo, tooltip), selettore clienti da tastiera, Analisi e report PDF, Clienti, stile del cliente con logo, editor post (modello, selezione, trascinamento, annulla, forme, immagini, PNG, Programma), editor reel (clip, durata letta dal file, testo animato, riproduzione, esportazione MP4), Contenuti, Appuntamenti con .ics, tema scuro, nessuno sbordo a 390px. Deve finire con `0 FAIL`.
3. Guarda davvero gli screenshot (`light-panoramica.png`, `light-editor-post.png`, `light-editor-reel.png`, `light-stile.png`, `dark-*.png`, `mobile-*.png`): i test non vedono sovrapposizioni o etichette tagliate. Se c'è ffmpeg, `ffprobe tmp/ui-check/downloads/*.mp4` deve mostrare una traccia h264 e una aac.
4. Se hai cambiato il PDF, generane uno e guardane le pagine (vedi skill `modifica-report-pdf`).

Entrambi gli script usano un server e una cartella dati temporanei: i dati reali in `data/` restano intatti.

## Se qualcosa non va

- `EADDRINUSE`: la porta è occupata. Usa un'altra `PORT` o ferma il processo come sopra.
- `ui-check` non trova Chrome: imposta `CHROME_PATH` al percorso di `chrome.exe`.
- Pagina bianca: apri la console del browser; gli errori JS compaiono anche nel report di `ui-check` ("console errors").
