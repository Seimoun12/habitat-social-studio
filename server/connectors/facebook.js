// Facebook Pages API. Serve un Page Access Token con pages_read_engagement e read_insights.
// Da verificare con una Pagina reale: Meta ha ritirato diverse metriche delle Pagine nel 2024-2025,
// quindi ogni metrica giornaliera è facoltativa e un errore diventa un avviso, non un blocco.
import { getJson, mapLimit, dailyFromPosts, unixRange, graphBase } from './common.js';
import { addDays } from '../dates.js';

// La versione si cambia con META_GRAPH_VERSION nel file .env.
const P = 'Facebook';

function url(path, params) {
  const u = new URL(graphBase() + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}

const FORMAT = { photo: 'Foto', video_inline: 'Video', video_autoplay: 'Video', share: 'Link', album: 'Foto', native_templates: 'Link' };

async function listPosts(id, token, from, to) {
  const { since, until } = unixRange(from, to);
  const out = [];
  let next = url(`/${id}/posts`, {
    fields: 'id,message,created_time,permalink_url,attachments{media_type,type},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares',
    since, until, limit: '50', access_token: token,
  });
  while (next) {
    const page = await getJson(P, next);
    out.push(...(page.data || []));
    next = page.paging?.next || null;
  }
  return out;
}

async function postInsights(postId, token) {
  try {
    const res = await getJson(P, url(`/${postId}/insights`, { metric: 'post_impressions_unique,post_video_views', access_token: token }));
    return Object.fromEntries((res.data || []).map((x) => [x.name, x.values?.[0]?.value ?? null]));
  } catch {
    return {};
  }
}

async function dailyMetric(id, token, metric, from, to) {
  const out = {};
  for (let start = from; start <= to; start = addDays(start, 90)) {
    const end = addDays(start, 89) < to ? addDays(start, 89) : to;
    const { since, until } = unixRange(start, end);
    const res = await getJson(P, url(`/${id}/insights`, { metric, period: 'day', since, until, access_token: token }));
    for (const v of res.data?.[0]?.values || []) out[addDays(v.end_time.slice(0, 10), -1)] = v.value;
  }
  return out;
}

export async function fetchFacebook(conn, from, to) {
  const { accountId: id, accessToken: token } = conn;
  const warnings = [];
  const page = await getJson(P, url(`/${id}`, { fields: 'name,followers_count', access_token: token }));

  const raw = await listPosts(id, token, from, to);
  const insights = await mapLimit(raw, 4, (p) => postInsights(p.id, token));
  const posts = raw.map((p, i) => {
    const kind = p.attachments?.data?.[0]?.type || p.attachments?.data?.[0]?.media_type;
    const isReel = p.permalink_url?.includes('/reel/');
    return {
      id: p.id,
      date: p.created_time.slice(0, 10),
      format: isReel ? 'Reel' : FORMAT[kind] || (kind ? 'Altro' : 'Testo'),
      caption: (p.message || '').slice(0, 140) || 'Post senza testo',
      permalink: p.permalink_url,
      views: insights[i].post_video_views ?? null,
      reach: insights[i].post_impressions_unique ?? null,
      likes: p.reactions?.summary?.total_count ?? 0,
      comments: p.comments?.summary?.total_count ?? 0,
      shares: p.shares?.count ?? 0,
      saves: null,
    };
  });

  const accountDaily = {};
  const metrics = [
    ['page_impressions_unique', 'reach', 'Copertura giornaliera'],
    ['page_daily_follows_unique', 'gained', 'Nuovi follower'],
    ['page_daily_unfollows_unique', 'lost', 'Follower persi'],
  ];
  for (const [metric, key, label] of metrics) {
    try {
      const values = await dailyMetric(id, token, metric, from, to);
      for (const [d, v] of Object.entries(values)) accountDaily[d] = { ...accountDaily[d], [key]: v };
    } catch (e) { warnings.push(`${label} non disponibile (${e.message}).`); }
  }

  return {
    daily: dailyFromPosts(from, to, posts, accountDaily),
    posts,
    demographics: null,
    unavailable: {
      demographics: 'Meta ha ritirato i dati demografici delle Pagine Facebook (genere, età, città) dalle API. Restano visibili solo in Meta Business Suite.',
    },
    warnings,
    currentFollowers: page.followers_count ?? null,
    accountLabel: page.name || null,
  };
}
