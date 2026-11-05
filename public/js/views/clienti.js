// Elenco clienti: aggiunta, modifica, collegamento agli account reali, eliminazione.
import { api, esc, state, initials, openDialog, closeButton, confirmDialog, toast, PLATFORM_LABEL, platformLetter } from '../lib.js';

const ACCOUNT_ID_HELP = {
  instagram: 'ID utente Instagram professionale (numerico, da Meta Business Suite o Graph API Explorer).',
  facebook: 'ID della Pagina Facebook (numerico).',
  tiktok: null,
};
const SOURCE = { meta: 'con il login Meta', tiktok: 'con il login TikTok', manuale: 'con token inserito a mano' };

let oauthStatus = null;
let refreshOnFocus = () => {};
const getOauthStatus = async () => (oauthStatus ??= await api('/api/oauth/status').catch(() => ({ meta: {}, tiktok: {} })));

function connLine(c, p) {
  const info = c.connection?.[p];
  if (!info) return `<span class="conn-state"><span class="mark" aria-hidden="true"></span>${PLATFORM_LABEL[p]}: dati demo${c.handles[p] ? ` · ${esc(c.handles[p])}` : ''}</span>`;
  const expired = info.expiresAt && Date.parse(info.expiresAt) < Date.now() && !info.autoRefresh;
  return `<span class="conn-state on"><span class="mark" aria-hidden="true"></span>${PLATFORM_LABEL[p]}: ${expired ? 'token scaduto' : 'collegato'}${info.accountLabel || c.handles[p] ? ` · ${esc(info.accountLabel || c.handles[p])}` : ''}</span>`;
}

// Guide nella scheda del cliente: link diretti ai portali e valori da copiare, per non cercarli altrove.
const copyBtn = (text, label = 'Copia') => `<button type="button" class="button button-outline button-small" data-copy-text="${esc(text)}">${label}</button>`;
const copyRow = (text) => `<div class="copy-row"><code>${esc(text)}</code>${copyBtn(text)}</div>`;
const ext = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
const metaApp = (st) => `https://developers.facebook.com/apps/${st.meta?.appId ? `${encodeURIComponent(st.meta.appId)}/` : ''}`;
const explorerUrl = (st) => `https://developers.facebook.com/tools/explorer/?method=GET&path=${encodeURIComponent('me/accounts?fields=id,name,access_token,instagram_business_account{id,username}')}&version=${encodeURIComponent(st.meta?.graphVersion || 'v25.0')}`;
const RESTART = '<li>Dopo ogni modifica al file <code>.env</code> riavvia Habitat.</li>';

function setupGuide(p, st) {
  if (p === 'facebook') {
    return '<p class="note-muted">Facebook usa la stessa app Meta di Instagram: la guida è nel blocco Instagram.</p>';
  }
  if (p === 'instagram') {
    const scopes = (st.meta?.scopes || []).join(', ');
    return `<details class="manual guide"><summary>Guida: configurare l'app Meta (una volta per tutti i clienti)</summary><div>
      <ol class="guide-steps">
        <li>Apri ${ext(metaApp(st), 'la tua app Meta')}. In <strong>Casi d'uso</strong> aggiungi quello per gestire la Pagina e quello per Instagram con login Facebook.</li>
        <li>In ogni caso d'uso apri <strong>Personalizza → Autorizzazioni</strong> e aggiungi questi permessi:${copyRow(scopes)}</li>
        <li>In <strong>Facebook Login for Business → Impostazioni</strong>, tra gli URI di reindirizzamento OAuth validi, incolla:${copyRow(st.meta?.redirectUri || '')}</li>
        <li>ID app e chiave segreta sono in ${ext(`${metaApp(st)}settings/basic/`, 'Impostazioni app → Di base')}: vanno in <code>META_APP_ID</code> e <code>META_APP_SECRET</code> nel file <code>.env</code>.</li>
        ${RESTART}
      </ol>
      <p class="note-muted">In modalità sviluppo può accedere solo chi ha un ruolo nell'app (${ext(`${metaApp(st)}roles/roles/`, "Ruoli dell'app")}). Per i clienti esterni Meta chiede la verifica dell'attività e la revisione dei permessi.</p>
    </div></details>`;
  }
  const scopes = (st.tiktok?.scopes || []).join(', ');
  return `<details class="manual guide"><summary>Guida: configurare l'app TikTok (una volta per tutti i clienti)</summary><div>
    <ol class="guide-steps">
      <li>Apri ${ext('https://developers.tiktok.com/apps/', 'le tue app TikTok')} e passa alla <strong>Sandbox</strong>. Aggiungi <strong>Login Kit</strong> e <strong>Display API</strong> con questi scope:${copyRow(scopes)}</li>
      <li>In Login Kit scegli la piattaforma <strong>Desktop</strong> e come Redirect URI incolla:${copyRow(st.tiktok?.redirectUri || '')}</li>
      <li>In <strong>Target users</strong> aggiungi l'account TikTok del cliente: in sandbox possono accedere solo quelli.</li>
      <li>Client key e Client secret della sandbox vanno in <code>TIKTOK_CLIENT_KEY</code> e <code>TIKTOK_CLIENT_SECRET</code> nel file <code>.env</code>. Premi <strong>Save</strong> sul portale.</li>
      ${RESTART}
    </ol>
  </div></details>`;
}

function manualSteps(p, st) {
  if (p === 'tiktok') return '<p class="note-muted">TikTok dà i token solo dopo il login: usa il pulsante qui sopra. Questi campi servono se hai già token e refresh token ottenuti altrove.</p>';
  const field = p === 'instagram'
    ? '<code>access_token</code> della Pagina (inizia con EAA) e il numero in <code>instagram_business_account.id</code>'
    : '<code>access_token</code> e <code>id</code> della Pagina';
  return `<ol class="guide-steps">
    <li>Apri ${ext(explorerUrl(st), 'Graph API Explorer')}, già pronto sulla richiesta giusta. Scegli la tua app, <strong>Token utente</strong>, aggiungi i permessi della guida e premi <strong>Generate Access Token</strong>.</li>
    <li>Quel token scade in circa un'ora. Incollalo nel ${ext('https://developers.facebook.com/tools/debug/accesstoken/', 'Debugger dei token')}, premi <strong>Estendi token di accesso</strong> e rimetti nell'Explorer il token esteso.</li>
    <li>Premi <strong>Invia</strong>. Dalla risposta copia qui sotto ${field}. Così il token della Pagina non scade.</li>
  </ol>`;
}

function bindCopy(root) {
  root.querySelectorAll('[data-copy-text]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copyText); toast('Copiato.'); }
    catch { toast('Copia non riuscita: seleziona il testo e premi Ctrl+C.'); }
  }));
}

export async function renderClienti(main) {
  const draw = () => {
    const rows = state.clients.map((c) => `
      <li class="client-row">
        <span class="monogram" aria-hidden="true">${esc(initials(c.name))}</span>
        <div>
          <div class="name">${esc(c.name)} <span class="swatches" title="Colori del cliente">${Object.values(c.brand.colors).map((x) => `<i style="background:${esc(x)}"></i>`).join('')}</span></div>
          <div class="meta">${Object.keys(PLATFORM_LABEL).map((p) => connLine(c, p)).join('')}</div>
        </div>
        <div class="actions">
          <a class="button button-outline button-small" href="#/cliente/${encodeURIComponent(c.id)}/panoramica">Apri</a>
          <a class="button button-outline button-small" href="#/cliente/${encodeURIComponent(c.id)}/studio/stile">Stile</a>
          <button type="button" class="button button-outline button-small" data-edit="${esc(c.id)}">Modifica e collega</button>
          <button type="button" class="button button-outline button-small" data-invite="${esc(c.id)}">Link per il cliente</button>
          <button type="button" class="button button-ghost button-small button-danger" data-delete="${esc(c.id)}">Elimina</button>
        </div>
      </li>`).join('');

    main.innerHTML = `
      <div class="page-heading">
        <div><p class="eyebrow">Studio · ${state.clients.length === 1 ? '1 cliente' : `${state.clients.length} clienti`}</p><h1>Clienti<br><em>e account collegati.</em></h1>
          <p class="heading-copy">Collega Instagram, Facebook e TikTok per passare dai dati demo a quelli reali.</p></div>
        <button type="button" class="button button-accent" id="new-client"><span class="button-icon plus-icon" aria-hidden="true"></span>Nuovo cliente</button>
      </div>
      ${state.clients.length ? `<ul class="client-rows">${rows}</ul>` : `
        <div class="state"><h2>Nessun cliente</h2><p>Aggiungi il primo cliente per vedere le sue analisi, preparare i report e creare i suoi contenuti.</p>
        <button type="button" class="button button-dark" data-new>Aggiungi cliente</button></div>`}`;

    main.querySelector('#new-client').addEventListener('click', () => editClient(null, draw));
    main.querySelector('[data-new]')?.addEventListener('click', () => editClient(null, draw));
    main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editClient(state.client(b.dataset.edit), draw)));
    main.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => inviteDialog(state.client(b.dataset.invite))));
    main.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
      const c = state.client(b.dataset.delete);
      const ok = await confirmDialog({
        title: `Eliminare ${c.name}?`,
        text: 'Verranno eliminati il cliente, i suoi collegamenti, i progetti grafici, i file caricati e i contenuti programmati. Gli appuntamenti restano in calendario, senza cliente associato.',
        confirm: 'Elimina cliente',
      });
      if (!ok) return;
      try {
        await api(`/api/clients/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
        if (state.currentId === c.id) state.currentId = null;
        await state.refreshClients();
        window.dispatchEvent(new Event('counts'));
        toast(`${c.name} eliminato.`);
        draw();
      } catch (e) { toast(e.message); }
    }));
  };

  draw();
  // Un cliente può collegarsi da un link mentre la pagina è aperta: al ritorno sulla scheda si aggiorna.
  window.removeEventListener('focus', refreshOnFocus);
  refreshOnFocus = async () => {
    if (!location.hash.startsWith('#/clienti') || document.querySelector('dialog[open]')) return;
    await state.refreshClients().catch(() => {});
    draw();
  };
  window.addEventListener('focus', refreshOnFocus);
  if (state.openNewClient) {
    state.openNewClient = false;
    editClient(null, draw);
  }
  if (state.pendingMetaPick) {
    const id = state.pendingMetaPick;
    state.pendingMetaPick = null;
    pickMetaAccounts(id, draw);
  }
}

async function editClient(client, onDone) {
  let conns = { instagram: {}, facebook: {}, tiktok: {} };
  const status = await getOauthStatus();
  if (client) {
    try { conns = await api(`/api/clients/${encodeURIComponent(client.id)}/connections`); } catch (e) { toast(e.message); return; }
  }
  const cid = client ? encodeURIComponent(client.id) : '';
  const loginButton = (p) => {
    if (!client) return '<p class="note-muted">Salva il cliente, poi riapri questa finestra per collegarlo con il login.</p>';
    if (p === 'tiktok') {
      return status.tiktok?.configured
        ? `<a class="button button-dark button-small" href="/oauth/tiktok/start?client=${cid}">${conns.tiktok.hasToken ? 'Ricollega con TikTok' : 'Collega con TikTok'}</a>`
        : '<p class="note-muted">Login TikTok non configurato: servono TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nel file .env. Apri la guida qui sotto.</p>';
    }
    const igOnly = p === 'instagram' && status.instagram?.configured
      ? `<a class="button button-dark button-small" href="/oauth/instagram/start?client=${cid}">${conns.instagram.hasToken ? 'Ricollega con Instagram' : 'Collega con Instagram'}</a><span class="note-muted">Senza Pagina Facebook: basta l'account Instagram professionale.</span> `
      : '';
    return igOnly + (status.meta?.configured
      ? `<a class="button button-dark button-small" href="/oauth/meta/start?client=${cid}">${conns[p].hasToken ? 'Ricollega con Meta' : 'Collega con Meta'}</a><span class="note-muted">Un solo login collega Pagina Facebook e Instagram.</span>`
      : '<p class="note-muted">Login Meta non configurato: servono META_APP_ID e META_APP_SECRET nel file .env. Apri la guida nel blocco Instagram.</p>');
  };
  const connBlock = (p) => {
    const info = client?.connection?.[p];
    return `
    <div class="conn-block">
      <h3>${platformLetter(p)}${PLATFORM_LABEL[p]} <span class="note-muted">${info ? `collegato ${SOURCE[info.source] || ''}${info.accountLabel ? ` · ${esc(info.accountLabel)}` : ''}` : 'non collegato, dati demo'}</span></h3>
      <label class="field"><span>Nome profilo</span><input type="text" name="handle-${p}" maxlength="80" value="${esc(client?.handles?.[p] || '')}" placeholder="@nomeprofilo"></label>
      <div class="conn-actions">${loginButton(p)}</div>
      ${setupGuide(p, status)}
      <details class="manual"><summary>Inserisci il token a mano</summary><div>
        ${manualSteps(p, status)}
        ${ACCOUNT_ID_HELP[p] ? `<label class="field"><span>ID account</span><input type="text" name="id-${p}" inputmode="numeric" value="${esc(conns[p].accountId || '')}" placeholder="Es. 17841400000000000"><small>${esc(ACCOUNT_ID_HELP[p])}</small></label>` : ''}
        <label class="field"><span>Access token</span><input type="password" name="token-${p}" autocomplete="off" placeholder="${conns[p].hasToken ? 'Salvato. Lascia vuoto per non cambiarlo' : 'Incolla il token per usare i dati reali'}"></label>
        ${p === 'tiktok' ? '<label class="field"><span>Refresh token <small>(facoltativo, per il rinnovo automatico)</small></span><input type="password" name="refresh-tiktok" autocomplete="off"></label>' : ''}
      </div></details>
      ${conns[p].hasToken ? `<label class="check-option"><input type="checkbox" name="clear-${p}"> Scollega e torna ai dati demo</label>` : ''}
    </div>`;
  };

  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Cliente</p><h2 id="cl-title">${client ? `Modifica ${esc(client.name)}` : 'Nuovo cliente'}</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <label class="field"><span>Nome del cliente</span><input type="text" name="name" maxlength="80" required value="${esc(client?.name || '')}" placeholder="Nome dell'attività"></label>
        <p class="note-muted">I token restano salvati solo su questo computer (cartella data/) e non vengono mai mostrati nel browser.</p>
        ${Object.keys(PLATFORM_LABEL).map(connBlock).join('')}
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot">
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="submit" class="button button-accent">${client ? 'Salva modifiche' : 'Aggiungi cliente'}</button>
      </div>
    </form>`, { labelledBy: 'cl-title' });

  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  bindCopy(dlg);
  form.elements.name.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = form.elements.name.value.trim();
    if (!name) { err.textContent = 'Scrivi il nome del cliente.'; err.hidden = false; form.elements.name.focus(); return; }
    const handles = {};
    const connections = {};
    for (const p of Object.keys(PLATFORM_LABEL)) {
      handles[p] = form[`handle-${p}`].value.trim();
      const token = form[`token-${p}`].value.trim();
      const id = form[`id-${p}`]?.value.trim() ?? '';
      const refresh = form[`refresh-${p}`]?.value.trim() || '';
      if (form[`clear-${p}`]?.checked) { connections[p] = { clear: true }; continue; }
      if (token && ACCOUNT_ID_HELP[p] && !id) { err.textContent = `Per collegare ${PLATFORM_LABEL[p]} serve anche l'ID account.`; err.hidden = false; return; }
      if (token || refresh || id !== (conns[p].accountId || '')) connections[p] = { accountId: id, accessToken: token, ...(refresh ? { refreshToken: refresh } : {}) };
    }
    try {
      const saved = await api(client ? `/api/clients/${encodeURIComponent(client.id)}` : '/api/clients', { method: client ? 'PUT' : 'POST', body: { name, handles, connections } });
      await state.refreshClients();
      dlg.close();
      toast(client ? 'Cliente aggiornato.' : `${saved.name} aggiunto. Riapri "Modifica e collega" per collegare gli account.`);
      onDone();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

// Dopo il login Meta: si sceglie quale Pagina usare per Facebook e quale account per Instagram.
async function pickMetaAccounts(pendingId, onDone) {
  let data;
  try { data = await api(`/api/oauth/meta/pending/${encodeURIComponent(pendingId)}`); } catch (e) { toast(e.message); return; }
  const client = state.client(data.clientId);
  const withIg = data.pages.filter((p) => p.instagram);
  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Login Meta riuscito</p><h2 id="mp-title">Quali account usare${client ? ` per ${esc(client.name)}` : ''}?</h2></div>${closeButton}</div>
      <div class="dlg-body">
        ${data.pages.length ? '' : '<p>Il profilo che ha fatto il login non gestisce nessuna Pagina Facebook. Serve una Pagina, e per Instagram un account professionale collegato a quella Pagina.</p>'}
        <fieldset class="field"><legend>Pagina Facebook</legend><div class="check-grid two">
          <label class="check-option"><input type="radio" name="fb" value="" ${data.pages.length ? '' : 'checked'}>Non collegare</label>
          ${data.pages.map((p, i) => `<label class="check-option"><input type="radio" name="fb" value="${esc(p.id)}" ${i === 0 ? 'checked' : ''}>${esc(p.name)}</label>`).join('')}
        </div></fieldset>
        <fieldset class="field"><legend>Account Instagram</legend><div class="check-grid two">
          <label class="check-option"><input type="radio" name="ig" value="" ${withIg.length ? '' : 'checked'}>Non collegare</label>
          ${withIg.map((p, i) => `<label class="check-option"><input type="radio" name="ig" value="${esc(p.id)}" ${i === 0 ? 'checked' : ''}>@${esc(p.instagram.username)} <span class="muted">(${esc(p.name)})</span></label>`).join('')}
        </div>${withIg.length ? '' : '<p class="note-muted">Nessuna Pagina ha un account Instagram professionale collegato.</p>'}</fieldset>
        <label class="field"><span>Cliente</span><select name="clientId">${state.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === data.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="dlg-foot">
        <button type="button" class="button button-outline" data-close>Annulla</button>
        <button type="submit" class="button button-accent">Collega gli account scelti</button>
      </div>
    </form>`, { labelledBy: 'mp-title' });
  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    try {
      const r = await api(`/api/oauth/meta/pending/${encodeURIComponent(pendingId)}`, {
        method: 'POST', body: { clientId: form.clientId.value, facebookPageId: form.fb.value, instagramPageId: form.ig.value },
      });
      await state.refreshClients();
      dlg.close();
      toast(`Collegato: ${r.saved.map((p) => PLATFORM_LABEL[p]).join(' e ')}. Le analisi ora usano i dati reali.`);
      onDone();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

// Link da mandare al cliente: lo apre dal suo telefono, fa l'accesso e i canali si collegano qui.
const INVITE_LABEL = { meta: 'Facebook e Instagram', instagram: 'Solo Instagram', tiktok: 'TikTok' };
const longDay = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });

async function inviteDialog(client) {
  const status = await getOauthStatus();
  const cid = encodeURIComponent(client.id);
  const options = Object.keys(INVITE_LABEL).map((k) => ({ k, on: Boolean(status[k]?.configured) }));
  const dlg = openDialog(`
    <form novalidate>
      <div class="dlg-head"><div><p class="eyebrow">Collegamento a distanza</p><h2 id="inv-title">Link per ${esc(client.name)}</h2></div>${closeButton}</div>
      <div class="dlg-body">
        <p>Manda il link al cliente: fa l'accesso con i suoi account e i canali si collegano qui. Il link vale 7 giorni e non mostra nient'altro dell'app.</p>
        ${status.publicUrl ? '' : '<p class="note-muted invite-local">Per ora il link si apre solo da questo computer. Perché il cliente lo apra dal suo telefono, Habitat deve essere raggiungibile da internet: vedi "Link per il cliente" in COLLEGAMENTI.md.</p>'}
        <fieldset class="field"><legend>Canali da collegare</legend><div class="check-grid two">
          ${options.map((o) => `<label class="check-option"><input type="checkbox" name="pf" value="${o.k}" ${o.on ? 'checked' : 'disabled'}><span>${INVITE_LABEL[o.k]}${o.on ? '' : '<br><span class="muted">Login non configurato</span>'}</span></label>`).join('')}
        </div></fieldset>
        <div class="conn-actions"><button type="submit" class="button button-dark button-small" ${options.some((o) => o.on) ? '' : 'disabled'}>Crea link</button></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="invite-list" aria-live="polite"></div>
      </div>
      <div class="dlg-foot"><button type="button" class="button button-accent" data-close>Fatto</button></div>
    </form>`, { labelledBy: 'inv-title' });
  const form = dlg.querySelector('form');
  const err = dlg.querySelector('.form-error');
  const list = dlg.querySelector('.invite-list');

  const draw = async (highlight = null) => {
    let items;
    try { items = await api(`/api/clients/${cid}/invites`); } catch (e) { list.textContent = e.message; return; }
    list.innerHTML = items.length ? `<h3 class="invite-head">Link attivi</h3>${items.slice().reverse().map((x) => `
      <div class="invite-item">
        <label class="field"><span>${x.platforms.map((p) => INVITE_LABEL[p]).join(' e ')} · fino al ${longDay.format(new Date(x.expiresAt))}</span>
          <input type="text" readonly value="${esc(x.url)}" data-url></label>
        <p class="note-muted">${x.platforms.map((p) => `${INVITE_LABEL[p]}: ${x.used[p] ? 'collegato' : 'in attesa'}`).join(' · ')}</p>
        <div class="conn-actions">
          <button type="button" class="button button-outline button-small" data-copy="${esc(x.url)}">Copia link</button>
          <a class="button button-outline button-small" href="${esc(x.url)}" target="_blank" rel="noopener">Apri</a>
          <button type="button" class="button button-ghost button-small button-danger" data-revoke="${esc(x.id)}">Annulla link</button>
        </div>
      </div>`).join('')}` : '';
    list.querySelectorAll('[data-url]').forEach((i) => i.addEventListener('focus', () => i.select()));
    list.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('Link copiato: incollalo in un messaggio al cliente.'); }
      catch { b.closest('.invite-item').querySelector('[data-url]').select(); toast('Copia non riuscita: il link è selezionato, premi Ctrl+C.'); }
    }));
    list.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/invites/${encodeURIComponent(b.dataset.revoke)}`, { method: 'DELETE' }); toast('Link annullato: non si apre più.'); draw(); }
      catch (e) { toast(e.message); }
    }));
    if (highlight) list.querySelector('[data-url]')?.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const platforms = [...form.querySelectorAll('[name="pf"]:checked')].map((i) => i.value);
    if (!platforms.length) { err.textContent = 'Scegli almeno un canale.'; err.hidden = false; return; }
    try {
      await api(`/api/clients/${cid}/invites`, { method: 'POST', body: { platforms } });
      await draw(true);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  draw();
}
