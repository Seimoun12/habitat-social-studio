# Collegare Instagram, Facebook e TikTok

Finché un canale non è collegato, Habitat mostra **dati demo** e lo dice a schermo e nel PDF. Ci sono due modi per collegare un cliente: il **login ufficiale** (consigliato) o il **token inserito a mano**. Entrambi si trovano in **Clienti → Modifica e collega**.

I token restano in `data/db.json` su questo computer e non arrivano mai al browser. Non condividere la cartella `data/`.

## Login Meta (Facebook e Instagram insieme)

Un solo login collega la Pagina Facebook e l'account Instagram professionale collegato a quella Pagina.

1. Crea un'app su [Meta for Developers](https://developers.facebook.com/) di tipo **Business** e aggiungi il prodotto **Facebook Login for Business**.
2. Tra i redirect OAuth validi registra `http://localhost:3000/oauth/meta/callback` (cambia la porta se usi un'altra `PORT`). In modalità sviluppo Meta accetta `localhost`.
3. Copia `.env.example` in `.env` e compila `META_APP_ID`, `META_APP_SECRET` e `META_GRAPH_VERSION` (una versione ancora attiva: a ottobre 2026 v25.0 o v26.0).
4. Riavvia con `npm start`, apri il cliente in **Clienti → Modifica e collega** e premi **Collega con Meta**.
5. Dopo il login Habitat chiede quale Pagina usare per Facebook e quale account per Instagram.

Permessi richiesti: `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management`. In modalità sviluppo possono fare il login solo le persone con un ruolo nell'app; per i clienti esterni servono la verifica dell'attività e la revisione dei permessi da parte di Meta.

**"Invalid Scopes".** Meta mostra questo avviso quando i permessi non sono disponibili per l'app. Nel pannello dell'app apri **Casi d'uso** e aggiungi quelli che contengono i permessi della Pagina e di Instagram (gestione della Pagina, API Instagram con login Facebook). In ognuno, sotto **Personalizza → Autorizzazioni**, aggiungi i permessi elencati sopra. In alternativa crea in **Facebook Login for Business → Configurazioni** una configurazione con token utente e quei permessi, e scrivi il suo ID in `META_CONFIG_ID`.

I token di Pagina ottenuti così non scadono finché la persona non cambia password o revoca l'accesso.

Limiti delle API Meta, mostrati anche nella dashboard:
- Instagram dà i nuovi follower solo per gli ultimi 30 giorni e non dice chi ha smesso di seguire;
- i dati demografici di Instagram arrivano solo con almeno 100 follower;
- Meta ha ritirato i dati demografici delle Pagine Facebook;
- lo storico dei follower totali si costruisce dal giorno del collegamento.

## Solo Instagram, senza Facebook

Per i clienti senza Pagina Facebook c'è il login Instagram (`/oauth/instagram/start`). L'account deve essere professionale (Business o Creator).

1. Nell'app Meta apri **Casi d'uso → API Instagram → Configurazione dell'API con Instagram Login** e copia **ID app Instagram** e **Chiave segreta app Instagram**: sono diversi da META_APP_ID e META_APP_SECRET.
2. Nello stesso pannello, tra gli URI di reindirizzamento OAuth, aggiungi `PUBLIC_URL/oauth/instagram/callback`.
3. Permessi: `instagram_business_basic` e `instagram_business_manage_insights`. In modalità sviluppo funziona con i ruoli dell'app e gli utenti test Instagram (Ruoli dell'app → Ruoli → aggiungi tester Instagram, che il cliente deve accettare dall'app Instagram).
4. In `.env` scrivi `IG_APP_ID` e `IG_APP_SECRET`, riavvia. Il token dura 60 giorni e Habitat lo rinnova da solo.

## Login TikTok

1. Crea un'app su [TikTok for Developers](https://developers.tiktok.com/) e aggiungi **Login Kit** e **Display API** con gli scope `user.info.basic`, `user.info.stats`, `video.list`.
2. Per un redirect su `localhost` TikTok richiede la configurazione **desktop** (con PKCE, già gestito da Habitat): registra `http://localhost:3000/oauth/tiktok/callback`. Se la tua app è configurata come **web**, TikTok accetta solo indirizzi `https`: serve un tunnel (per esempio Cloudflare Tunnel) e `TIKTOK_REDIRECT_URI` impostato di conseguenza.
3. Compila `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` in `.env`, riavvia e premi **Collega con TikTok** nella scheda del cliente.

Il token TikTok dura 24 ore: Habitat lo rinnova da solo con il refresh token (valido circa un anno) prima di leggere i dati.

Limiti: niente dati demografici né nuovi/persi; le visualizzazioni sono il totale di ogni video ad oggi, attribuito al giorno di pubblicazione.

## Link per il cliente

Così il cliente collega da solo i suoi account, senza darti le password.

1. In **Clienti** premi **Link per il cliente** sulla riga del cliente, scegli i canali e premi **Crea link**.
2. **Copia link** e mandalo al cliente (WhatsApp, email).
3. Il cliente apre il link, fa l'accesso a Facebook o TikTok e torna su una pagina di conferma. In Habitat la riga del cliente risulta collegata.

Il link vale 7 giorni e si può annullare prima. Mostra solo il nome del cliente e i pulsanti di accesso: dall'esterno il resto dell'app risponde "Pagina non disponibile".

**Per provarlo su te stesso** basta questo computer: crea il link, premi **Apri** e fai l'accesso.

**Perché il cliente lo apra dal suo telefono**, Habitat deve essere raggiungibile da internet in https:

1. Crea un tunnel verso `http://localhost:3000`, per esempio con Cloudflare Tunnel. Ti serve un indirizzo fisso, perché va registrato nelle app di Meta e TikTok: il tunnel rapido `cloudflared tunnel --url` cambia indirizzo a ogni avvio.
2. In `.env` scrivi `PUBLIC_URL=https://tuo-indirizzo` e riavvia.
3. Registra i nuovi redirect: `https://tuo-indirizzo/oauth/meta/callback` nell'app Meta e `https://tuo-indirizzo/oauth/tiktok/callback` nell'app TikTok, con la piattaforma **Web** al posto di Desktop.

**Account dei clienti veri.** Finché l'app TikTok è in sandbox può accedere solo chi è tra i **Target users**. Lo stesso vale per l'app Meta in modalità sviluppo, dove accede solo chi ha un ruolo nell'app. Per clienti qualsiasi servono la revisione dell'app TikTok e, per Meta, la verifica dell'attività e la revisione dei permessi.

L'app si apre solo da questo computer, non dagli altri dispositivi della rete di casa, perché non ha una password.

## Token a mano

Nella scheda del cliente, sotto **Inserisci il token a mano**, puoi incollare ID account e access token ottenuti da Graph API Explorer o dal portale TikTok. Per TikTok puoi aggiungere anche il refresh token per il rinnovo automatico.

## Se qualcosa non va

- "Login Meta non configurato": mancano le chiavi in `.env`, oppure il server non è stato riavviato.
- "Verifica di sicurezza non valida": il login è durato più di 15 minuti o il server è stato riavviato nel frattempo. Riprova.
- Errori del tipo "(#100) ... metric": Meta ha cambiato il nome di una metrica. I dettagli sono nel terminale; la skill `collega-account` spiega come intervenire.
- I connettori non sono ancora stati provati con account veri: al primo collegamento potrebbero servire piccoli aggiustamenti.
