// Impostazioni dell'app, salvate in questo browser: tema e tutorial di benvenuto.
import { openDialog, closeButton, toast } from './lib.js';

const KEY = 'habitat-impostazioni';
const DEFAULTS = { tutorial: true, tutorialDone: false };

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage non disponibile: vale per questa sessione */ }
  return next;
}

// Tema: "system" segue il sistema operativo; la scelta esplicita resta in localStorage.theme,
// letto anche dallo script in <head> per evitare il lampo di colore.
export function themePref() {
  try { return localStorage.getItem('theme') || 'system'; } catch { return 'system'; }
}
export function applyTheme(pref) {
  try { pref === 'system' ? localStorage.removeItem('theme') : localStorage.setItem('theme', pref); } catch { /* storage non disponibile */ }
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  window.dispatchEvent(new Event('themechange'));
}

export function openSettings({ startTour }) {
  const s = getSettings();
  const pref = themePref();
  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Habitat</p><h2 id="set-title">Impostazioni</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <fieldset class="field"><legend>Tema</legend>
          <div class="segmented" role="group" aria-label="Tema">
            ${[['light', 'Chiaro'], ['dark', 'Scuro'], ['system', 'Come il sistema']].map(([k, l]) => `<button type="button" data-theme-pref="${k}" aria-pressed="${pref === k}">${l}</button>`).join('')}
          </div>
        </fieldset>
        <fieldset class="field"><legend>Tutorial di benvenuto</legend>
          <label class="check-option"><input type="checkbox" name="tutorial" ${s.tutorial ? 'checked' : ''}><span>Tutorial attivo<br><span class="muted">Se è spento non compare mai, nemmeno al primo avvio.</span></span></label>
          <div class="conn-actions"><button type="button" class="button button-outline button-small" data-start-tour ${s.tutorial ? '' : 'disabled'}>Avvia il tutorial adesso</button>
            <span class="note-muted" data-tour-note>${s.tutorial ? (s.tutorialDone ? 'Già visto: puoi rivederlo quando vuoi.' : 'Comparirà al prossimo avvio.') : 'Riattivalo per poterlo rivedere.'}</span></div>
        </fieldset>
        <p class="note-muted">Le impostazioni valgono per questo browser.</p>
      </div>
      <div class="dlg-foot"><button type="button" class="button button-accent" data-close>Fatto</button></div>
    </form>`, { labelledBy: 'set-title' });

  dlg.querySelectorAll('[data-theme-pref]').forEach((b) => b.addEventListener('click', () => {
    applyTheme(b.dataset.themePref);
    dlg.querySelectorAll('[data-theme-pref]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const startBtn = dlg.querySelector('[data-start-tour]');
  const note = dlg.querySelector('[data-tour-note]');
  dlg.querySelector('[name="tutorial"]').addEventListener('change', (e) => {
    const on = e.target.checked;
    // Riattivarlo lo fa ricomparire al prossimo avvio, come la prima volta.
    setSettings(on ? { tutorial: true, tutorialDone: false } : { tutorial: false });
    startBtn.disabled = !on;
    note.textContent = on ? 'Comparirà al prossimo avvio.' : 'Riattivalo per poterlo rivedere.';
    toast(on ? 'Tutorial riattivato.' : 'Tutorial disattivato.');
  });
  startBtn.addEventListener('click', () => { dlg.close(); startTour(); });
  dlg.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
}
