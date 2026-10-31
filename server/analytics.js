// Calcola le analisi di un cliente su un canale e un periodo.
// Unico punto di calcolo: la dashboard e il report PDF leggono lo stesso oggetto.
import { previousRange, today } from './dates.js';
import { recordFollowers, getFollowerSnapshots } from './store.js';
import { demoData } from './demo.js';
import { fetchInstagram } from './connectors/instagram.js';
import { fetchFacebook } from './connectors/facebook.js';
import { fetchTiktok } from './connectors/tiktok.js';
import { freshConnection } from './oauth.js';

export const PLATFORMS = {
  instagram: { label: 'Instagram', fetch: fetchInstagram, erBase: 'reach' },
  facebook: { label: 'Facebook', fetch: fetchFacebook, erBase: 'reach' },
  tiktok: { label: 'TikTok', fetch: fetchTiktok, erBase: 'views' },
};

const INTERACTION_KEYS = ['likes', 'comments', 'shares', 'saves'];

const sum = (rows, key) => {
  let total = 0;
  let seen = false;
  for (const r of rows) if (r[key] != null) { total += r[key]; seen = true; }
  return seen ? total : null;
};

const interactionsOf = (row) => INTERACTION_KEYS.reduce((s, k) => s + (row[k] || 0), 0);

function rate(row, base) {
  const denom = row[base];
  return denom ? (interactionsOf(row) / denom) * 100 : null;
}

function totals(daily, base) {
  const t = {};
  for (const k of ['views', 'reach', ...INTERACTION_KEYS]) t[k] = sum(daily, k);
  t.interactions = INTERACTION_KEYS.reduce((s, k) => s + (t[k] || 0), 0);
  t.engagementRate = t[base] ? (t.interactions / t[base]) * 100 : null;
  return t;
}

// `before` = follower a fine giornata il giorno prima del periodo, se noto.
function audience(daily, before = null) {
  const known = daily.filter((d) => d.followers != null);
  if (!known.length) return { start: null, end: null, net: null, gained: sum(daily, 'gained'), lost: sum(daily, 'lost') };
  const start = before ?? known[0].followers;
  const end = known[known.length - 1].followers;
  return {
    start,
    end,
    net: start != null && end != null ? end - start : null,
    gained: sum(daily, 'gained'),
    lost: sum(daily, 'lost'),
  };
}

function formatBreakdown(posts, base) {
  const groups = new Map();
  for (const p of posts) {
    if (!groups.has(p.format)) groups.set(p.format, []);
    groups.get(p.format).push(p);
  }
  return [...groups.entries()]
    .map(([format, list]) => {
      const rates = list.map((p) => rate(p, base)).filter((x) => x != null);
      return {
        format,
        posts: list.length,
        avgViews: Math.round(list.reduce((s, p) => s + (p.views || 0), 0) / list.length),
        avgInteractions: Math.round(list.reduce((s, p) => s + interactionsOf(p), 0) / list.length),
        avgEngagementRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      };
    })
    .sort((a, b) => (b.avgEngagementRate ?? -1) - (a.avgEngagementRate ?? -1));
}

// Migliori e peggiori per tasso di coinvolgimento; a parità vince chi ha più visualizzazioni.
// Con meno di 10 contenuti le due liste non si sovrappongono: i peggiori sono quelli rimasti.
function ranking(posts, base) {
  const scored = posts
    .map((p) => ({ ...p, interactions: interactionsOf(p), engagementRate: rate(p, base) }))
    .filter((p) => p.engagementRate != null)
    .sort((a, b) => b.engagementRate - a.engagementRate || b.views - a.views);
  const best = scored.slice(0, 5);
  const rest = scored.slice(best.length);
  const worst = rest.slice(-5).reverse();
  return { best, worst };
}

export async function getAnalytics(client, platform, range) {
  const meta = PLATFORMS[platform];
  if (!meta) throw new RangeError(`Canale sconosciuto: ${platform}`);
  const prev = previousRange(range);
  const conn = await freshConnection(client, platform);
  const live = Boolean(conn?.accessToken);

  const raw = live
    ? await meta.fetch(conn, prev.from, range.to)
    : demoData(client.id, platform, prev.from, range.to);

  // Le API danno solo il totale follower di oggi: lo salviamo ogni giorno
  // e ricostruiamo lo storico dalle istantanee.
  if (live) {
    if (raw.currentFollowers != null) await recordFollowers(client.id, platform, today(), raw.currentFollowers);
    const snaps = await getFollowerSnapshots(client.id, platform);
    for (const d of raw.daily) d.followers = snaps[d.date] ?? null;
  }

  const cur = raw.daily.filter((d) => d.date >= range.from && d.date <= range.to);
  const old = raw.daily.filter((d) => d.date >= prev.from && d.date <= prev.to);
  const lastOld = [...old].reverse().find((d) => d.followers != null);
  const posts = raw.posts.filter((p) => p.date >= range.from && p.date <= range.to);
  const prevPosts = raw.posts.filter((p) => p.date >= prev.from && p.date <= prev.to);

  return {
    source: live ? 'live' : 'demo',
    client: { id: client.id, name: client.name },
    platform,
    platformLabel: meta.label,
    engagementBase: meta.erBase,
    range,
    previous: prev,
    accountLabel: raw.accountLabel || null,
    audience: { current: audience(cur, lastOld?.followers), previous: audience(old) },
    totals: { current: totals(cur, meta.erBase), previous: totals(old, meta.erBase) },
    postCount: { current: posts.length, previous: prevPosts.length },
    series: cur.map((d) => ({
      date: d.date,
      followers: d.followers,
      gained: d.gained,
      lost: d.lost,
      views: d.views,
      interactions: interactionsOf(d),
    })),
    formats: formatBreakdown(posts, meta.erBase),
    ranking: ranking(posts, meta.erBase),
    demographics: raw.demographics,
    unavailable: raw.unavailable || {},
    // Un connettore reale può non avere ogni metrica: nella risposta la metrica resta null.
    warnings: raw.warnings || [],
  };
}
