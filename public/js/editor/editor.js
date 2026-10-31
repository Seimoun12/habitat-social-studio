// Editor grafico per post, storie e reel di un cliente.
// Tela: clic per selezionare, trascina per spostare, maniglie per ridimensionare e ruotare.
// Tastiera: frecce spostano (Maiusc: 10px), Canc elimina, Ctrl+Z/Ctrl+Y annulla e ripete, Ctrl+D duplica, Esc deseleziona, Spazio avvia il reel.
import { api, esc, state, toast, uploadFile, confirmDialog, openDialog, closeButton, download, slug } from '../lib.js';
import {
  FORMATS, FONTS, BRAND_COLORS, BRAND_FONTS, POST_TEMPLATES, REEL_TEXTS, ANIMS,
  textLayer, shapeLayer, imageLayer, uid, resolveColor, resolveFont, onFontLoaded, fontInfo,
} from './model.js';
import { renderDoc, renderToCanvas, layoutText, isVisibleAt, onImageLoaded, getImage, assetSrc, waitForImages } from './render.js';
import { ReelEngine, timeline, clipDuration, fmtTime, exportReel, recorderType, mediaDuration } from './reel.js';
import { openContentDialog } from '../views/contenuti.js';

const HISTORY_MAX = 80;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const round = (v, p = 1) => Math.round(v * p) / p;

export async function renderEditor(main, client, designId, isCurrent) {
  main.innerHTML = '<p class="loading-line" style="padding:40px">Apro il progetto…</p>';
  let design;
  let assets;
  try {
    [design, assets] = await Promise.all([api(`/api/designs/${encodeURIComponent(designId)}`), api(`/api/clients/${encodeURIComponent(client.id)}/assets`)]);
  } catch (e) {
    if (!isCurrent()) return () => {};
    main.innerHTML = `<div class="state" style="padding:40px"><h2>Progetto non disponibile</h2><p>${esc(e.message)}</p><a class="button button-dark" href="#/cliente/${encodeURIComponent(client.id)}/studio">Torna allo Studio grafico</a></div>`;
    return () => {};
  }
  if (!isCurrent()) return () => {};
  if (design.clientId !== client.id) {
    location.replace(`#/cliente/${encodeURIComponent(design.clientId)}/editor/${encodeURIComponent(design.id)}`);
    return () => {};
  }

  const brand = () => state.client(client.id)?.brand || client.brand;
  const fmt = FORMATS[design.format];
  const isReel = fmt.kind === 'reel';
  let doc = design.doc;
  doc.layers ??= [];
  if (isReel) { doc.clips ??= []; doc.clipVolume ??= 1; }
  let name = design.name;
  let selected = null; // id del livello
  let scope = 'doc'; // doc | layer | clip | audio
  let selectedClip = null;
  let tool = isReel ? 'clip' : 'modelli';
  const history = [JSON.stringify(doc)];
  let future = [];
  const cleanups = [];

  main.innerHTML = `
    <div class="editor ${isReel ? 'is-reel' : ''}">
      <header class="ed-bar">
        <a class="button button-ghost button-small" href="#/cliente/${encodeURIComponent(client.id)}/studio">‹ Studio grafico</a>
        <label class="ed-name"><span class="visually-hidden">Nome del progetto</span><input type="text" id="ed-name" maxlength="100" value="${esc(name)}"></label>
        <span class="ed-format">${esc(fmt.label)} · ${fmt.w}×${fmt.h} · ${esc(client.name)}</span>
        <span class="ed-status" id="ed-status" role="status" aria-live="polite">Salvato</span>
        <span class="ed-spacer"></span>
        <button type="button" class="icon-button" id="ed-undo" aria-label="Annulla" title="Annulla (Ctrl+Z)">↶</button>
        <button type="button" class="icon-button" id="ed-redo" aria-label="Ripeti" title="Ripeti (Ctrl+Y)">↷</button>
        <button type="button" class="button button-outline button-small" id="ed-schedule">Programma</button>
        <button type="button" class="button button-dark button-small" id="ed-export"><span class="button-icon download-icon" aria-hidden="true"></span>Esporta</button>
      </header>
      <aside class="ed-tools" aria-label="Strumenti">
        <div class="ed-tabs" role="tablist" aria-label="Strumenti" aria-orientation="vertical">
          ${(isReel ? [['clip', 'Montaggio'], ['testi', 'Testi pronti']] : [['modelli', 'Modelli']]).concat([['testo', 'Testo'], ['elementi', 'Elementi'], ['file', 'File'], ['stile', 'Stile'], ['livelli', 'Livelli']])
            .map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tool="${k}" aria-controls="ed-tool-panel" aria-selected="${k === tool}">${l}</button>`).join('')}
        </div>
        <div class="ed-tool-panel" id="ed-tool-panel" role="tabpanel"></div>
      </aside>
      <section class="ed-stage-wrap" id="ed-stage-wrap" aria-label="Tela">
        <canvas id="ed-canvas" tabindex="0" role="img" aria-label="Anteprima del progetto ${esc(name)}. Seleziona i livelli dal pannello Livelli o con un clic."></canvas>
        <div class="ed-drop-hint" id="ed-drop-hint" hidden>Rilascia per caricare il file</div>
      </section>
      <aside class="ed-props" id="ed-props" aria-label="Proprietà"></aside>
      ${isReel ? '<section class="ed-timeline" id="ed-timeline" aria-label="Timeline"></section>' : ''}
    </div>`;

  const $ = (s) => main.querySelector(s);
  const canvas = $('#ed-canvas');
  const ctx = canvas.getContext('2d');
  const wrap = $('#ed-stage-wrap');
  const props = $('#ed-props');
  const toolPanel = $('#ed-tool-panel');
  const statusEl = $('#ed-status');
  let ds = 0.4; // scala di visualizzazione: pixel CSS per pixel del progetto
  let dpr = window.devicePixelRatio || 1;
  let guides = [];

  const layer = () => doc.layers.find((l) => l.id === selected) || null;
  const clip = () => doc.clips?.find((c) => c.id === selectedClip) || null;
  const now = () => (isReel ? engine.t : null);

  // Disegno

  function overlay(c) {
    c.save();
    c.setTransform(ds * dpr, 0, 0, ds * dpr, 0, 0);
    const px = 1 / ds;
    for (const g of guides) {
      c.strokeStyle = '#d04fd8';
      c.lineWidth = px;
      c.beginPath();
      if (g.x != null) { c.moveTo(g.x, 0); c.lineTo(g.x, doc.h); } else { c.moveTo(0, g.y); c.lineTo(doc.w, g.y); }
      c.stroke();
    }
    const l = layer();
    if (l && isVisibleAt({ ...l, hidden: false }, now())) {
      c.translate(l.x + l.w / 2, l.y + l.h / 2);
      c.rotate(((l.rotation || 0) * Math.PI) / 180);
      c.strokeStyle = '#3c795d';
      c.lineWidth = 2 * px;
      c.strokeRect(-l.w / 2, -l.h / 2, l.w, l.h);
      if (!l.locked) {
        for (const h of handles(l)) {
          c.fillStyle = h.k === 'rot' ? '#c8ec68' : '#ffffff';
          c.strokeStyle = '#173a32';
          c.lineWidth = 1.5 * px;
          c.beginPath();
          if (h.k === 'rot') c.arc(h.x, h.y, 7 * px, 0, Math.PI * 2);
          else c.rect(h.x - 5 * px, h.y - 5 * px, 10 * px, 10 * px);
          c.fill();
          c.stroke();
        }
        c.beginPath();
        c.moveTo(0, -l.h / 2);
        c.lineTo(0, -l.h / 2 - 26 * px);
        c.stroke();
      }
    }
    c.restore();
  }

  function draw() {
    if (isReel) { engine.draw(); return; }
    renderDoc(ctx, doc, { brand: brand(), scale: ds * dpr, editing: true });
    overlay(ctx);
  }

  function fit() {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = window.devicePixelRatio || 1;
    ds = Math.max(0.05, Math.min((r.width - 40) / doc.w, (r.height - 40) / doc.h));
    canvas.style.width = `${Math.round(doc.w * ds)}px`;
    canvas.style.height = `${Math.round(doc.h * ds)}px`;
    canvas.width = Math.round(doc.w * ds * dpr);
    canvas.height = Math.round(doc.h * ds * dpr);
    if (isReel) engine.scale = ds * dpr;
    draw();
  }

  const engine = isReel ? new ReelEngine({
    getDoc: () => doc, getBrand: brand, canvas, scale: 1,
    onTime: () => syncTimelineTime(), onEnd: () => syncPlayButton(),
  }) : null;
  if (engine) engine.overlay = overlay;

  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  cleanups.push(() => ro.disconnect(), onFontLoaded(draw), onImageLoaded(draw));

  // Cronologia e salvataggio

  let saveTimer = null;
  let saving = false;
  let pendingSave = false;
  const setStatus = (t) => { statusEl.textContent = t; };

  function commit() {
    const snap = JSON.stringify(doc);
    if (snap === history[history.length - 1]) return;
    history.push(snap);
    if (history.length > HISTORY_MAX) history.shift();
    future = [];
    syncUndo();
    scheduleSave();
  }
  function scheduleSave() {
    pendingSave = true;
    setStatus('Modifiche non salvate');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 900);
  }
  async function save() {
    clearTimeout(saveTimer);
    if (saving) { saveTimer = setTimeout(save, 400); return; }
    if (!pendingSave) return;
    saving = true;
    pendingSave = false;
    setStatus('Salvataggio…');
    try {
      await api(`/api/designs/${encodeURIComponent(design.id)}`, { method: 'PUT', body: { name, doc } });
      setStatus('Salvato');
      saveThumb();
    } catch (e) {
      pendingSave = true;
      setStatus(`Non salvato: ${e.message}`);
    } finally { saving = false; }
  }
  // Anteprima per la galleria dello Studio, aggiornata a ogni salvataggio (che ha già il suo ritardo).
  function saveThumb() {
    const frame = isReel ? engine.frameAt(engine.t) : null;
    const usable = frame && (frame.el.readyState >= 2 || frame.el.naturalWidth);
    const c = renderToCanvas(doc, brand(), { width: 400, time: now(), frame: usable ? frame : null });
    c.toBlob((b) => {
      if (b) api(`/api/designs/${encodeURIComponent(design.id)}/thumb`, { method: 'PUT', binary: b, type: 'image/png' }).catch((e) => console.warn('Anteprima non salvata:', e.message));
    }, 'image/png');
  }
  function restore(snap) {
    doc = JSON.parse(snap);
    if (!layer()) { selected = null; if (scope === 'layer') scope = 'doc'; }
    if (isReel && !clip()) { selectedClip = null; if (scope === 'clip') scope = 'doc'; }
    if (scope === 'audio' && !doc.audio) scope = 'doc';
    refresh();
    scheduleSave();
  }
  function undo() { if (history.length < 2) return; future.push(history.pop()); restore(history[history.length - 1]); syncUndo(); }
  function redo() { if (!future.length) return; const s = future.pop(); history.push(s); restore(s); syncUndo(); }
  function syncUndo() { $('#ed-undo').disabled = history.length < 2; $('#ed-redo').disabled = !future.length; }

  const beforeUnload = (e) => { if (pendingSave || saving) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  cleanups.push(() => window.removeEventListener('beforeunload', beforeUnload));

  $('#ed-name').addEventListener('input', (e) => { name = e.target.value.trim() || 'Senza nome'; scheduleSave(); });
  $('#ed-undo').addEventListener('click', undo);
  $('#ed-redo').addEventListener('click', redo);

  // Selezione e livelli

  function select(id, { focusCanvas = false } = {}) {
    selected = id;
    scope = id ? 'layer' : 'doc';
    if (id) selectedClip = null;
    refresh();
    if (focusCanvas) canvas.focus();
  }
  function addLayer(l, { center = true } = {}) {
    if (center && l.type !== 'image') { l.x = (doc.w - l.w) / 2; if (l.type !== 'text') l.y = (doc.h - l.h) / 2; else l.y = doc.h * 0.4; }
    if (isReel && l.start == null) l.start = 0;
    if (isReel && engine && !l._keepTime) { l.start = round(engine.t, 10); }
    delete l._keepTime;
    if (l.type === 'text') l.h = layoutText(ctx, l, brand()).h;
    doc.layers.push(l);
    commit();
    select(l.id);
  }
  function removeLayer(id) {
    doc.layers = doc.layers.filter((l) => l.id !== id);
    if (selected === id) { selected = null; scope = 'doc'; }
    commit();
    refresh();
  }
  function duplicate() {
    const l = layer();
    if (!l) return;
    const copy = { ...structuredClone(l), id: uid(), name: `${l.name} copia`, x: l.x + 30, y: l.y + 30 };
    doc.layers.splice(doc.layers.indexOf(l) + 1, 0, copy);
    commit();
    select(copy.id);
  }
  function move(delta) {
    const l = layer();
    if (!l) return;
    const i = doc.layers.indexOf(l);
    const j = Math.min(doc.layers.length - 1, Math.max(0, i + delta));
    if (i === j) return;
    doc.layers.splice(i, 1);
    doc.layers.splice(j, 0, l);
    commit();
    refresh();
  }

  // Interazione con la tela

  function toDoc(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / ds, y: (e.clientY - r.top) / ds };
  }
  function toLocal(l, p) {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const a = (-(l.rotation || 0) * Math.PI) / 180;
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function handles(l) {
    const w = l.w / 2;
    const h = l.h / 2;
    const px = 1 / ds;
    const list = [
      { k: 'nw', x: -w, y: -h, sx: -1, sy: -1 }, { k: 'ne', x: w, y: -h, sx: 1, sy: -1 },
      { k: 'sw', x: -w, y: h, sx: -1, sy: 1 }, { k: 'se', x: w, y: h, sx: 1, sy: 1 },
      { k: 'w', x: -w, y: 0, sx: -1, sy: 0 }, { k: 'e', x: w, y: 0, sx: 1, sy: 0 },
    ];
    if (l.type !== 'text') list.push({ k: 'n', x: 0, y: -h, sx: 0, sy: -1 }, { k: 's', x: 0, y: h, sx: 0, sy: 1 });
    list.push({ k: 'rot', x: 0, y: -h - 26 * px });
    return list;
  }
  function hitHandle(l, p) {
    if (!l || l.locked) return null;
    const lp = toLocal(l, p);
    const r = 11 / ds;
    return handles(l).find((h) => Math.abs(lp.x - h.x) <= r && Math.abs(lp.y - h.y) <= r) || null;
  }
  function hitLayer(p) {
    const t = now();
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i];
      if (l.locked || !isVisibleAt(l, t)) continue;
      const lp = toLocal(l, p);
      if (Math.abs(lp.x) <= l.w / 2 && Math.abs(lp.y) <= l.h / 2) return l;
    }
    return null;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.focus();
    const p = toDoc(e);
    const cur = layer();
    const h = hitHandle(cur, p);
    if (h) {
      drag = { mode: h.k === 'rot' ? 'rotate' : 'resize', h, start: p, orig: structuredClone(cur) };
    } else {
      const hit = hitLayer(p);
      if (!hit) { if (selected) select(null); return; }
      if (hit.id !== selected) select(hit.id);
      drag = { mode: 'move', start: p, orig: structuredClone(hit) };
    }
    canvas.setPointerCapture(e.pointerId);
  });

  function snapMove(l) {
    guides = [];
    const th = 7 / ds;
    const xs = [[l.x, 0], [l.x + l.w / 2, l.w / 2], [l.x + l.w, l.w]];
    const ys = [[l.y, 0], [l.y + l.h / 2, l.h / 2], [l.y + l.h, l.h]];
    const tx = [0, doc.w / 2, doc.w];
    const ty = [0, doc.h / 2, doc.h];
    outerX: for (const [v, off] of xs) for (const t of tx) if (Math.abs(v - t) < th) { l.x = t - off; guides.push({ x: t }); break outerX; }
    outerY: for (const [v, off] of ys) for (const t of ty) if (Math.abs(v - t) < th) { l.y = t - off; guides.push({ y: t }); break outerY; }
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toDoc(e);
    if (!drag) {
      const h = hitHandle(layer(), p);
      canvas.style.cursor = h ? (h.k === 'rot' ? 'grab' : 'crosshair') : hitLayer(p) ? 'move' : 'default';
      return;
    }
    const l = layer();
    if (!l) return;
    const o = drag.orig;
    if (drag.mode === 'move') {
      l.x = o.x + (p.x - drag.start.x);
      l.y = o.y + (p.y - drag.start.y);
      if (!e.altKey) snapMove(l);
    } else if (drag.mode === 'rotate') {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey || Math.abs(((deg % 90) + 90) % 90) < 4 || Math.abs(((deg % 90) + 90) % 90) > 86) deg = Math.round(deg / (e.shiftKey ? 15 : 90)) * (e.shiftKey ? 15 : 90);
      l.rotation = round(((deg + 540) % 360) - 180, 10);
    } else {
      const { sx, sy } = drag.h;
      const a = ((o.rotation || 0) * Math.PI) / 180;
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
      const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
      let nw = Math.max(12, o.w + sx * lx);
      let nh = Math.max(12, o.h + sy * ly);
      const corner = sx && sy;
      const keep = corner && (o.type === 'text' || (o.type === 'image') !== e.shiftKey);
      if (keep) {
        const f = Math.max(nw / o.w, nh / o.h);
        nw = o.w * f;
        nh = o.h * f;
      }
      if (o.type === 'text') {
        if (corner) l.size = Math.max(6, round(o.size * (nw / o.w), 10));
        l.w = nw;
        l.h = layoutText(ctx, l, brand()).h;
        nh = l.h;
      } else { l.w = nw; l.h = nh; }
      const shiftX = sx ? (sx * (nw - o.w)) / 2 : 0;
      const shiftY = o.type === 'text' ? (corner ? (sy * (nh - o.h)) / 2 : (nh - o.h) / 2) : sy ? (sy * (nh - o.h)) / 2 : 0;
      const cx = o.x + o.w / 2 + shiftX * Math.cos(a) - shiftY * Math.sin(a);
      const cy = o.y + o.h / 2 + shiftX * Math.sin(a) + shiftY * Math.cos(a);
      l.x = cx - nw / 2;
      l.y = cy - nh / 2;
    }
    draw();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    guides = [];
    for (const k of ['x', 'y', 'w', 'h']) if (layer()) layer()[k] = round(layer()[k], 10);
    commit();
    refresh();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => {
    if (layer()?.type === 'text') props.querySelector('[data-prop="text"]')?.focus();
  });

  // Scorciatoie da tastiera, fuori dai campi di testo.
  const onKey = (e) => {
    if (!main.contains(document.activeElement) && document.activeElement !== document.body) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); pendingSave = true; save(); return; }
    if (typing || document.querySelector('dialog[open]')) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (isReel && e.key === ' ' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); return; }
    const l = layer();
    if (e.key === 'Escape' && l) { select(null); return; }
    if (!l || l.locked) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(l.id); return; }
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d && document.activeElement === canvas) { e.preventDefault(); l.x += d[0]; l.y += d[1]; draw(); clearTimeout(keyCommit); keyCommit = setTimeout(() => { commit(); renderProps(); }, 350); }
  };
  let keyCommit = null;
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  // Pannello proprietà

  const field = (label, inner, cls = '') => `<label class="ed-field ${cls}"><span class="ed-label">${label}</span>${inner}</label>`;
  const numInput = (prop, value, { min, max, step = 1, suffix } = {}) => `<span class="ed-num"><input type="number" data-prop="${prop}" data-type="number" value="${round(value ?? 0, step < 1 ? 100 : 1)}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} step="${step}">${suffix ? `<i>${suffix}</i>` : ''}</span>`;
  const range = (prop, value, min, max, step = 1) => `<input type="range" data-prop="${prop}" data-type="number" min="${min}" max="${max}" step="${step}" value="${value ?? 0}">`;
  const check = (prop, value, label) => `<label class="ed-check"><input type="checkbox" data-prop="${prop}" data-type="bool" ${value ? 'checked' : ''}> ${label}</label>`;
  const select_ = (prop, value, options) => `<select data-prop="${prop}">${Object.entries(options).map(([k, l]) => `<option value="${esc(k)}" ${String(value) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  function colorField(label, prop, value, { none = false } = {}) {
    const b = brand();
    const hex = resolveColor(value, b) || '#ffffff';
    return `<div class="ed-field"><span class="ed-label">${label}</span><div class="ed-colors" data-color-prop="${prop}">
      ${none ? `<button type="button" class="sw sw-none" data-color="" aria-pressed="${!value}" aria-label="Nessun colore" title="Nessuno"></button>` : ''}
      ${Object.entries(BRAND_COLORS).map(([k, l]) => `<button type="button" class="sw" style="--c:${esc(b.colors[k])}" data-color="@${k}" aria-pressed="${value === `@${k}`}" aria-label="${l} del cliente" title="${l} del cliente"></button>`).join('')}
      <input type="color" value="${esc(hex.length === 7 ? hex : '#ffffff')}" data-color-custom aria-label="${label}: colore personalizzato" title="Colore personalizzato">
    </div></div>`;
  }
  const fontOptions = () => {
    const b = brand();
    return `<select data-prop="font">
      <optgroup label="Stile del cliente">${Object.entries(BRAND_FONTS).map(([k, l]) => `<option value="@${k}">${l} (${esc(b.fonts[k])})</option>`).join('')}</optgroup>
      <optgroup label="Tutti i caratteri">${FONTS.map((f) => `<option value="${esc(f.family)}">${esc(f.family)}</option>`).join('')}</optgroup>
    </select>`;
  };
  const timeFields = (o) => isReel ? `
    <h3 class="ed-h">Tempi</h3>
    <div class="ed-row">${field('Compare a', numInput('start', o.start || 0, { min: 0, step: 0.1, suffix: 's' }))}${field('Sparisce a', `<span class="ed-num"><input type="number" data-prop="end" data-type="number-null" value="${o.end ?? ''}" min="0" step="0.1" placeholder="fine"><i>s</i></span>`)}</div>
    <div class="ed-row"><button type="button" class="button button-outline button-small" data-act="start-here">Compare qui</button><button type="button" class="button button-outline button-small" data-act="end-here">Sparisce qui</button></div>
    ${field('Animazione di ingresso', select_('anim', o.anim || 'none', ANIMS))}` : '';

  function renderProps() {
    const l = layer();
    const b = brand();
    if (scope === 'layer' && l) {
      const common = `
        <div class="ed-props-head"><input type="text" class="ed-layer-name" data-prop="name" value="${esc(l.name)}" aria-label="Nome del livello" maxlength="60">
          <button type="button" class="icon-button" data-act="deselect" aria-label="Chiudi le proprietà del livello">×</button></div>
        <div class="ed-actions">
          <button type="button" class="button button-outline button-small" data-act="duplicate">Duplica</button>
          <button type="button" class="button button-outline button-small" data-act="forward" aria-label="Porta avanti di un livello">Avanti</button>
          <button type="button" class="button button-outline button-small" data-act="backward" aria-label="Porta indietro di un livello">Indietro</button>
          <button type="button" class="button button-outline button-small" data-act="lock" aria-pressed="${l.locked}">${l.locked ? 'Sblocca' : 'Blocca'}</button>
          <button type="button" class="button button-ghost button-small button-danger" data-act="delete">Elimina</button>
        </div>`;
      let specific = '';
      if (l.type === 'text') {
        specific = `
          ${field('Testo', `<textarea data-prop="text" rows="3">${esc(l.text)}</textarea>`)}
          ${field('Carattere', fontOptions())}
          <div class="ed-row">${field('Peso', select_('weight', l.weight, Object.fromEntries(fontInfo(resolveFont(l.font, b)).weights.map((w) => [w, { 400: 'Normale', 500: 'Medio', 600: 'Semigrassetto', 700: 'Grassetto', 800: 'Nero', 900: 'Nero pieno' }[w] || w]))))}${field('Dimensione', numInput('size', l.size, { min: 6, max: 600, step: 1, suffix: 'px' }))}</div>
          <div class="ed-row">${field('Interlinea', numInput('lineHeight', l.lineHeight, { min: 0.6, max: 3, step: 0.05 }))}${field('Spaziatura', numInput('letterSpacing', l.letterSpacing, { min: -10, max: 60, step: 0.5, suffix: 'px' }))}</div>
          <div class="ed-field"><span class="ed-label">Allineamento</span><div class="segmented ed-seg">${['left', 'center', 'right'].map((a) => `<button type="button" data-set="align" data-value="${a}" aria-pressed="${l.align === a}">${{ left: 'Sinistra', center: 'Centro', right: 'Destra' }[a]}</button>`).join('')}</div></div>
          <div class="ed-checks">${check('italic', l.italic, 'Corsivo')}${check('uppercase', l.uppercase, 'Maiuscolo')}${check('shadow', l.shadow, 'Ombra')}</div>
          ${colorField('Colore del testo', 'color', l.color)}
          ${colorField('Sfondo del testo', 'bg', l.bg, { none: true })}
          ${l.bg ? `<div class="ed-row">${field('Margine interno', numInput('pad', l.pad, { min: 0, max: 200, suffix: 'px' }))}${field('Arrotondamento', numInput('bgRadius', l.bgRadius, { min: 0, max: 400, suffix: 'px' }))}</div>` : ''}`;
      } else if (l.type === 'shape') {
        specific = `
          ${field('Forma', select_('shape', l.shape, { rect: 'Rettangolo', ellipse: 'Ellisse' }))}
          ${colorField('Riempimento', 'fill', l.fill, { none: true })}
          ${colorField('Bordo', 'stroke', l.stroke, { none: true })}
          <div class="ed-row">${field('Spessore bordo', numInput('strokeWidth', l.strokeWidth, { min: 0, max: 100, suffix: 'px' }))}${l.shape === 'rect' ? field('Arrotondamento', numInput('radius', l.radius, { min: 0, max: 2000, suffix: 'px' })) : ''}</div>`;
      } else {
        specific = `
          <div class="ed-actions"><button type="button" class="button button-outline button-small" data-act="replace-image">${l.assetId ? 'Sostituisci immagine' : 'Scegli immagine'}</button>
            <button type="button" class="button button-outline button-small" data-act="use-logo">Usa il logo</button>
            <button type="button" class="button button-outline button-small" data-act="fill-page">Riempi la pagina</button></div>
          ${field('Adattamento', select_('fit', l.fit, { cover: 'Riempi il riquadro (ritaglia)', contain: 'Intera nel riquadro' }))}
          ${field('Arrotondamento angoli', numInput('radius', l.radius, { min: 0, max: 2000, suffix: 'px' }))}
          ${field('Luminosità', range('brightness', l.brightness, 30, 170))}
          ${field('Contrasto', range('contrast', l.contrast, 30, 170))}
          ${field('Saturazione', range('saturate', l.saturate, 0, 200))}
          <div class="ed-checks">${check('flipX', l.flipX, 'Specchia')}</div>`;
      }
      props.dataset.scope = 'layer';
      props.innerHTML = `${common}${specific}
        <h3 class="ed-h">Posizione</h3>
        <div class="ed-row">${field('X', numInput('x', l.x, { suffix: 'px' }))}${field('Y', numInput('y', l.y, { suffix: 'px' }))}</div>
        <div class="ed-row">${field('Larghezza', numInput('w', l.w, { min: 12, suffix: 'px' }))}${l.type !== 'text' ? field('Altezza', numInput('h', l.h, { min: 12, suffix: 'px' })) : ''}</div>
        <div class="ed-field"><span class="ed-label">Allinea alla pagina</span><div class="ed-align">${[['left', 'Sinistra'], ['hcenter', 'Centro orizzontale'], ['right', 'Destra'], ['top', 'In alto'], ['vcenter', 'Centro verticale'], ['bottom', 'In basso']].map(([k, t]) => `<button type="button" class="button button-outline button-small" data-align="${k}">${t}</button>`).join('')}</div></div>
        ${field('Rotazione', `<div class="ed-range">${range('rotation', l.rotation, -180, 180)}${numInput('rotation', l.rotation, { min: -180, max: 180, suffix: '°' })}</div>`)}
        ${field('Opacità', `<div class="ed-range">${range('opacity', l.opacity, 0, 1, 0.01)}<span class="ed-val">${Math.round((l.opacity ?? 1) * 100)}%</span></div>`)}
        ${timeFields(l)}`;
      const fontSel = props.querySelector('select[data-prop="font"]');
      if (fontSel) fontSel.value = l.font;
      return;
    }
    if (scope === 'clip' && clip()) {
      const c = clip();
      const tl = timeline(doc);
      const idx = doc.clips.indexOf(c);
      props.dataset.scope = 'clip';
      props.innerHTML = `
        <div class="ed-props-head"><strong>Clip ${idx + 1} di ${doc.clips.length}</strong><button type="button" class="icon-button" data-act="deselect" aria-label="Chiudi le proprietà del clip">×</button></div>
        <p class="note-muted">${esc(c.name || '')} · dura ${esc(fmtTime(clipDuration(c)))}</p>
        <div class="ed-actions">
          <button type="button" class="button button-outline button-small" data-act="clip-left" ${idx === 0 ? 'disabled' : ''}>Sposta prima</button>
          <button type="button" class="button button-outline button-small" data-act="clip-right" ${idx === doc.clips.length - 1 ? 'disabled' : ''}>Sposta dopo</button>
          <button type="button" class="button button-outline button-small" data-act="clip-split">Dividi al cursore</button>
          <button type="button" class="button button-ghost button-small button-danger" data-act="clip-delete">Elimina</button>
        </div>
        ${c.type === 'video' ? `
          <h3 class="ed-h">Taglio</h3>
          <div class="ed-row">${field('Inizio nel video', numInput('in', c.in, { min: 0, max: c.srcDuration, step: 0.1, suffix: 's' }))}${field('Fine nel video', numInput('out', c.out, { min: 0.1, max: c.srcDuration, step: 0.1, suffix: 's' }))}</div>
          <p class="note-muted">Durata del file: ${esc(fmtTime(c.srcDuration || 0))}.</p>` : `
          ${field('Durata', numInput('duration', c.duration, { min: 0.5, max: 60, step: 0.5, suffix: 's' }))}`}
        ${field('Movimento', select_('motion', c.motion || 'none', { none: 'Fermo', zoom: 'Zoom lento in avanti', 'zoom-out': 'Zoom lento indietro' }))}
        ${field('Adattamento', select_('fit', c.fit || 'cover', { cover: 'Riempi lo schermo', contain: 'Intero, con bande' }))}
        <div class="ed-checks">${check('fadeIn', c.fadeIn, 'Dissolvenza dal nero')}</div>
        ${field('Luminosità', range('brightness', c.brightness ?? 100, 30, 170))}
        ${field('Contrasto', range('contrast', c.contrast ?? 100, 30, 170))}
        ${field('Saturazione', range('saturate', c.saturate ?? 100, 0, 200))}
        <p class="note-muted">Il clip parte a ${esc(fmtTime(tl.items[idx]?.start || 0))} nel reel.</p>`;
      return;
    }
    if (scope === 'audio' && doc.audio) {
      props.dataset.scope = 'audio';
      props.innerHTML = `
        <div class="ed-props-head"><strong>Musica</strong><button type="button" class="icon-button" data-act="deselect" aria-label="Chiudi le proprietà della musica">×</button></div>
        <p class="note-muted">${esc(doc.audio.name || '')}</p>
        ${field('Volume musica', `<div class="ed-range">${range('volume', doc.audio.volume ?? 0.8, 0, 1, 0.05)}<span class="ed-val">${Math.round((doc.audio.volume ?? 0.8) * 100)}%</span></div>`)}
        ${field('Parti dal secondo', numInput('offset', doc.audio.offset || 0, { min: 0, step: 0.5, suffix: 's' }))}
        <p class="note-muted">Usa solo musica di cui il cliente ha i diritti: Instagram e TikTok possono silenziare i brani protetti.</p>
        <div class="ed-actions"><button type="button" class="button button-ghost button-small button-danger" data-act="audio-remove">Togli la musica</button></div>`;
      return;
    }
    scope = 'doc';
    props.dataset.scope = 'doc';
    const bg = doc.background || {};
    props.innerHTML = `
      <div class="ed-props-head"><strong>Pagina</strong></div>
      <p class="note-muted">${esc(fmt.label)}, ${fmt.w}×${fmt.h} pixel. Seleziona un elemento sulla tela o nel pannello Livelli per modificarlo.</p>
      ${colorField('Sfondo', 'background.color', bg.color)}
      <div class="ed-checks">${check('background.gradient', Boolean(bg.color2), 'Sfumatura')}</div>
      ${bg.color2 ? `${colorField('Secondo colore', 'background.color2', bg.color2)}${field('Direzione', `<div class="ed-range">${range('background.angle', bg.angle ?? 180, 0, 360, 15)}<span class="ed-val">${bg.angle ?? 180}°</span></div>`)}` : ''}
      ${isReel ? `<h3 class="ed-h">Audio</h3>${field('Volume dei clip', `<div class="ed-range">${range('clipVolume', doc.clipVolume ?? 1, 0, 1, 0.05)}<span class="ed-val">${Math.round((doc.clipVolume ?? 1) * 100)}%</span></div>`)}
        <p class="note-muted">${doc.clips.length ? `Durata totale: ${esc(fmtTime(timeline(doc).duration))}.` : 'Aggiungi video o foto dal pannello Montaggio.'} Instagram accetta reel fino a 3 minuti, TikTok fino a 10.</p>` : ''}
      <h3 class="ed-h">Scorciatoie</h3>
      <ul class="ed-keys"><li><kbd>Frecce</kbd> spostano di 1 px, con <kbd>Maiusc</kbd> di 10</li><li><kbd>Canc</kbd> elimina, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplica</li><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> annulla, <kbd>Ctrl</kbd>+<kbd>Y</kbd> ripete</li><li><kbd>Alt</kbd> mentre trascini disattiva l'aggancio</li>${isReel ? '<li><kbd>Spazio</kbd> avvia o ferma</li>' : ''}</ul>`;
  }

  function scopeTarget() {
    if (props.dataset.scope === 'layer') return layer();
    if (props.dataset.scope === 'clip') return clip();
    if (props.dataset.scope === 'audio') return doc.audio;
    return doc;
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    while (keys.length > 1) { const k = keys.shift(); o[k] ??= {}; o = o[k]; }
    o[keys[0]] = value;
  }
  function readInput(el) {
    if (el.dataset.type === 'bool') return el.checked;
    if (el.dataset.type === 'number') return num(el.value);
    if (el.dataset.type === 'number-null') return el.value === '' ? null : num(el.value);
    if (el.dataset.prop === 'weight') return num(el.value, 400);
    return el.value;
  }
  function applyProp(prop, value) {
    const t = scopeTarget();
    if (!t) return;
    if (prop === 'background.gradient') { doc.background.color2 = value ? '@secondary' : null; return 'panel'; }
    if (prop === 'font') {
      t.font = value;
      const fam = resolveFont(value, brand());
      if (!fontInfo(fam).weights.includes(t.weight)) t.weight = fontInfo(fam).weights.reduce((a, b) => (Math.abs(b - t.weight) < Math.abs(a - t.weight) ? b : a));
      return 'panel';
    }
    if (props.dataset.scope === 'clip' && (prop === 'in' || prop === 'out')) {
      const c = t;
      value = Math.min(Math.max(0, value), c.srcDuration || value);
      if (prop === 'in' && value >= (c.out ?? c.srcDuration) - 0.1) value = (c.out ?? c.srcDuration) - 0.1;
      if (prop === 'out' && value <= (c.in || 0) + 0.1) value = (c.in || 0) + 0.1;
    }
    setPath(t, prop, value);
    if (t.type === 'text') t.h = layoutText(ctx, t, brand()).h;
    return ['bg', 'shape', 'fadeIn'].includes(prop) ? 'panel' : null;
  }

  props.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-color-custom]')) {
      applyProp(el.closest('[data-color-prop]').dataset.colorProp, el.value);
      el.closest('[data-color-prop]').querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      afterChange(false);
      return;
    }
    if (!el.dataset.prop) return;
    const panel = applyProp(el.dataset.prop, readInput(el));
    // Checkbox e menu si salvano subito nella cronologia: il pannello ridisegnato perderebbe l'evento change.
    if (el.type === 'checkbox' || el.tagName === 'SELECT') { commit(); afterChange(true); return; }
    // Il valore accanto agli slider si aggiorna senza ridisegnare il pannello.
    const val = el.parentElement.querySelector('.ed-val');
    if (val) val.textContent = el.dataset.prop.endsWith('angle') ? `${el.value}°` : `${Math.round(el.value * 100)}%`;
    if (el.type === 'range') { const twin = el.parentElement.querySelector(`input[type="number"][data-prop="${el.dataset.prop}"]`); if (twin) twin.value = el.value; }
    if (el.type === 'number') { const twin = el.closest('.ed-range')?.querySelector('input[type="range"]'); if (twin) twin.value = el.value; }
    if (el.dataset.prop === 'name') renderTool();
    afterChange(panel === 'panel' && el.type !== 'text' && el.tagName !== 'TEXTAREA');
  });
  props.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') return;
    if (e.target.matches('[data-color-custom], [data-prop]')) { commit(); if (isReel) renderTimeline(); }
  });
  props.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) {
      applyProp(sw.closest('[data-color-prop]').dataset.colorProp, sw.dataset.color || null);
      commit();
      afterChange(true);
      return;
    }
    const set = e.target.closest('[data-set]');
    if (set) { applyProp(set.dataset.set, set.dataset.value); commit(); afterChange(true); return; }
    const al = e.target.closest('[data-align]');
    if (al && layer()) {
      const l = layer();
      ({ left: () => { l.x = 0; }, hcenter: () => { l.x = (doc.w - l.w) / 2; }, right: () => { l.x = doc.w - l.w; }, top: () => { l.y = 0; }, vcenter: () => { l.y = (doc.h - l.h) / 2; }, bottom: () => { l.y = doc.h - l.h; } })[al.dataset.align]();
      commit();
      afterChange(true);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const l = layer();
    const actions = {
      deselect: () => { selected = null; selectedClip = null; scope = 'doc'; refresh(); },
      duplicate,
      forward: () => move(1),
      backward: () => move(-1),
      lock: () => { l.locked = !l.locked; commit(); refresh(); },
      delete: () => removeLayer(l.id),
      'replace-image': () => { setTool('file'); toast('Scegli un\'immagine dal pannello File: sostituirà quella selezionata.'); },
      'use-logo': () => { if (!brand().logoAssetId) { toast('Il cliente non ha ancora un logo: caricalo in Studio grafico, scheda Stile del cliente.'); return; } l.assetId = '@logo'; l.fit = 'contain'; commit(); afterChange(true); },
      'fill-page': () => { Object.assign(l, { x: 0, y: 0, w: doc.w, h: doc.h, rotation: 0 }); commit(); afterChange(true); },
      'start-here': () => { l.start = round(engine.t, 10); if (l.end != null && l.end <= l.start) l.end = null; commit(); afterChange(true); },
      'end-here': () => { if (engine.t <= (l.start || 0)) { toast('Sposta il cursore dopo il momento in cui il testo compare.'); return; } l.end = round(engine.t, 10); commit(); afterChange(true); },
      'clip-left': () => moveClip(-1),
      'clip-right': () => moveClip(1),
      'clip-split': splitClip,
      'clip-delete': () => { doc.clips = doc.clips.filter((c) => c.id !== selectedClip); selectedClip = null; scope = 'doc'; commit(); refresh(); engine.seek(Math.min(engine.t, timeline(doc).duration)); },
      'audio-remove': () => { doc.audio = null; scope = 'doc'; commit(); refresh(); },
    };
    actions[act]?.();
  });

  function afterChange(panel) {
    if (isReel && props.dataset.scope === 'clip') engine.seek(engine.t);
    draw();
    if (panel) renderProps();
    if (isReel) renderTimeline();
    scheduleSave();
  }

  // Pannello strumenti

  function setTool(t) {
    tool = t;
    main.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tool === t)));
    toolPanel.setAttribute('aria-labelledby', `tab-${t}`);
    renderTool();
  }
  main.querySelector('.ed-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
  main.querySelector('.ed-tabs').addEventListener('keydown', (e) => {
    const tabs = [...main.querySelectorAll('[data-tool]')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const j = { ArrowDown: i + 1, ArrowUp: i - 1, ArrowRight: i + 1, ArrowLeft: i - 1 }[e.key];
    if (j == null) return;
    e.preventDefault();
    const next = tabs[(j + tabs.length) % tabs.length];
    next.focus();
    setTool(next.dataset.tool);
  });

  const templateThumbs = new Map();
  function templateThumb(tpl) {
    const key = `${tpl.id}:${JSON.stringify(brand())}`;
    if (templateThumbs.has(key)) return templateThumbs.get(key);
    const tdoc = { w: doc.w, h: doc.h, background: { color: tpl.background?.color || '@background' }, layers: tpl.build({ w: doc.w, h: doc.h }) };
    const c = renderToCanvas(tdoc, brand(), { width: 150 });
    const url = c.toDataURL('image/png');
    templateThumbs.set(key, url);
    return url;
  }

  const assetUrl = (a) => `/media/${a.id}`;
  function renderTool() {
    const b = brand();
    if (tool === 'modelli') {
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Modelli</h2><p class="note-muted">Usano colori, caratteri e logo di ${esc(client.name)}.</p>
        <div class="ed-templates">${POST_TEMPLATES.map((t) => `<button type="button" class="ed-template" data-template="${t.id}"><img src="${templateThumb(t)}" alt="" style="aspect-ratio:${doc.w}/${doc.h}"><span>${esc(t.name)}</span></button>`).join('')}</div>`;
    } else if (tool === 'testi') {
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Testi pronti</h2><p class="note-muted">Compaiono al punto del cursore nella timeline, con l'animazione già impostata.</p>
        <div class="ed-list">${REEL_TEXTS.map((t) => `<button type="button" class="ed-item" data-reel-text="${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
    } else if (tool === 'testo') {
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Testo</h2>
        <div class="ed-list">
          <button type="button" class="ed-item ed-text-sample" data-add-text="title" style="font-family:'${esc(b.fonts.heading)}';font-size:22px;font-weight:700">Aggiungi un titolo</button>
          <button type="button" class="ed-item ed-text-sample" data-add-text="subtitle" style="font-family:'${esc(b.fonts.body)}';font-size:16px;font-weight:700">Aggiungi un sottotitolo</button>
          <button type="button" class="ed-item ed-text-sample" data-add-text="body" style="font-family:'${esc(b.fonts.body)}'">Aggiungi un testo</button>
          <button type="button" class="ed-item ed-text-sample" data-add-text="label">Etichetta con sfondo</button>
        </div>`;
    } else if (tool === 'elementi') {
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Elementi</h2>
        <div class="ed-shapes">
          <button type="button" class="ed-shape" data-add-shape="rect" aria-label="Rettangolo"><i style="border-radius:0"></i>Rettangolo</button>
          <button type="button" class="ed-shape" data-add-shape="round" aria-label="Rettangolo arrotondato"><i style="border-radius:10px"></i>Arrotondato</button>
          <button type="button" class="ed-shape" data-add-shape="ellipse" aria-label="Cerchio"><i style="border-radius:50%"></i>Cerchio</button>
          <button type="button" class="ed-shape" data-add-shape="line" aria-label="Linea"><i style="height:4px"></i>Linea</button>
          <button type="button" class="ed-shape" data-add-shape="frame" aria-label="Riquadro immagine"><i class="frame"></i>Riquadro foto</button>
          <button type="button" class="ed-shape" data-add-shape="logo" aria-label="Logo del cliente"><i class="logo">${b.logoAssetId ? `<img src="/media/${esc(b.logoAssetId)}" alt="">` : 'logo'}</i>Logo</button>
        </div>`;
    } else if (tool === 'file' || tool === 'clip') {
      const kinds = isReel ? ['video', 'image', 'audio'] : ['image'];
      const list = assets.filter((a) => kinds.includes(a.kind));
      const replacing = layer()?.type === 'image';
      toolPanel.innerHTML = `<h2 class="ed-panel-title">${tool === 'clip' ? 'Montaggio' : 'File'}</h2>
        ${tool === 'clip' ? `<p class="note-muted">${doc.clips.length ? `${doc.clips.length} clip, ${esc(fmtTime(timeline(doc).duration))}.` : 'Aggiungi video o foto: si mettono in fila nella timeline.'}</p>` : ''}
        ${replacing && tool === 'file' ? '<p class="ed-hint">Hai selezionato un\'immagine: il file che scegli la sostituisce.</p>' : ''}
        <label class="button button-accent button-small ed-upload"><span class="button-icon plus-icon" aria-hidden="true"></span>Carica ${isReel ? 'video, foto o musica' : 'immagini'}<input type="file" id="ed-file" accept="${isReel ? 'video/mp4,video/webm,video/quicktime,image/*,audio/*' : 'image/*'}" multiple class="visually-hidden"></label>
        <div id="ed-upload-progress"></div>
        ${list.length ? `<div class="ed-assets">${list.map((a) => `
          <div class="ed-asset">
            <div class="thumb">${a.kind === 'image' ? `<img src="${assetUrl(a)}" alt="" loading="lazy">` : a.kind === 'video' ? `<video src="${assetUrl(a)}#t=0.5" muted preload="metadata"></video>` : '<span>Audio</span>'}</div>
            <span class="name" title="${esc(a.name)}">${esc(a.name)}</span>
            <div class="acts">${assetButtons(a, replacing)}</div>
          </div>`).join('')}</div>` : `<p class="note-muted">Nessun file ancora. Puoi anche trascinarli sulla tela.</p>`}`;
      toolPanel.querySelector('#ed-file').addEventListener('change', (e) => { uploadMany([...e.target.files]); e.target.value = ''; });
    } else if (tool === 'stile') {
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Stile di ${esc(client.name)}</h2>
        <div class="ed-brand-colors">${Object.entries(BRAND_COLORS).map(([k, l]) => `<span><i style="background:${esc(b.colors[k])}"></i>${l}</span>`).join('')}</div>
        <p class="note-muted">Titoli in ${esc(b.fonts.heading)}, testi in ${esc(b.fonts.body)}.</p>
        <button type="button" class="button button-outline button-small" data-restyle>Applica lo stile a tutto il progetto</button>
        <p class="note-muted">Trasforma colori e caratteri scelti a mano in quelli del cliente: il testo più grande diventa titolo, gli altri testo.</p>
        <a class="text-button" href="#/cliente/${encodeURIComponent(client.id)}/studio/stile">Modifica lo stile del cliente</a>`;
    } else if (tool === 'livelli') {
      const rows = [...doc.layers].reverse();
      toolPanel.innerHTML = `<h2 class="ed-panel-title">Livelli</h2><p class="note-muted">In alto quelli in primo piano.</p>
        ${rows.length ? `<ul class="ed-layers">${rows.map((l) => `
          <li class="${l.id === selected ? 'is-selected' : ''}">
            <button type="button" class="ed-layer-pick" data-pick="${esc(l.id)}" aria-pressed="${l.id === selected}"><span class="kind">${{ text: 'T', image: 'Img', shape: 'Forma' }[l.type]}</span><span class="nm">${esc(l.name)}</span></button>
            <button type="button" class="icon-button" data-toggle-hide="${esc(l.id)}" aria-pressed="${l.hidden}" aria-label="${l.hidden ? 'Mostra' : 'Nascondi'} ${esc(l.name)}">${l.hidden ? '◌' : '●'}</button>
          </li>`).join('')}</ul>` : '<p class="note-muted">Nessun elemento: aggiungine uno da Testo, Elementi o File.</p>'}`;
    }
  }

  function assetButtons(a, replacing) {
    const id = esc(a.id);
    if (!isReel) return `<button type="button" class="button button-outline button-small" data-asset-add="${id}">${replacing ? 'Sostituisci' : 'Aggiungi'}</button>`;
    if (a.kind === 'video') return `<button type="button" class="button button-outline button-small" data-asset-clip="${id}">Al montaggio</button>`;
    if (a.kind === 'audio') return `<button type="button" class="button button-outline button-small" data-asset-audio="${id}">${doc.audio?.assetId === a.id ? 'In uso' : 'Come musica'}</button>`;
    return `<button type="button" class="button button-outline button-small" data-asset-clip="${id}">Come clip</button><button type="button" class="button button-outline button-small" data-asset-add="${id}">${replacing ? 'Sostituisci' : 'Sopra'}</button>`;
  }

  async function imageSize(src) {
    const entry = getImage(src);
    for (let i = 0; i < 100 && !entry.ready && !entry.failed; i++) await new Promise((r) => setTimeout(r, 50));
    return entry.ready ? { w: entry.img.naturalWidth, h: entry.img.naturalHeight } : { w: 800, h: 800 };
  }

  toolPanel.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-template]');
    if (t) {
      const tpl = POST_TEMPLATES.find((x) => x.id === t.dataset.template);
      if (doc.layers.length && !(await confirmDialog({ title: `Usare il modello "${tpl.name}"?`, text: 'Gli elementi attuali della pagina verranno sostituiti. Potrai tornare indietro con Annulla (Ctrl+Z).', confirm: 'Usa il modello' }))) return;
      doc.layers = tpl.build({ w: doc.w, h: doc.h });
      doc.background = { color: tpl.background?.color || '@background', color2: null, angle: 180 };
      selected = null;
      scope = 'doc';
      commit();
      refresh();
      return;
    }
    const rt = e.target.closest('[data-reel-text]');
    if (rt) {
      const tpl = REEL_TEXTS.find((x) => x.id === rt.dataset.reelText);
      const built = tpl.build({ w: doc.w, h: doc.h }, timeline(doc).duration);
      const offset = tpl.id === 'chiusura' ? 0 : round(engine.t, 10);
      for (const l of built) { l.start = (l.start || 0) + offset; if (l.end != null) l.end += offset; if (l.type === 'text') l.h = layoutText(ctx, l, brand()).h; doc.layers.push(l); }
      commit();
      select(built[built.length - 1].id);
      return;
    }
    const at = e.target.closest('[data-add-text]')?.dataset.addText;
    if (at) {
      const w = doc.w;
      const presets = {
        title: { name: 'Titolo', text: 'Il tuo titolo', font: '@heading', weight: 700, size: Math.round(w * 0.08), color: '@primary', w: w * 0.8, lineHeight: 1.1 },
        subtitle: { name: 'Sottotitolo', text: 'Un sottotitolo', weight: 700, size: Math.round(w * 0.045), color: '@text', w: w * 0.7 },
        body: { name: 'Testo', text: 'Scrivi qui il testo', size: Math.round(w * 0.035), color: '@text', w: w * 0.7, lineHeight: 1.4 },
        label: { name: 'Etichetta', text: 'Novità', weight: 700, size: Math.round(w * 0.035), color: '@primary', bg: '@accent', pad: Math.round(w * 0.02), bgRadius: Math.round(w * 0.04), w: w * 0.3, align: 'center' },
      };
      addLayer(textLayer({ ...presets[at], ...(isReel ? { end: null } : {}) }));
      return;
    }
    const sh = e.target.closest('[data-add-shape]')?.dataset.addShape;
    if (sh) {
      const s = doc.w * 0.3;
      if (sh === 'frame') { const l = imageLayer({ name: 'Riquadro foto', w: s * 1.6, h: s * 1.6 }); l.x = (doc.w - l.w) / 2; l.y = (doc.h - l.h) / 2; addLayer(l, { center: false }); return; }
      if (sh === 'logo') {
        if (!brand().logoAssetId) { toast('Il cliente non ha ancora un logo: caricalo in Studio grafico, scheda Stile del cliente.'); return; }
        const size = await imageSize(assetSrc('@logo', brand()));
        const w = doc.w * 0.3;
        const l = imageLayer({ name: 'Logo', assetId: '@logo', fit: 'contain', w, h: (w * size.h) / size.w });
        l.x = (doc.w - l.w) / 2; l.y = doc.h * 0.8;
        addLayer(l, { center: false });
        return;
      }
      addLayer(shapeLayer({
        rect: { name: 'Rettangolo', w: s * 1.4, h: s },
        round: { name: 'Rettangolo arrotondato', w: s * 1.4, h: s, radius: s * 0.15 },
        ellipse: { name: 'Cerchio', shape: 'ellipse', w: s, h: s },
        line: { name: 'Linea', w: doc.w * 0.6, h: Math.max(4, doc.w * 0.006), fill: '@text' },
      }[sh]));
      return;
    }
    const add = e.target.closest('[data-asset-add]')?.dataset.assetAdd;
    if (add) {
      const cur = layer();
      if (cur?.type === 'image') { cur.assetId = add; commit(); afterChange(true); toast('Immagine sostituita.'); return; }
      const size = await imageSize(`/media/${add}`);
      const k = Math.min((doc.w * 0.7) / size.w, (doc.h * 0.7) / size.h);
      const l = imageLayer({ name: assets.find((a) => a.id === add)?.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Immagine', assetId: add, w: size.w * k, h: size.h * k });
      l.x = (doc.w - l.w) / 2; l.y = (doc.h - l.h) / 2;
      addLayer(l, { center: false });
      return;
    }
    const ac = e.target.closest('[data-asset-clip]')?.dataset.assetClip;
    if (ac) { addClip(assets.find((a) => a.id === ac)); return; }
    const au = e.target.closest('[data-asset-audio]')?.dataset.assetAudio;
    if (au) {
      const a = assets.find((x) => x.id === au);
      doc.audio = { assetId: a.id, name: a.name, volume: 0.8, offset: 0 };
      scope = 'audio';
      selected = null;
      commit();
      refresh();
      return;
    }
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    if (pick) { select(pick); return; }
    const hide = e.target.closest('[data-toggle-hide]')?.dataset.toggleHide;
    if (hide) { const l = doc.layers.find((x) => x.id === hide); l.hidden = !l.hidden; commit(); refresh(); return; }
    if (e.target.closest('[data-restyle]')) restyle();
  });

  function restyle() {
    const texts = doc.layers.filter((l) => l.type === 'text');
    const biggest = Math.max(0, ...texts.map((l) => l.size));
    for (const l of texts) {
      const isTitle = l.size >= biggest * 0.75;
      l.font = isTitle ? '@heading' : '@body';
      if (!l.color?.startsWith('@')) l.color = isTitle ? '@primary' : '@text';
      if (l.bg && !l.bg.startsWith('@')) l.bg = '@accent';
      l.h = layoutText(ctx, l, brand()).h;
    }
    for (const l of doc.layers.filter((x) => x.type === 'shape')) if (l.fill && !l.fill.startsWith('@')) l.fill = '@accent';
    if (!doc.background.color?.startsWith('@')) doc.background.color = '@background';
    if (doc.background.color2 && !doc.background.color2.startsWith('@')) doc.background.color2 = '@secondary';
    commit();
    refresh();
    toast(`Stile di ${client.name} applicato. Ctrl+Z per tornare indietro.`);
  }

  // Caricamento file (pulsante o trascinamento sulla tela)

  async function probe(file) {
    const url = URL.createObjectURL(file);
    try {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {});
        return { width: img.naturalWidth, height: img.naturalHeight };
      }
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        return { duration: (await mediaDuration(url, file.type.startsWith('video/') ? 'video' : 'audio')) ?? undefined };
      }
      return {};
    } finally { URL.revokeObjectURL(url); }
  }

  async function uploadMany(files) {
    const allowed = files.filter((f) => isReel ? /^(image|video|audio)\//.test(f.type) : f.type.startsWith('image/'));
    if (!allowed.length) { toast(isReel ? 'Carica video, immagini o file audio.' : 'Nei post si possono usare solo immagini.'); return; }
    const box = toolPanel.querySelector('#ed-upload-progress');
    for (const file of allowed) {
      if (box) box.innerHTML = `<p class="note-muted">Carico ${esc(file.name)}…</p><div class="progress"><span></span></div>`;
      try {
        const meta = Object.fromEntries(Object.entries(await probe(file)).filter(([, v]) => v != null));
        const a = await uploadFile(client.id, file, { meta, onProgress: (p) => { const bar = toolPanel.querySelector('.progress > span'); if (bar) bar.style.width = `${Math.round(p * 100)}%`; } });
        assets.unshift(a);
        toast(`${file.name} caricato.`);
      } catch (ex) { toast(ex.message); }
    }
    if (tool !== 'file' && tool !== 'clip') setTool(isReel ? 'clip' : 'file'); else renderTool();
  }

  const dropHint = $('#ed-drop-hint');
  wrap.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); dropHint.hidden = false; } });
  wrap.addEventListener('dragleave', (e) => { if (!wrap.contains(e.relatedTarget)) dropHint.hidden = true; });
  wrap.addEventListener('drop', (e) => { e.preventDefault(); dropHint.hidden = true; uploadMany([...e.dataTransfer.files]); });

  // Reel: clip, timeline e riproduzione

  async function addClip(a) {
    if (!a) return;
    if (a.kind === 'video') {
      let dur = a.duration;
      if (!dur) dur = await mediaDuration(`/media/${a.id}`);
      if (!dur) { toast('Non riesco a leggere la durata di questo video: è stato impostato a 5 secondi, correggi la fine nel pannello del clip.'); dur = 5; }
      doc.clips.push({ id: uid(), assetId: a.id, name: a.name, type: 'video', in: 0, out: dur, srcDuration: dur, motion: 'none', fit: 'cover', fadeIn: false, brightness: 100, contrast: 100, saturate: 100 });
    } else {
      doc.clips.push({ id: uid(), assetId: a.id, name: a.name, type: 'image', duration: 3, motion: 'zoom', fit: 'cover', fadeIn: false, brightness: 100, contrast: 100, saturate: 100 });
    }
    selectedClip = doc.clips[doc.clips.length - 1].id;
    selected = null;
    scope = 'clip';
    commit();
    refresh();
    engine.seek(timeline(doc).items.find((it) => it.clip.id === selectedClip).start);
  }
  function moveClip(d) {
    const i = doc.clips.findIndex((c) => c.id === selectedClip);
    const j = i + d;
    if (i < 0 || j < 0 || j >= doc.clips.length) return;
    [doc.clips[i], doc.clips[j]] = [doc.clips[j], doc.clips[i]];
    commit();
    refresh();
    engine.seek(engine.t);
  }
  function splitClip() {
    const tl = timeline(doc);
    const it = tl.items.find((x) => x.clip.id === selectedClip);
    if (!it || engine.t <= it.start + 0.2 || engine.t >= it.end - 0.2) { toast('Porta il cursore dentro il clip selezionato, ad almeno 0,2 secondi dai bordi.'); return; }
    const c = it.clip;
    const cut = engine.t - it.start;
    const second = { ...structuredClone(c), id: uid(), fadeIn: false };
    if (c.type === 'video') { second.in = round((c.in || 0) + cut, 100); c.out = second.in; } else { second.duration = round(c.duration - cut, 10); c.duration = round(cut, 10); }
    doc.clips.splice(doc.clips.indexOf(c) + 1, 0, second);
    selectedClip = second.id;
    commit();
    refresh();
  }

  const tlEl = $('#ed-timeline');
  function togglePlay() {
    if (engine.playing) engine.pause(); else engine.play();
    syncPlayButton();
  }
  function syncPlayButton() {
    const b = tlEl?.querySelector('[data-play]');
    if (!b) return;
    b.textContent = engine.playing ? 'Pausa' : 'Riproduci';
    b.setAttribute('aria-pressed', String(engine.playing));
  }
  function syncTimelineTime() {
    if (!tlEl) return;
    const { duration } = timeline(doc);
    const t = engine.t;
    const time = tlEl.querySelector('[data-time]');
    if (time) time.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    const scrub = tlEl.querySelector('[data-scrub]');
    if (scrub && document.activeElement !== scrub) scrub.value = t;
    const head = tlEl.querySelector('.tl-head');
    if (head) head.style.left = `${(t / duration) * 100}%`;
  }
  function renderTimeline() {
    if (!tlEl) return;
    const { items, duration } = timeline(doc);
    const pct = (v) => `${(v / duration) * 100}%`;
    const texts = doc.layers.filter((l) => !l.hidden);
    tlEl.innerHTML = `
      <div class="tl-controls">
        <button type="button" class="button button-dark button-small" data-play aria-pressed="false">Riproduci</button>
        <span class="tl-time" data-time></span>
        <label class="tl-scrub"><span class="visually-hidden">Posizione nel reel</span><input type="range" data-scrub min="0" max="${duration}" step="0.05" value="${engine.t}"></label>
      </div>
      <div class="tl-tracks" data-tracks>
        <div class="tl-track" aria-label="Clip video e foto"><span class="tl-label">Clip</span>
          ${items.length ? items.map((it, i) => `<button type="button" class="tl-block tl-clip ${it.clip.id === selectedClip ? 'is-selected' : ''}" style="left:${pct(it.start)};width:${pct(it.end - it.start)}" data-clip="${esc(it.clip.id)}" aria-label="Clip ${i + 1}, ${esc(it.clip.name || '')}, ${esc(fmtTime(it.end - it.start))}">${i + 1}. ${esc(it.clip.name || '')}</button>`).join('') : '<span class="tl-empty">Aggiungi video o foto dal pannello Montaggio</span>'}
        </div>
        <div class="tl-track tl-track-layers" aria-label="Testi ed elementi"><span class="tl-label">Testi</span>
          ${texts.map((l, i) => { const s = Math.min(l.start || 0, duration); const e = Math.min(l.end ?? duration, duration); return `<button type="button" class="tl-block tl-layer ${l.id === selected ? 'is-selected' : ''}" style="left:${pct(s)};width:${pct(Math.max(0.1, e - s))};top:${4 + (i % 3) * 13}px" data-layer="${esc(l.id)}" aria-label="${esc(l.name)}, da ${esc(fmtTime(s))} a ${esc(fmtTime(e))}">${esc(l.name)}</button>`; }).join('')}
        </div>
        <div class="tl-track" aria-label="Musica"><span class="tl-label">Musica</span>
          ${doc.audio ? `<button type="button" class="tl-block tl-audio ${scope === 'audio' ? 'is-selected' : ''}" style="left:0;width:100%" data-audio>${esc(doc.audio.name || 'Musica')}</button>` : '<span class="tl-empty">Nessuna musica: caricala dal pannello Montaggio</span>'}
        </div>
        <span class="tl-head" aria-hidden="true"></span>
      </div>`;
    syncTimelineTime();
    syncPlayButton();
  }
  if (tlEl) {
    tlEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-play]')) { togglePlay(); return; }
      const c = e.target.closest('[data-clip]');
      if (c) {
        selectedClip = c.dataset.clip; selected = null; scope = 'clip';
        engine.pause();
        const it = timeline(doc).items.find((x) => x.clip.id === selectedClip);
        refresh();
        if (it && (engine.t < it.start || engine.t >= it.end)) engine.seek(it.start);
        return;
      }
      const l = e.target.closest('[data-layer]');
      if (l) { const lay = doc.layers.find((x) => x.id === l.dataset.layer); engine.pause(); select(lay.id); if (!isVisibleAt(lay, engine.t)) engine.seek(lay.start || 0); return; }
      if (e.target.closest('[data-audio]')) { scope = 'audio'; selected = null; selectedClip = null; refresh(); return; }
      const tracks = e.target.closest('[data-tracks]');
      if (tracks && !e.target.closest('button')) {
        const r = tracks.getBoundingClientRect();
        engine.pause();
        engine.seek(((e.clientX - r.left) / r.width) * timeline(doc).duration);
        syncPlayButton();
      }
    });
    tlEl.addEventListener('input', (e) => { if (e.target.matches('[data-scrub]')) { engine.pause(); syncPlayButton(); engine.seek(num(e.target.value)); } });
    cleanups.push(() => engine.destroy());
  }

  function refresh() {
    renderProps();
    renderTool();
    if (isReel) renderTimeline();
    draw();
    syncUndo();
  }

  // Esportazione

  $('#ed-export').addEventListener('click', () => {
    const dlg = openDialog(`
      <div class="dlg-head"><div><p class="eyebrow">Esporta</p><h2 id="ex-title">Scarica ${esc(name)}</h2></div>${closeButton}</div>
      <div class="dlg-body">
        ${isReel ? `
          <p>Il video si registra a ${doc.w}×${doc.h} in tempo reale: ${esc(fmtTime(timeline(doc).duration))} di reel richiedono altrettanto tempo. Tieni questa scheda aperta e in primo piano.</p>
          <p class="note-muted">${recorderType()?.startsWith('video/mp4') ? 'Formato: MP4, accettato da Instagram e TikTok.' : 'Questo browser registra solo in WebM: per Instagram serve convertirlo in MP4, oppure usa Chrome aggiornato.'}</p>
          <div class="progress" hidden><span></span></div><p class="note-muted" data-progress-text hidden></p>
          <div class="ed-actions"><button type="button" class="button button-dark" data-x="video" ${doc.clips.length ? '' : 'disabled'}>Registra il video</button><button type="button" class="button button-outline" data-x="cover">Copertina PNG (fotogramma attuale)</button></div>
          ${doc.clips.length ? '' : '<p class="form-error">Aggiungi almeno un clip prima di esportare.</p>'}` : `
          <p class="note-muted">${doc.w}×${doc.h} pixel, la dimensione consigliata da Instagram per questo formato.</p>
          <div class="ed-actions"><button type="button" class="button button-dark" data-x="png">PNG</button><button type="button" class="button button-outline" data-x="jpg">JPG</button></div>`}
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot"><button type="button" class="button button-outline" data-close>Chiudi</button></div>`, { labelledBy: 'ex-title' });
    const err = dlg.querySelector('.form-error[role="alert"]');
    let abort = null;
    dlg.addEventListener('close', () => abort?.abort());
    dlg.addEventListener('click', async (e) => {
      const kind = e.target.closest('[data-x]')?.dataset.x;
      if (!kind) return;
      err.hidden = true;
      const base = `${slug(client.name)}-${slug(name)}`;
      try {
        if (kind === 'png' || kind === 'jpg' || kind === 'cover') {
          await document.fonts.ready;
          const missing = await waitForImages(doc, brand());
          const frame = isReel ? engine.frameAt(engine.t) : null;
          const c = renderToCanvas(doc, brand(), { time: now(), frame });
          const type = kind === 'jpg' ? 'image/jpeg' : 'image/png';
          const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
          download(blob, `${base}.${kind === 'jpg' ? 'jpg' : 'png'}`);
          const empty = doc.layers.some((l) => l.type === 'image' && !assetSrc(l.assetId, brand()) && !l.hidden);
          toast(missing || empty ? 'Scaricato, ma alcuni riquadri immagine sono vuoti o non caricati.' : 'Immagine scaricata.');
          return;
        }
        if (kind === 'video') {
          engine.pause();
          syncPlayButton();
          abort = new AbortController();
          const bar = dlg.querySelector('.progress');
          const txt = dlg.querySelector('[data-progress-text]');
          bar.hidden = false; txt.hidden = false;
          dlg.querySelectorAll('[data-x]').forEach((b) => { b.disabled = true; });
          txt.textContent = 'Preparo i clip…';
          const out = await exportReel(structuredClone(doc), brand(), {
            signal: abort.signal,
            onProgress: (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; txt.textContent = `Registrazione ${Math.round(p * 100)}%. Puoi interrompere chiudendo la finestra.`; },
          });
          abort = null;
          if (!out) return;
          download(out.blob, `${base}.${out.ext}`);
          txt.textContent = `Video pronto: ${(out.blob.size / 1048576).toFixed(1).replace('.', ',')} MB.`;
          dlg.querySelectorAll('[data-x]').forEach((b) => { b.disabled = false; });
          toast('Video scaricato.');
        }
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        dlg.querySelectorAll('[data-x]').forEach((b) => { b.disabled = false; });
      }
    });
  });

  $('#ed-schedule').addEventListener('click', async () => {
    pendingSave = true;
    await save();
    let existing = null;
    try { existing = (await api(`/api/contents?clientId=${encodeURIComponent(client.id)}`)).find((c) => c.designId === design.id) || null; } catch { /* si crea un contenuto nuovo */ }
    openContentDialog(existing || { clientId: client.id, designId: design.id, format: fmt.content, title: name, channels: isReel ? ['instagram', 'tiktok'] : ['instagram'] }, () => window.dispatchEvent(new Event('counts')));
  });

  refresh();
  setTool(tool);
  fit();
  if (isReel) engine.seek(0);
  canvas.focus({ preventScroll: true });

  return () => {
    if (pendingSave) save();
    cleanups.forEach((fn) => fn());
  };
}
