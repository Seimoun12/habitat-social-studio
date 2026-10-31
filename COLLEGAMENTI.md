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

I token di Pagina ottenuti così non scadono finché la persona non cambia password o revoca l'accesso.

Limiti delle API Meta, mostrati anche nella dashboard:
- Instagram dà i nuovi follower solo per gli ultimi 30 giorni e non dice chi ha smesso di seguire;
- i dati demografici di Instagram arrivano solo con almeno 100 follower;
- Meta ha ritirato i dati demografici delle Pagine Facebook;
- lo storico dei follower totali si costruisce dal giorno del collegamento.

## Login TikTok

1. Crea un'app su [TikTok for Developers](https://developers.tiktok.com/) e aggiungi **Login Kit** e **Display API** con gli scope `user.info.basic`, `user.info.stats`, `video.list`.
2. Per un redirect su `localhost` TikTok richiede la configurazione **desktop** (con PKCE, già gestito da Habitat): registra `http://localhost:3000/oauth/tiktok/callback`. Se la tua app è configurata come **web**, TikTok accetta solo indirizzi `https`: serve un tunnel (per esempio Cloudflare Tunnel) e `TIKTOK_REDIRECT_URI` impostato di conseguenza.
3. Compila `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` in `.env`, riavvia e premi **Collega con TikTok** nella scheda del cliente.

Il token TikTok dura 24 ore: Habitat lo rinnova da solo con il refresh token (valido circa un anno) prima di leggere i dati.

Limiti: niente dati demografici né nuovi/persi; le visualizzazioni sono il totale di ogni video ad oggi, attribuito al giorno di pubblicazione.

## Token a mano

Nella scheda del cliente, sotto **Inserisci il token a mano**, puoi incollare ID account e access token ottenuti da Graph API Explorer o dal portale TikTok. Per TikTok puoi aggiungere anche il refresh token per il rinnovo automatico.

## Se qualcosa non va

- "Login Meta non configurato": mancano le chiavi in `.env`, oppure il server non è stato riavviato.
- "Verifica di sicurezza non valida": il login è durato più di 15 minuti o il server è stato riavviato nel frattempo. Riprova.
- Errori del tipo "(#100) ... metric": Meta ha cambiato il nome di una metrica. I dettagli sono nel terminale; la skill `collega-account` spiega come intervenire.
- I connettori non sono ancora stati provati con account veri: al primo collegamento potrebbero servire piccoli aggiustamenti.
