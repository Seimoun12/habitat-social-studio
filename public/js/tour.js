// Tutorial di benvenuto: una visita guidata che evidenzia le parti dell'app una alla volta.
// Tastiera: Invio o freccia destra avanti, freccia sinistra indietro, Esc chiude. Il focus resta nel riquadro.
import { state, esc } from './lib.js';
import { setSettings } from './settings.js';

const clientHash = (view) => {
  const id = state.client(state.currentId)?.id || state.clients[0]?.id;
  return id ? `#/cliente/${encodeURIComponent(id)}/${view}` : '#/clienti';
};

// Ogni passo: dove andare (route), cosa evidenziare (target), titolo e testo.
// Senza un elemento visibile il riquadro compare al centro.
const STEPS = [
  { title: 'Ti do il benvenuto in Habitat', text: 'Qui segui i social di tutti i clienti: numeri, report, grafiche e calendari. In un paio di minuti vedi dove si trova ogni cosa. Puoi chiudere quando vuoi e rivederlo da Impostazioni.' },
  { route: () => clientHash('panoramica'), target: '#client-switcher', title: 'Il cliente su cui lavori', text: 'Scegli il cliente da questo menu. Panoramica, Analisi e Studio grafico mostrano sempre il cliente scelto qui.', needsClient: true },
  { target: '[aria-labelledby="nav-client-label"]', title: 'Le pagine del cliente', text: 'Panoramica per il quadro veloce, Analisi per tutti i numeri, Studio grafico per creare post e reel con lo stile del cliente.', needsClient: true },
  { target: '#filters', title: 'Canale e periodo', text: 'Scegli Instagram, Facebook o TikTok e il periodo. Ogni numero viene confrontato con il periodo precedente della stessa durata.', needsClient: true },
  { target: '#demo-label', title: 'Dati demo o dati reali', text: 'Finché un canale non è collegato i numeri sono di prova. Lo trovi scritto qui, sopra i numeri e nel PDF, così non finisce per errore in un report vero.', needsClient: true },
  { target: '#open-report', title: 'Il report per il cliente', text: 'Scegli canali, periodo e sezioni e scarichi un PDF con gli stessi numeri che vedi qui. Puoi aggiungere un tuo commento in apertura.', needsClient: true },
  { route: () => clientHash('studio/progetti'), target: '.new-design', title: 'Post, storie e reel', text: 'Scegli un formato e si apre l\'editor, con modelli già nei colori e nei caratteri del cliente. I reel si esportano in MP4 pronti per Instagram e TikTok.', needsClient: true },
  { target: '#st-tab-stile', title: 'Lo stile del cliente', text: 'Colori, caratteri e logo si impostano una volta qui. Se li cambi, si aggiornano anche i progetti che li usano.', needsClient: true },
  { route: () => '#/contenuti', target: '#cal', title: 'Il piano contenuti', text: 'I contenuti programmati di tutti i clienti, a settimana o a mese, con il progetto grafico collegato. La pubblicazione sui social resta manuale.' },
  { target: '[aria-labelledby="nav-studio-label"]', title: 'Le pagine dello studio', text: 'Appuntamenti è il calendario di tutto lo studio, esportabile in Google Calendar o Outlook. In Clienti aggiungi i clienti e colleghi i loro account.' },
  { target: '#settings-open', title: 'Impostazioni', text: 'Qui scegli il tema e puoi spegnere questo tutorial o rivederlo.' },
  { title: 'Fatto', text: 'Per partire con i dati veri apri Clienti, aggiungi un cliente e collega i suoi account con "Modifica e collega".', last: true },
];

let active = null;

export function isTourActive() { return Boolean(active); }

export function startTour() {
  if (active) return;
  const steps = STEPS.filter((s) => !s.needsClient || state.clients.length);
  const prevFocus = document.activeElement;
  // Strato trasparente: durante il tutorial la pagina sotto non riceve clic.
  const block = document.createElement('div');
  block.className = 'tour-block';
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  spot.setAttribute('aria-hidden', 'true');
  const pop = document.createElement('div');
  pop.className = 'tour-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'true');
  pop.setAttribute('aria-labelledby', 'tour-title');
  pop.setAttribute('aria-describedby', 'tour-text');
  document.body.append(block, spot, pop);
  let i = 0;
  let target = null;
  let token = 0;

  const place = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    if (!target) {
      spot.classList.add('is-center');
      Object.assign(spot.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: '0px', height: '0px' });
      pop.style.left = `${Math.max(12, (vw - pw) / 2)}px`;
      pop.style.top = `${Math.max(12, (vh - ph) / 2)}px`;
      return;
    }
    spot.classList.remove('is-center');
    const r = target.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    let top = r.bottom + 14;
    if (top + ph > vh - 12) top = r.top - ph - 14;
    if (top < 12) top = Math.min(vh - ph - 12, Math.max(12, r.top));
    let left = Math.min(Math.max(12, r.left), vw - pw - 12);
    // Elementi alti e stretti (come la barra laterale): il riquadro va a destra.
    if (r.height > vh * 0.5 && r.right + pw + 24 < vw) { left = r.right + 18; top = Math.min(Math.max(12, r.top), vh - ph - 12); }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };

  const waitFor = async (sel, mine) => {
    for (let t = 0; t < 60; t++) {
      if (mine !== token) return null;
      const el = document.querySelector(sel);
      if (el && el.getClientRects().length && el.getBoundingClientRect().width) return el;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };

  async function show(n) {
    i = n;
    const mine = ++token;
    const s = steps[i];
    if (s.route) { const h = s.route(); if (location.hash !== h) location.hash = h; }
    pop.innerHTML = `<p class="tour-count">${s.target || s.last || i ? `Passo ${i + 1} di ${steps.length}` : 'Tutorial'}</p><p class="tour-loading">Un attimo…</p>`;
    target = s.target ? await waitFor(s.target, mine) : null;
    if (mine !== token) return;
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    pop.innerHTML = `
      <p class="tour-count">Passo ${i + 1} di ${steps.length}</p>
      <h2 id="tour-title">${esc(s.title)}</h2>
      <p id="tour-text">${esc(s.text)}</p>
      <div class="tour-actions">
        ${s.last ? '' : '<button type="button" class="text-button" data-tour="skip">Salta il tutorial</button>'}
        <span class="tour-spacer"></span>
        ${i > 0 ? '<button type="button" class="button button-outline button-small" data-tour="back">Indietro</button>' : ''}
        ${s.last
          ? '<button type="button" class="button button-outline button-small" data-tour="close">Chiudi</button><button type="button" class="button button-accent button-small" data-tour="clients">Apri Clienti</button>'
          : `<button type="button" class="button button-accent button-small" data-tour="next">${i === 0 ? 'Inizia' : 'Avanti'}</button>`}
      </div>`;
    place();
    pop.querySelector('[data-tour="next"], [data-tour="clients"]')?.focus();
  }

  function end() {
    token++;
    setSettings({ tutorialDone: true });
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey, true);
    block.remove();
    spot.remove();
    pop.remove();
    active = null;
    if (prevFocus?.isConnected) prevFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); return; }
    if (e.key === 'ArrowRight' && i < steps.length - 1) { e.preventDefault(); show(i + 1); return; }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); show(i - 1); return; }
    if (e.key === 'Tab') {
      const items = [...pop.querySelectorAll('button')];
      if (!items.length) return;
      const k = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(k + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  }

  pop.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tour]')?.dataset.tour;
    if (a === 'next') show(i + 1);
    if (a === 'back') show(i - 1);
    if (a === 'skip' || a === 'close') end();
    if (a === 'clients') { end(); location.hash = '#/clienti'; }
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  active = { end };
  show(0);
}
