// Appuntamenti dello studio: un solo calendario per tutti i clienti, non legato al cliente attivo.
// Ogni appuntamento può indicare un cliente, ma non è obbligatorio.
import { api, esc, state, openDialog, closeButton, confirmDialog, toast, isoLocal, parseIso, download } from '../lib.js';
import { mountCalendar } from './calendar.js';

const dayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const CHANNELS = ['', 'Instagram', 'Facebook', 'TikTok', 'Studio'];

export async function renderAppuntamenti(main, isCurrent) {
  main.innerHTML = `
    <div class="page-heading">
      <div><p class="eyebrow">Spazio condiviso · tutti i clienti</p><h1>Appuntamenti<br><em>dello studio.</em></h1>
        <p class="heading-copy">Call, revisioni e shooting di tutti i clienti in un solo calendario.</p></div>
      <div class="heading-actions">
        <button type="button" class="button button-outline" id="export-ics"><span class="button-icon download-icon" aria-hidden="true"></span>Esporta .ics</button>
        <button type="button" class="button button-accent" id="new-appt"><span class="button-icon plus-icon" aria-hidden="true"></span>Nuovo appuntamento</button>
      </div>
    </div>
    <p class="calendar-note">Il file .ics è una copia da importare in Google Calendar o Outlook: non si aggiorna da solo.</p>
    <div id="cal"></div>`;

  const cal = mountCalendar(main.querySelector('#cal'), {
    kind: 'appointments',
    noun: { one: 'appuntamento', plural: 'gli appuntamenti' },
    isCurrent,
    fetchItems: (from, to) => api(`/api/appointments?from=${from}&to=${to}`),
    renderItem: (a) => {
      const who = state.client(a.clientId)?.name;
      return `<button type="button" class="event-card" data-item="${esc(a.id)}" data-channel="${esc(a.channel || '')}">
        <strong>${esc(a.title)}</strong><span>${esc(a.start)}${a.end ? `–${esc(a.end)}` : ''}${who ? ` · ${esc(who)}` : ''}${a.channel ? ` · ${esc(a.channel)}` : ''}</span></button>`;
    },
    onAdd: (date) => editAppointment({ date }, done),
    onOpen: (a) => editAppointment(a, done),
  });
  function done(date) {
    window.dispatchEvent(new Event('counts'));
    if (date) cal.goTo(date); else cal.draw();
  }
  main.querySelector('#new-appt').addEventListener('click', () => editAppointment({ date: isoLocal(new Date()) }, done));
  main.querySelector('#export-ics').addEventListener('click', exportIcs);
  await cal.draw();
}

function editAppointment(appt, onDone) {
  const editing = Boolean(appt.id);
  const clientId = appt.clientId ?? (editing ? '' : state.currentId || '');
  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Calendario studio</p><h2 id="ap-title">${editing ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <label class="field"><span>Titolo</span><input type="text" name="title" maxlength="120" required value="${esc(appt.title || '')}" placeholder="Es. Revisione piano editoriale"></label>
        <div class="form-row-3">
          <label class="field"><span>Data</span><input type="date" name="date" required value="${esc(appt.date || '')}"></label>
          <label class="field"><span>Inizio</span><input type="time" name="start" required value="${esc(appt.start || '09:00')}"></label>
          <label class="field"><span>Fine <small>(facoltativa)</small></span><input type="time" name="end" value="${esc(appt.end || '')}"></label>
        </div>
        <div class="form-row">
          <label class="field"><span>Cliente <small>(facoltativo)</small></span>
            <select name="clientId"><option value="">Nessun cliente</option>
              ${state.clients.map((c) => `<option value="${esc(c.id)}" ${clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select></label>
          <label class="field"><span>Canale <small>(facoltativo)</small></span>
            <select name="channel">${CHANNELS.map((c) => `<option value="${c}" ${appt.channel === c ? 'selected' : ''}>${c || 'Nessuno'}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Luogo o link</span><input type="text" name="place" maxlength="300" value="${esc(appt.place || '')}" placeholder="Indirizzo o link della videochiamata"></label>
        <label class="field"><span>Note</span><textarea name="notes" maxlength="2000">${esc(appt.notes || '')}</textarea></label>
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot">
        ${editing ? '<button type="button" class="button button-ghost button-danger left" data-delete>Elimina</button>' : ''}
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="submit" class="button button-accent">${editing ? 'Salva modifiche' : 'Salva appuntamento'}</button>
      </div>
    </form>`, { labelledBy: 'ap-title' });

  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  form.elements.title.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const body = Object.fromEntries(new FormData(form));
    const problem = !body.title.trim() ? 'Scrivi un titolo.' : !body.date ? 'Scegli la data.' : !body.start ? "Indica l'ora di inizio." : body.end && body.end <= body.start ? "L'ora di fine deve venire dopo l'inizio." : null;
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    try {
      await api(editing ? `/api/appointments/${appt.id}` : '/api/appointments', { method: editing ? 'PUT' : 'POST', body });
      dlg.close();
      toast(editing ? 'Appuntamento aggiornato.' : 'Appuntamento aggiunto al calendario dello studio.');
      onDone(body.date);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  dlg.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: "Eliminare l'appuntamento?", text: `"${appt.title}" del ${dayFmt.format(parseIso(appt.date))} verrà eliminato.`, confirm: 'Elimina' });
    if (!ok) return;
    try {
      await api(`/api/appointments/${appt.id}`, { method: 'DELETE' });
      dlg.close();
      toast('Appuntamento eliminato.');
      onDone();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

// Esportazione .ics (RFC 5545): righe ripiegate a 75 byte, testo con escape.
const icsText = (v) => String(v).replace(/\\/g, '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line) {
  let out = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 75) { out += '\r\n '; bytes = 1; }
    out += ch;
    bytes += n;
  }
  return out;
}

async function exportIcs() {
  let appts;
  try { appts = await api('/api/appointments'); } catch (e) { toast(e.message); return; }
  if (!appts.length) { toast('Aggiungi un appuntamento prima di esportare il calendario.'); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = appts.map((a) => {
    const who = state.client(a.clientId)?.name;
    const start = `${a.date.replace(/-/g, '')}T${a.start.replace(':', '')}00`;
    const details = [who && `Cliente: ${who}`, a.channel && `Canale: ${a.channel}`, a.notes].filter(Boolean).join('\n');
    return [
      'BEGIN:VEVENT', `UID:${a.id}@habitat.local`, `DTSTAMP:${stamp}`, `DTSTART:${start}`,
      a.end ? `DTEND:${a.date.replace(/-/g, '')}T${a.end.replace(':', '')}00` : 'DURATION:PT1H',
      `SUMMARY:${icsText(a.title)}`, ...(details ? [`DESCRIPTION:${icsText(details)}`] : []), ...(a.place ? [`LOCATION:${icsText(a.place)}`] : []),
      'END:VEVENT',
    ];
  });
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Habitat//Social Studio//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Habitat - Appuntamenti', ...events.flat(), 'END:VCALENDAR'].map(fold).join('\r\n');
  download(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `habitat-appuntamenti-${isoLocal(new Date()).replace(/-/g, '')}.ics`);
  toast(`${events.length} appuntamenti esportati in formato .ics.`);
}
