// Time to Create usa i progetti persistenti e gli strumenti condivisi dello studio.
import { api, esc, state, toast, uploadFile, confirmDialog, openDialog, closeButton } from '../lib.js';
import { FORMATS, FONTS, BRAND_COLORS, BRAND_FONTS, POST_TEMPLATES, emptyDoc, ensureFont, onFontLoaded } from '../editor/model.js';
import { renderToCanvas, onImageLoaded } from '../editor/render.js';
import { mediaDuration } from '../editor/reel.js';

const CATEGORIES = {
  social: {
    label: 'Social media',
    description: 'Post, stories, caroselli e copertine.',
    formats: ['post-1x1', 'post-4x5', 'story-9x16', 'reel-cover-9x16', 'carousel-4x5', 'facebook-post', 'facebook-cover', 'linkedin-post', 'linkedin-cover', 'tiktok-cover', 'youtube-cover', 'youtube-thumbnail', 'pinterest-pin'],
    custom: 'custom-post',
  },
  presentations: {
    label: 'Presentazioni',
    description: 'Slide, pitch e proposte.',
    formats: ['presentation-16x9', 'presentation-4x3'],
    custom: 'custom-post',
  },
  documents: {
    label: 'Documenti',
    description: 'Report, proposte e documenti A4/A5.',
    formats: ['document-a4', 'document-a5', 'report-a4', 'proposal-a4', 'quote-a4', 'resume-a4'],
    custom: 'custom-post',
  },
  video: {
    label: 'Video',
    description: 'Reel, TikTok e video promozionali.',
    formats: ['reel-9x16', 'video-square', 'landscape-16x9'],
    custom: 'custom-video',
  },
  print: {
    label: 'Grafica per stampa',
    description: 'Flyer, locandine e brochure.',
    formats: ['print-a4', 'print-a5', 'brochure-a4', 'poster-a3', 'business-card', 'invitation-a5', 'menu-a4'],
    custom: 'custom-post',
  },
  other: {
    label: 'Altri progetti',
    description: 'Loghi, moodboard e formati personalizzati.',
    formats: ['logo-square', 'moodboard-16x9', 'web-graphic'],
    custom: 'custom-post',
  },
};
const CATEGORY_SIZES = {
  social: [1080, 1350], presentations: [1920, 1080], documents: [2480, 3508],
  video: [1080, 1920], print: [2480, 3508], other: [1080, 1080],
};
const CATEGORY_ICONS = {
  social: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r="1" class="icon-fill"/></svg>',
  presentations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M12 17v4m-4 0h8M8 9h8m-8 3h5"/></svg>',
  documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6m-6 3h6"/></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" class="icon-fill"/></svg>',
  print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10v5H7zm-2 5h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2z"/><path d="M7 14h10v6H7zm10-3h.01"/></svg>',
  other: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/></svg>',
  brand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.5-2.9 7.8-7 10-4.1-2.2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  files: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h7l2 2h8v11h-17z"/><path d="M3.5 9h17"/></svg>',
  templates: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="8" rx="1"/><rect x="13.5" y="3.5" width="7" height="5" rx="1"/><rect x="13.5" y="11.5" width="7" height="9" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/></svg>',
};
const dateFmt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
const sizeFmt = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

export async function renderStudio(main, client, isCurrent, tabArg) {
  const tab = ['stile', 'file'].includes(tabArg) ? tabArg : 'progetti';
  const cid = encodeURIComponent(client.id);
  main.innerHTML = `
    <div class="studio-heading">
      <div class="studio-title">
        <h1>Time to Create</h1>
        <p>Dai forma alle tue idee.</p>
        ${tab === 'progetti' ? `
          <label class="studio-search">
            <span class="visually-hidden">Cerca progetti e modelli</span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>
            <input id="studio-search" type="search" placeholder="Cerca progetti e modelli" autocomplete="off">
          </label>` : ''}
      </div>
      ${tab !== 'progetti' ? `<a class="button button-outline" href="#/cliente/${cid}/studio">‹ Time to Create</a>` : ''}
    </div>
    ${tab === 'progetti' ? '<div id="studio-search-results" class="studio-search-results" aria-live="polite" hidden></div>' : ''}
    <div id="st-panel"></div>`;
  const panel = main.querySelector('#st-panel');

  if (tab === 'stile') return brandKit();
  if (tab === 'file') return files();
  const search = main.querySelector('#studio-search');
  const results = main.querySelector('#studio-search-results');
  let designs = [];
  let loadError = false;

  function renderDesigns() {
    const box = panel.querySelector('#designs');
    if (!box || loadError) return;
    const query = search.value.trim().toLowerCase();
    const filtered = designs.filter((d) => !query || `${d.name} ${FORMATS[d.format]?.label || d.format}`.toLowerCase().includes(query));
    if (!designs.length) {
      box.innerHTML = '<p class="studio-empty">I tuoi progetti appariranno qui</p>';
      return;
    }
    if (!filtered.length) {
      box.innerHTML = '<p class="studio-empty">Nessun progetto corrisponde alla ricerca.</p>';
      return;
    }
    box.innerHTML = `<div class="studio-project-list">${filtered.map((d) => `
      <article class="studio-project" data-design-id="${esc(d.id)}">
        <a class="studio-project-preview" href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}" aria-label="Apri ${esc(d.name)}">
          ${d.hasThumb ? `<img src="/media/thumb/${encodeURIComponent(d.id)}.png?v=${encodeURIComponent(d.updatedAt)}" alt="" loading="lazy">` : `<span>${esc(FORMATS[d.format]?.label || 'Anteprima non disponibile')}</span>`}
        </a>
        <a class="studio-project-name" href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}">${esc(d.name)}</a>
        <span class="studio-project-type">${esc(FORMATS[d.format]?.label || d.format)}</span>
        <time class="studio-project-date" datetime="${esc(d.updatedAt)}">${esc(dateFmt.format(new Date(d.updatedAt)))}</time>
        <details class="studio-project-actions">
          <summary aria-label="Azioni per ${esc(d.name)}" title="Azioni">⋯</summary>
          <div class="studio-action-menu" aria-label="Azioni per ${esc(d.name)}">
            <a href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}">Apri</a>
            <button type="button" data-rename="${esc(d.id)}" data-name="${esc(d.name)}">Rinomina</button>
            <button type="button" data-duplicate="${esc(d.id)}">Duplica</button>
            <button type="button" data-delete="${esc(d.id)}" data-name="${esc(d.name)}">Elimina</button>
          </div>
        </details>
      </article>`).join('')}</div>`;
    box.querySelectorAll('[data-rename]').forEach((button) => button.addEventListener('click', () => {
      button.closest('details').open = false;
      renameDesign(button.dataset.rename, button.dataset.name);
    }));
    box.querySelectorAll('[data-duplicate]').forEach((button) => button.addEventListener('click', async () => {
      button.closest('details').open = false;
      try {
        await api(`/api/designs/${encodeURIComponent(button.dataset.duplicate)}/duplicate`, { method: 'POST' });
        toast('Progetto duplicato.');
        await loadDesigns();
      } catch (e) { toast(e.message); }
    }));
    box.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
      button.closest('details').open = false;
      if (!(await confirmDialog({ title: `Eliminare "${button.dataset.name}"?`, text: 'Il progetto verrà eliminato. I contenuti in programma che lo usavano restano, senza progetto collegato.', confirm: 'Elimina' }))) return;
      try {
        await api(`/api/designs/${encodeURIComponent(button.dataset.delete)}`, { method: 'DELETE' });
        toast('Progetto eliminato.');
        await loadDesigns();
      } catch (e) { toast(e.message); }
    }));
  }

  function renderSearch(value) {
    const query = value.trim().toLowerCase();
    results.hidden = !query;
    if (!query) { results.innerHTML = ''; return; }
    const matchingDesigns = designs.filter((d) => `${d.name} ${FORMATS[d.format]?.label || d.format}`.toLowerCase().includes(query));
    const matchingTemplates = POST_TEMPLATES.filter((template) => template.name.toLowerCase().includes(query));
    const projectRows = matchingDesigns.map((d) => `
      <a class="studio-search-result" href="#/cliente/${cid}/editor/${encodeURIComponent(d.id)}">
        <span class="studio-icon">${CATEGORY_ICONS.templates}</span><span><strong>${esc(d.name)}</strong><small>Progetto · ${esc(FORMATS[d.format]?.label || d.format)}</small></span>
      </a>`).join('');
    const templateRows = matchingTemplates.map((template) => `
      <button type="button" class="studio-search-result" data-search-template="${esc(template.id)}">
        <span class="studio-icon">${CATEGORY_ICONS.templates}</span><span><strong>${esc(template.name)}</strong><small>Template</small></span>
      </button>`).join('');
    results.innerHTML = projectRows || templateRows ? `
      ${projectRows ? `<div class="studio-search-group"><h2>Progetti</h2>${projectRows}</div>` : ''}
      ${templateRows ? `<div class="studio-search-group"><h2>Template</h2>${templateRows}</div>` : ''}`
      : '<p class="studio-search-empty">Nessun progetto o template trovato.</p>';
    results.querySelectorAll('[data-search-template]').forEach((button) => {
      button.addEventListener('click', () => openFormatDialog({ categoryKey: 'social', templateId: button.dataset.searchTemplate }));
    });
  }

  async function loadDesigns() {
    loadError = false;
    const box = panel.querySelector('#designs');
    box.innerHTML = '<p class="loading-line">Carico i progetti…</p>';
    try {
      designs = await api(`/api/designs?clientId=${cid}`);
      if (!isCurrent()) return;
      renderDesigns();
      renderSearch(search.value);
    } catch (e) {
      if (!isCurrent()) return;
      loadError = true;
      box.innerHTML = `<div class="error-box" role="alert"><p>${esc(e.message)}</p><button type="button" class="button button-outline" data-retry>Riprova</button></div>`;
      box.querySelector('[data-retry]').addEventListener('click', loadDesigns);
    }
  }

  function renameDesign(id, oldName) {
    const dialog = openDialog(`
      <form id="rename-design-form">
        <div class="dlg-head"><h2 id="rename-design-title">Rinomina progetto</h2>${closeButton}</div>
        <div class="dlg-body">
          <label class="field"><span>Nome del progetto</span><input name="name" maxlength="100" required value="${esc(oldName)}"></label>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="dlg-foot"><button type="button" class="button button-outline" data-close>Annulla</button><button type="submit" class="button button-accent">Salva nome</button></div>
      </form>`, { labelledBy: 'rename-design-title' });
    const form = dialog.querySelector('#rename-design-form');
    const error = form.querySelector('.form-error');
    form.querySelector('[name="name"]').focus();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = form.querySelector('[name="name"]').value.trim();
      if (!name) { error.textContent = 'Scrivi un nome per il progetto.'; error.hidden = false; return; }
      try {
        const design = await api(`/api/designs/${encodeURIComponent(id)}`);
        await api(`/api/designs/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: { name, kind: design.kind, format: design.format, doc: design.doc },
        });
        dialog.close();
        toast('Nome del progetto aggiornato.');
        await loadDesigns();
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
      }
    });
  }

  function openFormatDialog({ categoryKey = 'social', templateId = null } = {}) {
    const category = CATEGORIES[categoryKey] ? categoryKey : 'social';
    const template = POST_TEMPLATES.find((item) => item.id === templateId);
    const dialog = openDialog(`
      <form id="new-design-form">
        <div class="dlg-head"><div><p class="eyebrow">${template ? 'Usa un template' : 'Nuovo progetto'}</p><h2 id="new-design-title">${template ? esc(template.name) : 'Scegli un formato'}</h2></div>${closeButton}</div>
        <div class="dlg-body">
          ${template ? `<p class="note-muted">Template selezionato. Scegli il formato da aprire nell’editor.</p><input type="hidden" name="category" value="social">` : `
            <label class="field"><span>Tipologia</span><select name="category">${Object.entries(CATEGORIES).map(([key, item]) => `<option value="${key}" ${category === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>`}
          <label class="field"><span>Formato</span><select name="format"></select></label>
          <div class="custom-dimensions" hidden>
            <div class="form-row">
              <label class="field"><span>Larghezza</span><input type="number" name="width" min="1" max="10000" inputmode="decimal"></label>
              <label class="field"><span>Altezza</span><input type="number" name="height" min="1" max="10000" inputmode="decimal"></label>
              <label class="field"><span>Unità</span><select name="unit"><option value="px">px</option><option value="mm">mm</option><option value="cm">cm</option></select></label>
            </div>
            <p class="note-muted">Le misure sono convertite in pixel per l’editor, fino a 25 megapixel.</p>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="dlg-foot"><button type="button" class="button button-outline" data-close>Annulla</button><button type="submit" class="button button-accent">Crea e apri l’editor</button></div>
      </form>`, { labelledBy: 'new-design-title' });
    const form = dialog.querySelector('#new-design-form');
    const formatSelect = form.elements.format;
    const customFields = form.querySelector('.custom-dimensions');
    const error = form.querySelector('.form-error');
    const initialCategory = category;

    function selectedCategory() {
      return template ? 'social' : form.elements.category.value;
    }

    function setCustomSize(currentCategory) {
      const factor = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54 }[form.elements.unit.value];
      const [width, height] = CATEGORY_SIZES[currentCategory];
      form.elements.width.value = Math.max(1, Math.round(width / factor));
      form.elements.height.value = Math.max(1, Math.round(height / factor));
    }

    function updateFormats() {
      const currentCategory = selectedCategory();
      const item = CATEGORIES[currentCategory];
      const customFormat = item.custom;
      const options = item.formats.map((id) => {
        const f = FORMATS[id];
        return `<option value="${id}">${esc(f.label)} · ${f.w} x ${f.h} px</option>`;
      });
      const custom = FORMATS[customFormat];
      options.push(`<option value="${customFormat}">${esc(custom.label)} · imposta le dimensioni</option>`);
      formatSelect.innerHTML = options.join('');
      if (currentCategory === initialCategory && item.formats.includes('presentation-16x9')) formatSelect.value = 'presentation-16x9';
      customFields.hidden = formatSelect.value !== customFormat;
      if (!customFields.hidden) setCustomSize(currentCategory);
    }

    if (!template) form.elements.category.addEventListener('change', updateFormats);
    formatSelect.addEventListener('change', () => {
      const item = CATEGORIES[selectedCategory()];
      customFields.hidden = formatSelect.value !== item.custom;
      if (!customFields.hidden) setCustomSize(selectedCategory());
    });
    form.elements.unit.addEventListener('change', (event) => {
      const factor = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54 };
      const previous = factor[event.target.dataset.previousUnit || 'px'];
      const next = factor[event.target.value];
      for (const field of [form.elements.width, form.elements.height]) {
        const px = Number(field.value) * previous;
        field.value = Math.max(1, Math.round(px / next));
      }
      event.target.dataset.previousUnit = event.target.value;
    });
    updateFormats();
    formatSelect.focus();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      const selectedFormat = formatSelect.value;
      let dimensions = null;
      if (selectedFormat === CATEGORIES[selectedCategory()].custom) {
        const factor = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54 }[form.elements.unit.value];
        dimensions = {
          w: Math.round(Number(form.elements.width.value) * factor),
          h: Math.round(Number(form.elements.height.value) * factor),
        };
        if (!dimensions.w || !dimensions.h || dimensions.w > 10000 || dimensions.h > 10000 || dimensions.w * dimensions.h > 25000000) {
          error.textContent = 'Inserisci misure valide, con lati fino a 10.000 px e area fino a 25 megapixel.';
          error.hidden = false;
          return;
        }
      }
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const format = selectedFormat;
        const f = FORMATS[format];
        const doc = emptyDoc(format);
        if (dimensions) { doc.w = dimensions.w; doc.h = dimensions.h; }
        if (template) {
          doc.layers = template.build({ w: doc.w, h: doc.h });
          doc.background = { ...doc.background, ...template.background };
        }
        const createdAt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(new Date());
        const name = template ? `${template.name} · ${createdAt}` : `${f.label} · ${createdAt}`;
        const design = await api('/api/designs', {
          method: 'POST',
          body: { clientId: client.id, kind: f.kind, format, name, doc },
        });
        dialog.close();
        location.hash = `#/cliente/${cid}/editor/${encodeURIComponent(design.id)}`;
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
        button.disabled = false;
      }
    });
  }

  function renderTemplates() {
    panel.innerHTML = `
      <div class="studio-subview-heading">
        <div><p class="eyebrow">Libreria</p><h2>Template</h2></div>
        <button type="button" class="button button-outline" data-dashboard>‹ Torna a Time to Create</button>
      </div>
      <div class="studio-template-grid">${POST_TEMPLATES.map((template) => `
        <article class="studio-template">
          <canvas width="160" height="200" data-template-preview="${esc(template.id)}" aria-hidden="true"></canvas>
          <h3>${esc(template.name)}</h3>
          <button type="button" class="button button-outline" data-use-template="${esc(template.id)}">Usa template</button>
        </article>`).join('')}</div>`;
    const brand = state.client(client.id)?.brand || client.brand;
    for (const template of POST_TEMPLATES) {
      const canvas = panel.querySelector(`[data-template-preview="${template.id}"]`);
      const doc = { w: 1080, h: 1350, background: { color: '@background', color2: null, angle: 180, ...template.background }, layers: template.build({ w: 1080, h: 1350 }) };
      canvas.getContext('2d').drawImage(renderToCanvas(doc, brand, { width: canvas.width }), 0, 0, canvas.width, canvas.height);
    }
    panel.querySelector('[data-dashboard]').addEventListener('click', projects);
    panel.querySelectorAll('[data-use-template]').forEach((button) => {
      button.addEventListener('click', () => openFormatDialog({ categoryKey: 'social', templateId: button.dataset.useTemplate }));
    });
  }

  async function projects() {
    panel.innerHTML = `
      <section aria-labelledby="studio-create-heading">
        <div class="section-heading"><h2 id="studio-create-heading">Cosa vuoi creare oggi?</h2></div>
        <div class="studio-category-grid">
          ${Object.entries(CATEGORIES).map(([key, category]) => `
            <button type="button" class="studio-category" data-category="${key}">
              <span class="studio-icon">${CATEGORY_ICONS[key]}</span>
              <span class="studio-category-copy"><strong>${category.label}</strong><small>${category.description}</small></span>
            </button>`).join('')}
        </div>
      </section>
      <section class="studio-workspace" aria-labelledby="studio-workspace-heading">
        <div class="section-heading"><h2 id="studio-workspace-heading">Il tuo spazio di lavoro</h2></div>
        <nav class="studio-shortcuts" aria-label="Risorse dello spazio di lavoro">
          <a class="studio-shortcut" href="#/cliente/${cid}/studio/stile"><span class="studio-icon">${CATEGORY_ICONS.brand}</span><span>Brand Kit</span></a>
          <a class="studio-shortcut" href="#/cliente/${cid}/studio/file"><span class="studio-icon">${CATEGORY_ICONS.files}</span><span>File e risorse</span></a>
          <button type="button" class="studio-shortcut" data-templates><span class="studio-icon">${CATEGORY_ICONS.templates}</span><span>Template</span></button>
        </nav>
      </section>
      <section class="studio-recent" aria-labelledby="studio-recent-heading">
        <div class="section-heading"><h2 id="studio-recent-heading">Progetti recenti</h2></div>
        <div id="designs"><p class="loading-line">Carico i progetti…</p></div>
      </section>`;
    panel.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => openFormatDialog({ categoryKey: button.dataset.category })));
    panel.querySelector('[data-templates]').addEventListener('click', renderTemplates);
    await loadDesigns();
  }

  if (tab === 'progetti') {
    search.addEventListener('input', () => {
      renderDesigns();
      renderSearch(search.value);
    });
    await projects();
    return;
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
