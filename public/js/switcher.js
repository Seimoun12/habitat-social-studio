// Menu a tendina per passare da un cliente all'altro restando nella stessa sezione.
// Tastiera: Invio/Spazio/Freccia giù apre, frecce scorrono, Esc chiude, Tab esce.
import { state, esc, initials } from './lib.js';

export function mountSwitcher(root) {
  let activeId = null;
  let sub = 'panoramica';
  let open = false;

  root.innerHTML = `
    <button type="button" class="switcher-btn" aria-haspopup="true" aria-expanded="false" aria-controls="client-menu">
      <span class="monogram" aria-hidden="true"></span>
      <span class="label"><span class="hint">Profilo cliente</span><span class="name"></span></span>
      <svg class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <div class="menu" id="client-menu" role="menu" aria-label="Scegli cliente" hidden></div>`;
  const btn = root.querySelector('.switcher-btn');
  const menu = root.querySelector('.menu');

  const items = () => [...menu.querySelectorAll('.menu-item')];

  function renderMenu() {
    const list = state.clients.map((c) => `
      <a role="menuitem" class="menu-item" href="#/cliente/${encodeURIComponent(c.id)}/${sub}" ${c.id === activeId ? 'aria-current="true"' : ''} tabindex="-1">
        <span class="monogram" aria-hidden="true">${esc(initials(c.name))}</span>
        <span>${esc(c.name)}</span>
        ${c.id === activeId ? '<svg class="check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>' : ''}
      </a>`).join('');
    menu.innerHTML = `
      ${list || '<p class="menu-empty">Nessun cliente ancora.</p>'}
      <div class="menu-sep" role="separator"></div>
      <a role="menuitem" class="menu-item" href="#/clienti" data-new tabindex="-1">Aggiungi cliente</a>
      <a role="menuitem" class="menu-item" href="#/clienti" tabindex="-1">Gestisci clienti</a>`;
  }

  function setOpen(next) {
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    menu.dataset.open = String(open);
    if (open) {
      renderMenu();
      const list = items();
      (list.find((i) => i.getAttribute('aria-current') === 'true') || list[0])?.focus();
    }
  }

  btn.addEventListener('click', () => setOpen(!open));
  btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
    if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.focus(); }
    if (e.key === 'Tab') setOpen(false);
    if (e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
  });
  menu.addEventListener('click', (e) => {
    const link = e.target.closest('.menu-item');
    if (!link) return;
    setOpen(false);
    if (link.hasAttribute('data-new')) {
      e.preventDefault();
      // Apre direttamente il modulo "Nuovo cliente" nella pagina Clienti.
      state.openNewClient = true;
      if (location.hash === '#/clienti') window.dispatchEvent(new Event('hashchange'));
      else location.hash = '#/clienti';
    }
  });
  document.addEventListener('pointerdown', (e) => { if (open && !root.contains(e.target)) setOpen(false); });

  return {
    update(id, view) {
      activeId = id;
      if (view) sub = view;
      const c = state.client(id);
      root.querySelector('.monogram').textContent = c ? initials(c.name) : '';
      root.querySelector('.monogram').hidden = !c;
      root.querySelector('.name').textContent = c ? c.name : 'Scegli un cliente';
      if (open) renderMenu();
    },
  };
}
