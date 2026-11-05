// Accesso con password per chi apre Habitat da internet (VPS o tunnel).
// Attivo solo se HABITAT_PASSWORD_HASH è impostato: senza, resta il comportamento di sempre
// (da questo computer si entra, da fuori si vede solo il link del cliente).
// Da localhost non serve mai la password. Nessuna dipendenza: scrypt e HMAC sono in node:crypto.
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const COOKIE = 'habitat_sessione';
const KEYLEN = 64;
const COST = 16384;

// Formato: scrypt:<costo>:<sale>:<hash>, tutto in base64url, senza "$" per non dare noie a .env e systemd.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N: COST });
  return `scrypt:${COST}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, cost, salt, hash] = String(stored || '').split(':');
  if (kind !== 'scrypt' || !cost || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, { N: Number(cost) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const hash = () => (process.env.HABITAT_PASSWORD_HASH || '').trim();
export const enabled = () => Boolean(hash());

// Senza SESSION_SECRET la chiave nasce a ogni avvio: funziona, ma i login decadono al riavvio.
const bootSecret = randomBytes(32).toString('hex');
const secret = () => process.env.SESSION_SECRET || bootSecret;
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');
const days = () => Math.max(1, Number(process.env.HABITAT_SESSION_DAYS) || 14);

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function hasSession(req) {
  const [exp, nonce, sig] = readCookie(req, COOKIE).split('.');
  if (!exp || !nonce || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(`${exp}.${nonce}`));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
}

const secure = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

export function startSession(req, res) {
  const exp = Date.now() + days() * 86400000;
  const payload = `${exp}.${randomBytes(12).toString('base64url')}`;
  res.append('Set-Cookie', `${COOKIE}=${payload}.${sign(payload)}; Path=/; Max-Age=${days() * 86400}; HttpOnly; SameSite=Lax${secure(req) ? '; Secure' : ''}`);
}

export function endSession(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure(req) ? '; Secure' : ''}`);
}

// Le richieste che scrivono devono arrivare dalla stessa origine (oltre a SameSite=Lax sul cookie).
export function sameOrigin(req) {
  // I browser moderni dichiarano da soli da dove parte la richiesta; Origin può essere "null"
  // quando la pagina ha referrer no-referrer, quindi non è affidabile da solo.
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// Tentativi falliti per indirizzo: dopo 5 in 15 minuti si aspetta. Dietro nginx l'indirizzo è l'ultimo di x-forwarded-for.
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map();

export function clientKey(req) {
  const ip = req.socket.remoteAddress || '';
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ip.includes('127.0.0.1') || ip === '::1' ? fwd.at(-1) || ip : ip;
}

export function waitSeconds(key) {
  const f = fails.get(key);
  if (!f || f.until <= Date.now()) return 0;
  return f.count >= MAX_FAILS ? Math.ceil((f.until - Date.now()) / 1000) : 0;
}

export function recordFail(key) {
  const now = Date.now();
  const f = fails.get(key);
  if (!f || f.until <= now) fails.set(key, { count: 1, until: now + WINDOW });
  else { f.count += 1; f.until = now + WINDOW; }
  if (fails.size > 5000) for (const [k, v] of fails) if (v.until < now) fails.delete(k);
}

export const clearFails = (key) => fails.delete(key);

export async function checkPassword(password) {
  return verifyPassword(String(password || '').slice(0, 256), hash());
}
