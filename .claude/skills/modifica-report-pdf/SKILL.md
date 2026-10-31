---
name: modifica-report-pdf
description: Come modificare il report PDF per i clienti (sezioni, testi, impaginazione, grafici) in server/report.js e come verificarne l'aspetto. Usala quando chiedono di cambiare il report, aggiungere una sezione al PDF, cambiare intestazione, colori o ordine.
---

# Modificare il report PDF

Il PDF si genera in `server/report.js` con pdfkit, partendo dallo stesso oggetto delle analisi a schermo (`getAnalytics`). Non ricalcolare numeri nel report: se manca un dato, aggiungilo in `analytics.js` (skill `aggiungi-metrica`).

## Struttura

- `REPORT_SECTIONS`: chiave → titolo. L'ordine qui è l'ordine nel PDF e nella finestra "Scarica report" (che legge `/api/report-sections`).
- `SECTION[chiave](a)`: disegna una sezione per un canale.
- Strumenti: `heading`, `note`, `stats` (riga di numeri), `table`, `lineChart`, `bars`, `contentTable`. Usa `ensure(altezza)` prima di disegnare blocchi che non devono spezzarsi tra due pagine.
- Il testo passa sempre da `t()`: i font standard di pdfkit (Helvetica) coprono le lettere accentate italiane ma non il segno meno tipografico, che viene convertito.
- Se un canale ha dati demo, l'intestazione lo dichiara in rosso. Non togliere questa riga (anti-slop R-38).

## Verifica visiva

1. Server attivo, poi:
   ```bash
   curl -s -o report.pdf -X POST localhost:3000/api/clients/<id>/report -H 'Content-Type: application/json; charset=utf-8' --data-binary '{"platforms":["instagram","facebook","tiktok"],"sections":["sintesi","pubblico","interazioni","coinvolgimento","formati","migliori","peggiori","demografia"],"preset":"30d","notes":"Prova"}'
   ```
2. Converti le pagine in immagini per guardarle (es. PyMuPDF in una cartella temporanea: `pip install --target <tmp> pymupdf`, poi `page.get_pixmap(dpi=70).save(...)`) e controlla: tabelle allineate, nessun testo tagliato, salti pagina sensati, numero di pagina in basso.
3. `npm run check` conferma che il PDF si genera con tutte le sezioni.
