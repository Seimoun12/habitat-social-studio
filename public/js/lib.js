// Piccoli strumenti condivisi: chiamate API, escape HTML, avvisi, dialog, stato globale.

export class ApiError extends Error {}

export async function api(path, { method = 'GET', body, raw = false, binary = null, type } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: binary ? { 'Content-Type': type } : body ? { 'Content-Type': 'application/json' } : undefined,
      body: binary || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('Il server non risponde. Controlla che sia avviato con "npm start".');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || `Errore ${res.status}.`);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

// Caricamento di un file con avanzamento: fetch non espone il progresso dell'invio, XHR sì.
export function uploadFile(clientId, file, { onProgress, meta = {} } = {}) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ name: file.name, ...meta });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/clients/${encodeURIComponent(clientId)}/assets?${q}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* risposta vuota */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error || `Caricamento non riuscito (errore ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new ApiError('Il server non risponde. Controlla che sia avviato con "npm start".'));
    xhr.send(file);
  });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase();
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

// Crea un <dialog> modale; Esc lo chiude in modo nativo e il focus torna dove era.
export function openDialog(html, { labelledBy, wide = false } = {}) {
  const prev = document.activeElement;
  const dlg = document.createElement('dialog');
  if (wide) dlg.classList.add('wide');
  if (labelledBy) dlg.setAttribute('aria-labelledby', labelledBy);
  dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.addEventListener('close', () => { dlg.remove(); prev?.focus?.(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.showModal();
  return dlg;
}

export const closeButton = '<button type="button" class="icon-button" data-close aria-label="Chiudi finestra">×</button>';

export function confirmDialog({ title, text, confirm }) {
  return new Promise((resolve) => {
    const dlg = openDialog(`
      <div class="dlg-head"><h2 id="cf-title">${esc(title)}</h2></div>
      <div class="dlg-body"><p>${esc(text)}</p></div>
      <div class="dlg-foot">
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="button" class="button button-dark" data-ok>${esc(confirm)}</button>
      </div>`, { labelledBy: 'cf-title' });
    let ok = false;
    dlg.querySelector('[data-ok]').addEventListener('click', () => { ok = true; dlg.close(); });
    dlg.addEventListener('close', () => resolve(ok));
    dlg.querySelector('[data-close]').focus();
  });
}

// Stato condiviso: elenco clienti e cliente attivo, ricordato tra le sessioni.
const listeners = new Set();
export const state = {
  clients: [],
  get currentId() {
    try { return localStorage.getItem('clientId'); } catch { return null; }
  },
  set currentId(id) {
    try { id ? localStorage.setItem('clientId', id) : localStorage.removeItem('clientId'); } catch { /* storage non disponibile */ }
  },
  client(id) { return this.clients.find((c) => c.id === id) || null; },
  async refreshClients() {
    this.clients = await api('/api/clients');
    listeners.forEach((fn) => fn());
    return this.clients;
  },
  onChange(fn) { listeners.add(fn); },
};

export const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
export const PLATFORM_SHORT = { instagram: 'IG', facebook: 'FB', tiktok: 'TT' };
export const PLATFORM_LETTER = { instagram: 'ig', facebook: 'f', tiktok: 'tt' };
export const platformLetter = (p) => `<span class="platform-letter ${p}-letter" aria-hidden="true">${PLATFORM_LETTER[p]}</span>`;

// Date locali come 'YYYY-MM-DD' (i calendari ragionano nel fuso del browser).
export const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'file';
