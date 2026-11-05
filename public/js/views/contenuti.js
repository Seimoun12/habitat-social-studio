// Piano contenuti di tutto lo studio: post, storie, reel e TikTok, separati dagli appuntamenti.
// I contenuti si pianificano qui; la pubblicazione sui social resta manuale.
import { api, esc, state, openDialog, closeButton, confirmDialog, toast, isoLocal, PLATFORM_LABEL, platformLetter } from '../lib.js';
import { mountCalendar } from './calendar.js';

export const CONTENT_FORMATS = ['Post', 'Carosello', 'Storia', 'Reel', 'Video TikTok', 'Video', 'Presentazione'];
const STATUS = { bozza: 'Bozza', pronto: 'Pronto da pubblicare', pubblicato: 'Pubblicato' };

export async function renderContenuti(main, isCurrent) {
  main.innerHTML = `
    <div class="page-heading">
      <div><p class="eyebrow">Pianificazione · tutti i clienti</p><h1>Programmazione<br><em>contenuti.</em></h1>
        <p class="heading-copy">Post, storie, reel e TikTok di ogni cliente, con il progetto grafico collegato.</p></div>
      <button type="button" class="button button-accent" id="new-content"><span class="button-icon plus-icon" aria-hidden="true"></span>Programma contenuto</button>
    </div>
    <p class="calendar-note">Il piano non pubblica in automatico: quando un contenuto è online segnalalo come "Pubblicato".</p>
    <div id="cal"></div>`;

  const cal = mountCalendar(main.querySelector('#cal'), {
    kind: 'contents',
    noun: { one: 'contenuto', plural: 'i contenuti' },
    isCurrent,
    fetchItems: (from, to) => api(`/api/contents?from=${from}&to=${to}`),
    renderItem: (c) => {
      const who = state.client(c.clientId)?.name || 'Cliente eliminato';
      return `<button type="button" class="event-card" data-item="${esc(c.id)}" data-channel="${esc(c.channels[0])}" data-status="${esc(c.status)}">
        <span class="event-kind">${esc(c.format)}${c.status !== 'bozza' ? ` · ${esc(STATUS[c.status])}` : ''}</span>
        <strong>${esc(c.title)}</strong><span>${esc(c.time)} · ${esc(who)} · ${c.channels.map((p) => PLATFORM_LABEL[p]).join(', ')}</span></button>`;
    },
    onAdd: (date) => openContentDialog({ date }, done),
    onOpen: (c) => openContentDialog(c, done),
  });
  function done(date) {
    window.dispatchEvent(new Event('counts'));
    if (date) cal.goTo(date); else cal.draw();
  }
  main.querySelector('#new-content').addEventListener('click', () => openContentDialog({}, done));
  await cal.draw();
}

// Usata anche dall'editor grafico, con cliente, formato e progetto già scelti.
export function openContentDialog(item, onDone = () => {}) {
  const editing = Boolean(item.id);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const v = {
    title: '', clientId: state.currentId || state.clients[0]?.id || '', format: 'Post', channels: [], caption: '',
    date: isoLocal(tomorrow), time: '18:00', status: 'bozza', designId: null, ...item,
  };
  if (!v.channels.length) v.channels = ['instagram'];
  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Piano contenuti</p><h2 id="ct-title">${editing ? 'Modifica contenuto' : 'Programma un contenuto'}</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <label class="field"><span>Titolo interno</span><input type="text" name="title" maxlength="120" required value="${esc(v.title)}" placeholder="Es. Reel dietro le quinte"></label>
        <div class="form-row">
          <label class="field"><span>Cliente</span><select name="clientId" required>
            ${state.clients.map((c) => `<option value="${esc(c.id)}" ${v.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Formato</span><select name="format">${CONTENT_FORMATS.map((f) => `<option ${v.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        </div>
        <fieldset class="field"><legend>Canali</legend>
          <div class="check-grid">${Object.entries(PLATFORM_LABEL).map(([k, l]) => `<label class="check-option"><input type="checkbox" name="channels" value="${k}" ${v.channels.includes(k) ? 'checked' : ''}>${platformLetter(k)}${l}</label>`).join('')}</div>
        </fieldset>
        <label class="field"><span>Testo del contenuto <small data-count></small></span><textarea name="caption" rows="4" maxlength="2200" placeholder="Didascalia, hashtag, menzioni">${esc(v.caption)}</textarea></label>
        <label class="field"><span>Progetto grafico <small>(facoltativo)</small></span><select name="designId"><option value="">Carico i progetti…</option></select></label>
        <div class="form-row-3">
          <label class="field"><span>Data</span><input type="date" name="date" required value="${esc(v.date)}"></label>
          <label class="field"><span>Ora</span><input type="time" name="time" required value="${esc(v.time)}"></label>
          <label class="field"><span>Stato</span><select name="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot">
        ${editing ? '<button type="button" class="button button-ghost button-danger left" data-delete>Elimina</button>' : ''}
        <a class="button button-outline" data-open-design hidden>Apri progetto</a>
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="submit" class="button button-accent">${editing ? 'Salva modifiche' : 'Salva nel piano'}</button>
      </div>
    </form>`, { labelledBy: 'ct-title' });

  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  const count = dlg.querySelector('[data-count]');
  const openLink = dlg.querySelector('[data-open-design]');
  const syncCount = () => { count.textContent = `${form.caption.value.length} / 2200`; };
  syncCount();
  form.caption.addEventListener('input', syncCount);

  async function loadDesigns() {
    const sel = form.designId;
    sel.innerHTML = '<option value="">Carico i progetti…</option>';
    try {
      const list = await api(`/api/designs?clientId=${encodeURIComponent(form.clientId.value)}`);
      sel.innerHTML = `<option value="">Nessun progetto</option>${list.map((d) => `<option value="${esc(d.id)}" ${d.id === v.designId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}`;
    } catch { sel.innerHTML = '<option value="">Progetti non disponibili</option>'; }
    syncLink();
  }
  function syncLink() {
    const id = form.designId.value;
    openLink.hidden = !id;
    if (id) openLink.href = `#/cliente/${encodeURIComponent(form.clientId.value)}/editor/${encodeURIComponent(id)}`;
  }
  form.clientId.addEventListener('change', () => { v.designId = null; loadDesigns(); });
  form.designId.addEventListener('change', syncLink);
  openLink.addEventListener('click', () => dlg.close());
  loadDesigns();
  form.title.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const body = {
      title: form.title.value.trim(), clientId: form.clientId.value, format: form.format.value,
      channels: [...form.querySelectorAll('[name="channels"]:checked')].map((b) => b.value),
      caption: form.caption.value, designId: form.designId.value || null,
      date: form.date.value, time: form.time.value, status: form.status.value,
    };
    const problem = !body.title ? 'Scrivi un titolo interno.' : !body.clientId ? 'Scegli il cliente.' : !body.channels.length ? 'Scegli almeno un canale.' : !body.date || !body.time ? 'Indica data e ora.' : null;
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    try {
      await api(editing ? `/api/contents/${item.id}` : '/api/contents', { method: editing ? 'PUT' : 'POST', body });
      dlg.close();
      toast(editing ? 'Contenuto aggiornato.' : 'Contenuto salvato nel piano. La pubblicazione resta manuale.');
      onDone(body.date);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  dlg.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Eliminare il contenuto?', text: `"${item.title}" verrà tolto dal piano. Il progetto grafico collegato resta nello Studio.`, confirm: 'Elimina' });
    if (!ok) return;
    try {
      await api(`/api/contents/${item.id}`, { method: 'DELETE' });
      dlg.close();
      toast('Contenuto eliminato dal piano.');
      onDone();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}
