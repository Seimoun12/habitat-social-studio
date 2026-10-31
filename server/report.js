// Report PDF per il cliente, disegnato con pdfkit. Legge lo stesso oggetto
// delle analisi a schermo, così i numeri del PDF coincidono con la dashboard.
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { buildSummary } from './summary.js';
import { fmtInt, fmtPct, fmtSigned, pctChange, fmtDate, fmtShortDate, fmtRange } from '../public/js/format.js';

export const REPORT_SECTIONS = {
  sintesi: 'Sintesi',
  pubblico: 'Crescita del pubblico',
  interazioni: 'Interazioni',
  coinvolgimento: 'Tasso di coinvolgimento',
  formati: 'Rendimento per formato',
  migliori: 'I 5 contenuti migliori',
  peggiori: 'I 5 contenuti meno performanti',
  demografia: 'Chi ti segue: genere, età e luogo',
};

// Colori e caratteri Habitat (vedi DESIGN.md): inchiostro, verde bosco per i grafici, DM Sans e Playfair Display.
const INK = '#17231f';
const MUTED = '#5d6b63';
const RULE = '#dfe5db';
const ACCENT = '#315d48';
const FOREST = '#173a32';
const LEAF = '#c8ec68';
const DOWN = '#a44b39';
const M = 48;
const FONT_DIR = path.resolve('node_modules/@fontsource');
const FONTS = {
  Body: 'dm-sans/files/dm-sans-latin-400-normal.woff',
  BodyBold: 'dm-sans/files/dm-sans-latin-700-normal.woff',
  Display: 'playfair-display/files/playfair-display-latin-500-normal.woff',
};

// Il segno meno tipografico diventa un trattino: non tutti i sottoinsiemi del carattere lo contengono.
const t = (s) => String(s).replace(/−/g, '-');

// Restituisce il PDF come Buffer: un errore durante il disegno non lascia un file a metà.
export function renderReport({ client, analyses, sections, notes }) {
  return new Promise((resolve, reject) => {
    try { draw({ client, analyses, sections, notes }, resolve); } catch (e) { reject(e); }
  });
}

function draw({ client, analyses, sections, notes }, done) {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: `Report ${client.name}` } });
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, path.join(FONT_DIR, file));
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => done(Buffer.concat(chunks)));
  const W = doc.page.width - M * 2;
  const bottom = () => doc.page.height - M;
  const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };


  function rule() {
    doc.moveDown(0.8);
    doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.moveDown(0.8);
  }

  function heading(text, size = 13) {
    ensure(60);
    doc.font('Display').fontSize(size + 2).fillColor(INK).text(t(text), M, doc.y, { width: W });
    doc.moveDown(0.4);
  }

  function note(text) {
    doc.font('Body').fontSize(9).fillColor(MUTED).text(t(text), M, doc.y, { width: W });
    doc.moveDown(0.4);
  }

  function stats(items) {
    ensure(54);
    const y = doc.y;
    const colW = W / items.length;
    items.forEach(([label, value, sub], i) => {
      const x = M + i * colW;
      doc.font('Body').fontSize(9).fillColor(MUTED).text(t(label), x, y, { width: colW - 8 });
      doc.font('BodyBold').fontSize(17).fillColor(INK).text(t(value), x, y + 13, { width: colW - 8 });
      if (sub) doc.font('Body').fontSize(8.5).fillColor(MUTED).text(t(sub), x, y + 34, { width: colW - 8 });
    });
    doc.y = y + 54;
    doc.x = M;
  }

  function table(cols, rows) {
    const widths = cols.map((c) => c.w * W);
    const rowH = 18;
    const drawHeader = () => {
      let x = M;
      const y = doc.y;
      doc.font('BodyBold').fontSize(8.5).fillColor(MUTED);
      cols.forEach((c, i) => { doc.text(t(c.label), x + 2, y, { width: widths[i] - 4, align: c.align || 'left', lineBreak: false }); x += widths[i]; });
      doc.y = y + 14;
      doc.moveTo(M, doc.y - 3).lineTo(M + W, doc.y - 3).lineWidth(0.5).strokeColor(RULE).stroke();
    };
    ensure(rowH * 2 + 14);
    drawHeader();
    for (const row of rows) {
      if (doc.y + rowH > bottom()) { doc.addPage(); drawHeader(); }
      let x = M;
      const y = doc.y;
      doc.font('Body').fontSize(9).fillColor(INK);
      row.forEach((cell, i) => {
        doc.text(t(cell ?? ''), x + 2, y, { width: widths[i] - 4, align: cols[i].align || 'left', lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.y = y + rowH;
    }
    doc.x = M;
    doc.moveDown(0.6);
  }

  function lineChart(points, label) {
    const vals = points.map((p) => p.v).filter((v) => v != null);
    if (vals.length < 2) return;
    const h = 120;
    ensure(h + 30);
    const top = doc.y;
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    min -= pad; max += pad;
    const x = (i) => M + 40 + (i / (points.length - 1)) * (W - 40);
    const y = (v) => top + h - ((v - min) / (max - min)) * h;
    doc.font('Body').fontSize(8).fillColor(MUTED);
    [min + pad, max - pad].forEach((v) => {
      doc.text(fmtInt(v), M, y(v) - 4, { width: 36, align: 'right', lineBreak: false });
      doc.moveTo(M + 40, y(v)).lineTo(M + W, y(v)).lineWidth(0.4).strokeColor(RULE).stroke();
    });
    let started = false;
    points.forEach((p, i) => {
      if (p.v == null) return;
      if (!started) { doc.moveTo(x(i), y(p.v)); started = true; } else doc.lineTo(x(i), y(p.v));
    });
    doc.lineWidth(1.6).strokeColor(ACCENT).lineJoin('round').stroke();
    doc.text(fmtDate(points[0].d), M + 40, top + h + 6, { lineBreak: false });
    doc.text(fmtDate(points[points.length - 1].d), M, top + h + 6, { width: W, align: 'right', lineBreak: false });
    doc.y = top + h + 22;
    doc.x = M;
    note(label);
  }

  function bars(title, rows) {
    ensure(20 + rows.length * 16);
    doc.font('BodyBold').fontSize(10).fillColor(INK).text(t(title), M, doc.y);
    doc.moveDown(0.3);
    const labelW = 110;
    const barMax = W - labelW - 60;
    const top = Math.max(...rows.map((r) => r.value), 0.0001);
    for (const r of rows) {
      const y = doc.y;
      doc.font('Body').fontSize(9).fillColor(INK).text(t(r.label), M, y, { width: labelW - 8, lineBreak: false, ellipsis: true });
      const w = Math.max(2, (r.value / top) * barMax);
      doc.roundedRect(M + labelW, y + 1, w, 9, 2).fill(ACCENT);
      doc.fillColor(MUTED).text(fmtPct(r.value * 100, 1), M + labelW + w + 6, y, { lineBreak: false });
      doc.y = y + 16;
    }
    doc.x = M;
    doc.moveDown(0.6);
  }

  function delta(cur, prev) {
    const d = pctChange(cur, prev);
    return d == null ? 'n/d' : `${fmtSigned(d, 1)}%`;
  }

  function contentTable(list) {
    if (!list.length) { note('Non ci sono abbastanza contenuti nel periodo per questa classifica.'); return; }
    const reachLabel = list[0].reach != null ? 'Copertura' : 'Visual.';
    table(
      [
        { label: 'Data', w: 0.12 }, { label: 'Formato', w: 0.12 }, { label: 'Contenuto', w: 0.38 },
        { label: reachLabel, w: 0.12, align: 'right' }, { label: 'Interazioni', w: 0.13, align: 'right' }, { label: 'Coinv.', w: 0.13, align: 'right' },
      ],
      list.map((p) => [fmtShortDate(p.date), p.format, p.caption, fmtInt(p.reach ?? p.views), fmtInt(p.interactions), fmtPct(p.engagementRate)]),
    );
  }

  const SECTION = {
    sintesi(a) {
      heading(REPORT_SECTIONS.sintesi);
      for (const line of buildSummary(a)) {
        ensure(18);
        doc.font('Body').fontSize(10.5).fillColor(INK).text(t(`· ${line}`), M, doc.y, { width: W, lineGap: 1.5 });
        doc.moveDown(0.25);
      }
      doc.moveDown(0.6);
    },
    pubblico(a) {
      heading(REPORT_SECTIONS.pubblico);
      const c = a.audience.current;
      const items = [
        ['Follower a fine periodo', fmtInt(c.end)],
        ['Variazione netta', c.net == null ? 'n/d' : fmtSigned(c.net), c.start ? `${fmtSigned((c.net / c.start) * 100, 1)}%` : null],
      ];
      if (c.gained != null) items.push(['Nuovi follower', fmtInt(c.gained)]);
      if (c.lost != null) items.push(['Follower persi', fmtInt(c.lost)]);
      stats(items);
      if (a.unavailable.gainedLost) note(a.unavailable.gainedLost);
      lineChart(a.series.map((s) => ({ d: s.date, v: s.followers })), 'Follower totali giorno per giorno.');
    },
    interazioni(a) {
      heading(REPORT_SECTIONS.interazioni);
      const cur = a.totals.current;
      const prev = a.totals.previous;
      const rows = [
        ['Visualizzazioni', 'views'], ['Copertura', 'reach'], ['Mi piace', 'likes'], ['Commenti', 'comments'],
        ['Condivisioni', 'shares'], ['Salvataggi', 'saves'], ['Totale interazioni', 'interactions'],
      ].filter(([, k]) => cur[k] != null);
      table(
        [{ label: 'Metrica', w: 0.4 }, { label: 'Periodo', w: 0.2, align: 'right' }, { label: 'Precedente', w: 0.2, align: 'right' }, { label: 'Variazione', w: 0.2, align: 'right' }],
        rows.map(([label, k]) => [label, fmtInt(cur[k]), fmtInt(prev[k]), delta(cur[k], prev[k])]),
      );
      note(`Contenuti pubblicati: ${a.postCount.current} (periodo precedente: ${a.postCount.previous}).`);
    },
    coinvolgimento(a) {
      heading(REPORT_SECTIONS.coinvolgimento);
      const cur = a.totals.current.engagementRate;
      const prev = a.totals.previous.engagementRate;
      stats([
        ['Periodo', fmtPct(cur)],
        ['Periodo precedente', fmtPct(prev)],
        ['Differenza', cur != null && prev != null ? `${fmtSigned(cur - prev, 2)} punti` : 'n/d'],
      ]);
      note(a.engagementBase === 'reach'
        ? 'Calcolo: (mi piace + commenti + condivisioni + salvataggi) diviso copertura, per 100.'
        : 'Calcolo: (mi piace + commenti + condivisioni) diviso visualizzazioni, per 100.');
      doc.moveDown(0.6);
    },
    formati(a) {
      heading(REPORT_SECTIONS.formati);
      if (!a.formats.length) { note('Nessun contenuto pubblicato nel periodo.'); return; }
      table(
        [{ label: 'Formato', w: 0.28 }, { label: 'Contenuti', w: 0.14, align: 'right' }, { label: 'Visual. medie', w: 0.2, align: 'right' }, { label: 'Interazioni medie', w: 0.2, align: 'right' }, { label: 'Coinv. medio', w: 0.18, align: 'right' }],
        a.formats.map((f) => [f.format, String(f.posts), fmtInt(f.avgViews), fmtInt(f.avgInteractions), fmtPct(f.avgEngagementRate)]),
      );
    },
    migliori(a) { heading(REPORT_SECTIONS.migliori); contentTable(a.ranking.best); },
    peggiori(a) { heading(REPORT_SECTIONS.peggiori); contentTable(a.ranking.worst); },
    demografia(a) {
      heading(REPORT_SECTIONS.demografia);
      if (!a.demographics) { note(a.unavailable.demographics || 'Dati demografici non disponibili.'); return; }
      bars('Genere', a.demographics.gender);
      bars('Età', a.demographics.age);
      bars('Città principali', a.demographics.locations);
      note('Le percentuali delle città sono calcolate sul totale delle città principali indicate dalla piattaforma.');
    },
  };

  const first = analyses[0];
  doc.rect(0, 0, doc.page.width, 6).fill(FOREST);
  doc.rect(M, 6, 64, 3).fill(LEAF);
  doc.font('BodyBold').fontSize(8).fillColor(MUTED).text('HABITAT · SOCIAL STUDIO', M, M, { characterSpacing: 1 });
  doc.moveDown(0.4);
  doc.font('Body').fontSize(10).fillColor(MUTED).text(t(`Report social · ${fmtRange(first.range)}`));
  doc.moveDown(0.3);
  doc.font('Display').fontSize(28).fillColor(INK).text(t(client.name));
  doc.moveDown(0.2);
  doc.font('Body').fontSize(10).fillColor(MUTED)
    .text(t(`${analyses.map((a) => a.platformLabel).join(', ')} · confronto con ${fmtRange(first.previous)}`));
  if (analyses.some((a) => a.source === 'demo')) {
    doc.moveDown(0.6);
    doc.font('BodyBold').fontSize(10).fillColor(DOWN)
      .text('Dati demo: i numeri di questo report sono generati per prova e non provengono dagli account del cliente.');
  }
  rule();

  if (notes?.trim()) {
    heading('Note', 14);
    doc.font('Body').fontSize(11).fillColor(INK).text(t(notes.trim()), { width: W, lineGap: 2 });
    rule();
  }

  analyses.forEach((a, i) => {
    if (i > 0) doc.addPage();
    doc.font('Display').fontSize(20).fillColor(INK).text(t(a.platformLabel + (a.accountLabel ? ` · ${a.accountLabel}` : '')));
    doc.moveDown(0.4);
    for (const key of Object.keys(REPORT_SECTIONS)) if (sections.includes(key)) SECTION[key](a);
  });

  doc.font('Body').fontSize(8).fillColor(MUTED);
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    doc.page.margins.bottom = 0; // altrimenti scrivere nel margine crea una pagina nuova
    doc.text(`Pagina ${p + 1} di ${range.count} · generato il ${fmtDate(new Date().toISOString().slice(0, 10))}`, M, doc.page.height - M + 16, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
}
