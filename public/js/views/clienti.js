// Elenco clienti: aggiunta, modifica, collegamento agli account reali, eliminazione.
import { api, esc, state, initials, openDialog, closeButton, confirmDialog, toast, PLATFORM_LABEL, platformLetter } from '../lib.js';

const ACCOUNT_ID_HELP = {
  instagram: 'ID utente Instagram professionale (numerico, da Meta Business Suite o Graph API Explorer).',
  facebook: 'ID della Pagina Facebook (numerico).',
  tiktok: null,
};
const SOURCE = { meta: 'con il login Meta', tiktok: 'con il login TikTok', manuale: 'con token inserito a mano' };

let oauthStatus = null;
const getOauthStatus = async () => (oauthStatus ??= await api('/api/oauth/status').catch(() => ({ meta: {}, tiktok: {} })));

function connLine(c, p) {
  const info = c.connection?.[p];
  if (!info) return `<span class="conn-state"><span class="mark" aria-hidden="true"></span>${PLATFORM_LABEL[p]}: dati demo${c.handles[p] ? ` · ${esc(c.handles[p])}` : ''}</span>`;
  const expired = info.expiresAt && Date.parse(info.expiresAt) < Date.now() && !info.autoRefresh;
  return `<span class="conn-state on"><span class="mark" aria-hidden="true"></span>${PLATFORM_LABEL[p]}: ${expired ? 'token scaduto' : 'collegato'}${info.accountLabel || c.handles[p] ? ` · ${esc(info.accountLabel || c.handles[p])}` : ''}</span>`;
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
        : '<p class="note-muted">Login TikTok non configurato: servono TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nel file .env (guida in COLLEGAMENTI.md).</p>';
    }
    return status.meta?.configured
      ? `<a class="button button-dark button-small" href="/oauth/meta/start?client=${cid}">${conns[p].hasToken ? 'Ricollega con Meta' : 'Collega con Meta'}</a><span class="note-muted">Un solo login collega Pagina Facebook e Instagram.</span>`
      : '<p class="note-muted">Login Meta non configurato: servono META_APP_ID e META_APP_SECRET nel file .env (guida in COLLEGAMENTI.md).</p>';
  };
  const connBlock = (p) => {
    const info = client?.connection?.[p];
    return `
    <div class="conn-block">
      <h3>${platformLetter(p)}${PLATFORM_LABEL[p]} <span class="note-muted">${info ? `collegato ${SOURCE[info.source] || ''}${info.accountLabel ? ` · ${esc(info.accountLabel)}` : ''}` : 'non collegato, dati demo'}</span></h3>
      <label class="field"><span>Nome profilo</span><input type="text" name="handle-${p}" maxlength="80" value="${esc(client?.handles?.[p] || '')}" placeholder="@nomeprofilo"></label>
      <div class="conn-actions">${loginButton(p)}</div>
      <details class="manual"><summary>Inserisci il token a mano</summary><div>
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
