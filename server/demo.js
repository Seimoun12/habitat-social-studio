// Dati demo deterministici: stesso cliente + canale + giorno = stessi numeri,
// così i periodi che si sovrappongono restano coerenti tra loro.
// Restituisce la stessa forma dei connettori reali (vedi connectors/README in CLAUDE.md).
import { eachDay, diffDays } from './dates.js';

const EPOCH = '2024-01-01';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FORMATS = {
  instagram: [['Reel', 0.45, 2.2], ['Carosello', 0.35, 1.1], ['Foto', 0.2, 0.7]],
  facebook: [['Reel', 0.3, 1.8], ['Foto', 0.35, 0.9], ['Video', 0.15, 1.2], ['Link', 0.2, 0.4]],
  tiktok: [['Video breve', 0.5, 1.4], ['Video medio', 0.35, 1.0], ['Video lungo', 0.15, 0.7]],
};

function profile(clientId, platform) {
  const r = rng(hash(`${clientId}:${platform}:profile`));
  const base = { instagram: 6000, facebook: 3500, tiktok: 9000 }[platform];
  return {
    followers: Math.round(base * (0.4 + r() * 4)),
    growth: 0.0012 + r() * 0.003,
    churn: 0.0006 + r() * 0.0012,
    postEvery: platform === 'tiktok' ? 1.6 + r() * 1.5 : 2 + r() * 2.5,
    reachRatio: platform === 'facebook' ? 0.25 + r() * 0.3 : 0.35 + r() * 0.5,
    likeRate: platform === 'facebook' ? 0.015 + r() * 0.02 : 0.03 + r() * 0.05,
  };
}

function pickFormat(platform, x) {
  let acc = 0;
  for (const f of FORMATS[platform]) {
    acc += f[1];
    if (x <= acc) return f;
  }
  return FORMATS[platform][0];
}

const SHORT_MONTH = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const label = (d) => `${Number(d.slice(8))} ${SHORT_MONTH[Number(d.slice(5, 7)) - 1]}`;

function postsOn(clientId, platform, date, p, followersNow) {
  const r = rng(hash(`${clientId}:${platform}:${date}:posts`));
  const out = [];
  if (r() > 1 / p.postEvery) return out;
  const [format, , mult] = pickFormat(platform, r());
  const luck = Math.exp((r() - 0.5) * 1.6); // dispersione log-normale: pochi post vanno molto meglio
  const views = Math.round(followersNow * p.reachRatio * mult * luck * (1.4 + r()));
  const reach = Math.round(views * (0.55 + r() * 0.3));
  const likes = Math.round(reach * p.likeRate * (0.6 + r() * 0.9) * (luck > 1 ? 1.15 : 0.85));
  const post = {
    id: `${platform}-${date}`,
    date,
    format,
    caption: `Contenuto demo · ${format} del ${label(date)}`,
    permalink: null,
    views,
    reach: platform === 'tiktok' ? null : reach,
    likes,
    comments: Math.round(likes * (0.02 + r() * 0.06)),
    shares: Math.round(likes * (0.03 + r() * 0.12)),
    saves: platform !== 'instagram' ? null : Math.round(likes * (0.04 + r() * 0.1)),
  };
  if (platform === 'tiktok') post.durationSec = format === 'Video breve' ? 8 + Math.round(r() * 6) : format === 'Video medio' ? 16 + Math.round(r() * 40) : 61 + Math.round(r() * 120);
  out.push(post);
  return out;
}

// Restituisce giorni e post nel periodo [from, to], inclusi i giorni precedenti
// necessari al confronto (li sceglie chi chiama passando from già anticipato).
export function demoData(clientId, platform, from, to) {
  const p = profile(clientId, platform);
  const start = from < EPOCH ? from : EPOCH;
  let followers = p.followers;
  const daily = [];
  const posts = [];
  const spread = []; // quote di metriche dei post distribuite sui giorni successivi

  for (const date of eachDay(start, to)) {
    const r = rng(hash(`${clientId}:${platform}:${date}:day`));
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    const weekFactor = weekday === 0 || weekday === 6 ? 0.8 : 1.05;
    const todaysPosts = postsOn(clientId, platform, date, p, followers);
    const postBoost = todaysPosts.reduce((s, x) => s + x.views, 0) / Math.max(followers, 1);

    const gained = Math.round(followers * p.growth * weekFactor * (0.5 + r()) * (1 + postBoost * 0.6));
    const lost = Math.round(followers * p.churn * (0.5 + r()));
    followers += gained - lost;

    // Le metriche dei post maturano in tre giorni: 60% / 25% / 15%.
    for (const post of todaysPosts) {
      spread.push({ day: 0, post });
      if (date >= from) posts.push(post);
    }
    const day = { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    const base = followers * 0.04 * (0.7 + r() * 0.6); // visualizzazioni da contenuti vecchi
    day.views += Math.round(base);
    day.reach += Math.round(base * 0.7);
    day.likes += Math.round(base * p.likeRate * 0.6);
    for (let i = spread.length - 1; i >= 0; i--) {
      const s = spread[i];
      const share = [0.6, 0.25, 0.15][s.day];
      for (const k of Object.keys(day)) day[k] += Math.round((s.post[k] || 0) * share);
      s.day += 1;
      if (s.day > 2) spread.splice(i, 1);
    }
    if (date < from) continue;
    daily.push({
      date,
      followers,
      gained: platform === 'tiktok' ? null : gained,
      lost: platform === 'facebook' ? lost : null,
      views: day.views,
      reach: platform === 'tiktok' ? null : day.reach,
      likes: day.likes,
      comments: day.comments,
      shares: day.shares,
      saves: platform !== 'instagram' ? null : day.saves,
    });
  }

  // La demo rispetta gli stessi limiti delle API reali, così non promette dati che poi mancano.
  let demographics = null;
  const unavailable = {};
  if (platform === 'tiktok') {
    unavailable.demographics = 'La TikTok Display API non fornisce genere, età e luogo del pubblico. Servono le API TikTok for Business (accesso su richiesta).';
    unavailable.gainedLost = 'TikTok fornisce solo il totale dei follower: si vede la variazione netta, non chi è entrato e chi è uscito.';
  } else if (platform === 'facebook') {
    unavailable.demographics = 'Meta ha ritirato i dati demografici delle Pagine Facebook (genere, età, città) dalle API. Restano visibili solo in Meta Business Suite.';
  } else {
    unavailable.gainedLost = 'Instagram indica i nuovi follower (solo per gli ultimi 30 giorni con le API reali) ma non chi ha smesso di seguire.';
    const r = rng(hash(`${clientId}:${platform}:demo`));
    const women = 0.45 + r() * 0.25;
    const unknown = 0.02 + r() * 0.03;
    demographics = {
      gender: [
        { label: 'Donne', value: women },
        { label: 'Uomini', value: 1 - women - unknown },
        { label: 'Non specificato', value: unknown },
      ],
      age: normalise(['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((l, i) => ({
        label: l,
        value: Math.max(0.01, [0.02, 0.18, 0.32, 0.24, 0.13, 0.07, 0.04][i] * (0.6 + r() * 0.8)),
      }))),
      locations: normalise(['Milano', 'Roma', 'Torino', 'Napoli', 'Bologna', 'Firenze', 'Bari', 'Verona'].map((l) => ({
        label: l,
        value: 0.02 + r() * 0.2,
      }))).sort((a, b) => b.value - a.value),
    };
  }

  return { daily, posts, demographics, unavailable, accountLabel: null, days: diffDays(from, to) + 1 };
}

function normalise(rows) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows.map((r) => ({ ...r, value: r.value / total }));
}

export const DEMO_EARLIEST = EPOCH;
