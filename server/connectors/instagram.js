// Instagram Graph API (account Business o Creator collegato a una Pagina Facebook).
// Serve un token con instagram_basic, instagram_manage_insights, pages_read_engagement.
// Da verificare con un account reale: i nomi delle metriche Meta cambiano tra versioni.
import { getJson, mapLimit, dailyFromPosts, unixRange, graphBase } from './common.js';
import { addDays, today } from '../dates.js';

// La versione si cambia con META_GRAPH_VERSION nel file .env.
const P = 'Instagram';

const FORMAT = { REELS: 'Reel', CAROUSEL_ALBUM: 'Carosello', IMAGE: 'Foto', VIDEO: 'Video', STORY: 'Storia' };

// Con Instagram Login (conn.source) le stesse chiamate vanno a graph.instagram.com; con il login Facebook a graph.facebook.com.
const builder = (conn) => {
  const base = conn.source === 'instagram-login'
    ? `https://graph.instagram.com/${process.env.META_GRAPH_VERSION || 'v25.0'}`
    : graphBase();
  return (path, params) => {
    const u = new URL(base + path);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u;
  };
};

async function listMedia(id, token, from, to, url) {
  const out = [];
  let next = url(`/${id}/media`, {
    fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count',
    limit: '50',
    access_token: token,
  });
  // I contenuti arrivano dal più recente: ci si ferma quando si supera l'inizio del periodo.
  while (next) {
    const page = await getJson(P, next);
    for (const m of page.data || []) {
      const date = m.timestamp.slice(0, 10);
      if (date > to) continue;
      if (date < from) return out;
      out.push(m);
    }
    next = page.paging?.next || null;
  }
  return out;
}

async function mediaInsights(m, token, url) {
  const metrics = 'views,reach,likes,comments,shares,saved';
  try {
    const res = await getJson(P, url(`/${m.id}/insights`, { metric: metrics, access_token: token }));
    const v = Object.fromEntries((res.data || []).map((x) => [x.name, x.values?.[0]?.value ?? x.total_value?.value ?? null]));
    return v;
  } catch {
    return {}; // alcuni contenuti vecchi o storie scadute non hanno insight
  }
}

async function dailyMetric(id, token, metric, from, to, url) {
  const out = {};
  // L'API accetta al massimo 30 giorni per richiesta.
  for (let start = from; start <= to; start = addDays(start, 30)) {
    const end = addDays(start, 29) < to ? addDays(start, 29) : to;
    const { since, until } = unixRange(start, end);
    const res = await getJson(P, url(`/${id}/insights`, { metric, period: 'day', since, until, access_token: token }));
    for (const v of res.data?.[0]?.values || []) out[v.end_time.slice(0, 10)] = v.value;
  }
  return out;
}

async function demographics(id, token, url) {
  const read = async (breakdown) => {
    const res = await getJson(P, url(`/${id}/insights`, {
      metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown, access_token: token,
    }));
    const rows = res.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({ label: r.dimension_values[0], value: r.value / total }));
  };
  const gender = (await read('gender')).map((g) => ({
    ...g, label: { F: 'Donne', M: 'Uomini', U: 'Non specificato' }[g.label] || g.label,
  }));
  const age = (await read('age')).sort((a, b) => a.label.localeCompare(b.label));
  const locations = (await read('city'))
    .map((c) => ({ ...c, label: c.label.split(',')[0] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return { gender, age, locations };
}

export async function fetchInstagram(conn, from, to) {
  const { accountId: id, accessToken: token } = conn;
  const url = builder(conn);
  const warnings = [];
  const account = await getJson(P, url(`/${id}`, { fields: 'username,followers_count', access_token: token }));

  const media = await listMedia(id, token, from, to, url);
  const insights = await mapLimit(media, 4, (m) => mediaInsights(m, token, url));
  const posts = media.map((m, i) => {
    const ins = insights[i];
    return {
      id: m.id,
      date: m.timestamp.slice(0, 10),
      format: FORMAT[m.media_product_type === 'REELS' ? 'REELS' : m.media_type] || m.media_type,
      caption: (m.caption || '').slice(0, 140) || 'Contenuto senza didascalia',
      permalink: m.permalink,
      views: ins.views ?? null,
      reach: ins.reach ?? null,
      likes: ins.likes ?? m.like_count ?? 0,
      comments: ins.comments ?? m.comments_count ?? 0,
      shares: ins.shares ?? 0,
      saves: ins.saved ?? 0,
    };
  });

  const accountDaily = {};
  try {
    const reach = await dailyMetric(id, token, 'reach', from, to, url);
    for (const [d, v] of Object.entries(reach)) accountDaily[d] = { ...accountDaily[d], reach: v };
  } catch (e) { warnings.push(`Copertura giornaliera non disponibile (${e.message}).`); }

  // follower_count = nuovi follower al giorno, solo per gli ultimi 30 giorni.
  const earliest = addDays(today(), -30);
  if (to >= earliest) {
    try {
      const gained = await dailyMetric(id, token, 'follower_count', from > earliest ? from : earliest, to, url);
      for (const [d, v] of Object.entries(gained)) accountDaily[d] = { ...accountDaily[d], gained: v };
    } catch (e) { warnings.push(`Nuovi follower non disponibili (${e.message}).`); }
  }

  let demo = null;
  const unavailable = {
    gainedLost: 'Instagram fornisce i nuovi follower solo per gli ultimi 30 giorni e non indica chi ha smesso di seguire.',
  };
  try { demo = await demographics(id, token, url); } catch (e) {
    unavailable.demographics = `Dati demografici non disponibili: ${e.message}. Instagram li mostra solo con almeno 100 follower.`;
  }

  return {
    daily: dailyFromPosts(from, to, posts, accountDaily),
    posts,
    demographics: demo,
    unavailable,
    warnings,
    currentFollowers: account.followers_count ?? null,
    accountLabel: account.username ? '@' + account.username : null,
  };
}
