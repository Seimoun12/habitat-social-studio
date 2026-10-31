// Studio grafico del cliente: progetti (post, storie, reel), stile del cliente e file caricati.
import { api, esc, state, toast, uploadFile, confirmDialog } from '../lib.js';
import { FORMATS, FONTS, BRAND_COLORS, BRAND_FONTS, POST_TEMPLATES, emptyDoc, ensureFont, onFontLoaded } from '../editor/model.js';
import { renderToCanvas, onImageLoaded } from '../editor/render.js';
import { mediaDuration } from '../editor/reel.js';

const TABS = { progetti: 'Progetti', stile: 'Stile del cliente', file: 'File caricati' };
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const sizeFmt = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

export async function renderStudio(main, client, isCurrent, tabArg) {
  let tab = TABS[tabArg] ? tabArg : 'progetti';
  const cid = encodeURIComponent(client.id);
  main.innerHTML = `
    <div class="page-heading">
      <div><p class="eyebrow">${esc(client.name)} · studio grafico</p><h1>Post e reel<br><em>con lo stile di ${esc(client.name)}.</em></h1>
        <p class="heading-copy">Crea grafiche e video dai modelli, con colori, caratteri e logo salvati per questo cliente.</p></div>
    </div>
    <div class="tabs" role="tablist" aria-label="Sezioni dello studio">
      ${Object.entries(TABS).map(([k, l]) => `<button type="button" role="tab" id="st-tab-${k}" aria-controls="st-panel" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="st-panel" role="tabpanel" aria-labelledby="st-tab-${tab}"></div>`;
  const panel = main.querySelector('#st-panel');

  main.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    history.replaceState(null, '', `#/cliente/${cid}/studio/${b.dataset.tab}`);
    show(b.dataset.tab);
  });
  main.querySelector('.tabs').addEventListener('keydown', (e) => {
    const tabs = [...main.querySelectorAll('[data-tab]')];
    const i = tabs.indexOf(document.activeElement);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key];
    if (i < 0 || j == null) return;
    const next = tabs[(j + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });

  function show(t) {
    tab = t;
    main.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    panel.setAttribute('aria-labelledby', `st-tab-${t}`);
    if (t === 'progetti') return projects();
    if (t === 'stile') return brandKit();
    return files();
  }

  async function projects() {
    panel.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">Nuovo progetto</p><h2>Che cosa crei?</h2></div></div>
      <div class="new-design">${Object.entries(FORMATS).map(([k, f]) => {
        const r = f.w / f.h;
        return `<button type="button" class="format-option" data-new="${k}"><span class="ratio" style="width:${Math.round(r >= 1 ? 44 : 44 * r)}px;height:${Math.round(r >= 1 ? 44 / r : 44)}px" aria-hidden="true"></span><strong>${esc(f.label)}</strong><small>${f.w}×${f.h}${f.kind === 'reel' ? ' · video' : ''}</small></button>`;
      }).join('')}</div>
      <div class="section-heading"><div><p class="eyebrow">Progetti</p><h2>Lavori di ${esc(client.name)}</h2></div></div>
      <div id="designs"><p class="loading-line">Carico i progetti…</p></div>`;
    panel.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => create(b.dataset.new, b)));
    const box = panel.querySelector('#designs');
    let list;
    try { list = await api(`/api/designs?clientId=${cid}`); } catch (e) {
      if (!isCurrent()) return;
      box.innerHTML = `<div class="error-box" role="alert"><p>${esc(e.message)}</p><p><button type="button" class="button button-outline" data-retry>Riprova</button></p></div>`;
      box.querySelector('[data-retry]').addEventListener('click', projects);
      return;
    }
    if (!isCurrent() || tab !== 'progetti') return;
    if (!list.length) { box.innerHTML = '<p class="note-muted">Nessun progetto ancora. Scegli un formato qui sopra: si apre l\'editor con i modelli già nello stile del cliente.</p>'; return; }
    box.innerHTML = `<div class="design-grid">${list.map((d) => `
      <article class="design-card">
        <a class="design-thumb" href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}" aria-label="Apri ${esc(d.name)}">
          ${d.hasThumb ? `<img src="/media/thumb/${encodeURIComponent(d.id)}.png?v=${encodeURIComponent(d.updatedAt)}" alt="" loading="lazy">` : '<span>Anteprima dopo il primo salvataggio</span>'}
        </a>
        <div class="design-info"><strong title="${esc(d.name)}">${esc(d.name)}</strong><span>${esc(FORMATS[d.format]?.label || d.format)} · ${esc(dateFmt.format(new Date(d.updatedAt)))}</span></div>
        <div class="design-actions">
          <a class="button button-ghost button-small" href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}">Apri</a>
          <button type="button" class="button button-ghost button-small" data-dup="${esc(d.id)}">Duplica</button>
          <button type="button" class="button button-ghost button-small button-danger" data-del="${esc(d.id)}" data-name="${esc(d.name)}">Elimina</button>
        </div>
      </article>`).join('')}</div>`;
    box.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/designs/${encodeURIComponent(b.dataset.dup)}/duplicate`, { method: 'POST' }); toast('Progetto duplicato.'); projects(); } catch (e) { toast(e.message); }
    }));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: `Eliminare "${b.dataset.name}"?`, text: 'Il progetto verrà eliminato. I contenuti in programma che lo usavano restano, senza progetto collegato.', confirm: 'Elimina' }))) return;
      try { await api(`/api/designs/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); toast('Progetto eliminato.'); projects(); } catch (e) { toast(e.message); }
    }));
  }

  async function create(format, btn) {
    btn.disabled = true;
    const f = FORMATS[format];
    const name = `${f.label} del ${new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(new Date())}`;
    try {
      const d = await api('/api/designs', { method: 'POST', body: { clientId: client.id, kind: f.kind, format, name, doc: emptyDoc(format) } });
      location.hash = `#/cliente/${cid}/editor/${encodeURIComponent(d.id)}`;
    } catch (e) { toast(e.message); btn.disabled = false; }
  }

  async function brandKit() {
    const c = state.client(client.id);
    const b = structuredClone(c.brand);
    let images = [];
    try { images = (await api(`/api/clients/${cid}/assets`)).filter((a) => a.kind === 'image'); } catch { /* il logo resta facoltativo */ }
    if (!isCurrent() || tab !== 'stile') return;
    const fontSelect = (k) => `<select name="font-${k}">${FONTS.map((f) => `<option ${b.fonts[k] === f.family ? 'selected' : ''}>${esc(f.family)}</option>`).join('')}</select>`;
    panel.innerHTML = `
      <div class="brand-layout">
        <form class="panel" id="brand-form" novalidate>
          <h2>Colori</h2>
          <p class="note-muted" style="margin:4px 0 14px">I progetti usano questi ruoli: se cambi un colore qui, cambia in tutti i progetti di ${esc(c.name)} che lo usano.</p>
          <div style="display:grid;gap:10px">${Object.entries(BRAND_COLORS).map(([k, l]) => `
            <div class="color-row"><input type="color" name="color-${k}" value="${esc(b.colors[k])}" aria-label="${l}"><span>${l}</span><input type="text" name="hex-${k}" value="${esc(b.colors[k])}" maxlength="7" aria-label="${l}, codice esadecimale"></div>`).join('')}</div>
          <h2 style="margin-top:24px">Caratteri</h2>
          <div class="form-row" style="margin-top:12px">${Object.entries(BRAND_FONTS).map(([k, l]) => `<label class="field"><span>${l}</span>${fontSelect(k)}</label>`).join('')}</div>
          <p class="note-muted" style="margin-top:6px">DM Sans e Playfair Display sono inclusi nell'app; gli altri si scaricano da Google Fonts, serve la connessione.</p>
          <h2 style="margin-top:24px">Logo</h2>
          <div class="logo-pick" style="margin-top:12px">
            <img id="logo-preview" alt="Logo attuale" ${b.logoAssetId ? `src="/media/${esc(b.logoAssetId)}"` : 'hidden'}>
            <label class="field" style="flex:1 1 200px"><span>Scegli tra le immagini caricate</span><select name="logo"><option value="">Nessun logo</option>${images.map((a) => `<option value="${esc(a.id)}" ${b.logoAssetId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
            <label class="button button-outline button-small">Carica un logo<input type="file" name="logo-file" accept="image/png,image/svg+xml,image/webp,image/jpeg" class="visually-hidden"></label>
          </div>
          <p class="note-muted" style="margin-top:6px">Meglio un PNG o SVG con sfondo trasparente.</p>
          <label class="field" style="margin-top:20px"><span>Note di stile <small>(tono, cose da evitare, hashtag ricorrenti)</small></span><textarea name="notes" maxlength="2000">${esc(b.notes)}</textarea></label>
          <p class="form-error" role="alert" hidden></p>
          <div class="heading-actions" style="margin-top:16px"><button type="submit" class="button button-accent">Salva lo stile</button><button type="button" class="button button-ghost" data-reset>Torna ai colori Habitat</button></div>
        </form>
        <div class="brand-preview"><p class="eyebrow">Anteprima</p><canvas id="brand-canvas" width="380" height="475" aria-label="Anteprima di un post con lo stile scelto"></canvas>
          <p class="note-muted" style="margin-top:8px">Modello "Titolo e testo" con i colori e i caratteri del modulo.</p></div>
      </div>`;
    const form = panel.querySelector('#brand-form');
    const err = form.querySelector('.form-error');
    const canvas = panel.querySelector('#brand-canvas');
    const tpl = POST_TEMPLATES.find((t) => t.id === 'titolo');
    const preview = () => {
      ensureFont(b.fonts.heading, 700);
      ensureFont(b.fonts.body, 400);
      const doc = { w: 1080, h: 1350, background: { color: '@background' }, layers: tpl.build({ w: 1080, h: 1350 }) };
      const out = renderToCanvas(doc, b, { width: canvas.width });
      canvas.getContext('2d').drawImage(out, 0, 0);
    };
    const offFont = onFontLoaded(preview);
    const offImg = onImageLoaded(preview);
    const obs = new MutationObserver(() => { if (!panel.contains(canvas)) { offFont(); offImg(); obs.disconnect(); } });
    obs.observe(panel, { childList: true });
    preview();

    form.addEventListener('input', (e) => {
      const n = e.target.name || '';
      if (n.startsWith('color-')) { const k = n.slice(6); b.colors[k] = e.target.value; form[`hex-${k}`].value = e.target.value; }
      if (n.startsWith('hex-') && /^#[0-9a-f]{6}$/i.test(e.target.value)) { const k = n.slice(4); b.colors[k] = e.target.value; form[`color-${k}`].value = e.target.value; }
      if (n.startsWith('font-')) b.fonts[n.slice(5)] = e.target.value;
      if (n === 'logo') { b.logoAssetId = e.target.value || null; const img = panel.querySelector('#logo-preview'); img.hidden = !b.logoAssetId; if (b.logoAssetId) img.src = `/media/${b.logoAssetId}`; }
      if (n === 'notes') b.notes = e.target.value;
      preview();
    });
    form['logo-file'].addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const a = await uploadFile(client.id, file);
        form.logo.insertAdjacentHTML('beforeend', `<option value="${esc(a.id)}">${esc(a.name)}</option>`);
        form.logo.value = a.id;
        form.logo.dispatchEvent(new Event('input', { bubbles: true }));
        toast('Logo caricato. Ricorda di salvare lo stile.');
      } catch (ex) { toast(ex.message); }
    });
    form.querySelector('[data-reset]').addEventListener('click', () => {
      const def = { primary: '#173a32', secondary: '#52745b', accent: '#c8ec68', background: '#f6f7f0', text: '#17231f' };
      for (const [k, v] of Object.entries(def)) { b.colors[k] = v; form[`color-${k}`].value = v; form[`hex-${k}`].value = v; }
      b.fonts = { heading: 'Playfair Display', body: 'DM Sans' };
      form['font-heading'].value = b.fonts.heading;
      form['font-body'].value = b.fonts.body;
      preview();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const bad = Object.keys(BRAND_COLORS).find((k) => !/^#[0-9a-f]{6}$/i.test(form[`hex-${k}`].value));
      if (bad) { err.textContent = `Il colore "${BRAND_COLORS[bad]}" deve essere un codice come #173a32.`; err.hidden = false; return; }
      try {
        await api(`/api/clients/${cid}/brand`, { method: 'PUT', body: b });
        await state.refreshClients();
        toast(`Stile di ${c.name} salvato. I progetti che usano i colori del cliente sono già aggiornati.`);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  }

  async function files() {
    panel.innerHTML = `
      <label class="dropzone" id="dropzone"><strong>Trascina qui foto, video o musica</strong><span>oppure scegli i file dal computer. Immagini fino a 25 MB, video fino a 800 MB, audio fino a 60 MB.</span>
        <span class="button button-outline button-small">Scegli file</span><input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,audio/*" class="visually-hidden"></label>
      <div id="up-progress"></div>
      <div id="assets"><p class="loading-line">Carico i file…</p></div>`;
    const zone = panel.querySelector('#dropzone');
    const input = zone.querySelector('input');
    const progress = panel.querySelector('#up-progress');
    const list = panel.querySelector('#assets');

    async function load() {
      let assets;
      try { assets = await api(`/api/clients/${cid}/assets`); } catch (e) { list.innerHTML = `<div class="error-box" role="alert"><p>${esc(e.message)}</p></div>`; return; }
      if (!isCurrent() || tab !== 'file') return;
      const logo = state.client(client.id)?.brand.logoAssetId;
      list.innerHTML = assets.length ? `<div class="asset-grid">${assets.map((a) => `
        <div class="asset-card">
          <div class="preview">${a.kind === 'image' ? `<img src="/media/${esc(a.id)}" alt="" loading="lazy">` : a.kind === 'video' ? `<video src="/media/${esc(a.id)}#t=0.5" muted preload="metadata" aria-hidden="true"></video>` : '<span class="kind">Audio</span>'}</div>
          <div class="info"><span title="${esc(a.name)}">${esc(a.name)}${a.id === logo ? ' · logo' : ''}<br><span class="note-muted">${esc(sizeFmt(a.size))}${a.duration ? ` · ${String(a.duration.toFixed(1)).replace('.', ',')} s` : ''}</span></span>
            <button type="button" class="icon-button" data-del="${esc(a.id)}" data-name="${esc(a.name)}" aria-label="Elimina ${esc(a.name)}">×</button></div>
        </div>`).join('')}</div>` : '<p class="note-muted" style="margin-top:14px">Nessun file caricato per questo cliente.</p>';
      list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: `Eliminare ${b.dataset.name}?`, text: 'Il file verrà cancellato da questo computer. Nei progetti che lo usano resterà un riquadro vuoto.', confirm: 'Elimina file' }))) return;
        try { await api(`/api/assets/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); await state.refreshClients(); toast('File eliminato.'); load(); } catch (e) { toast(e.message); }
      }));
    }

    async function upload(fileList) {
      for (const file of fileList) {
        progress.innerHTML = `<p class="note-muted" style="margin-top:10px">Carico ${esc(file.name)}…</p><div class="progress"><span></span></div>`;
        try {
          const meta = await probe(file);
          await uploadFile(client.id, file, { meta, onProgress: (p) => { const bar = progress.querySelector('.progress > span'); if (bar) bar.style.width = `${Math.round(p * 100)}%`; } });
        } catch (e) { toast(e.message); }
      }
      progress.innerHTML = '';
      load();
    }
    input.addEventListener('change', () => { upload([...input.files]); input.value = ''; });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); upload([...e.dataTransfer.files]); });
    await load();
  }

  await show(tab);
}

// Misure del file lette nel browser prima del caricamento (dimensioni e durata).
async function probe(file) {
  const url = URL.createObjectURL(file);
  const out = {};
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      if (img.naturalWidth) Object.assign(out, { width: img.naturalWidth, height: img.naturalHeight });
    } else if (/^(video|audio)\//.test(file.type)) {
      const d = await mediaDuration(url, file.type.startsWith('video/') ? 'video' : 'audio');
      if (d) out.duration = d;
    }
  } finally { URL.revokeObjectURL(url); }
  return out;
}
