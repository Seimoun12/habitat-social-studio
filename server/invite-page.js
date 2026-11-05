// Pagina pubblica del link di collegamento: l'unica parte di Habitat che il cliente vede.
// HTML scritto dal server, senza script: funziona anche da un telefono qualsiasi.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const day = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

const OUTCOME = {
  'meta-collegato': ['ok', 'Facebook e Instagram sono collegati. Grazie!'],
  'instagram-collegato': ['ok', 'Instagram è collegato. Grazie!'],
  'tiktok-collegato': ['ok', 'TikTok è collegato. Grazie!'],
  'meta-annullato': ['info', "Hai annullato l'accesso a Facebook. Puoi riprovare quando vuoi."],
  'instagram-annullato': ['info', "Hai annullato l'accesso a Instagram. Puoi riprovare quando vuoi."],
  'tiktok-annullato': ['info', "Hai annullato l'accesso a TikTok. Puoi riprovare quando vuoi."],
  'meta-errore': ['err', 'Il collegamento con Facebook non è riuscito. Riprova, e se succede ancora avvisa chi ti ha mandato il link.'],
  'instagram-errore': ['err', 'Il collegamento con Instagram non è riuscito. Riprova, e se succede ancora avvisa chi ti ha mandato il link.'],
  'tiktok-errore': ['err', 'Il collegamento con TikTok non è riuscito. Riprova, e se succede ancora avvisa chi ti ha mandato il link.'],
  'meta-non-configurato': ['err', 'Il collegamento con Facebook non è ancora attivo. Avvisa chi ti ha mandato il link.'],
  'instagram-non-configurato': ['err', 'Il collegamento con Instagram non è ancora attivo. Avvisa chi ti ha mandato il link.'],
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
.legal h2 { margin: 26px 0 6px; }
.legal ul { margin: 0 0 12px; padding-left: 20px; }
.legal li { margin-bottom: 6px; }
a { color: var(--forest); }
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
        ? `<a class="button${done ? ' outline' : ''}" href="${base.replace('%s', platformKey)}">${done ? 'Accedi di nuovo' : `Accedi con ${{ meta: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }[key]}`}</a>`
        : '<p class="muted">Non ancora attivo: avvisa chi ti ha mandato il link.</p>'}
    </section>`;
  };
  const cards = [
    invite.platforms.includes('meta') && card('meta', 'Facebook e Instagram', 'Per chi ha una Pagina Facebook. Per Instagram, un account professionale collegato a quella Pagina: li scegli dopo l\'accesso.', 'meta', status.meta.configured),
    invite.platforms.includes('instagram') && card('instagram', 'Instagram', 'Accedi con il tuo account Instagram professionale (Business o Creator). Non serve Facebook.', 'instagram', status.instagram.configured),
    invite.platforms.includes('tiktok') && card('tiktok', 'TikTok', 'Accedi con il profilo TikTok da collegare.', 'tiktok', status.tiktok.configured),
  ].filter(Boolean).join('');
  const where = [invite.platforms.includes('meta') && 'Facebook', invite.platforms.includes('instagram') && 'Instagram', invite.platforms.includes('tiktok') && 'TikTok'].filter(Boolean).join(' o su ');
  return page(`Collega i tuoi account · ${client.name}`, `
    <p class="eyebrow">${esc(client.name)}</p>
    <h1>Collega i tuoi account</h1>
    ${note ? `<p class="note ${note[0]}" role="status">${esc(note[1])}</p>` : ''}
    <p>Chi cura i tuoi social ti ha mandato questo link per leggere le statistiche dei tuoi profili e preparare i report.</p>
    <p class="muted">La password la inserisci su ${where}, non qui. Habitat non pubblica nulla sui tuoi profili.</p>
    ${cards}
    <footer><p class="muted">Puoi togliere l'accesso quando vuoi dalle impostazioni di ${where.replace(' o su ', ' o di ')}. Il link vale fino al ${esc(day.format(new Date(invite.expiresAt)))}.</p>${legalConfigured() ? LEGAL_LINKS : ''}</footer>`);
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

// Pagine pubbliche richieste da Meta e TikTok: informativa, termini, eliminazione dei dati.
// Titolare e contatto vengono da LEGAL_OWNER e LEGAL_EMAIL nel file .env: senza, le pagine non esistono.
const LEGAL_LINKS = '<p class="muted"><a href="/privacy">Informativa privacy</a> · <a href="/termini">Termini del servizio</a> · <a href="/elimina-dati">Eliminazione dei dati</a></p>';
export const legalConfigured = () => Boolean(process.env.LEGAL_OWNER && process.env.LEGAL_EMAIL);

export function legalPage(kind) {
  const who = esc(process.env.LEGAL_OWNER);
  const mail = esc(process.env.LEGAL_EMAIL);
  const contact = `<a href="mailto:${mail}">${mail}</a>`;
  const updated = '<p class="muted">Ultimo aggiornamento: 5 novembre 2026.</p>';
  const pages = {
    privacy: ['Informativa sulla privacy', `
      <p>Habitat è lo strumento con cui ${who}, che lavora in proprio, legge le statistiche dei profili social dei suoi clienti per preparare analisi e report. Questa pagina spiega quali dati vengono letti quando autorizzi l'accesso a Instagram, Facebook o TikTok.</p>
      <h2>Titolare del trattamento</h2>
      <p>${who}. Contatto per qualsiasi richiesta: ${contact}.</p>
      <h2>Quali dati vengono letti</h2>
      <ul>
        <li>Il nome e l'identificativo del profilo o della Pagina che colleghi.</li>
        <li>Le statistiche del profilo: follower, copertura, visualizzazioni, interazioni e, quando la piattaforma li fornisce, i dati demografici in forma aggregata.</li>
        <li>I contenuti che hai pubblicato (didascalia, data, link) con le loro statistiche.</li>
        <li>Un codice di accesso rilasciato dalla piattaforma, che resta sul server e non compare mai nel browser né nei report.</li>
        <li>Il numero di follower registrato ogni giorno, a partire dal giorno del collegamento.</li>
      </ul>
      <h2>Cosa Habitat non fa</h2>
      <p>Non legge i messaggi privati, non legge i dati dei singoli follower, non pubblica, non commenta e non mette "mi piace" a nome tuo. Non vende né cede i dati e non li usa per pubblicità o profilazione.</p>
      <h2>Perché e su quale base</h2>
      <p>I dati servono solo a preparare le analisi e i report del tuo profilo. La base è il tuo consenso, che dai autorizzando l'accesso sulla piattaforma e puoi ritirare quando vuoi.</p>
      <h2>Chi vede i dati e per quanto tempo</h2>
      <p>Li vedono il titolare e chi, nello studio, cura i social del cliente. I dati restano finché l'accesso è attivo. Se revochi l'accesso o chiedi la cancellazione, vengono eliminati entro 30 giorni (vedi <a href="/elimina-dati">Eliminazione dei dati</a>).</p>
      <h2>I tuoi diritti</h2>
      <p>Puoi chiedere l'accesso ai dati, la correzione, la cancellazione, la limitazione del trattamento e una copia in formato leggibile scrivendo a ${contact}. Se ritieni che i tuoi diritti non siano rispettati puoi rivolgerti al Garante per la protezione dei dati personali.</p>
      <h2>Le piattaforme</h2>
      <p>Instagram e Facebook (Meta) e TikTok trattano i tuoi dati secondo le loro informative. Habitat riceve da loro solo ciò che autorizzi.</p>`],
    termini: ['Termini del servizio', `
      <p>Questi termini valgono per chi collega un account social a Habitat con il link ricevuto da ${who}.</p>
      <h2>Cos'è il servizio</h2>
      <p>Habitat legge le statistiche dei profili collegati e le usa per analisi e report destinati al titolare del profilo. Non pubblica nulla e non modifica i profili.</p>
      <h2>Chi può collegare un account</h2>
      <p>Solo il titolare del profilo, o chi ha la sua autorizzazione, e solo per profili professionali (Business o Creator) o per le Pagine che gestisce.</p>
      <h2>Cosa autorizzi</h2>
      <p>Autorizzi la sola lettura dei dati descritti nell'<a href="/privacy">informativa sulla privacy</a>. Puoi togliere l'accesso in qualsiasi momento dalle impostazioni della piattaforma, e Habitat smette subito di leggere i dati.</p>
      <h2>Precisione dei numeri</h2>
      <p>I numeri arrivano dalle piattaforme. Quando una piattaforma non fornisce un dato, Habitat lo omette invece di stimarlo. Non si garantisce che i dati siano sempre completi o aggiornati.</p>
      <h2>Responsabilità e modifiche</h2>
      <p>Il servizio è offerto così com'è, senza garanzie di disponibilità continua. Questi termini possono cambiare: la versione in vigore è sempre quella su questa pagina. Vale la legge italiana.</p>
      <h2>Contatti</h2>
      <p>${who}, ${contact}.</p>`],
    'elimina-dati': ['Eliminazione dei dati', `
      <p>Habitat è gestito da ${who}. Puoi interrompere l'accesso e far cancellare i tuoi dati in due passaggi.</p>
      <h2>1. Togli l'accesso dalla piattaforma</h2>
      <ul>
        <li><b>Instagram:</b> nelle impostazioni, sezione "Siti web e app" (o Centro gestione account), rimuovi Habitat.</li>
        <li><b>Facebook:</b> Impostazioni, "App e siti web", rimuovi Habitat.</li>
        <li><b>TikTok:</b> Impostazioni e privacy, sezione delle autorizzazioni delle app, rimuovi Habitat.</li>
      </ul>
      <p>Da quel momento Habitat non può più leggere nulla.</p>
      <h2>2. Chiedi la cancellazione dei dati già conservati</h2>
      <p>Scrivi a ${contact} con oggetto "Eliminazione dati Habitat" e il nome del profilo collegato. Entro 30 giorni vengono cancellati il codice di accesso, le statistiche e lo storico dei follower, e ricevi una conferma per email.</p>`],
  };
  const [title, body] = pages[kind];
  return page(`${title} · Habitat`, `<div class="legal"><h1>${title}</h1>${body}${updated}</div>`);
}
