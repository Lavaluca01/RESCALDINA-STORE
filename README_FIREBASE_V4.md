# Gestione Preferenze Rescaldina — Firebase v4

Questa versione usa Firebase Authentication, Cloud Firestore e Cloud Functions.

## Prima pubblicazione
1. Da Terminale, nella cartella `RESCALDINA-STORE-main`, eseguire `firebase deploy --only firestore:rules`.
2. Le Cloud Functions `createEmployee`, `resetEmployeePin` e `setEmployeeActive` devono essere già pubblicate in `europe-west8`.
3. Caricare su GitHub i file front-end aggiornati: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `logo-mediaworld.jpg`.
4. Aprire la PWA e accedere come Manager. Il primo accesso usa la credenziale Firebase Manager già creata.
5. Premere `Importa organico iniziale`: vengono creati solo i dipendenti non ancora presenti e viene mostrato un report con i PIN temporanei.
6. Conservare il report; ogni dipendente dovrà cambiare il PIN al primo accesso.

## Sicurezza
- Il dipendente vede soltanto il proprio profilo e le proprie richieste.
- Può modificare una richiesta solo mentre è `pending` (visualizzata come `IN ATTESA`).
- Solo il Manager può approvare, rifiutare o eliminare richieste.
- Solo il Manager può creare, disattivare/riattivare dipendenti e resettare i PIN.
- I PIN non sono salvati in Firestore o nel browser: sono gestiti da Firebase Authentication.
