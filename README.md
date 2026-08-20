# Gestione Preferenze Personale - Rescaldina v3

Versione PWA con accessi separati tramite PIN.

## Accesso iniziale
- Manager: PIN temporaneo `2468` (da cambiare subito dall'area Manager).
- Dipendenti già caricati: PIN temporaneo `0000`; al primo accesso ciascun dipendente è obbligato a crearne uno personale.
- Nuovi assunti: il Manager assegna un PIN temporaneo di 4-6 cifre; il dipendente lo cambia al primo accesso.

## Regole di accesso
- Il dipendente può entrare solo nella propria area e vede solo le proprie richieste.
- Il dipendente non può aprire o raggiungere l'area Manager dall'interfaccia.
- Il Manager accede solo con il PIN Manager.
- Il Manager può reimpostare il PIN temporaneo di un dipendente.

## Regole richieste
- Il dipendente può modificare una richiesta esclusivamente quando è `IN ATTESA`.
- Dopo approvazione/rifiuto non può più modificarla.
- Il Manager può approvare, rifiutare o eliminare una richiesta errata.
- Se eliminata, il dipendente può reinserirla correttamente.

## Nota sicurezza
Questa v3 conserva PIN e dati nel browser (localStorage) ed è quindi una versione di test/prototipo. Per l'uso reale con più dispositivi, i PIN e i permessi devono essere spostati su Firebase Authentication / Firestore con Security Rules. Non usare questa v3 come sistema definitivo per dati del personale.
