import { state, esc, api, toast, isoLocal } from './lib.js';
import { mountSwitcher } from './switcher.js';
import { renderPanoramica } from './views/panoramica.js';
import { renderAnalisi } from './views/analisi.js';
import { renderStudio } from './views/studio.js';
import { renderContenuti } from './views/contenuti.js';
import { renderAppuntamenti } from './views/appuntamenti.js';
import { renderClienti } from './views/clienti.js';
import { getSettings, openSettings, applyTheme } from './settings.js';
import { startTour } from './tour.js';

const main = document.getElementById('main');
const CLIENT_VIEWS = ['panoramica', 'analisi', 'studio', 'editor'];

// Rotte: #/cliente/<id>/<panoramica|analisi|studio|editor/<progetto>>  ·  #/contenuti  ·  #/appuntamenti  ·  #/clienti
function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'cliente' && parts[1]) {
    const sub = CLIENT_VIEWS.includes(parts[2]) ? parts[2] : 'panoramica';
    return { view: sub, id: parts[1], arg: parts[3] || null };
  }
  if (['contenuti', 'appuntamenti', 'clienti'].includes(parts[0])) return { view: parts[0] };
  return { view: 'home' };
}

const TITLES = { panoramica: 'Panoramica', analisi: 'Analisi', studio: 'Time to Create', editor: 'Editor', contenuti: 'Contenuti', appuntamenti: 'Appuntamenti', clienti: 'Clienti' };

function updateChrome(r) {
  const clientId = CLIENT_VIEWS.includes(r.view) ? r.id : state.client(state.currentId)?.id || state.clients[0]?.id;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const key = a.dataset.nav;
    if (['panoramica', 'analisi', 'studio'].includes(key)) {
      if (clientId) { a.href = `#/cliente/${encodeURIComponent(clientId)}/${key}`; a.removeAttribute('aria-disabled'); } else { a.href = '#/clienti'; a.setAttribute('aria-disabled', 'true'); }
    }
    const active = key === r.view || (key === 'studio' && r.view === 'editor');
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const onClient = CLIENT_VIEWS.includes(r.view);
  document.getElementById('client-switcher').hidden = !onClient;
  const ctx = document.getElementById('topbar-context');
  ctx.hidden = onClient;
  if (!onClient) ctx.innerHTML = `<p class="eyebrow">Studio · tutti i clienti</p><strong>${esc(TITLES[r.view] || '')}</strong>`;
  switcher.update(onClient ? r.id : null, r.view === 'editor' ? 'studio' : r.view);

  const label = document.getElementById('demo-label');
  const c = onClient ? state.client(r.id) : null;
  if (c) {
    const live = Object.values(c.connected).filter(Boolean).length;
    label.hidden = false;
    label.classList.toggle('is-live', live === 3);
    label.lastElementChild.textContent = live === 0 ? 'Dati demo' : live === 3 ? 'Tutti i canali collegati' : `Dati demo su ${3 - live} canali`;
  } else label.hidden = true;

  document.querySelector('.topbar').hidden = r.view === 'editor';
  main.classList.toggle('is-editor', r.view === 'editor');
  document.querySelector('.app-shell').classList.toggle('is-editing', r.view === 'editor');
}

let renderToken = 0;
let cleanup = null;
async function route() {
  const r = parse();
  const token = ++renderToken;
  cleanup?.();
  cleanup = null;

  if (r.view === 'home') {
    const id = state.client(state.currentId) ? state.currentId : state.clients[0]?.id;
    location.replace(id ? `#/cliente/${encodeURIComponent(id)}/panoramica` : '#/clienti');
    return;
  }
  if (CLIENT_VIEWS.includes(r.view)) {
    if (!state.client(r.id)) {
      updateChrome({ view: 'clienti' });
      main.innerHTML = `<div class="state"><h2>Cliente non trovato</h2>
        <p>Questo cliente non esiste più o il link è sbagliato.</p>
        <a class="button button-dark" href="#/clienti">Vai all'elenco clienti</a></div>`;
      return;
    }
    state.currentId = r.id;
  }
  updateChrome(r);
  const isCurrent = () => token === renderToken;
  const client = state.client(r.id);
  const setCleanup = (fn) => { if (isCurrent()) cleanup = fn; else fn(); };
  if (r.view === 'panoramica') await renderPanoramica(main, client, isCurrent);
  if (r.view === 'analisi') await renderAnalisi(main, client, isCurrent);
  if (r.view === 'studio') await renderStudio(main, client, isCurrent, r.arg);
  if (r.view === 'editor') {
    const { renderEditor } = await import('./editor/editor.js');
    if (isCurrent()) setCleanup(await renderEditor(main, client, r.arg, isCurrent));
  }
  if (r.view === 'contenuti') await renderContenuti(main, isCurrent);
  if (r.view === 'appuntamenti') await renderAppuntamenti(main, isCurrent);
  if (r.view === 'clienti') await renderClienti(main, isCurrent);
  document.title = `${client ? `${client.name} · ` : ''}${TITLES[r.view]} · Habitat`;
}

// Tema: segue il sistema finché non si sceglie, poi ricorda la scelta (anche da Impostazioni).
const root = document.documentElement;
if (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) root.dataset.theme = 'dark';
const themeLabel = () => { document.getElementById('theme-label').textContent = root.dataset.theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'; };
themeLabel();
window.addEventListener('themechange', themeLabel);
document.getElementById('theme-toggle').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
document.getElementById('settings-open').addEventListener('click', () => openSettings({ startTour }));

document.getElementById('today-label').textContent = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

// Contatori nella barra laterale: contenuti e appuntamenti da oggi in avanti.
async function refreshCounts() {
  const from = isoLocal(new Date());
  try {
    const [contents, appts] = await Promise.all([api(`/api/contents?from=${from}`), api(`/api/appointments?from=${from}`)]);
    for (const [id, n] of [['count-contenuti', contents.length], ['count-appuntamenti', appts.length]]) {
      const el = document.getElementById(id);
      el.textContent = n;
      el.hidden = !n;
      el.setAttribute('aria-label', `${n} in programma`);
    }
  } catch { /* i contatori sono accessori */ }
}
window.addEventListener('counts', refreshCounts);

// Ritorno dal login Meta o TikTok.
const OAUTH_MESSAGES = {
  'meta-non-configurato': 'Per collegare con Meta inserisci META_APP_ID e META_APP_SECRET nel file .env e riavvia il server.',
  'tiktok-non-configurato': 'Per collegare con TikTok inserisci TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nel file .env e riavvia il server.',
  'stato-non-valido': 'Verifica di sicurezza non valida o scaduta. Avvia di nuovo il collegamento.',
  'meta-annullato': 'Autorizzazione Meta annullata.',
  'meta-errore': 'Collegamento Meta non riuscito. Controlla permessi e configurazione dell\'app, i dettagli sono nel terminale.',
  'tiktok-annullato': 'Autorizzazione TikTok annullata.',
  'tiktok-errore': 'Collegamento TikTok non riuscito. Controlla configurazione e redirect dell\'app, i dettagli sono nel terminale.',
  'tiktok-collegato': 'Account TikTok collegato. Le analisi ora usano i dati reali.',
  'cliente-non-trovato': 'Il cliente da collegare non esiste più.',
};
const params = new URLSearchParams(location.search);
const oauthOutcome = params.get('oauth');
if (oauthOutcome) {
  if (oauthOutcome === 'meta-scegli') state.pendingMetaPick = params.get('scelta');
  else if (OAUTH_MESSAGES[oauthOutcome]) setTimeout(() => toast(OAUTH_MESSAGES[oauthOutcome]), 300);
  history.replaceState({}, '', `${location.pathname}${location.hash}`);
}

const switcher = mountSwitcher(document.getElementById('client-switcher'));

try {
  await state.refreshClients();
} catch (e) {
  main.innerHTML = `<div class="state"><h2>Impossibile caricare i clienti</h2><p>${esc(e.message)}</p>
    <button type="button" class="button button-dark" onclick="location.reload()">Riprova</button></div>`;
}
window.addEventListener('hashchange', route);
state.onChange(() => updateChrome(parse()));
refreshCounts();
await route();
// Primo avvio: il tutorial parte da solo, se non è stato spento o già visto. Mai sopra il ritorno da un login.
const settings = getSettings();
if (settings.tutorial && !settings.tutorialDone && !oauthOutcome && !document.querySelector('dialog[open]')) startTour();
