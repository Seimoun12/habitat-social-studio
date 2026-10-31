// Calendario a settimana o mese, usato da Appuntamenti e Contenuti.
// Su schermi stretti la griglia del mese diventa un elenco per giorno.
import { esc, state, isoLocal, parseIso } from '../lib.js';

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const dayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

const monday = (d) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

// Vista e filtro restano tra una visita e l'altra, separati per tipo di calendario.
const memory = {};

export function mountCalendar(root, { kind, noun, fetchItems, renderItem, onAdd, onOpen, isCurrent }) {
  const mem = memory[kind] ??= { mode: 'week', anchor: new Date(), client: '' };
  root.innerHTML = `
    <div class="calendar-toolbar">
      <div class="week-navigation">
        <button type="button" class="icon-button" data-shift="-1"><span aria-hidden="true">‹</span></button>
        <button type="button" class="button button-outline" data-today>Oggi</button>
        <button type="button" class="icon-button" data-shift="1"><span aria-hidden="true">›</span></button>
        <h2 class="period-label" aria-live="polite"></h2>
      </div>
      <div class="toolbar-right">
        <label class="field"><span class="visually-hidden">Filtra per cliente</span>
          <select data-client-filter>
            <option value="">Tutti i clienti</option>
            ${kind === 'appointments' ? `<option value="none" ${mem.client === 'none' ? 'selected' : ''}>Senza cliente</option>` : ''}
            ${state.clients.map((c) => `<option value="${esc(c.id)}" ${mem.client === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <div class="segmented" role="group" aria-label="Vista ${esc(noun.plural)}">
          <button type="button" data-mode="week" aria-pressed="${mem.mode === 'week'}">Settimana</button>
          <button type="button" data-mode="month" aria-pressed="${mem.mode === 'month'}">Mese</button>
        </div>
      </div>
    </div>
    <div data-body></div>`;

  const body = root.querySelector('[data-body]');
  const label = root.querySelector('.period-label');

  function period() {
    if (mem.mode === 'week') {
      const first = monday(mem.anchor);
      const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
      return { days, first, last: days[6], month: null };
    }
    const month = new Date(mem.anchor.getFullYear(), mem.anchor.getMonth(), 1);
    const first = monday(month);
    const last = monday(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    last.setDate(last.getDate() + 6);
    const days = [];
    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return { days, first, last, month };
  }

  async function draw() {
    const { days, first, last, month } = period();
    const step = mem.mode === 'week' ? 'Settimana' : 'Mese';
    root.querySelector('[data-shift="-1"]').setAttribute('aria-label', `${step} precedente`);
    root.querySelector('[data-shift="1"]').setAttribute('aria-label', `${step} successivo`);
    label.textContent = month ? monthFmt.format(month) : `${shortFmt.format(first)} – ${shortFmt.format(last)} ${last.getFullYear()}`;
    body.innerHTML = `<p class="loading-line">Carico ${esc(noun.plural)}…</p>`;
    let items;
    try {
      items = await fetchItems(isoLocal(first), isoLocal(last));
    } catch (e) {
      if (!isCurrent()) return;
      body.innerHTML = `<div class="error-box" role="alert"><p><strong>Non riesco a caricare il calendario.</strong></p><p>${esc(e.message)}</p><p><button type="button" class="button button-outline" data-retry>Riprova</button></p></div>`;
      body.querySelector('[data-retry]').addEventListener('click', draw);
      return;
    }
    if (!isCurrent()) return;
    if (mem.client === 'none') items = items.filter((x) => !x.clientId);
    else if (mem.client) items = items.filter((x) => x.clientId === mem.client);

    const byDay = new Map();
    for (const it of items) { if (!byDay.has(it.date)) byDay.set(it.date, []); byDay.get(it.date).push(it); }
    const today = isoLocal(new Date());
    const addBtn = (d) => `<button type="button" class="day-add" data-add="${isoLocal(d)}" aria-label="Aggiungi ${esc(noun.one)} ${esc(dayFmt.format(d))}">+</button>`;
    const visible = items.filter((x) => !month || parseIso(x.date).getMonth() === month.getMonth());
    const empty = !visible.length
      ? `<p class="empty-calendar">${mem.client ? `Nessun ${esc(noun.one)} per questo filtro` : `Nessun ${esc(noun.one)}`} ${month ? 'in questo mese' : 'in questa settimana'}. Usa il + su un giorno per aggiungerne uno.</p>`
      : '';

    let grid;
    if (!month) {
      grid = `<div class="week-grid">${days.map((d, i) => {
        const list = byDay.get(isoLocal(d)) || [];
        return `<section class="day-column ${isoLocal(d) === today ? 'is-today' : ''}" aria-label="${esc(dayFmt.format(d))}">
          <header class="day-header"><div><span>${DAYS[i]}</span><strong>${d.getDate()}</strong></div>${addBtn(d)}</header>
          <div class="day-events">${list.length ? list.map(renderItem).join('') : '<span class="empty-day">Libero</span>'}</div></section>`;
      }).join('')}</div>`;
    } else {
      const cells = days.map((d) => {
        const list = byDay.get(isoLocal(d)) || [];
        const out = d.getMonth() !== month.getMonth();
        return `<section class="month-day ${isoLocal(d) === today ? 'is-today' : ''} ${out ? 'is-outside' : ''}" aria-label="${esc(dayFmt.format(d))}">
          <header class="month-day-header"><time datetime="${isoLocal(d)}">${d.getDate()}</time>${addBtn(d)}</header>
          <div class="month-day-events">${list.map(renderItem).join('')}</div></section>`;
      }).join('');
      const agendaDays = [...byDay.keys()].filter((k) => parseIso(k).getMonth() === month.getMonth()).sort();
      grid = `<div class="month-grid-scroll"><div class="month-grid">${DAYS.map((d) => `<div class="month-weekday">${d.slice(0, 3)}</div>`).join('')}${cells}</div></div>
        <div class="agenda">${agendaDays.map((k) => `<div class="agenda-day"><h3>${esc(dayFmt.format(parseIso(k)))}</h3>${byDay.get(k).map(renderItem).join('')}</div>`).join('')}</div>`;
    }
    body.innerHTML = `${grid}${empty}`;
    body.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => onAdd(b.dataset.add)));
    body.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      onOpen(items.find((x) => x.id === b.dataset.item));
    }));
  }

  root.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.shift);
    const a = mem.anchor;
    mem.anchor = mem.mode === 'week' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + n * 7) : new Date(a.getFullYear(), a.getMonth() + n, 1);
    draw();
  }));
  root.querySelector('[data-today]').addEventListener('click', () => { mem.anchor = new Date(); draw(); });
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mem.mode = b.dataset.mode;
    root.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  root.querySelector('[data-client-filter]').addEventListener('change', (e) => { mem.client = e.target.value; draw(); });

  return {
    draw,
    // Dopo un salvataggio il calendario si sposta sul giorno dell'elemento.
    goTo(date) { mem.anchor = parseIso(date); draw(); },
  };
}
