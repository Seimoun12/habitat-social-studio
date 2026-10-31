// Parti condivise da Panoramica e Analisi: scelta di canale e periodo, variazioni, avvisi sui dati demo.
import { api, esc, PLATFORM_LABEL } from '../lib.js';
import { fmtInt, fmtPct, fmtSigned, pctChange, fmtShortDate } from '../format.js';

export const PERIODS = { '7d': '7 giorni', '30d': '30 giorni', '90d': '90 giorni', custom: 'Intervallo' };

// Canale e periodo restano quelli scelti l'ultima volta, anche cambiando cliente o pagina.
export function loadPrefs() {
  const base = { platform: 'instagram', period: '30d', from: '', to: '' };
  try { return { ...base, ...JSON.parse(localStorage.getItem('analisi') || '{}') }; } catch { return base; }
}
export function savePrefs(p) { try { localStorage.setItem('analisi', JSON.stringify(p)); } catch { /* storage non disponibile */ } }

export const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
export const rangeQuery = (p) => (p.period === 'custom' ? `from=${p.from}&to=${p.to}` : `preset=${p.period}`);

export function fetchAnalytics(client, prefs) {
  return api(`/api/clients/${encodeURIComponent(client.id)}/analytics?platform=${prefs.platform}&${rangeQuery(prefs)}`);
}

// Variazione rispetto al periodo precedente: segno, freccia e colore insieme.
export function delta(cur, prev, { mode = 'pct', invert = false, vs } = {}) {
  if (cur == null || prev == null) return '';
  const diff = mode === 'pct' ? pctChange(cur, prev) : cur - prev;
  if (diff == null) return '';
  const rounded = mode === 'pct' ? Math.round(diff * 10) / 10 : mode === 'points' ? Math.round(diff * 100) / 100 : Math.round(diff);
  const dir = rounded === 0 ? 'flat' : (rounded > 0) !== invert ? 'up' : 'down';
  const arrow = rounded === 0 ? '' : rounded > 0 ? '▲' : '▼';
  const text = mode === 'pct' ? `${fmtSigned(diff, 1)}%` : mode === 'points' ? `${fmtSigned(diff, 2)} punti` : fmtSigned(diff);
  return `<span class="delta ${dir}"><span aria-hidden="true">${arrow}</span>${esc(text)}${vs ? `<span class="vs">${esc(vs)}</span>` : ''}</span>`;
}

export function stat(label, value, deltaHtml) {
  return `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${deltaHtml || ''}</div>`;
}

export function demoNotice(a, client) {
  if (a.source === 'demo') {
    return `<div class="demo-notice" role="note"><span class="notice-mark" aria-hidden="true">i</span><span><strong>Dati demo.</strong> ${esc(a.platformLabel)} non è collegato per ${esc(client.name)}: i numeri sono generati per prova e non vengono dall'account. <a href="#/clienti">Collega l'account</a></span></div>`;
  }
  if (a.warnings.length) return `<div class="demo-notice" role="note"><span class="notice-mark" aria-hidden="true">i</span><span><strong>Alcuni dati mancano.</strong> ${a.warnings.map(esc).join(' ')}</span></div>`;
  return '';
}

export function rankItem(p) {
  return `
    <li>
      <span class="c-title">${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener">${esc(p.caption)}</a>` : esc(p.caption)}</span>
      <span class="c-rate">${esc(fmtPct(p.engagementRate))}</span>
      <span class="c-meta">${esc(p.format)} · ${esc(fmtShortDate(p.date))} · ${esc(fmtInt(p.views))} visualizzazioni · ${esc(fmtInt(p.interactions))} interazioni</span>
    </li>`;
}

// Barra filtri: canale, periodo e date personalizzate. Chiama onChange quando i filtri sono validi.
export function filterBar(prefs) {
  return `
    <form class="toolbar" id="filters" novalidate>
      <label class="field"><span>Canale</span>
        <select name="platform">${Object.entries(PLATFORM_LABEL).map(([k, v]) => `<option value="${k}" ${k === prefs.platform ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      <fieldset class="field"><legend>Periodo</legend>
        <div class="segmented" role="group" aria-label="Periodo">${Object.entries(PERIODS).map(([k, v]) => `<button type="button" data-period="${k}" aria-pressed="${k === prefs.period}">${v}</button>`).join('')}</div>
      </fieldset>
      <div class="custom-range" id="custom-range" ${prefs.period === 'custom' ? '' : 'hidden'}>
        <label class="field"><span>Dal</span><input type="date" name="from" value="${esc(prefs.from)}" max="${yesterday()}"></label>
        <label class="field"><span>Al</span><input type="date" name="to" value="${esc(prefs.to)}" max="${yesterday()}"></label>
        <button type="submit" class="button button-outline">Applica</button>
      </div>
      <p class="compare" id="compare"></p>
    </form>
    <p class="form-error" id="filter-error" role="alert" hidden></p>`;
}

export function bindFilters(root, prefs, load) {
  const form = root.querySelector('#filters');
  const err = root.querySelector('#filter-error');
  const run = () => {
    err.hidden = true;
    if (prefs.period === 'custom') {
      if (!prefs.from || !prefs.to) { err.textContent = 'Scegli la data di inizio e quella di fine, poi premi Applica.'; err.hidden = false; return; }
      if (prefs.from > prefs.to) { err.textContent = 'La data di inizio viene dopo la data di fine.'; err.hidden = false; return; }
    }
    savePrefs(prefs);
    load();
  };
  form.platform.addEventListener('change', () => { prefs.platform = form.platform.value; run(); });
  form.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => {
    prefs.period = b.dataset.period;
    form.querySelectorAll('[data-period]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    form.querySelector('#custom-range').hidden = prefs.period !== 'custom';
    if (prefs.period === 'custom' && (!prefs.from || !prefs.to)) { form.from.focus(); return; }
    run();
  }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    prefs.from = form.from.value;
    prefs.to = form.to.value;
    run();
  });
  return run;
}

export const loadingLine = (prefs) => {
  const what = prefs.period === 'custom' ? `dal ${fmtShortDate(prefs.from)} al ${fmtShortDate(prefs.to)}` : `ultimi ${PERIODS[prefs.period]}`;
  return `<p class="loading-line">Carico i dati di ${esc(PLATFORM_LABEL[prefs.platform])}, ${esc(what)}…</p>`;
};

export const errorBox = (e) => `<div class="error-box" role="alert"><p><strong>Non riesco a caricare le analisi.</strong></p><p>${esc(e.message)}</p>
  <p><button type="button" class="button button-outline" data-retry>Riprova</button></p></div>`;
