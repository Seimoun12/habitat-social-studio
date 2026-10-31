---
name: aggiungi-metrica
description: Procedura per aggiungere o modificare una metrica (es. visite al profilo, clic sul link, tempo di visione) in tutta la catena connettori → dati demo → analytics → dashboard → PDF. Usala quando chiedono un nuovo numero, una nuova colonna o un nuovo grafico nelle analisi.
---

# Aggiungere una metrica

Una metrica attraversa sempre gli stessi file, in quest'ordine. Saltarne uno crea differenze tra dashboard e PDF.

1. **Domanda**: scrivi la domanda a cui risponde ("Quante persone hanno visitato il profilo?"). Diventa titolo o etichetta. Se nessuna domanda regge, la metrica non serve (anti-slop C-3).
2. **Connettori** (`server/connectors/*.js`): leggi il valore dall'API. Se una piattaforma non lo fornisce, lascia `null` e aggiungi una spiegazione in `unavailable`. Mai `0` al posto di "non disponibile".
3. **Demo** (`server/demo.js`): genera il valore in modo deterministico (usa `rng(hash(...))` con una chiave nuova) e rispetta gli stessi limiti della piattaforma reale.
4. **Calcolo** (`server/analytics.js`): aggiungi la chiave a `totals()` o a `series`. Il periodo precedente si calcola da solo.
5. **Sintesi** (`server/summary.js`): solo se la metrica cambia il giudizio sul periodo.
6. **Dashboard** (`public/js/views/analisi.js`): aggiungi la riga a `metricRows` o una sezione nuova. Ogni numero porta il suo confronto con `delta()`. Per un grafico usa `lineChart` o `columnChart` da `public/js/charts.js`: una serie per grafico, titolo = domanda.
7. **PDF** (`server/report.js`): aggiungi la riga nella sezione corrispondente; se è una sezione nuova, aggiungila a `REPORT_SECTIONS` (compare da sola nella finestra "Scarica report").
8. **Test**: aggiungi un'asserzione in `scripts/smoke.mjs`, poi `npm run check` e `npm run ui-check`.
9. **Anti-slop**: chiudi con il Delivery Gate (skill `antislop`), in particolare R-17 e R-38: nessun numero senza fonte.

## Formule usate

- Interazioni = mi piace + commenti + condivisioni + salvataggi (i campi `null` contano 0).
- Tasso di coinvolgimento = interazioni / copertura × 100 (Instagram, Facebook); interazioni / visualizzazioni × 100 (TikTok, che non fornisce la copertura).
- Variazione = (periodo − precedente) / precedente × 100; per i tassi si mostra la differenza in punti.
- Periodo precedente = stessa durata, finisce il giorno prima dell'inizio.
