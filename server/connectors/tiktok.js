// TikTok Display API v2. Serve un token utente con user.info.stats e video.list.
// L'API dà solo valori correnti (follower, visualizzazioni totali per video):
// lo storico dei follower si costruisce con le istantanee salvate a ogni lettura.
import { getJson, dailyFromPosts } from './common.js';

const API = 'https://open.tiktokapis.com/v2';
const P = 'TikTok';

const bucket = (sec) => (sec < 15 ? 'Video breve' : sec <= 60 ? 'Video medio' : 'Video lungo');

export async function fetchTiktok(conn, from, to) {
  const headers = { Authorization: `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json' };
  const info = await getJson(P, `${API}/user/info/?fields=display_name,follower_count`, { headers });
  const user = info.data?.user || {};

  const posts = [];
  let cursor;
  let more = true;
  const fields = 'id,title,video_description,create_time,share_url,duration,view_count,like_count,comment_count,share_count';
  while (more) {
    const res = await getJson(P, `${API}/video/list/?fields=${fields}`, {
      method: 'POST', headers, body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
    });
    const videos = res.data?.videos || [];
    let reachedStart = false;
    for (const v of videos) {
      const date = new Date(v.create_time * 1000).toISOString().slice(0, 10);
      if (date > to) continue;
      if (date < from) { reachedStart = true; break; }
      posts.push({
        id: v.id,
        date,
        format: bucket(v.duration || 0),
        durationSec: v.duration,
        caption: (v.title || v.video_description || '').slice(0, 140) || 'Video senza descrizione',
        permalink: v.share_url,
        views: v.view_count ?? 0,
        reach: null,
        likes: v.like_count ?? 0,
        comments: v.comment_count ?? 0,
        shares: v.share_count ?? 0,
        saves: null,
      });
    }
    more = Boolean(res.data?.has_more) && !reachedStart;
    cursor = res.data?.cursor;
  }

  return {
    daily: dailyFromPosts(from, to, posts),
    posts,
    demographics: null,
    unavailable: {
      demographics: 'La TikTok Display API non fornisce genere, età e luogo del pubblico. Servono le API TikTok for Business (accesso su richiesta).',
      gainedLost: 'TikTok fornisce solo il totale dei follower: si vede la variazione netta, non chi è entrato e chi è uscito.',
    },
    warnings: ['Le visualizzazioni di TikTok sono il totale di ogni video ad oggi, attribuito al giorno di pubblicazione.'],
    currentFollowers: user.follower_count ?? null,
    accountLabel: user.display_name || null,
  };
}
