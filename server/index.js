import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as store from './store.js';
import * as oauth from './oauth.js';
import * as invitePage from './invite-page.js';
import { getAnalytics, PLATFORMS } from './analytics.js';
import { buildSummary } from './summary.js';
import { renderReport, REPORT_SECTIONS } from './report.js';
import { resolveRange, isIsoDate } from './dates.js';

const app = express();

// Locale = da questo computer, senza passare da un tunnel (che aggiunge le intestazioni forwarded).
// Tutto il resto vede solo la pagina del link di collegamento e il login: l'app non ha password.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const PUBLIC_PATH = /^\/(collega\/[\w-]+(\/meta)?|oauth\/(meta|tiktok)\/(start|callback)|fonts\/[\w/.-]+)$/;
app.use((req, res, next) => {
  const h = req.headers;
  req.isLocal = LOOPBACK.has(req.socket.remoteAddress) && LOCAL_HOST.test(h.host || '')
    && !h['x-forwarded-for'] && !h['cf-connecting-ip'] && !h.forwarded;
  if (req.isLocal || PUBLIC_PATH.test(req.path)) return next();
  res.status(404).type('text').send('Pagina non disponibile.');
});

app.use(express.json({ limit: '4mb' })); // i progetti grafici con molti livelli superano i 100kb
app.use(express.static(path.resolve('public')));
app.use('/fonts/dm-sans', express.static(path.resolve('node_modules/@fontsource/dm-sans/files'), { maxAge: '30d' }));
app.use('/fonts/playfair-display', express.static(path.resolve('node_modules/@fontsource/playfair-display/files'), { maxAge: '30d' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof RangeError) return res.status(400).json({ error: err.message });
  if (err.platform) return res.status(502).json({ error: `Errore dal servizio ${err.message}` });
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server. Controlla il terminale per i dettagli.' });
});

const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res, what) => res.status(404).json({ error: `${what} non trovato.` });
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-f]{6}$/i;

// Clienti

app.get('/api/clients', wrap(async (_req, res) => {
  res.json((await store.listClients()).map(store.publicClient));
}));

function validateClient(body) {
  if (!body || typeof body.name !== 'string' || !body.name.trim()) return 'Il nome del cliente è obbligatorio.';
  if (body.name.length > 80) return 'Il nome può avere al massimo 80 caratteri.';
  return null;
}

app.post('/api/clients', wrap(async (req, res) => {
  const err = validateClient(req.body);
  if (err) return bad(res, err);
  const c = await store.saveClient({ ...req.body, name: req.body.name.trim() });
  res.status(201).json(store.publicClient(c));
}));

app.put('/api/clients/:id', wrap(async (req, res) => {
  const err = validateClient(req.body);
  if (err) return bad(res, err);
  const c = await store.saveClient({ ...req.body, name: req.body.name.trim() }, req.params.id);
  if (!c) return notFound(res, 'Cliente');
  res.json(store.publicClient(c));
}));

app.get('/api/clients/:id/connections', wrap(async (req, res) => {
  const c = await store.getClient(req.params.id);
  if (!c) return notFound(res, 'Cliente');
  // Solo gli ID account: i token restano sul server.
  const out = {};
  for (const p of Object.keys(PLATFORMS)) out[p] = { accountId: c.connections?.[p]?.accountId || '', hasToken: Boolean(c.connections?.[p]?.accessToken) };
  res.json(out);
}));

app.put('/api/clients/:id/brand', wrap(async (req, res) => {
  const b = req.body || {};
  const colors = b.colors || {};
  for (const k of Object.keys(store.DEFAULT_BRAND.colors)) if (colors[k] != null && !HEX.test(colors[k])) return bad(res, 'I colori devono essere in formato esadecimale, es. #173a32.');
  for (const k of ['heading', 'body']) if (b.fonts?.[k] != null && (typeof b.fonts[k] !== 'string' || b.fonts[k].length > 60)) return bad(res, 'Carattere non valido.');
  if (b.logoAssetId && !(await store.getAsset(b.logoAssetId))) return bad(res, 'Il logo scelto non esiste più.');
  if ((b.notes || '').length > 2000) return bad(res, 'Le note di stile possono avere al massimo 2000 caratteri.');
  const c = await store.saveBrand(req.params.id, b);
  if (!c) return notFound(res, 'Cliente');
  res.json(store.publicClient(c));
}));

app.delete('/api/clients/:id', wrap(async (req, res) => {
  const ok = await store.deleteClient(req.params.id);
  res.status(ok ? 204 : 404).end();
}));

// Analisi

app.get('/api/clients/:id/analytics', wrap(async (req, res) => {
  const client = await store.getClient(req.params.id);
  if (!client) return notFound(res, 'Cliente');
  const range = resolveRange(req.query.preset ? { preset: req.query.preset } : { from: req.query.from, to: req.query.to });
  const platform = req.query.platform;
  if (!PLATFORMS[platform]) return bad(res, 'Scegli un canale: instagram, facebook o tiktok.');
  const a = await getAnalytics(client, platform, range);
  res.json({ ...a, summary: buildSummary(a) });
}));

app.get('/api/report-sections', (_req, res) => res.json(REPORT_SECTIONS));

app.post('/api/clients/:id/report', wrap(async (req, res) => {
  const client = await store.getClient(req.params.id);
  if (!client) return notFound(res, 'Cliente');
  const { platforms, sections, preset, from, to, notes } = req.body || {};
  if (!Array.isArray(platforms) || !platforms.length || platforms.some((p) => !PLATFORMS[p])) return bad(res, 'Scegli almeno un canale.');
  if (!Array.isArray(sections) || !sections.length || sections.some((s) => !REPORT_SECTIONS[s])) return bad(res, 'Scegli almeno una sezione da includere.');
  if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) return bad(res, 'Le note possono avere al massimo 2000 caratteri.');
  const range = resolveRange(preset ? { preset } : { from, to });
  const analyses = [];
  for (const p of platforms) analyses.push(await getAnalytics(client, p, range));

  const slug = client.name.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'cliente';
  const pdf = await renderReport({ client, analyses, sections, notes });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${slug}-${range.from}_${range.to}.pdf"`);
  res.send(pdf);
}));

// File caricati: il corpo della richiesta è il file stesso, scritto su disco man mano che arriva.

const KINDS = {
  image: { types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'], max: 25 * 1024 * 1024, label: '25 MB' },
  video: { types: ['video/mp4', 'video/webm', 'video/quicktime'], max: 800 * 1024 * 1024, label: '800 MB' },
  audio: { types: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac'], max: 60 * 1024 * 1024, label: '60 MB' },
};
const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'weba', 'audio/aac': 'aac',
};

app.get('/api/clients/:id/assets', wrap(async (req, res) => {
  if (!(await store.getClient(req.params.id))) return notFound(res, 'Cliente');
  res.json(await store.listAssets({ clientId: req.params.id }));
}));

app.post('/api/clients/:id/assets', wrap(async (req, res) => {
  if (!(await store.getClient(req.params.id))) return notFound(res, 'Cliente');
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const kind = Object.keys(KINDS).find((k) => KINDS[k].types.includes(type));
  if (!kind) return bad(res, 'Formato non supportato. Carica immagini (PNG, JPG, WebP, GIF, SVG), video (MP4, WebM, MOV) o audio (MP3, M4A, WAV, OGG).');
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > KINDS[kind].max) return res.status(413).json({ error: `Il file supera il limite di ${KINDS[kind].label}.` });
  const id = randomUUID();
  const file = `${id}.${EXT[type]}`;
  const dest = path.join(store.UPLOAD_DIR, file);
  let size = 0;
  let tooBig = false;
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > KINDS[kind].max && !tooBig) { tooBig = true; req.unpipe(out); out.destroy(); resolve(); }
    });
    req.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    req.on('error', reject);
  });
  if (tooBig) { await rm(dest, { force: true }); return res.status(413).json({ error: `Il file supera il limite di ${KINDS[kind].label}.` }); }
  if (!size) { await rm(dest, { force: true }); return bad(res, 'Il file è vuoto.'); }
  const name = String(req.query.name || 'file').slice(0, 120);
  const meta = {};
  for (const k of ['width', 'height', 'duration']) if (req.query[k] && Number.isFinite(Number(req.query[k]))) meta[k] = Number(req.query[k]);
  const asset = await store.addAsset({ id, clientId: req.params.id, name, type, kind, size, file, ...meta, createdAt: new Date().toISOString() });
  res.status(201).json(asset);
}));

app.delete('/api/assets/:id', wrap(async (req, res) => {
  res.status((await store.deleteAsset(req.params.id)) ? 204 : 404).end();
}));

// sendFile gestisce le richieste a intervalli (Range), necessarie per scorrere i video.
app.get('/media/:id', wrap(async (req, res) => {
  const a = await store.getAsset(req.params.id);
  if (!a) return res.status(404).end();
  res.sendFile(path.join(store.UPLOAD_DIR, a.file), { headers: { 'Content-Type': a.type, 'Cache-Control': 'private, max-age=86400' } });
}));

// Progetti grafici

const FORMATS = ['post-1x1', 'post-4x5', 'story-9x16', 'reel-9x16', 'landscape-16x9'];

function validateDesign(b, creating) {
  if (!b || typeof b.name !== 'string' || !b.name.trim()) return 'Dai un nome al progetto.';
  if (b.name.length > 100) return 'Il nome può avere al massimo 100 caratteri.';
  if (creating && !['post', 'reel'].includes(b.kind)) return 'Tipo di progetto non valido.';
  if ((creating || b.format) && !FORMATS.includes(b.format)) return 'Formato non valido.';
  if (!b.doc || typeof b.doc !== 'object' || !Array.isArray(b.doc.layers)) return 'Il contenuto del progetto non è valido.';
  return null;
}

app.get('/api/designs', wrap(async (req, res) => {
  res.json(await store.listDesigns({ clientId: req.query.clientId }));
}));

app.post('/api/designs', wrap(async (req, res) => {
  const err = validateDesign(req.body, true);
  if (err) return bad(res, err);
  if (!(await store.getClient(req.body.clientId))) return bad(res, 'Il cliente scelto non esiste.');
  res.status(201).json(await store.saveDesign({ ...req.body, name: req.body.name.trim() }));
}));

app.get('/api/designs/:id', wrap(async (req, res) => {
  const d = await store.getDesign(req.params.id);
  if (!d) return notFound(res, 'Progetto');
  res.json(d);
}));

app.put('/api/designs/:id', wrap(async (req, res) => {
  const err = validateDesign(req.body, false);
  if (err) return bad(res, err);
  const d = await store.saveDesign({ ...req.body, name: req.body.name.trim() }, req.params.id);
  if (!d) return notFound(res, 'Progetto');
  res.json({ id: d.id, updatedAt: d.updatedAt });
}));

app.post('/api/designs/:id/duplicate', wrap(async (req, res) => {
  const d = await store.getDesign(req.params.id);
  if (!d) return notFound(res, 'Progetto');
  const copy = await store.saveDesign({ clientId: d.clientId, kind: d.kind, format: d.format, name: `${d.name} (copia)`.slice(0, 100), doc: structuredClone(d.doc) });
  res.status(201).json(copy);
}));

app.put('/api/designs/:id/thumb', express.raw({ type: 'image/png', limit: '3mb' }), wrap(async (req, res) => {
  if (!(await store.getDesign(req.params.id))) return notFound(res, 'Progetto');
  if (!Buffer.isBuffer(req.body) || req.body.subarray(1, 4).toString() !== 'PNG') return bad(res, 'Anteprima non valida.');
  await writeFile(path.join(store.THUMB_DIR, `${req.params.id}.png`), req.body);
  await store.markThumb(req.params.id);
  res.status(204).end();
}));

app.get('/media/thumb/:id.png', (req, res) => {
  res.sendFile(path.join(store.THUMB_DIR, `${path.basename(req.params.id)}.png`), { headers: { 'Cache-Control': 'no-cache' } }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
});

app.delete('/api/designs/:id', wrap(async (req, res) => {
  res.status((await store.deleteDesign(req.params.id)) ? 204 : 404).end();
}));

// Contenuti programmati

const CONTENT_FORMATS = ['Post', 'Carosello', 'Storia', 'Reel', 'Video TikTok', 'Video'];

async function validateContent(b) {
  if (!b || typeof b.title !== 'string' || !b.title.trim()) return 'Scrivi un titolo interno.';
  if (b.title.length > 120) return 'Il titolo può avere al massimo 120 caratteri.';
  if (!b.clientId || !(await store.getClient(b.clientId))) return 'Scegli il cliente.';
  if (!CONTENT_FORMATS.includes(b.format)) return 'Scegli il formato.';
  if (!Array.isArray(b.channels) || !b.channels.length || b.channels.some((c) => !PLATFORMS[c])) return 'Scegli almeno un canale.';
  if (!isIsoDate(b.date)) return 'Inserisci una data valida.';
  if (!TIME.test(b.time || '')) return "Inserisci l'ora (es. 18:30).";
  if ((b.caption || '').length > 2200) return 'Il testo può avere al massimo 2200 caratteri, il limite di Instagram.';
  if (b.status && !['bozza', 'pronto', 'pubblicato'].includes(b.status)) return 'Stato non valido.';
  if (b.designId && !(await store.getDesign(b.designId))) return 'Il progetto grafico collegato non esiste più.';
  return null;
}

app.get('/api/contents', wrap(async (req, res) => {
  res.json(await store.listContents({ from: req.query.from, to: req.query.to, clientId: req.query.clientId }));
}));

app.post('/api/contents', wrap(async (req, res) => {
  const err = await validateContent(req.body);
  if (err) return bad(res, err);
  res.status(201).json(await store.saveContent({ ...req.body, title: req.body.title.trim() }));
}));

app.put('/api/contents/:id', wrap(async (req, res) => {
  const err = await validateContent(req.body);
  if (err) return bad(res, err);
  const c = await store.saveContent({ ...req.body, title: req.body.title.trim() }, req.params.id);
  if (!c) return notFound(res, 'Contenuto');
  res.json(c);
}));

app.delete('/api/contents/:id', wrap(async (req, res) => {
  res.status((await store.deleteContent(req.params.id)) ? 204 : 404).end();
}));

// Appuntamenti (indipendenti dai clienti)

const APPT_CHANNELS = ['', 'Instagram', 'Facebook', 'TikTok', 'Studio'];

function validateAppointment(b) {
  if (!b || typeof b.title !== 'string' || !b.title.trim()) return 'Il titolo è obbligatorio.';
  if (b.title.length > 120) return 'Il titolo può avere al massimo 120 caratteri.';
  if (!isIsoDate(b.date)) return 'Inserisci una data valida.';
  if (!TIME.test(b.start || '')) return "Inserisci l'ora di inizio (es. 09:30).";
  if (b.end && !TIME.test(b.end)) return "L'ora di fine non è valida.";
  if (b.end && b.end <= b.start) return "L'ora di fine deve venire dopo l'ora di inizio.";
  if (!APPT_CHANNELS.includes(b.channel || '')) return 'Canale non valido.';
  if ((b.notes || '').length > 2000) return 'Le note possono avere al massimo 2000 caratteri.';
  return null;
}

app.get('/api/appointments', wrap(async (req, res) => {
  res.json(await store.listAppointments({ from: req.query.from, to: req.query.to }));
}));

app.post('/api/appointments', wrap(async (req, res) => {
  const err = validateAppointment(req.body);
  if (err) return bad(res, err);
  if (req.body.clientId && !(await store.getClient(req.body.clientId))) return bad(res, 'Il cliente scelto non esiste più.');
  res.status(201).json(await store.saveAppointment({ ...req.body, title: req.body.title.trim() }));
}));

app.put('/api/appointments/:id', wrap(async (req, res) => {
  const err = validateAppointment(req.body);
  if (err) return bad(res, err);
  const a = await store.saveAppointment({ ...req.body, title: req.body.title.trim() }, req.params.id);
  if (!a) return notFound(res, 'Appuntamento');
  res.json(a);
}));

app.delete('/api/appointments/:id', wrap(async (req, res) => {
  const ok = await store.deleteAppointment(req.params.id);
  res.status(ok ? 204 : 404).end();
}));

// Collegamento account con OAuth

app.get('/api/oauth/status', (_req, res) => res.json(oauth.status()));
app.get('/oauth/meta/start', wrap(oauth.metaStart));
app.get('/oauth/meta/callback', wrap(oauth.metaCallback));
app.get('/oauth/tiktok/start', wrap(oauth.tiktokStart));
app.get('/oauth/tiktok/callback', wrap(oauth.tiktokCallback));

app.get('/api/oauth/meta/pending/:id', (req, res) => {
  const p = oauth.metaPending(req.params.id);
  if (!p) return res.status(404).json({ error: 'La scelta è scaduta: avvia di nuovo il collegamento con Meta.' });
  res.json(p);
});

app.post('/api/oauth/meta/pending/:id', wrap(async (req, res) => {
  const { saved, client } = await oauth.metaConfirm(req.params.id, req.body || {});
  res.json({ saved, client: store.publicClient(client) });
}));

// Link di collegamento per il cliente

const INVITE_PLATFORMS = ['meta', 'tiktok'];
const publicInvite = (x) => ({
  id: x.id, url: `${oauth.inviteBase()}/collega/${x.id}`, platforms: x.platforms, created: x.created, expiresAt: x.expiresAt, used: x.used,
});

app.get('/api/clients/:id/invites', wrap(async (req, res) => {
  if (!(await store.getClient(req.params.id))) return notFound(res, 'Cliente');
  res.json((await store.listInvites(req.params.id)).map(publicInvite));
}));

app.post('/api/clients/:id/invites', wrap(async (req, res) => {
  const platforms = [...new Set(Array.isArray(req.body?.platforms) ? req.body.platforms : [])].filter((p) => INVITE_PLATFORMS.includes(p));
  if (!platforms.length) return bad(res, 'Scegli almeno un canale da collegare.');
  const st = oauth.status();
  const off = platforms.filter((p) => !st[p].configured);
  if (off.length) return bad(res, `Login ${off.map((p) => (p === 'meta' ? 'Meta' : 'TikTok')).join(' e ')} non configurato nel file .env.`);
  const x = await store.createInvite(req.params.id, platforms);
  if (!x) return notFound(res, 'Cliente');
  res.status(201).json(publicInvite(x));
}));

app.delete('/api/invites/:id', wrap(async (req, res) => {
  res.status((await store.deleteInvite(req.params.id)) ? 204 : 404).end();
}));

const sendPage = (res, html, code = 200) => res.status(code).set('Cache-Control', 'no-store').type('html').send(html);

app.get('/collega/:token', wrap(async (req, res) => {
  const invite = await store.getInvite(req.params.token);
  const client = invite && (await store.getClient(invite.clientId));
  if (!client) return sendPage(res, invitePage.expiredPage(), 404);
  const choice = String(req.query.scelta || '');
  const pick = choice && oauth.metaPending(choice, invite.id);
  if (pick) return sendPage(res, invitePage.metaPickPage({ invite, client, pick, choice }));
  sendPage(res, invitePage.invitePage({ invite, client, status: oauth.status(), outcome: String(req.query.esito || '') }));
}));

app.post('/collega/:token/meta', express.urlencoded({ extended: false, limit: '8kb' }), wrap(async (req, res) => {
  const invite = await store.getInvite(req.params.token);
  const client = invite && (await store.getClient(invite.clientId));
  if (!client) return sendPage(res, invitePage.expiredPage(), 404);
  const choice = String(req.body.scelta || '');
  try {
    await oauth.metaConfirm(choice, { facebookPageId: String(req.body.fb || ''), instagramPageId: String(req.body.ig || '') }, invite.id);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    const pick = oauth.metaPending(choice, invite.id);
    if (pick) return sendPage(res, invitePage.metaPickPage({ invite, client, pick, choice, error: e.message }), 400);
    return res.redirect(303, `/collega/${encodeURIComponent(invite.id)}?esito=stato-non-valido`);
  }
  res.redirect(303, `/collega/${encodeURIComponent(invite.id)}?esito=meta-collegato`);
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Percorso API inesistente.' }));
app.get('*', (_req, res) => res.sendFile(path.resolve('public/index.html')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Habitat pronto su http://localhost:${port}`));
