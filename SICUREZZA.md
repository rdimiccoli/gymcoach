# Stato del database

> ## ⚠️ AGGIORNAMENTO DEL 7 OTTOBRE 2026 — LEGGI PRIMA DEL RESTO
>
> **Da `supabase/migrazione-credenziale-unica.sql` in poi, il database non
> separa più i due coach.** Tutto quello che si legge più sotto sulle RLS che
> legano ogni riga al suo coach descrive com'era *prima* di quella migrazione.
>
> **Cosa è cambiato.** Sandro e Manu hanno chiesto una credenziale sola, con la
> scelta del profilo dentro l'app e la possibilità di guardare i turni
> dell'altro quando serve. Con un account solo la vecchia regola
> `coach_id = auth.uid()` non poteva più funzionare: l'account è uno, i profili
> due. Ora la regola è **«chi è entrato vede e scrive tutto»**.
>
> **Dov'è finita la separazione.** Solo dentro l'app: nella scelta «chi sei?»
> e nei filtri `.eq('coach_id', coach.id)` delle cinque query che caricano i
> turni. È una comodità per sapere con chi si sta lavorando, **non** una
> barriera di riservatezza. Chi ha la password passa da un profilo all'altro
> quando vuole — ed è esattamente quello che i due coach hanno chiesto.
>
> **Cosa regge adesso tutta la riservatezza.** Una cosa sola: **la
> registrazione pubblica deve restare SPENTA** (punto 5 del riepilogo in
> fondo). Prima era importante; adesso è l'unica cosa che impedisce a chiunque
> dal sito di crearsi un account e leggere turni, atlete e carichi della
> palestra. Se quella voce torna accesa, il database è aperto a tutti.
>
> **Cosa resta uguale.** Nessun dato è stato cancellato o spostato: la
> migrazione tocca solo policy e funzioni. I tre profili coach, i turni, le
> schede, le atlete e i carichi sono rimasti dov'erano, con gli stessi
> identificativi.

---

## Stato verificato il 4 settembre 2026

Audit eseguito sul progetto `zutadrqmowzbecwdtlyp` (org *rdimiccoli's Org*)
interrogando i cataloghi di Postgres. Questo documento riporta **quello che c'è**,
non quello che si sospettava.

⚠️ Da qui in poi la fotografia è quella di settembre: per la separazione fra
coach vale il riquadro qui sopra.

---

## ✅ Cosa è già a posto

### Le RLS ci sono e sono corrette

Tutte e 8 le tabelle hanno `rowsecurity = true`, e ogni policy risale
correttamente al coach passando per `turns.coach_id = auth.uid()`:

| Tabella | Condizione |
|---|---|
| `coaches` | `auth.uid() = id` |
| `turns` | `coach_id = auth.uid()` |
| `clients` | `turn_id IN (turns del coach)` |
| `cycles` | `turn_id IN (turns del coach)` |
| `cycle_exercises` | `cycle_id IN (cycles → turns del coach)` |
| `client_loads` | `client_id IN (clients → turns del coach)` |
| `client_notes` | `client_id IN (clients → turns del coach)` |
| `exercises` | `auth.role() = 'authenticated'` (catalogo condiviso, voluto) |

**Una coach non può vedere né modificare le atlete di un'altra.** Era il rischio
principale ipotizzato in analisi: non sussiste.

> **Nota su `with_check = null`.** Tutte le policy sono `FOR ALL` con solo
> `USING`. Non è una falla: in Postgres, quando `WITH CHECK` è omesso, viene
> usata l'espressione `USING` anche per le scritture. Inserimenti e modifiche
> sono quindi protetti dalla stessa condizione.

### Il vincolo unico sui carichi esiste

```
client_loads → UNIQUE (client_id, cycle_exercise_id, week)
```

È esattamente ciò che pretende l'`upsert` con
`onConflict: 'client_id,cycle_exercise_id,week'`. **I carichi sono sempre stati
salvati correttamente.** Il sospetto peggiore emerso in analisi era infondato.

### Le cancellazioni a cascata ci sono tutte

```
turns    → coaches            ON DELETE CASCADE
clients  → turns              ON DELETE CASCADE
cycles   → turns              ON DELETE CASCADE
cycle_exercises → cycles      ON DELETE CASCADE
client_loads → clients        ON DELETE CASCADE
client_loads → cycle_exercises ON DELETE CASCADE
client_notes → clients        ON DELETE CASCADE
client_notes → cycle_exercises ON DELETE CASCADE
```

Eliminare un turno porta via da solo clienti, schede, esercizi e carichi, in una
transazione unica. Il codice dell'app è stato semplificato di conseguenza: le
cancellazioni manuali dei figli erano ridondanti.

L'unica foreign key **senza** cascata è `cycle_exercises → exercises`, ed è
giusto così: cancellare un esercizio dal catalogo non deve svuotare le schede
che lo usano.

---

## 🔴 Il problema confermato: il recupero password non ha mai funzionato

La policy su `coaches` è `USING (auth.uid() = id)`. Per un utente **non
autenticato** `auth.uid()` vale `NULL`, quindi la condizione non è mai vera.

Il vecchio codice di `Login.jsx` interrogava `coaches` **prima** di inviare la
mail di reset, da utente non autenticato. Quella query restituiva sempre zero
righe. Quindi il messaggio *"Nessun account trovato con questa email"* non era
un caso limite: **era la risposta per chiunque, sempre.**

Corretto nel Blocco 2: la verifica preventiva è stata rimossa e si chiama
direttamente `resetPasswordForEmail`, che non rivela se l'indirizzo esiste.

---

## ⚠️ Cosa resta da fare

### 1. Chiudere le registrazioni pubbliche — ✅ VERIFICATO SPENTO l'8/10/2026

Non è SQL, è un interruttore, e non è verificabile dai cataloghi: va guardato a
mano. Sta in **Authentication → Sign In / Providers**, in cima alla pagina,
SOPRA l'elenco dei provider — non dentro la scheda Email, dove lo cercavamo.

- **Allow new users to sign up** → **OFF** ✅ controllato da Ruggiero l'8/10/2026
- **Confirm email** → **ON**

I nuovi coach si creano da **Authentication → Users → Add user**.

⚠️ **Da ricontrollare ogni volta che si tocca la configurazione di Auth.**
Dalla credenziale unica in poi questo interruttore non è più «il più
importante»: è l'**unico**. Prima, con le RLS che legavano ogni riga al suo
coach, un estraneo che si registrava non vedeva le atlete di nessuno. Adesso la
regola è «chi è entrato vede tutto», quindi chiunque riesca a crearsi un
account legge turni, atlete e carichi della palestra.

Se un giorno c'è il dubbio che sia stato riacceso, la prova che non mente è
chiedere al server di creare un utente:

```
curl -X POST 'https://<progetto>.supabase.co/auth/v1/signup' \
  -H "apikey: <chiave anon>" -H "Content-Type: application/json" \
  -d '{"email":"prova@example.com","password":"unaPasswordLunga123"}'
```

Deve rispondere **«Signups not allowed for this instance»**. Se invece crea
l'utente, le registrazioni sono aperte: va chiuso l'interruttore e cancellato
quell'utente da Authentication → Users.

### 1b. La lunghezza minima della password — ☐ da decidere

È a **6 caratteri**. Con una credenziale sola condivisa fra i due coach sono
pochi: 10 o 12 sarebbe più sensato. Alzarla non tocca le password esistenti,
vale solo da quando si cambia.

### 2. Indici sulle foreign key

Postgres crea gli indici da solo per chiavi primarie e vincoli unici, **ma non
per le foreign key**. Le policy RLS eseguono una sottoquery a ogni riga letta, e
le cascate devono cercare le righe figlie: senza questi indici entrambe
rallentano man mano che i dati crescono.

Tutte `if not exists`, quindi eseguirle è innocuo anche se qualcuna già esiste:

```sql
create index if not exists idx_turns_coach           on turns (coach_id);
create index if not exists idx_clients_turn          on clients (turn_id);
create index if not exists idx_cycles_turn           on cycles (turn_id);
create index if not exists idx_cycle_exercises_cycle on cycle_exercises (cycle_id);
create index if not exists idx_cycle_exercises_ex    on cycle_exercises (exercise_id);
create index if not exists idx_client_loads_cyclex   on client_loads (cycle_exercise_id);
create index if not exists idx_client_notes_client   on client_notes (client_id);
create index if not exists idx_client_notes_cyclex   on client_notes (cycle_exercise_id);
```

> `client_loads (client_id)` non serve: è già la prima colonna dell'indice creato
> dal vincolo unico.

### 3. Facoltativo — restringere le policy a `authenticated`

Tutte le policy sono `TO public`, cioè valgono anche per il ruolo `anon`. **Non
è un buco**, perché le condizioni si basano su `auth.uid()` che per un anonimo è
`NULL`: le righe restituite sono comunque zero. È però meno esplicito, e obbliga
Postgres a valutare la sottoquery anche per richieste che potrebbero essere
respinte subito.

Cambiarle significa ricrearle una per una su un database in produzione, con il
rischio di chiudere fuori tutti se qualcosa va storto. **Il guadagno è marginale:
farlo solo con calma e con un backup fresco**, non ora.

---

## 📋 Due cose notate di passaggio

**`client_notes` esiste ma non viene usata.** Tabella completa, con vincolo unico
su `(client_id, cycle_exercise_id)` e cascate a posto — ma nel codice React non
c'è un solo riferimento. O è una funzione progettata e mai costruita (una nota
per esercizio e atleta), oppure un residuo. Da decidere: implementarla o
eliminarla.

**`exercises` ha `UNIQUE (name)`, ma è sensibile alle maiuscole.** Conferma che
l'inserimento di un esercizio omonimo falliva davvero — era la causa del crash
corretto nel Blocco 1. Attenzione però: il vincolo lascia passare `Panca piana` e
`panca piana` come due righe distinte. Il codice ora cerca con `ilike` prima di
inserire, quindi riusa quello esistente a prescindere dalle maiuscole: è più
severo del database.

---

## Riepilogo

| # | Cosa | Dove | Stato |
|---|---|---|---|
| 1 | RLS su tutte le tabelle | — | ✅ già a posto |
| 2 | Vincolo unico su `client_loads` | — | ✅ già a posto |
| 3 | Cascate sulle foreign key | — | ✅ già a posto |
| 4 | Recupero password | codice | ✅ corretto (Blocco 2) |
| 5 | **Registrazione pubblica OFF** | Authentication | ✅ verificato spento 8/10/2026 — **l'unica barriera rimasta, ricontrollare a ogni modifica di Auth** |
| 5b | Lunghezza minima password (ora 6) | Authentication | ☐ da decidere |
| 6 | Indici sulle foreign key | SQL Editor | ☐ da fare |
| 7 | Policy `TO authenticated` | SQL Editor | ☐ facoltativo, senza fretta |
| 8 | Decidere cosa fare di `client_notes` | — | ☐ da decidere |
