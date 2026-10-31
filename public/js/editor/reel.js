// Riproduzione ed esportazione dei reel: clip in sequenza, musica, testi a tempo.
// L'esportazione registra la tela in tempo reale (MediaRecorder): un reel di 20 secondi richiede 20 secondi.
import { renderDoc } from './render.js';

export const clipDuration = (c) => Math.max(0.1, c.type === 'image' ? c.duration || 3 : (c.out ?? c.srcDuration ?? 3) - (c.in || 0));

export function timeline(doc) {
  let t = 0;
  const items = (doc.clips || []).map((clip) => {
    const d = clipDuration(clip);
    const it = { clip, start: t, end: t + d };
    t += d;
    return it;
  });
  return { items, duration: t || 5 };
}

// Durata di un video o audio. I file registrati dal browser (WebM) spesso non la dichiarano:
// in quel caso la si scopre saltando alla fine del file.
export async function mediaDuration(src, kind = 'video') {
  const el = document.createElement(kind);
  el.preload = 'metadata';
  el.muted = true;
  el.src = src;
  await new Promise((r) => { el.onloadedmetadata = r; el.onerror = r; setTimeout(r, 8000); });
  if (!Number.isFinite(el.duration)) {
    await new Promise((r) => {
      el.ondurationchange = () => { if (Number.isFinite(el.duration)) r(); };
      el.currentTime = 1e7;
      setTimeout(r, 5000);
    });
  }
  const d = el.duration;
  el.removeAttribute('src');
  el.load();
  return Number.isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : null;
}

export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0').replace('.', ',')}`;
};

// Un elemento <video>/<img> per clip, riusato tra anteprima e scorrimento.
function makeElement(clip) {
  const src = `/media/${clip.assetId}`;
  if (clip.type === 'image') {
    const img = new Image();
    img.src = src;
    return img;
  }
  const v = document.createElement('video');
  v.src = src;
  v.preload = 'auto';
  v.playsInline = true;
  v.crossOrigin = 'anonymous';
  return v;
}

const seekTo = (v, time) => new Promise((resolve) => {
  if (Math.abs(v.currentTime - time) < 0.01 && v.readyState >= 2) return resolve();
  const done = () => { v.removeEventListener('seeked', done); resolve(); };
  v.addEventListener('seeked', done);
  v.currentTime = time;
  setTimeout(done, 1500);
});

export class ReelEngine {
  constructor({ getDoc, getBrand, canvas, scale, onTime, onEnd, editing = true }) {
    Object.assign(this, { getDoc, getBrand, canvas, scale, onTime, onEnd, editing });
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.playing = false;
    this.els = new Map();
    this.audioEl = null;
    this.overlay = null;
  }

  el(clip) {
    let e = this.els.get(clip.id);
    if (!e || e.dataset?.asset !== clip.assetId) {
      e = makeElement(clip);
      e.dataset.asset = clip.assetId;
      if (e.tagName === 'VIDEO') e.addEventListener('loadeddata', () => { if (!this.playing) this.draw(); });
      else e.addEventListener('load', () => { if (!this.playing) this.draw(); });
      this.els.set(clip.id, e);
    }
    return e;
  }

  active(t = this.t) {
    const { items } = timeline(this.getDoc());
    return items.find((it) => t >= it.start && t < it.end) || items[items.length - 1] || null;
  }

  frameAt(t) {
    const it = this.active(t);
    if (!it) return null;
    const el = this.el(it.clip);
    const local = Math.max(0, t - it.start);
    return { el, clip: it.clip, local, progress: Math.min(1, local / (it.end - it.start)) };
  }

  draw() {
    const doc = this.getDoc();
    const frame = this.frameAt(this.t);
    const ready = frame && (frame.el.tagName === 'VIDEO' ? frame.el.readyState >= 2 : frame.el.complete && frame.el.naturalWidth);
    renderDoc(this.ctx, doc, { brand: this.getBrand(), scale: this.scale, time: this.t, frame: ready ? frame : null, editing: this.editing });
    this.overlay?.(this.ctx);
  }

  async seek(t) {
    const { duration } = timeline(this.getDoc());
    this.t = Math.min(Math.max(0, t), duration);
    const it = this.active();
    if (it && it.clip.type !== 'image') {
      const v = this.el(it.clip);
      if (!this.playing) await seekTo(v, (it.clip.in || 0) + (this.t - it.start));
    }
    this.syncAudio(false);
    this.draw();
    this.onTime?.(this.t);
  }

  audio() {
    const a = this.getDoc().audio;
    if (!a) { this.audioEl?.pause(); this.audioEl = null; return null; }
    if (!this.audioEl || this.audioEl.dataset.asset !== a.assetId) {
      this.audioEl?.pause();
      this.audioEl = new Audio(`/media/${a.assetId}`);
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.dataset.asset = a.assetId;
    }
    this.audioEl.volume = Math.min(1, Math.max(0, a.volume ?? 0.8));
    return this.audioEl;
  }

  syncAudio(play) {
    const el = this.audio();
    if (!el) return;
    const a = this.getDoc().audio;
    const pos = (a.offset || 0) + this.t;
    if (!play) { el.pause(); if (Number.isFinite(pos)) el.currentTime = pos; return; }
    if (Math.abs(el.currentTime - pos) > 0.25) el.currentTime = pos;
    if (el.paused && !(el.duration && pos >= el.duration)) el.play().catch(() => {});
  }

  async play() {
    const doc = this.getDoc();
    const { duration } = timeline(doc);
    if (this.playing) return;
    if (this.t >= duration - 0.05) await this.seek(0);
    this.playing = true;
    let last = performance.now();
    // Il clip in riproduzione si riconosce dall'id: la timeline si ricalcola a ogni fotogramma.
    let currentId = null;
    let currentV = null;
    let lastVT = -1;
    let stallSince = performance.now();
    const step = (now) => {
      if (!this.playing) return;
      const dt = (now - last) / 1000;
      last = now;
      const it = this.active();
      if (!it) { this.t += dt; } else if (it.clip.type === 'image') {
        if (currentId !== it.clip.id) { currentV?.pause(); currentV = null; currentId = it.clip.id; }
        this.t += dt;
      } else {
        const v = this.el(it.clip);
        if (currentId !== it.clip.id) {
          currentV?.pause();
          currentId = it.clip.id;
          currentV = v;
          stallSince = now;
          v.currentTime = (it.clip.in || 0) + (this.t - it.start);
          v.muted = (this.getDoc().clipVolume ?? 1) === 0;
          v.volume = Math.min(1, this.getDoc().clipVolume ?? 1);
          v.play().catch(() => {});
        }
        if (!v.paused && v.readyState >= 2) this.t = it.start + (v.currentTime - (it.clip.in || 0));
        else this.t += v.readyState >= 2 ? dt : 0;
        // Un video che non avanza per 3 secondi (file danneggiato o troncato) non blocca il reel.
        if (v.currentTime !== lastVT) { lastVT = v.currentTime; stallSince = now; } else if (now - stallSince > 3000) this.t = it.end;
        if (v.ended || v.currentTime >= (it.clip.out ?? v.duration) - 0.02) this.t = it.end;
      }
      // Il clip successivo si prepara in anticipo per non avere scatti al cambio.
      const next = timeline(this.getDoc()).items.find((x) => x.start >= (it?.end ?? 0) - 0.001 && x !== it);
      if (next && it && it.end - this.t < 1 && next.clip.type !== 'image') {
        const nv = this.el(next.clip);
        if (nv.paused && Math.abs(nv.currentTime - (next.clip.in || 0)) > 0.05 && !nv.seeking) nv.currentTime = next.clip.in || 0;
      }
      this.syncAudio(true);
      if (this.t >= timeline(this.getDoc()).duration) {
        this.t = timeline(this.getDoc()).duration;
        this.pause();
        this.draw();
        this.onTime?.(this.t);
        this.onEnd?.();
        return;
      }
      this.draw();
      this.onTime?.(this.t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  pause() {
    this.playing = false;
    for (const e of this.els.values()) if (e.tagName === 'VIDEO') e.pause();
    this.audioEl?.pause();
  }

  destroy() {
    this.pause();
    for (const e of this.els.values()) if (e.tagName === 'VIDEO') { e.removeAttribute('src'); e.load(); }
    this.els.clear();
    this.audioEl = null;
  }
}

export function recorderType() {
  const options = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return options.find((t) => window.MediaRecorder?.isTypeSupported(t)) || null;
}

// Registra il reel a piena risoluzione. Restituisce { blob, ext }.
export async function exportReel(doc, brand, { onProgress, signal } = {}) {
  const type = recorderType();
  if (!type) throw new Error('Questo browser non sa registrare video. Usa Chrome o Edge aggiornati.');
  const canvas = document.createElement('canvas');
  canvas.width = doc.w;
  canvas.height = doc.h;
  const engine = new ReelEngine({ getDoc: () => doc, getBrand: () => brand, canvas, scale: 1, editing: false });

  // L'audio dei clip e la musica passano da un mixer WebAudio verso la registrazione.
  const ac = new AudioContext();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  // Senza nessuna sorgente sonora Chrome non produce campioni audio e il file MP4 si interrompe:
  // un segnale di silenzio tiene viva la traccia anche nei reel di sole foto.
  const silence = ac.createConstantSource();
  silence.offset.value = 0;
  silence.connect(dest);
  silence.start();
  const routed = new WeakSet();
  const route = (el, volume) => {
    if (routed.has(el)) return;
    routed.add(el);
    const g = ac.createGain();
    g.gain.value = volume;
    ac.createMediaElementSource(el).connect(g).connect(dest);
  };
  for (const clip of doc.clips) {
    const el = engine.el(clip);
    if (el.tagName === 'VIDEO') {
      route(el, doc.clipVolume ?? 1);
      await new Promise((r) => { if (el.readyState >= 2) r(); else { el.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 8000); } });
    } else await new Promise((r) => { if (el.complete) r(); else { el.addEventListener('load', r, { once: true }); el.addEventListener('error', r, { once: true }); } });
  }
  const music = engine.audio();
  if (music) {
    route(music, 1);
    await new Promise((r) => { if (music.readyState >= 2) r(); else { music.addEventListener('canplay', r, { once: true }); setTimeout(r, 5000); } });
  }
  await document.fonts.ready;
  await engine.seek(0);

  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });
  const { duration } = timeline(doc);
  engine.onTime = (t) => onProgress?.(Math.min(1, t / duration));
  const finished = new Promise((r) => { engine.onEnd = r; });
  signal?.addEventListener('abort', () => { engine.pause(); engine.onEnd?.(); });

  rec.start(250);
  await engine.play();
  await finished;
  // Mezzo secondo in più evita che l'ultimo fotogramma venga tagliato.
  await new Promise((r) => setTimeout(r, 300));
  rec.stop();
  await stopped;
  engine.destroy();
  ac.close();
  if (signal?.aborted) return null;
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
}
