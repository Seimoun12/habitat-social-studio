// Disegno di un progetto su una tela 2D. Lo stesso codice serve l'anteprima nell'editor,
// l'esportazione PNG/JPG e i fotogrammi del video: ciò che si vede è ciò che si esporta.
import { resolveColor, resolveFont, ensureFont, nearestWeight } from './model.js';

// Immagini caricate una volta sola; quando arrivano si ridisegna.
const images = new Map();
const imageListeners = new Set();
export const onImageLoaded = (fn) => { imageListeners.add(fn); return () => imageListeners.delete(fn); };
export function getImage(src) {
  if (!src) return null;
  let entry = images.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, failed: false };
    images.set(src, entry);
    img.onload = () => { entry.ready = true; imageListeners.forEach((fn) => fn()); };
    img.onerror = () => { entry.failed = true; imageListeners.forEach((fn) => fn()); };
    img.src = src;
  }
  return entry;
}
export const assetSrc = (assetId, brand) => {
  if (assetId === '@logo') return brand.logoAssetId ? `/media/${brand.logoAssetId}` : null;
  return assetId ? `/media/${assetId}` : null;
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (p) => 1 - (1 - p) ** 3;

function fill(ctx, color, brand, w, h, color2, angle) {
  const c1 = resolveColor(color, brand);
  if (!color2) return c1;
  const a = ((angle ?? 180) - 90) * (Math.PI / 180);
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createLinearGradient(w / 2 - Math.cos(a) * r, h / 2 - Math.sin(a) * r, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
  g.addColorStop(0, c1);
  g.addColorStop(1, resolveColor(color2, brand));
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

export function fontString(layer, brand) {
  const family = resolveFont(layer.font, brand);
  const weight = nearestWeight(family, layer.weight || 400);
  ensureFont(family, weight, layer.italic);
  return `${layer.italic ? 'italic ' : ''}${weight} ${layer.size}px "${family}", "DM Sans", sans-serif`;
}

// A capo automatico entro la larghezza del riquadro, rispettando gli a capo scritti.
export function layoutText(ctx, layer, brand) {
  ctx.save();
  ctx.font = fontString(layer, brand);
  ctx.letterSpacing = `${layer.letterSpacing || 0}px`;
  const maxW = Math.max(10, layer.w - 2 * (layer.pad || 0));
  const raw = layer.uppercase ? String(layer.text).toUpperCase() : String(layer.text);
  const lines = [];
  for (const para of raw.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const test = line + word;
      if (line && ctx.measureText(test.trimEnd()).width > maxW && word.trim()) {
        lines.push(line.trimEnd());
        line = word.trimStart();
        // Una parola più larga del riquadro va spezzata a mano.
        while (ctx.measureText(line).width > maxW && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else line = test;
    }
    lines.push(line.trimEnd());
  }
  const lineH = layer.size * (layer.lineHeight || 1.2);
  ctx.restore();
  return { lines, lineH, h: lines.length * lineH + 2 * (layer.pad || 0) };
}

export function isVisibleAt(layer, t) {
  if (layer.hidden) return false;
  if (t == null) return true;
  return t >= (layer.start || 0) && (layer.end == null || t < layer.end);
}

function drawText(ctx, layer, brand, reveal) {
  const { lines, lineH, h } = layoutText(ctx, layer, brand);
  layer.h = h;
  const pad = layer.pad || 0;
  if (layer.bg) {
    ctx.fillStyle = resolveColor(layer.bg, brand);
    roundRect(ctx, -layer.w / 2, -h / 2, layer.w, h, layer.bgRadius);
    ctx.fill();
  }
  ctx.font = fontString(layer, brand);
  ctx.letterSpacing = `${layer.letterSpacing || 0}px`;
  ctx.fillStyle = resolveColor(layer.color, brand);
  ctx.textBaseline = 'middle';
  ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  if (layer.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = layer.size * 0.35; ctx.shadowOffsetY = layer.size * 0.06; }
  const x = layer.align === 'center' ? 0 : layer.align === 'right' ? layer.w / 2 - pad : -layer.w / 2 + pad;
  let budget = reveal == null ? Infinity : reveal;
  lines.forEach((line, i) => {
    if (budget <= 0) return;
    const shown = line.slice(0, budget);
    budget -= line.length + 1;
    ctx.fillText(shown, x, -h / 2 + pad + lineH * (i + 0.5));
  });
}

function drawImageFit(ctx, el, natW, natH, w, h, fit) {
  if (!natW || !natH) return;
  const s = fit === 'contain' ? Math.min(w / natW, h / natH) : Math.max(w / natW, h / natH);
  const dw = natW * s;
  const dh = natH * s;
  ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
}

function filterOf(o) {
  const parts = [];
  if (o.brightness != null && o.brightness !== 100) parts.push(`brightness(${o.brightness}%)`);
  if (o.contrast != null && o.contrast !== 100) parts.push(`contrast(${o.contrast}%)`);
  if (o.saturate != null && o.saturate !== 100) parts.push(`saturate(${o.saturate}%)`);
  return parts.join(' ') || 'none';
}

function drawImageLayer(ctx, layer, brand, editing) {
  const src = assetSrc(layer.assetId, brand);
  const entry = getImage(src);
  ctx.save();
  roundRect(ctx, -layer.w / 2, -layer.h / 2, layer.w, layer.h, layer.radius);
  ctx.clip();
  if (entry?.ready) {
    ctx.filter = filterOf(layer);
    if (layer.flipX) ctx.scale(-1, 1);
    drawImageFit(ctx, entry.img, entry.img.naturalWidth, entry.img.naturalHeight, layer.w, layer.h, layer.fit);
  } else if (editing) {
    // Riquadro vuoto: visibile solo nell'editor, nell'esportazione resta trasparente.
    ctx.fillStyle = 'rgba(120,140,128,0.18)';
    ctx.fillRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h);
    ctx.strokeStyle = 'rgba(80,100,90,0.55)';
    ctx.setLineDash([layer.w / 40 + 4, layer.w / 60 + 4]);
    ctx.lineWidth = Math.max(2, layer.w / 300);
    ctx.strokeRect(-layer.w / 2 + 2, -layer.h / 2 + 2, layer.w - 4, layer.h - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(40,60,50,0.75)';
    ctx.font = `600 ${Math.max(14, Math.min(layer.w, layer.h) * 0.07)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const msg = layer.assetId === '@logo' ? 'Logo del cliente non impostato' : entry?.failed ? 'Immagine non trovata' : src ? 'Carico…' : 'Scegli un\'immagine';
    ctx.fillText(msg, 0, 0, layer.w * 0.9);
  }
  ctx.restore();
}

function drawShape(ctx, layer, brand) {
  ctx.fillStyle = fill(ctx, layer.fill, brand, layer.w, layer.h);
  if (layer.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(layer.w / 2), Math.abs(layer.h / 2), 0, 0, Math.PI * 2);
  } else roundRect(ctx, -layer.w / 2, -layer.h / 2, layer.w, layer.h, layer.radius);
  if (layer.fill) ctx.fill();
  if (layer.stroke && layer.strokeWidth) {
    ctx.strokeStyle = resolveColor(layer.stroke, brand);
    ctx.lineWidth = layer.strokeWidth;
    ctx.stroke();
  }
}

// Fotogramma di un clip del reel, a tutto schermo con eventuale zoom lento.
function drawFrame(ctx, doc, frame) {
  const { el, clip, progress } = frame;
  const natW = el.videoWidth || el.naturalWidth;
  const natH = el.videoHeight || el.naturalHeight;
  if (!natW) return;
  ctx.save();
  ctx.translate(doc.w / 2, doc.h / 2);
  if (clip.motion === 'zoom') { const z = 1 + 0.08 * progress; ctx.scale(z, z); }
  if (clip.motion === 'zoom-out') { const z = 1.08 - 0.08 * progress; ctx.scale(z, z); }
  ctx.filter = filterOf(clip);
  drawImageFit(ctx, el, natW, natH, doc.w, doc.h, clip.fit || 'cover');
  ctx.restore();
}

export function renderDoc(ctx, doc, { brand, scale = 1, time = null, frame = null, editing = false, transparent = false } = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, doc.w, doc.h);
  if (!transparent) {
    const bg = doc.background || {};
    ctx.fillStyle = fill(ctx, bg.color || '#ffffff', brand, doc.w, doc.h, bg.color2, bg.angle);
    ctx.fillRect(0, 0, doc.w, doc.h);
  }
  if (frame) {
    drawFrame(ctx, doc, frame);
    // Dissolvenza dal nero all'inizio del clip, se richiesta.
    if (frame.clip.fadeIn && frame.local < 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${1 - frame.local / 0.4})`;
      ctx.fillRect(0, 0, doc.w, doc.h);
    }
  }

  for (const layer of doc.layers) {
    if (!isVisibleAt(layer, time)) continue;
    let alpha = layer.opacity ?? 1;
    let dy = 0;
    let zoom = 1;
    let reveal = null;
    if (time != null && layer.anim && layer.anim !== 'none') {
      const p = ease(clamp((time - (layer.start || 0)) / 0.45));
      if (layer.anim === 'fade') alpha *= p;
      if (layer.anim === 'slide') { alpha *= p; dy = (1 - p) * doc.h * 0.04; }
      if (layer.anim === 'pop') { alpha *= p; zoom = 0.85 + 0.15 * p; }
      if (layer.anim === 'typewriter' && layer.type === 'text') reveal = Math.floor(clamp((time - (layer.start || 0)) / Math.max(0.5, String(layer.text).length * 0.04)) * String(layer.text).length);
      if (layer.end != null && layer.anim !== 'typewriter') alpha *= clamp((layer.end - time) / 0.3);
    }
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (layer.type === 'text') layer.h = layoutText(ctx, layer, brand).h;
    ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2 + dy);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    if (zoom !== 1) ctx.scale(zoom, zoom);
    if (layer.type === 'text') drawText(ctx, layer, brand, reveal);
    else if (layer.type === 'image') drawImageLayer(ctx, layer, brand, editing);
    else drawShape(ctx, layer, brand);
    ctx.restore();
  }
  ctx.restore();
}

// Disegna un progetto statico su una nuova tela, per anteprime ed esportazione.
export function renderToCanvas(doc, brand, { width = doc.w, time = null, frame = null } = {}) {
  const scale = width / doc.w;
  const c = document.createElement('canvas');
  c.width = Math.round(doc.w * scale);
  c.height = Math.round(doc.h * scale);
  renderDoc(c.getContext('2d'), doc, { brand, scale, time, frame });
  return c;
}

// Le immagini devono essere pronte prima di esportare, altrimenti mancherebbero nel file.
export async function waitForImages(doc, brand, timeout = 8000) {
  const srcs = doc.layers.filter((l) => l.type === 'image').map((l) => assetSrc(l.assetId, brand)).filter(Boolean);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const entries = srcs.map(getImage);
    if (entries.every((e) => e.ready || e.failed)) return entries.filter((e) => e.failed).length;
    await new Promise((r) => setTimeout(r, 100));
  }
  return srcs.length;
}
