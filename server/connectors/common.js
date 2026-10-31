// Strumenti condivisi dai connettori reali.
import { eachDay } from '../dates.js';

export class ConnectorError extends Error {
  constructor(platform, message, status) {
    super(`${platform}: ${message}`);
    this.platform = platform;
    this.status = status;
  }
}

export async function getJson(platform, url, init = {}) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ConnectorError(platform, 'impossibile raggiungere il servizio. Controlla la connessione.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error?.code && body.error.code !== 'ok') {
    const msg = body.error?.message || `risposta ${res.status}`;
    throw new ConnectorError(platform, msg, res.status);
  }
  return body;
}

// Esegue le richieste a gruppi per restare sotto i limiti di frequenza delle API.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Costruisce le righe giornaliere sommando le metriche dei contenuti per data di pubblicazione.
// Le metriche giornaliere a livello di account (es. copertura) si passano in `accountDaily`.
export function dailyFromPosts(from, to, posts, accountDaily = {}) {
  const byDate = new Map(eachDay(from, to).map((d) => [d, {
    date: d, followers: null, gained: null, lost: null,
    views: 0, reach: null, likes: 0, comments: 0, shares: 0, saves: null,
  }]));
  for (const p of posts) {
    const row = byDate.get(p.date);
    if (!row) continue;
    row.views += p.views || 0;
    row.likes += p.likes || 0;
    row.comments += p.comments || 0;
    row.shares += p.shares || 0;
    if (p.saves != null) row.saves = (row.saves || 0) + p.saves;
  }
  for (const [date, values] of Object.entries(accountDaily)) {
    const row = byDate.get(date);
    if (row) Object.assign(row, values);
  }
  return [...byDate.values()];
}

export const unixRange = (from, to) => ({
  since: Math.floor(Date.parse(from + 'T00:00:00Z') / 1000),
  until: Math.floor(Date.parse(to + 'T23:59:59Z') / 1000),
});

// Versione Graph API configurabile: Meta ritira ogni versione circa due anni dopo l'uscita.
export const graphBase = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v25.0'}`;
