---
name: collega-account
description: Guida per collegare gli account Instagram, Facebook e TikTok di un cliente ai dati reali (token, ID account, permessi) e per risolvere gli errori dei connettori. Usala quando chiedono di collegare un account, passare dai dati demo ai dati reali, o quando un canale collegato mostra errori o dati mancanti.
---

# Collegare un account ai dati reali

Guida per l'utente: COLLEGAMENTI.md nella radice del progetto. Il modo consigliato è il login ufficiale (Clienti, Modifica e collega, Collega con Meta o Collega con TikTok), gestito in `server/oauth.js`: richiede `META_APP_ID` e `META_APP_SECRET`, `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` in `.env`. Dopo il login Meta l'utente sceglie Pagina e account Instagram (scelta tenuta in memoria per 15 minuti, token mai inviati al browser). TikTok usa PKCE (challenge SHA-256 in esadecimale come da documentazione TikTok, da verificare con un'app reale) e il token si rinnova da solo in `freshConnection`.

In alternativa i token si inseriscono a mano nella stessa finestra, sotto "Inserisci il token a mano". Restano in `data/db.json` e non arrivano mai al browser. Un canale senza token mostra dati demo etichettati.

## Instagram (Instagram Graph API)

Requisiti: account Instagram **Business o Creator** collegato a una Pagina Facebook.

1. Crea un'app su developers.facebook.com (tipo "Business").
2. Aggiungi il prodotto "Instagram Graph API" / "Facebook Login for Business".
3. Permessi: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`.
4. Da Graph API Explorer genera un token utente, poi trasformalo in token di lunga durata (60 giorni) o usa un token di System User (non scade) da Meta Business Suite.
5. ID account: `GET /me/accounts` → Pagina → `GET /{page-id}?fields=instagram_business_account`. Il numero che torna è l'**ID account** da incollare.

Limiti noti (gestiti dal connettore, mostrati all'utente):
- nuovi follower giornalieri solo per gli ultimi 30 giorni; i follower persi non sono esposti;
- dati demografici solo con almeno 100 follower;
- lo storico dei follower totali si costruisce dal giorno del collegamento (istantanee giornaliere in `db.snapshots`).

## Facebook (Pages API)

1. Stessa app Meta. Permessi: `pages_read_engagement`, `read_insights`.
2. Serve un **Page Access Token** (da `GET /me/accounts`, campo `access_token` della Pagina).
3. ID account = ID numerico della Pagina.

Meta ha ritirato i dati demografici delle Pagine e diverse metriche giornaliere: il connettore tratta ogni metrica come facoltativa e trasforma gli errori in avvisi visibili.

## TikTok (Display API v2)

1. App su developers.tiktok.com con "Login Kit" e "Display API".
2. Scope: `user.info.basic`, `user.info.stats`, `video.list`.
3. Il cliente autorizza l'app (OAuth), ottieni l'access token utente. Dura 24 ore: Habitat lo rinnova da solo con il refresh token.
4. Non serve un ID account.

Limiti: niente dati demografici, niente nuovi/persi, visualizzazioni totali per video attribuite al giorno di pubblicazione.

## Risolvere errori

- Il messaggio mostrato in pagina arriva da `ConnectorError` in `server/connectors/common.js` ed è il testo restituito dalla piattaforma.
- "Invalid OAuth access token" / "Session has expired": token scaduto, incollane uno nuovo.
- "(#100) ... metric": il nome di una metrica è cambiato. Aggiorna la chiamata nel connettore e verifica con Graph API Explorer. La versione Graph API si cambia con `META_GRAPH_VERSION` nel file `.env` (predefinita v25.0, vedi `graphBase` in `connectors/common.js`).
- Prova un connettore isolato: `node -e "import('./server/connectors/instagram.js').then(m=>m.fetchInstagram({accountId:'ID',accessToken:'TOKEN'},'2026-10-01','2026-10-07')).then(r=>console.log(JSON.stringify(r,null,1).slice(0,3000)))"`. Non incollare token reali in file versionati o in chat condivise.
- Dopo una modifica: `npm run check` e controlla che la forma restituita rispetti il contratto in CLAUDE.md.
