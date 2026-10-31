// Collegamento degli account con il login ufficiale di Meta e TikTok.
// I token restano sul server: il browser riceve solo nomi di Pagine e profili da scegliere.
import { randomBytes, createHash } from 'node:crypto';
import * as store from './store.js';
import { graphBase } from './connectors/common.js';

const STATE_TTL = 15 * 60 * 1000;
const pendingStates = new Map(); // state -> { platform, clientId, verifier, created }
const pendingPicks = new Map(); // id -> { clientId, pages, created }

const token = () => randomBytes(24).toString('base64url');
const env = (k) => process.env[k] || '';
const port = () => Number(process.env.PORT) || 3000;

function sweep(map) {
  const now = Date.now();
  for (const [k, v] of map) if (now - v.created > STATE_TTL) map.delete(k);
}

export const metaRedirect = () => env('META_REDIRECT_URI') || `http://localhost:${port()}/oauth/meta/callback`;
export const tiktokRedirect = () => env('TIKTOK_REDIRECT_URI') || `http://localhost:${port()}/oauth/tiktok/callback`;

export function status() {
  return {
    meta: { configured: Boolean(env('META_APP_ID') && env('META_APP_SECRET')), redirectUri: metaRedirect() },
    tiktok: { configured: Boolean(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET')), redirectUri: tiktokRedirect() },
  };
}

const back = (res, outcome, extra = '') => res.redirect(303, `/?oauth=${outcome}${extra}#/clienti`);

async function json(url, init) {
  let r;
  try { r = await fetch(url, init); } catch { throw new Error('servizio non raggiungibile'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw new Error(body.error?.message || body.error_description || body.message || `risposta ${r.status}`);
  return body;
}

// Meta: Facebook Login, poi scelta della Pagina e dell'account Instagram collegato.

const META_SCOPES = 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,business_management';

export function metaStart(req, res) {
  if (!status().meta.configured) return back(res, 'meta-non-configurato');
  const clientId = String(req.query.client || '');
  sweep(pendingStates);
  const state = token();
  pendingStates.set(state, { platform: 'meta', clientId, created: Date.now() });
  const q = new URLSearchParams({ client_id: env('META_APP_ID'), redirect_uri: metaRedirect(), state, response_type: 'code', scope: META_SCOPES });
  res.redirect(303, `https://www.facebook.com/${graphVersion()}/dialog/oauth?${q}`);
}

const graphVersion = () => env('META_GRAPH_VERSION') || 'v25.0';

export async function metaCallback(req, res) {
  const entry = pendingStates.get(String(req.query.state || ''));
  if (!entry || entry.platform !== 'meta') return back(res, 'stato-non-valido');
  pendingStates.delete(String(req.query.state));
  if (req.query.error) return back(res, 'meta-annullato');
  try {
    const base = graphBase();
    const short = await json(`${base}/oauth/access_token?${new URLSearchParams({
      client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: metaRedirect(), code: String(req.query.code || ''),
    })}`);
    const long = await json(`${base}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: short.access_token,
    })}`);
    // I token di Pagina ottenuti da un token utente di lunga durata non scadono.
    const pages = await json(`${base}/me/accounts?${new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100', access_token: long.access_token,
    })}`);
    sweep(pendingPicks);
    const id = token();
    pendingPicks.set(id, {
      clientId: entry.clientId,
      created: Date.now(),
      pages: (pages.data || []).map((p) => ({
        id: p.id, name: p.name, token: p.access_token,
        instagram: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username } : null,
      })),
    });
    back(res, 'meta-scegli', `&scelta=${id}`);
  } catch (e) {
    console.error('OAuth Meta non riuscito:', e.message);
    back(res, 'meta-errore');
  }
}

export function metaPending(id) {
  const p = pendingPicks.get(id);
  if (!p) return null;
  return {
    clientId: p.clientId,
    pages: p.pages.map((x) => ({ id: x.id, name: x.name, instagram: x.instagram })),
  };
}

// Salva i canali scelti: la Pagina per Facebook, l'account Instagram professionale collegato a una Pagina.
export async function metaConfirm(id, { clientId, facebookPageId, instagramPageId }) {
  const p = pendingPicks.get(id);
  if (!p) throw new RangeError('La scelta è scaduta: avvia di nuovo il collegamento con Meta.');
  const client = await store.getClient(clientId || p.clientId);
  if (!client) throw new RangeError('Cliente non trovato.');
  const saved = [];
  const fb = p.pages.find((x) => x.id === facebookPageId);
  if (fb) {
    await store.setConnection(client.id, 'facebook', { accountId: fb.id, accessToken: fb.token, accountLabel: fb.name, source: 'meta' });
    if (!client.handles.facebook) client.handles.facebook = fb.name;
    saved.push('facebook');
  }
  const ig = p.pages.find((x) => x.id === instagramPageId && x.instagram);
  if (ig) {
    await store.setConnection(client.id, 'instagram', { accountId: ig.instagram.id, accessToken: ig.token, accountLabel: `@${ig.instagram.username}`, source: 'meta' });
    if (!client.handles.instagram) client.handles.instagram = `@${ig.instagram.username}`;
    saved.push('instagram');
  }
  if (!saved.length) throw new RangeError('Scegli almeno una Pagina o un account Instagram.');
  pendingPicks.delete(id);
  await store.saveClient({ name: client.name, handles: client.handles }, client.id);
  return { saved, client: await store.getClient(client.id) };
}

// TikTok: Login Kit con PKCE. Con un redirect su localhost TikTok richiede il flusso "desktop".

const TIKTOK_SCOPES = 'user.info.basic,user.info.stats,video.list';

export function tiktokStart(req, res) {
  if (!status().tiktok.configured) return back(res, 'tiktok-non-configurato');
  sweep(pendingStates);
  const state = token();
  const verifier = randomBytes(48).toString('base64url');
  pendingStates.set(state, { platform: 'tiktok', clientId: String(req.query.client || ''), verifier, created: Date.now() });
  // TikTok documenta la challenge come SHA-256 in esadecimale, non in base64url.
  const challenge = createHash('sha256').update(verifier).digest('hex');
  const q = new URLSearchParams({
    client_key: env('TIKTOK_CLIENT_KEY'), scope: TIKTOK_SCOPES, response_type: 'code', redirect_uri: tiktokRedirect(),
    state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  res.redirect(303, `https://www.tiktok.com/v2/auth/authorize/?${q}`);
}

async function tiktokToken(params) {
  return json('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), ...params }),
  });
}

const tiktokConn = (t, prev = {}) => ({
  accountId: t.open_id || prev.accountId || '',
  accessToken: t.access_token,
  refreshToken: t.refresh_token || prev.refreshToken,
  expiresAt: new Date(Date.now() + (t.expires_in || 86400) * 1000).toISOString(),
  refreshExpiresAt: t.refresh_expires_in ? new Date(Date.now() + t.refresh_expires_in * 1000).toISOString() : prev.refreshExpiresAt || null,
  accountLabel: prev.accountLabel || null,
  source: 'tiktok',
});

export async function tiktokCallback(req, res) {
  const entry = pendingStates.get(String(req.query.state || ''));
  if (!entry || entry.platform !== 'tiktok') return back(res, 'stato-non-valido');
  pendingStates.delete(String(req.query.state));
  if (req.query.error) return back(res, 'tiktok-annullato');
  try {
    const t = await tiktokToken({ code: String(req.query.code || ''), grant_type: 'authorization_code', redirect_uri: tiktokRedirect(), code_verifier: entry.verifier });
    const conn = tiktokConn(t);
    try {
      const info = await json('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${conn.accessToken}` } });
      conn.accountLabel = info.data?.user?.display_name || null;
    } catch { /* il nome profilo è facoltativo */ }
    if (!(await store.setConnection(entry.clientId, 'tiktok', conn))) return back(res, 'cliente-non-trovato');
    back(res, 'tiktok-collegato');
  } catch (e) {
    console.error('OAuth TikTok non riuscito:', e.message);
    back(res, 'tiktok-errore');
  }
}

// Il token TikTok dura 24 ore: lo si rinnova prima di leggere i dati, se c'è il refresh token.
export async function freshConnection(client, platform) {
  const conn = client.connections?.[platform];
  if (platform !== 'tiktok' || !conn?.refreshToken || !conn.expiresAt) return conn;
  if (Date.parse(conn.expiresAt) - Date.now() > 5 * 60 * 1000) return conn;
  if (!status().tiktok.configured) return conn;
  try {
    const t = await tiktokToken({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
    const next = tiktokConn(t, conn);
    await store.setConnection(client.id, 'tiktok', next);
    return next;
  } catch (e) {
    const err = new Error(`TikTok: rinnovo del token non riuscito (${e.message}). Collega di nuovo l'account.`);
    err.platform = 'TikTok';
    throw err;
  }
}
