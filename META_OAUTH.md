# Collegamento Meta locale

Il backend aggiunto avvia Habitat su `http://127.0.0.1:8000` e gestisce il login Meta, il controllo dello `state` OAuth, lo scambio del codice e la lettura delle Pagine Facebook e degli account Instagram professionali collegati.

## Configurazione

1. Crea un'app su [Meta for Developers](https://developers.facebook.com/) e aggiungi il prodotto Instagram API con Facebook Login.
2. Registra `http://127.0.0.1:8000/oauth/meta/callback` tra i redirect OAuth consentiti nell'app Meta. Deve corrispondere esattamente a `META_REDIRECT_URI`.
3. Copia `.env.example` in `.env` e inserisci App ID, App Secret e una versione Graph API attualmente supportata dalla tua app Meta.
4. Per la prova, il profilo Instagram deve essere professionale e collegato a una Pagina Facebook che l'utente autorizzante può gestire.
5. Avvia con `python3 server.py` e apri `http://127.0.0.1:8000`.

Il flusso richiede `pages_show_list`, `pages_read_engagement`, `pages_read_user_content` e `instagram_basic`. In modalità sviluppo possono accedere solo persone con un ruolo consentito nell'app. Per autorizzare altri utenti servono le verifiche e gli accessi richiesti da Meta, inclusa la revisione dei permessi quando applicabile.

## Limiti di questa prova

- I token restano solo nella memoria del processo Python e non vengono inviati al browser né scritti su disco. Riavviando il server bisogna collegare di nuovo l'account.
- Il collegamento identifica profilo, Pagine e account Instagram associati; metriche e report dell'interfaccia restano dati demo. Non è stata implementata la sincronizzazione Insights né la pubblicazione.
- Questo server è solo per sviluppo locale: non ha autenticazione Habitat multiutente, persistenza cifrata, rinnovo automatico dei token, gestione della cancellazione dati o hardening da produzione. Non esporlo su Internet.