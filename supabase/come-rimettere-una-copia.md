# Come rimettere i dati da una copia di sicurezza

Le copie le fa l'app (vedi `src/lib/copie.js`):

- **da sola, una volta a settimana**, nello spazio privato «copie» di Supabase
  (pannello di Supabase → Storage → copie);
- **a mano**, da Impostazioni → Copie di sicurezza → «Scarica una copia di
  tutto»: il file finisce sul telefono, sul tablet o sul computer.

Una copia è un file `gymcoach-copia-AAAA-MM-GG-HHMM.json` con tutte le tabelle,
riga per riga.

## Rimettere quello che manca

Serve un computer con Node.js (lo stesso che serve per lavorare sull'app).

1. Prendi la copia: dalle Impostazioni dell'app («Le ultime copie automatiche»
   → SCARICA) oppure dal pannello di Supabase → Storage → copie.
2. Dalla cartella dell'app lancia:

   ```
   node strumenti/copia-in-sql.mjs gymcoach-copia-2026-11-28-0835.json
   ```

   Accanto alla copia compare `gymcoach-copia-2026-11-28-0835.sql`.
3. Apri il SQL Editor di Supabase, incolla il contenuto del file `.sql` e
   lancialo. Se è troppo lungo per incollarlo tutto insieme, lancialo a pezzi:
   ogni blocco `insert … on conflict do nothing;` sta in piedi da solo.

Il file **aggiunge soltanto le righe che mancano** (`on conflict do nothing`):
non cancella e non cambia niente di quello che c'è già. Quindi:

- un peso cancellato per sbaglio torna;
- un peso **cambiato** dopo la copia resta com'è adesso (la copia non lo
  riporta indietro);
- lanciarlo due volte non fa danni.

## Se si è perso tutto il progetto Supabase

Il file `.sql` rimette le righe, non le tabelle. In un progetto nuovo vanno
prima create le tabelle con le stesse colonne (e le regole di accesso), poi si
lancia il file `.sql`. Chi sistema l'app può ricrearle dalla struttura del
database: conviene tenerne una copia insieme ai dati.
