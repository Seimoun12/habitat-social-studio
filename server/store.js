// Archivio su file JSON: clienti, appuntamenti, contenuti programmati, progetti grafici e file caricati.
// Basta per un uso a singolo utente; le scritture passano da una coda per non sovrapporsi.
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PLATFORM_KEYS = ['instagram', 'facebook', 'tiktok'];

// Stile di partenza: i colori Habitat, finché la social media manager non imposta quelli del cliente.
export const DEFAULT_BRAND = {
  colors: { primary: '#173a32', secondary: '#52745b', accent: '#c8ec68', background: '#f6f7f0', text: '#17231f' },
  fonts: { heading: 'Playfair Display', body: 'DM Sans' },
  logoAssetId: null,
  notes: '',
};

// I clienti iniziali sono segnaposto dichiarati: si rinominano o eliminano da "Clienti".
const SEED = {
  clients: [
    { id: 'demo-a', name: 'Cliente demo A', handles: { instagram: '', facebook: '', tiktok: '' }, connections: {} },
    { id: 'demo-b', name: 'Cliente demo B', handles: { instagram: '', facebook: '', tiktok: '' }, connections: {} },
    { id: 'demo-c', name: 'Cliente demo C', handles: { instagram: '', facebook: '', tiktok: '' }, connections: {} },
  ],
  appointments: [],
  contents: [],
  designs: [],
  assets: [],
};

let cache = null;
let queue = Promise.resolve();

async function load() {
  if (cache) return cache;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await mkdir(THUMB_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    cache = structuredClone(SEED);
    await persist();
    return cache;
  }
  cache = JSON.parse(await readFile(DB_FILE, 'utf8'));
  for (const key of ['clients', 'appointments', 'contents', 'designs', 'assets']) cache[key] ??= [];
  return cache;
}

function persist() {
  queue = queue.then(async () => {
    const tmp = DB_FILE + '.tmp';
    await writeFile(tmp, JSON.stringify(cache, null, 2));
    await rename(tmp, DB_FILE);
  });
  return queue;
}

const brandOf = (c) => ({
  colors: { ...DEFAULT_BRAND.colors, ...c.brand?.colors },
  fonts: { ...DEFAULT_BRAND.fonts, ...c.brand?.fonts },
  logoAssetId: c.brand?.logoAssetId ?? null,
  notes: c.brand?.notes ?? '',
});

// I token non escono mai verso il browser: il client vede solo se un canale è collegato e come.
export function publicClient(c) {
  const connected = {};
  const connection = {};
  for (const p of PLATFORM_KEYS) {
    const conn = c.connections?.[p];
    connected[p] = Boolean(conn && conn.accessToken);
    connection[p] = connected[p]
      ? { source: conn.source || 'manuale', accountLabel: conn.accountLabel || null, expiresAt: conn.expiresAt || null, autoRefresh: Boolean(conn.refreshToken) }
      : null;
  }
  return { id: c.id, name: c.name, handles: c.handles, connected, connection, brand: brandOf(c) };
}

export async function listClients() {
  return (await load()).clients;
}

export async function getClient(id) {
  return (await load()).clients.find((c) => c.id === id) || null;
}

export async function saveClient(input, id = null) {
  const db = await load();
  let client = id ? db.clients.find((c) => c.id === id) : null;
  if (id && !client) return null;
  if (!client) {
    client = { id: randomUUID(), name: '', handles: {}, connections: {} };
    db.clients.push(client);
  }
  client.name = input.name;
  client.handles = {
    instagram: input.handles?.instagram || '',
    facebook: input.handles?.facebook || '',
    tiktok: input.handles?.tiktok || '',
  };
  // Un campo token vuoto lascia invariato quello salvato; "clear" lo rimuove.
  for (const p of PLATFORM_KEYS) {
    const next = input.connections?.[p];
    if (!next) continue;
    if (next.clear) { delete client.connections[p]; continue; }
    const prev = client.connections[p] || {};
    const tokenChanged = Boolean(next.accessToken);
    client.connections[p] = {
      ...prev,
      accountId: next.accountId ?? prev.accountId ?? '',
      accessToken: tokenChanged ? next.accessToken : prev.accessToken || '',
      ...(tokenChanged ? { source: 'manuale', expiresAt: null, accountLabel: null } : {}),
      ...(next.refreshToken ? { refreshToken: next.refreshToken } : tokenChanged ? { refreshToken: undefined } : {}),
    };
  }
  await persist();
  return client;
}

// Collegamento ottenuto da OAuth: sostituisce del tutto quello precedente del canale.
export async function setConnection(clientId, platform, conn) {
  const client = await getClient(clientId);
  if (!client) return null;
  client.connections[platform] = conn;
  await persist();
  return client;
}

export async function saveBrand(clientId, input) {
  const client = await getClient(clientId);
  if (!client) return null;
  client.brand = {
    colors: { ...DEFAULT_BRAND.colors, ...input.colors },
    fonts: { ...DEFAULT_BRAND.fonts, ...input.fonts },
    logoAssetId: input.logoAssetId || null,
    notes: input.notes || '',
  };
  await persist();
  return client;
}

export async function deleteClient(id) {
  const db = await load();
  const before = db.clients.length;
  db.clients = db.clients.filter((c) => c.id !== id);
  // Gli appuntamenti restano in calendario, senza più il collegamento al cliente.
  for (const a of db.appointments) if (a.clientId === id) a.clientId = null;
  for (const key of Object.keys(db.snapshots || {})) if (key.startsWith(id + ':')) delete db.snapshots[key];
  // Contenuti, progetti grafici e file appartengono al cliente: si eliminano con lui.
  db.contents = db.contents.filter((c) => c.clientId !== id);
  for (const d of db.designs.filter((x) => x.clientId === id)) await rm(path.join(THUMB_DIR, `${d.id}.png`), { force: true });
  db.designs = db.designs.filter((d) => d.clientId !== id);
  for (const a of db.assets.filter((x) => x.clientId === id)) await rm(path.join(UPLOAD_DIR, a.file), { force: true });
  db.assets = db.assets.filter((a) => a.clientId !== id);
  await persist();
  return db.clients.length < before;
}

export async function recordFollowers(clientId, platform, date, count) {
  const db = await load();
  db.snapshots ??= {};
  const key = `${clientId}:${platform}`;
  db.snapshots[key] ??= {};
  if (db.snapshots[key][date] === count) return;
  db.snapshots[key][date] = count;
  await persist();
}

export async function getFollowerSnapshots(clientId, platform) {
  const db = await load();
  return db.snapshots?.[`${clientId}:${platform}`] || {};
}

// Appuntamenti dello studio

export async function listAppointments({ from, to } = {}) {
  const db = await load();
  return db.appointments
    .filter((a) => (!from || a.date >= from) && (!to || a.date <= to))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export async function saveAppointment(input, id = null) {
  const db = await load();
  let appt = id ? db.appointments.find((a) => a.id === id) : null;
  if (id && !appt) return null;
  if (!appt) {
    appt = { id: randomUUID() };
    db.appointments.push(appt);
  }
  Object.assign(appt, {
    title: input.title,
    date: input.date,
    start: input.start,
    end: input.end || '',
    clientId: input.clientId || null,
    channel: input.channel || '',
    place: input.place || '',
    notes: input.notes || '',
  });
  await persist();
  return appt;
}

export async function deleteAppointment(id) {
  const db = await load();
  const before = db.appointments.length;
  db.appointments = db.appointments.filter((a) => a.id !== id);
  await persist();
  return db.appointments.length < before;
}

// Contenuti programmati (piano editoriale, non pubblicati in automatico)

export async function listContents({ from, to, clientId } = {}) {
  const db = await load();
  return db.contents
    .filter((c) => (!from || c.date >= from) && (!to || c.date <= to) && (!clientId || c.clientId === clientId))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function saveContent(input, id = null) {
  const db = await load();
  let item = id ? db.contents.find((c) => c.id === id) : null;
  if (id && !item) return null;
  if (!item) {
    item = { id: randomUUID(), createdAt: new Date().toISOString() };
    db.contents.push(item);
  }
  Object.assign(item, {
    title: input.title,
    clientId: input.clientId,
    format: input.format,
    channels: input.channels,
    caption: input.caption || '',
    date: input.date,
    time: input.time,
    status: input.status || 'bozza',
    designId: input.designId || null,
  });
  await persist();
  return item;
}

export async function deleteContent(id) {
  const db = await load();
  const before = db.contents.length;
  db.contents = db.contents.filter((c) => c.id !== id);
  await persist();
  return db.contents.length < before;
}

// Progetti grafici (post, storie, reel)

const designSummary = (d) => ({
  id: d.id, clientId: d.clientId, name: d.name, kind: d.kind, format: d.format,
  updatedAt: d.updatedAt, hasThumb: Boolean(d.hasThumb),
});

export async function listDesigns({ clientId } = {}) {
  const db = await load();
  return db.designs
    .filter((d) => !clientId || d.clientId === clientId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(designSummary);
}

export async function getDesign(id) {
  return (await load()).designs.find((d) => d.id === id) || null;
}

export async function saveDesign(input, id = null) {
  const db = await load();
  let d = id ? db.designs.find((x) => x.id === id) : null;
  if (id && !d) return null;
  if (!d) {
    d = { id: randomUUID(), clientId: input.clientId, kind: input.kind, format: input.format, hasThumb: false };
    db.designs.push(d);
  }
  d.name = input.name;
  d.doc = input.doc;
  if (input.format) d.format = input.format;
  d.updatedAt = new Date().toISOString();
  await persist();
  return d;
}

export async function markThumb(id) {
  const d = await getDesign(id);
  if (!d) return;
  d.hasThumb = true;
  await persist();
}

export async function deleteDesign(id) {
  const db = await load();
  const before = db.designs.length;
  db.designs = db.designs.filter((d) => d.id !== id);
  for (const c of db.contents) if (c.designId === id) c.designId = null;
  await rm(path.join(THUMB_DIR, `${id}.png`), { force: true });
  await persist();
  return db.designs.length < before;
}

// File caricati (immagini, video, audio)

export async function listAssets({ clientId } = {}) {
  const db = await load();
  return db.assets.filter((a) => !clientId || a.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAsset(id) {
  return (await load()).assets.find((a) => a.id === id) || null;
}

export async function addAsset(asset) {
  const db = await load();
  db.assets.push(asset);
  await persist();
  return asset;
}

export async function deleteAsset(id) {
  const db = await load();
  const asset = db.assets.find((a) => a.id === id);
  if (!asset) return false;
  db.assets = db.assets.filter((a) => a.id !== id);
  for (const c of db.clients) if (c.brand?.logoAssetId === id) c.brand.logoAssetId = null;
  await rm(path.join(UPLOAD_DIR, asset.file), { force: true });
  await persist();
  return true;
}
