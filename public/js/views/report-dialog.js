// Finestra "Scarica report": si scelgono canali, periodo, sezioni e note, poi si scarica il PDF.
import { api, esc, openDialog, closeButton, toast, download, PLATFORM_LABEL, platformLetter } from '../lib.js';
import { yesterday } from './analytics-common.js';

const PERIODS = { '7d': 'Ultimi 7 giorni', '30d': 'Ultimi 30 giorni', '90d': 'Ultimi 90 giorni', custom: 'Altro (scegli le date)' };
let sectionsCache = null;

export async function openReportDialog(client, prefs) {
  if (!sectionsCache) {
    try { sectionsCache = await api('/api/report-sections'); } catch (e) { toast(e.message); return; }
  }
  const dlg = openDialog(`
    <form id="report-form" novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Report cliente</p><h2 id="rp-title">Cosa vuoi mandare a ${esc(client.name)}?</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <fieldset class="field"><legend>Canali</legend>
          <div class="check-grid">${Object.entries(PLATFORM_LABEL).map(([k, v]) => `
            <label class="check-option"><input type="checkbox" name="platforms" value="${k}" ${k === prefs.platform ? 'checked' : ''}>${platformLetter(k)}<span>${v}${client.connected[k] ? '' : '<br><span class="muted">dati demo</span>'}</span></label>`).join('')}</div>
        </fieldset>
        <div class="form-row">
          <label class="field"><span>Periodo</span>
            <select name="period">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${k === prefs.period ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <div></div>
          <label class="field" data-custom><span>Dal</span><input type="date" name="from" value="${esc(prefs.from)}" max="${yesterday()}"></label>
          <label class="field" data-custom><span>Al</span><input type="date" name="to" value="${esc(prefs.to)}" max="${yesterday()}"></label>
        </div>
        <fieldset class="field"><legend>Dati da includere</legend>
          <div class="check-grid two">${Object.entries(sectionsCache).map(([k, v]) => `
            <label class="check-option"><input type="checkbox" name="sections" value="${k}" checked><span>${esc(v)}</span></label>`).join('')}</div>
          <div><button type="button" class="text-button" data-toggle-all>Deseleziona tutto</button></div>
        </fieldset>
        <label class="field"><span>Note per il cliente <small>(facoltative, in apertura del report)</small></span>
          <textarea name="notes" maxlength="2000" placeholder="Il tuo commento sul periodo"></textarea>
        </label>
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot">
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="submit" class="button button-dark"><span class="button-icon download-icon" aria-hidden="true"></span><span data-label>Scarica PDF</span></button>
      </div>
    </form>`, { labelledBy: 'rp-title' });

  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  const submit = form.querySelector('[type="submit"]');
  const syncCustom = () => dlg.querySelectorAll('[data-custom]').forEach((el) => { el.hidden = form.period.value !== 'custom'; });
  syncCustom();
  form.period.addEventListener('change', syncCustom);

  const toggleAll = dlg.querySelector('[data-toggle-all]');
  const sectionBoxes = [...form.querySelectorAll('[name="sections"]')];
  const syncToggle = () => { toggleAll.textContent = sectionBoxes.every((b) => b.checked) ? 'Deseleziona tutto' : 'Seleziona tutto'; };
  toggleAll.addEventListener('click', () => {
    const all = sectionBoxes.every((b) => b.checked);
    sectionBoxes.forEach((b) => { b.checked = !all; });
    syncToggle();
  });
  sectionBoxes.forEach((b) => b.addEventListener('change', syncToggle));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const platforms = [...form.querySelectorAll('[name="platforms"]:checked')].map((b) => b.value);
    const sections = sectionBoxes.filter((b) => b.checked).map((b) => b.value);
    const body = { platforms, sections, notes: form.notes.value };
    if (form.period.value === 'custom') Object.assign(body, { from: form.from.value, to: form.to.value });
    else body.preset = form.period.value;

    const problem = !platforms.length ? 'Scegli almeno un canale.'
      : !sections.length ? 'Scegli almeno una sezione da includere.'
        : form.period.value === 'custom' && (!body.from || !body.to) ? 'Scegli la data di inizio e quella di fine.'
          : null;
    if (problem) { err.textContent = problem; err.hidden = false; return; }

    submit.disabled = true;
    submit.querySelector('[data-label]').textContent = 'Preparo il PDF…';
    try {
      const res = await api(`/api/clients/${encodeURIComponent(client.id)}/report`, { method: 'POST', body, raw: true });
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'report.pdf';
      download(await res.blob(), name);
      dlg.close();
      toast(`Report scaricato: ${name}`);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      submit.disabled = false;
      submit.querySelector('[data-label]').textContent = 'Scarica PDF';
    }
  });
}
