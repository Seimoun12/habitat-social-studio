// Collegamento degli account con il login ufficiale di Meta e TikTok.
// I token restano sul server: il browser riceve solo nomi di Pagine e profili da scegliere.
import { randomBytes, createHash } from 'node:crypto';
import * as store from './store.js';
import * as auth from './auth.js';
import { graphBase } from './connectors/common.js';

const STATE_TTL = 15 * 60 * 1000;
const pendingStates = new Map(); // state -> { platform, clientId, invite, verifier, created }
const pendingPicks = new Map(); // id -> { clientId, invite, pages, created }

const token = () => randomBytes(24).toString('base64url');
const env = (k) => process.env[k] || '';
const port = () => Number(process.env.PORT) || 3000;

function sweep(map) {
  const now = Date.now();
  for (const [k, v] of map) if (now - v.created > STATE_TTL) map.delete(k);
}

// PUBLIC_URL: indirizzo https da cui Habitat è raggiungibile da internet (tunnel), per i link ai clienti.
export const publicUrl = () => env('PUBLIC_URL').replace(/\/+$/, '');
const localUrl = () => `http://localhost:${port()}`;
export const inviteBase = () => publicUrl() || localUrl();
export const metaRedirect = () => env('META_REDIRECT_URI') || `${inviteBase()}/oauth/meta/callback`;
export const tiktokRedirect = () => env('TIKTOK_REDIRECT_URI') || `${inviteBase()}/oauth/tiktok/callback`;

export function status() {
  return {
    // ID app e permessi sono pubblici (compaiono nell'indirizzo del login): servono per le guide nella scheda cliente.
    meta: {
      configured: Boolean(env('META_APP_ID') && env('META_APP_SECRET')), redirectUri: metaRedirect(),
      appId: env('META_APP_ID') || null, graphVersion: graphVersion(), scopes: META_SCOPES.split(','), configId: Boolean(env('META_CONFIG_ID')),
    },
    tiktok: { configured: Boolean(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET')), redirectUri: tiktokRedirect(), scopes: TIKTOK_SCOPES.split(',') },
    publicUrl: publicUrl() || null,
  };
}

// Con un link del cliente si torna alla sua pagina; altrimenti all'app: su localhost, oppure sullo stesso
// indirizzo se il login è partito da internet con la password.
const back = (res, outcome, extra = '', invite = null, remote = false) => res.redirect(303, invite
  ? `/collega/${encodeURIComponent(invite)}?esito=${outcome}${extra}`
  : `${publicUrl() && !remote ? localUrl() : ''}/?oauth=${outcome}${extra}#/clienti`);

// Da internet si avvia un login solo con un link valido, mai indicando un cliente qualsiasi.
async function startTarget(req) {
  if (req.query.invite) {
    const inv = await store.getInvite(String(req.query.invite));
    return inv ? { clientId: inv.clientId, invite: inv.id } : { expired: String(req.query.invite) };
  }
  // Da internet l'app si apre solo con la password (server/auth.js): chi ha la sessione può collegare qualsiasi cliente.
  const remote = !req.isLocal;
  if (remote && !(auth.enabled() && auth.hasSession(req))) return { forbidden: true };
  return { clientId: String(req.query.client || ''), invite: null, remote };
}

function refuse(res, t) {
  if (t.forbidden) { res.status(403).type('text').send('Accesso non consentito.'); return true; }
  if (t.expired) { res.redirect(303, `/collega/${encodeURIComponent(t.expired)}`); return true; }
  return false;
}

async function json(url, init) {
  let r;
  try { r = await fetch(url, init); } catch { throw new Error('servizio non raggiungibile'); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) throw new Error(body.error?.message || body.error_description || body.message || `risposta ${r.status}`);
  return body;
}

// Meta: Facebook Login, poi scelta della Pagina e dell'account Instagram collegato.

const META_SCOPES = 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,business_management';

export async function metaStart(req, res) {
  const t = await startTarget(req);
  if (refuse(res, t)) return;
  if (!status().meta.configured) return back(res, 'meta-non-configurato', '', t.invite, t.remote);
  sweep(pendingStates);
  const state = token();
  pendingStates.set(state, { platform: 'meta', clientId: t.clientId, invite: t.invite, remote: t.remote, created: Date.now() });
  // Facebook Login for Business: con una configurazione (config_id) i permessi sono quelli scelti sul portale.
  const q = new URLSearchParams({ client_id: env('META_APP_ID'), redirect_uri: metaRedirect(), state, response_type: 'code' });
  if (env('META_CONFIG_ID')) q.set('config_id', env('META_CONFIG_ID'));
  else q.set('scope', META_SCOPES);
  res.redirect(303, `https://www.facebook.com/${graphVersion()}/dialog/oauth?${q}`);
}

const graphVersion = () => env('META_GRAPH_VERSION') || 'v25.0';

export async function metaCallback(req, res) {
  const entry = pendingStates.get(String(req.query.state || ''));
  if (!entry || entry.platform !== 'meta') return back(res, 'stato-non-valido');
  pendingStates.delete(String(req.query.state));
  if (req.query.error) return back(res, 'meta-annullato', '', entry.invite, entry.remote);
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
      invite: entry.invite,
      created: Date.now(),
      pages: (pages.data || []).map((p) => ({
        id: p.id, name: p.name, token: p.access_token,
        instagram: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username } : null,
      })),
    });
    back(res, 'meta-scegli', `&scelta=${id}`, entry.invite, entry.remote);
  } catch (e) {
    console.error('OAuth Meta non riuscito:', e.message);
    back(res, 'meta-errore', '', entry.invite, entry.remote);
  }
}

export function metaPending(id, invite = null) {
  const p = pendingPicks.get(id);
  if (!p || (invite && p.invite !== invite)) return null;
  return {
    clientId: p.clientId,
    pages: p.pages.map((x) => ({ id: x.id, name: x.name, instagram: x.instagram })),
  };
}

// Salva i canali scelti: la Pagina per Facebook, l'account Instagram professionale collegato a una Pagina.
// Con un link del cliente il cliente di destinazione è quello del link, non uno scelto dal browser.
export async function metaConfirm(id, { clientId, facebookPageId, instagramPageId }, invite = null) {
  const p = pendingPicks.get(id);
  if (!p || (invite && p.invite !== invite)) throw new RangeError('La scelta è scaduta: avvia di nuovo il collegamento con Meta.');
  const client = await store.getClient(invite ? p.clientId : clientId || p.clientId);
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
  if (p.invite) await store.markInviteUsed(p.invite, 'meta');
  await store.saveClient({ name: client.name, handles: client.handles }, client.id);
  return { saved, client: await store.getClient(client.id) };
}

// TikTok: Login Kit con PKCE. Con un redirect su localhost TikTok richiede il flusso "desktop".

const TIKTOK_SCOPES = 'user.info.basic,user.info.stats,video.list';

export async function tiktokStart(req, res) {
  const t = await startTarget(req);
  if (refuse(res, t)) return;
  if (!status().tiktok.configured) return back(res, 'tiktok-non-configurato', '', t.invite, t.remote);
  sweep(pendingStates);
  const state = token();
  const verifier = randomBytes(48).toString('base64url');
  pendingStates.set(state, { platform: 'tiktok', clientId: t.clientId, invite: t.invite, remote: t.remote, verifier, created: Date.now() });
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
  if (req.query.error) return back(res, 'tiktok-annullato', '', entry.invite, entry.remote);
  try {
    const t = await tiktokToken({ code: String(req.query.code || ''), grant_type: 'authorization_code', redirect_uri: tiktokRedirect(), code_verifier: entry.verifier });
    const conn = tiktokConn(t);
    try {
      const info = await json('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${conn.accessToken}` } });
      conn.accountLabel = info.data?.user?.display_name || null;
    } catch { /* il nome profilo è facoltativo */ }
    const client = await store.setConnection(entry.clientId, 'tiktok', conn);
    if (!client) return back(res, 'cliente-non-trovato', '', entry.invite, entry.remote);
    if (!client.handles.tiktok && conn.accountLabel) await store.saveClient({ name: client.name, handles: { ...client.handles, tiktok: conn.accountLabel } }, client.id);
    if (entry.invite) await store.markInviteUsed(entry.invite, 'tiktok');
    back(res, 'tiktok-collegato', '', entry.invite, entry.remote);
  } catch (e) {
    console.error('OAuth TikTok non riuscito:', e.message);
    back(res, 'tiktok-errore', '', entry.invite, entry.remote);
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
