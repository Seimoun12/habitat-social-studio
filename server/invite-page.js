// Pagina pubblica del link di collegamento: l'unica parte di Habitat che il cliente vede.
// HTML scritto dal server, senza script: funziona anche da un telefono qualsiasi.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const day = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

const OUTCOME = {
  'meta-collegato': ['ok', 'Facebook e Instagram sono collegati. Grazie!'],
  'tiktok-collegato': ['ok', 'TikTok è collegato. Grazie!'],
  'meta-annullato': ['info', "Hai annullato l'accesso a Facebook. Puoi riprovare quando vuoi."],
  'tiktok-annullato': ['info', "Hai annullato l'accesso a TikTok. Puoi riprovare quando vuoi."],
  'meta-errore': ['err', 'Il collegamento con Facebook non è riuscito. Riprova, e se succede ancora avvisa chi ti ha mandato il link.'],
  'tiktok-errore': ['err', 'Il collegamento con TikTok non è riuscito. Riprova, e se succede ancora avvisa chi ti ha mandato il link.'],
  'meta-non-configurato': ['err', 'Il collegamento con Facebook non è ancora attivo. Avvisa chi ti ha mandato il link.'],
  'tiktok-non-configurato': ['err', 'Il collegamento con TikTok non è ancora attivo. Avvisa chi ti ha mandato il link.'],
  'stato-non-valido': ['info', 'La richiesta è scaduta. Riprova dal pulsante qui sotto.'],
  'cliente-non-trovato': ['err', 'Questo link non corrisponde più a nessun profilo. Chiedi un link nuovo.'],
};

const CSS = `
@font-face { font-family: 'DM Sans'; font-weight: 400; src: url(/fonts/dm-sans/dm-sans-latin-400-normal.woff2) format('woff2'); }
@font-face { font-family: 'DM Sans'; font-weight: 700; src: url(/fonts/dm-sans/dm-sans-latin-700-normal.woff2) format('woff2'); }
@font-face { font-family: 'Playfair Display'; font-weight: 500; src: url(/fonts/playfair-display/playfair-display-latin-500-normal.woff2) format('woff2'); }
:root { color-scheme: light; --ink: #17231f; --muted: #5d6b63; --forest: #173a32; --leaf: #c8ec68; --leaf-hover: #b9e250; --paper: #f6f7f0; --line: #dfe5db; --focus: #3c795d; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--paper); color: var(--ink); font: 15px/1.55 'DM Sans', system-ui, sans-serif; }
header { background: var(--forest); color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: .01em; }
header b { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50% 50% 50% 4px; background: var(--leaf); color: var(--forest); font-size: 14px; }
main { max-width: 560px; margin: 0 auto; padding: 36px 20px 48px; }
.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
h1 { margin: 0 0 14px; font: 500 34px/1.1 'Playfair Display', Georgia, serif; }
h2 { margin: 0 0 4px; font-size: 16px; }
p { margin: 0 0 12px; }
.muted { color: var(--muted); font-size: 13px; }
.card { margin-top: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
.card p { margin-bottom: 14px; }
.button { display: inline-flex; min-height: 44px; align-items: center; padding: 0 18px; border: 0; border-radius: 8px; background: var(--leaf); color: var(--ink); font: 700 14px 'DM Sans', system-ui, sans-serif; text-decoration: none; cursor: pointer; }
.button:hover { background: var(--leaf-hover); }
.button.outline { background: transparent; border: 1px solid #c5cfc4; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.done { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #2f6b3c; }
.done::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: #2f6b3c; }
.note { padding: 12px 14px; border-radius: 10px; margin-bottom: 18px; border: 1px solid; }
.note.ok { background: #eef6e2; border-color: #c9dfae; }
.note.info { background: #f3f5ef; border-color: var(--line); }
.note.err { background: #f8ebe7; border-color: #e8c4ba; color: #6e2c1e; }
fieldset { border: 0; padding: 0; margin: 0 0 16px; }
legend { font-weight: 700; margin-bottom: 8px; }
label { display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 6px; background: #fff; }
input[type=password] { width: 100%; min-height: 44px; padding: 0 12px; margin-bottom: 14px; border: 1px solid #c5cfc4; border-radius: 8px; background: #fff; color: var(--ink); font: 16px 'DM Sans', system-ui, sans-serif; }
.field { display: block; min-height: 0; padding: 0; border: 0; background: none; margin: 0 0 6px; font-weight: 700; }
input[type=radio] { width: 18px; height: 18px; accent-color: var(--forest); }
footer { margin-top: 28px; }
`;

function page(title, body) {
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><header><b aria-hidden="true">h.</b>habitat</header><main>${body}</main></body></html>`;
}

export function expiredPage() {
  return page('Link non più valido', `
    <h1>Link non più valido</h1>
    <p>Il link è scaduto o è stato annullato. Chiedi un link nuovo a chi te l'ha mandato.</p>`);
}

export function invitePage({ invite, client, status, outcome }) {
  const note = OUTCOME[outcome];
  const base = `/oauth/%s/start?invite=${encodeURIComponent(invite.id)}`;
  const card = (key, name, help, platformKey, configured) => {
    const done = invite.used?.[key];
    return `<section class="card">
      <h2>${name}</h2>
      ${done ? '<p class="done">Collegato</p><p class="muted">Se serve, puoi rifare l\'accesso.</p>' : `<p class="muted">${help}</p>`}
      ${configured
        ? `<a class="button${done ? ' outline' : ''}" href="${base.replace('%s', platformKey)}">${done ? 'Accedi di nuovo' : `Accedi con ${key === 'meta' ? 'Facebook' : 'TikTok'}`}</a>`
        : '<p class="muted">Non ancora attivo: avvisa chi ti ha mandato il link.</p>'}
    </section>`;
  };
  const cards = [
    invite.platforms.includes('meta') && card('meta', 'Facebook e Instagram', 'Serve una Pagina Facebook. Per Instagram, un account professionale collegato a quella Pagina: li scegli dopo l\'accesso.', 'meta', status.meta.configured),
    invite.platforms.includes('tiktok') && card('tiktok', 'TikTok', 'Accedi con il profilo TikTok da collegare.', 'tiktok', status.tiktok.configured),
  ].filter(Boolean).join('');
  const where = [invite.platforms.includes('meta') && 'Facebook', invite.platforms.includes('tiktok') && 'TikTok'].filter(Boolean).join(' o su ');
  return page(`Collega i tuoi account · ${client.name}`, `
    <p class="eyebrow">${esc(client.name)}</p>
    <h1>Collega i tuoi account</h1>
    ${note ? `<p class="note ${note[0]}" role="status">${esc(note[1])}</p>` : ''}
    <p>Chi cura i tuoi social ti ha mandato questo link per leggere le statistiche dei tuoi profili e preparare i report.</p>
    <p class="muted">La password la inserisci su ${where}, non qui. Habitat non pubblica nulla sui tuoi profili.</p>
    ${cards}
    <footer><p class="muted">Puoi togliere l'accesso quando vuoi dalle impostazioni di ${where.replace(' o su ', ' o di ')}. Il link vale fino al ${esc(day.format(new Date(invite.expiresAt)))}.</p></footer>`);
}

// Accesso di chi apre Habitat da internet (server/auth.js).
export function loginPage({ error } = {}) {
  return page('Accedi · Habitat', `
    <h1>Accedi a Habitat</h1>
    <p>Spazio di lavoro dello studio. Inserisci la password per continuare.</p>
    ${error ? `<p class="note err" role="alert">${esc(error)}</p>` : ''}
    <form method="post" action="/login" class="card">
      <label class="field" for="password">Password</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required autofocus>
      <button type="submit" class="button">Entra</button>
    </form>`);
}

// Dopo l'accesso a Facebook: quale Pagina e quale account Instagram collegare.
export function metaPickPage({ invite, client, pick, choice, error }) {
  const withIg = pick.pages.filter((p) => p.instagram);
  return page(`Scegli gli account · ${client.name}`, `
    <p class="eyebrow">${esc(client.name)}</p>
    <h1>Quali account collegare?</h1>
    ${error ? `<p class="note err" role="alert">${esc(error)}</p>` : ''}
    ${pick.pages.length ? '' : '<p class="note info">Il profilo con cui hai fatto l\'accesso non gestisce nessuna Pagina Facebook. Serve una Pagina, e per Instagram un account professionale collegato a quella Pagina.</p>'}
    <form method="post" action="/collega/${encodeURIComponent(invite.id)}/meta">
      <input type="hidden" name="scelta" value="${esc(choice)}">
      <fieldset><legend>Pagina Facebook</legend>
        ${pick.pages.map((p, i) => `<label><input type="radio" name="fb" value="${esc(p.id)}" ${i === 0 ? 'checked' : ''}>${esc(p.name)}</label>`).join('')}
        <label><input type="radio" name="fb" value="" ${pick.pages.length ? '' : 'checked'}>Non collegare</label>
      </fieldset>
      <fieldset><legend>Account Instagram</legend>
        ${withIg.map((p, i) => `<label><input type="radio" name="ig" value="${esc(p.id)}" ${i === 0 ? 'checked' : ''}>@${esc(p.instagram.username)}</label>`).join('')}
        <label><input type="radio" name="ig" value="" ${withIg.length ? '' : 'checked'}>Non collegare</label>
        ${withIg.length ? '' : '<p class="muted">Nessuna delle tue Pagine ha un account Instagram professionale collegato.</p>'}
      </fieldset>
      <button type="submit" class="button">Collega gli account scelti</button>
    </form>`);
}
