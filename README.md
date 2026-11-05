# Habitat · Social studio

Spazio di lavoro per una social media manager che segue più clienti: analisi di Instagram, Facebook e TikTok, report PDF, piano contenuti, appuntamenti dello studio ed editor grafico per post e reel con lo stile di ogni cliente.

## Avvio

Serve Node.js 20 o più recente.

```bash
npm install
npm start
```

Poi apri http://localhost:3000.

**Su un server (VPS)**: per entrare da internet imposta una password. `npm run password` la chiede senza mostrarla e stampa la riga `HABITAT_PASSWORD_HASH=...` da mettere in `.env`, insieme a una `SESSION_SECRET` lunga e casuale. Senza queste righe da fuori si vede solo il link del cliente. Metti Habitat dietro https (nginx o simili) che inoltri `X-Forwarded-For` e `X-Forwarded-Proto`. Dopo 5 password sbagliate si aspetta 15 minuti.

## Cosa c'è

**Per ogni cliente** (selettore in alto):
- **Panoramica**: follower, interazioni, visualizzazioni e coinvolgimento con il confronto sul periodo precedente, andamento dei follower, pubblico, contenuti da replicare e da rivedere, prossimi contenuti in programma.
- **Analisi**: tutti i numeri per canale e periodo (7, 30, 90 giorni o date a scelta), formati, classifiche, genere, età e città. **Scarica report** crea il PDF per il cliente.
- **Studio grafico**: progetti (post quadrati e verticali, storie, reel e TikTok, video orizzontali), **stile del cliente** (cinque colori, caratteri per titoli e testi, logo, note) e file caricati.

**Per tutto lo studio**:
- **Contenuti**: piano editoriale a settimana o mese, con il progetto grafico collegato e lo stato (bozza, pronto, pubblicato).
- **Appuntamenti**: calendario unico dello studio, esportabile in `.ics`.
- **Clienti**: aggiunta, modifica, collegamento degli account con il login Meta e TikTok.

Al primo avvio un **tutorial** mostra dove si trova ogni cosa. In **Impostazioni** (in basso nella barra laterale) lo spegni del tutto, lo riattivi o lo rivedi, e scegli il tema. Le impostazioni valgono per il browser in uso.

## Editor grafico

- **Post e storie**: modelli già nello stile del cliente, testi, forme, foto e logo. Si trascina, si ridimensiona, si ruota; annulla e ripeti, aggancio al centro e ai bordi, livelli. Esporta PNG o JPG a 1080 px.
- **Reel e TikTok**: clip video e foto in sequenza con taglio, divisione al cursore, zoom lento, dissolvenza e filtri; testi a tempo con animazioni; musica con volume. Esporta un MP4 1080×1920 (H.264 e AAC) registrato in tempo reale nel browser: un reel di 30 secondi richiede 30 secondi.
- I colori e i caratteri del cliente sono collegati: se cambi lo stile del cliente, i progetti che li usano si aggiornano.
- **Programma** mette il progetto nel piano contenuti.

L'esportazione video usa Chrome o Edge aggiornati. La pubblicazione sui social resta manuale.

## Dati demo e dati reali

Finché un canale non è collegato, i numeri sono **dati demo** generati per prova, e lo si legge a schermo e nel PDF. Per collegare gli account segui [COLLEGAMENTI.md](COLLEGAMENTI.md).

I token, i progetti e i file caricati restano nella cartella `data/` su questo computer.

## Verifica

- `npm run check`: test delle API.
- `npm run ui-check`: prova i controlli in Chrome (compresi editor ed esportazione video) e salva screenshot in `tmp/ui-check`.

## Per chi sviluppa

Architettura e regole in [CLAUDE.md](CLAUDE.md) e [AGENTS.md](AGENTS.md), direzione visiva in [DESIGN.md](DESIGN.md), filtro anti-slop in [antislop.md](antislop.md).
