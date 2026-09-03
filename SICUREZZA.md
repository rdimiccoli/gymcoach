# Sicurezza — cosa devi verificare su Supabase

GymCoach non ha un backend. L'app parla con Supabase **direttamente dal browser**,
usando la chiave `anon`, che è pubblica: chiunque apra il sito può leggerla dal
codice JavaScript. Non è un difetto di per sé — è il modello previsto da Supabase —
ma significa una cosa sola:

> **Tutta la sicurezza dei dati sta nelle policy RLS del database.**
> Nel codice dell'app non c'è, e non può esserci, alcun controllo di autorizzazione.

Il codice non filtra mai per coach quando legge clienti, schede o carichi:

```js
.from('clients').eq('turn_id', turn.id)          // nessun filtro sul coach
.from('cycles').eq('turn_id', turn.id)           // nessun filtro sul coach
.from('client_loads').in('client_id', clIds)     // nessun filtro sul coach
```

Se le RLS mancano o sono permissive, **una coach può leggere e modificare le
atlete e i carichi delle colleghe** conoscendo un id. Non ho accesso al tuo
progetto Supabase, quindi questa parte devi verificarla tu.

---

## ⚠️ Prima di eseguire qualsiasi cosa

1. **Fai un backup**: Supabase → Database → Backups.
2. Gli `create policy` falliscono se esiste già una policy con lo stesso nome.
   Esegui prima il **passo 1** (verifica) e adatta di conseguenza.
3. **Attivare RLS su una tabella senza policy blocca tutti, te compresa.**
   Attiva RLS e crea le policy nella stessa esecuzione, mai separatamente.
4. I nomi di colonna qui sotto sono dedotti dal codice dell'app. Controllali
   con il passo 1 prima di procedere.

---

## Passo 1 — Fotografia della situazione attuale

Supabase → **SQL Editor** → incolla ed esegui:

```sql
-- Quali tabelle hanno RLS attivo?
select tablename,
       rowsecurity as rls_attivo
from pg_tables
where schemaname = 'public'
order by tablename;

-- Quali policy esistono, e cosa permettono davvero?
select tablename, policyname, cmd, roles,
       qual        as condizione_lettura,
       with_check  as condizione_scrittura
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Nomi reali delle colonne (per verificare l'SQL dei passi successivi)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

**Come leggere il risultato:**

| Cosa vedi | Significato |
|---|---|
| `rls_attivo = false` su una tabella | 🔴 Chiunque abbia la chiave anon legge e scrive tutto |
| `rls_attivo = true` ma nessuna policy | 🔒 Tabella inaccessibile a tutti (l'app non funziona) |
| policy con `condizione_lettura = true` | 🔴 Permette tutto, non filtra niente |
| `roles = {public}` o `{anon}` | 🔴 Vale anche per chi non ha fatto login |
| `condizione_lettura` che risale a `auth.uid()` | ✅ Corretto |

---

## Passo 2 — Le policy corrette

Ogni tabella deve risalire al coach passando per `turns.coach_id`.
Adatta i nomi se il passo 1 mostra qualcosa di diverso, poi esegui **tutto insieme**:

```sql
-- ── COACHES ────────────────────────────────────────────────────────────────
-- Ognuno vede solo se stesso. Questo chiude anche la fuga di email dei coach.
alter table coaches enable row level security;

create policy "coach: legge se stesso" on coaches
  for select to authenticated using (id = auth.uid());

create policy "coach: crea il proprio profilo" on coaches
  for insert to authenticated with check (id = auth.uid());

create policy "coach: aggiorna se stesso" on coaches
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── TURNS ──────────────────────────────────────────────────────────────────
alter table turns enable row level security;

create policy "turni: solo i propri" on turns
  for all to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- ── CLIENTS ────────────────────────────────────────────────────────────────
alter table clients enable row level security;

create policy "clienti: solo dei propri turni" on clients
  for all to authenticated
  using (exists (
    select 1 from turns t where t.id = clients.turn_id and t.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from turns t where t.id = clients.turn_id and t.coach_id = auth.uid()
  ));

-- ── CYCLES ─────────────────────────────────────────────────────────────────
alter table cycles enable row level security;

create policy "schede: solo dei propri turni" on cycles
  for all to authenticated
  using (exists (
    select 1 from turns t where t.id = cycles.turn_id and t.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from turns t where t.id = cycles.turn_id and t.coach_id = auth.uid()
  ));

-- ── CYCLE_EXERCISES ────────────────────────────────────────────────────────
alter table cycle_exercises enable row level security;

create policy "esercizi scheda: solo dei propri turni" on cycle_exercises
  for all to authenticated
  using (exists (
    select 1 from cycles c
    join turns t on t.id = c.turn_id
    where c.id = cycle_exercises.cycle_id and t.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from cycles c
    join turns t on t.id = c.turn_id
    where c.id = cycle_exercises.cycle_id and t.coach_id = auth.uid()
  ));

-- ── CLIENT_LOADS ───────────────────────────────────────────────────────────
alter table client_loads enable row level security;

create policy "carichi: solo dei propri clienti" on client_loads
  for all to authenticated
  using (exists (
    select 1 from clients cl
    join turns t on t.id = cl.turn_id
    where cl.id = client_loads.client_id and t.coach_id = auth.uid()
  ))
  with check (exists (
    select 1 from clients cl
    join turns t on t.id = cl.turn_id
    where cl.id = client_loads.client_id and t.coach_id = auth.uid()
  ));

-- ── EXERCISES ──────────────────────────────────────────────────────────────
-- Catalogo volutamente condiviso fra tutte le coach, ma NON leggibile da chi
-- non ha fatto login.
alter table exercises enable row level security;

create policy "catalogo: lettura per chi ha fatto login" on exercises
  for select to authenticated using (true);

create policy "catalogo: inserimento per chi ha fatto login" on exercises
  for insert to authenticated with check (true);

create policy "catalogo: modifica per chi ha fatto login" on exercises
  for update to authenticated using (true) with check (true);
```

Dopo l'esecuzione **riapri l'app e prova un giro completo**: home, turni,
apertura scheda, salvataggio carichi, condivisione. Se qualcosa resta vuoto,
è una policy troppo stretta — il Notifier ora te lo dice invece di tacere.

---

## Passo 3 — Indici per le policy

Le `exists (...)` qui sopra girano a ogni riga letta. Senza questi indici
diventano lente appena crescono i dati:

```sql
create index if not exists idx_turns_coach            on turns (coach_id);
create index if not exists idx_clients_turn           on clients (turn_id);
create index if not exists idx_cycles_turn            on cycles (turn_id);
create index if not exists idx_cycle_exercises_cycle  on cycle_exercises (cycle_id);
create index if not exists idx_client_loads_client    on client_loads (client_id);
create index if not exists idx_client_loads_cyclex    on client_loads (cycle_exercise_id);
```

---

## Passo 4 — Vincolo unico sui carichi

Il salvataggio dei carichi usa
`upsert(..., { onConflict: 'client_id,cycle_exercise_id,week' })`.
Postgres pretende che esista un vincolo unico **esattamente** su quelle tre
colonne, altrimenti l'upsert fallisce con errore 42P10.

```sql
-- Verifica se c'è già
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'client_loads'::regclass and contype = 'u';

-- Se manca:
alter table client_loads
  add constraint client_loads_unico unique (client_id, cycle_exercise_id, week);
```

> Se il vincolo mancava, fino ad oggi **nessun carico veniva salvato** e l'app
> non lo diceva. Da adesso lo dice, ma il vincolo va comunque creato.

---

## Passo 5 — Cancellazioni a cascata

L'app ora pulisce le tabelle figlie a mano prima di eliminare un turno, quindi
funziona in ogni caso. Ma è più robusto e più veloce farlo fare al database:

```sql
-- Verifica cosa succede oggi alle foreign key
select tc.table_name, tc.constraint_name, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name;
```

Se `delete_rule` è `NO ACTION` o `RESTRICT`, puoi passare a `CASCADE`
(sostituisci i nomi dei vincoli con quelli veri restituiti dalla query):

```sql
alter table clients          drop constraint clients_turn_id_fkey,
  add constraint clients_turn_id_fkey foreign key (turn_id) references turns(id) on delete cascade;

alter table cycles           drop constraint cycles_turn_id_fkey,
  add constraint cycles_turn_id_fkey foreign key (turn_id) references turns(id) on delete cascade;

alter table cycle_exercises  drop constraint cycle_exercises_cycle_id_fkey,
  add constraint cycle_exercises_cycle_id_fkey foreign key (cycle_id) references cycles(id) on delete cascade;

alter table client_loads     drop constraint client_loads_client_id_fkey,
  add constraint client_loads_client_id_fkey foreign key (client_id) references clients(id) on delete cascade;

alter table client_loads     drop constraint client_loads_cycle_exercise_id_fkey,
  add constraint client_loads_cycle_exercise_id_fkey foreign key (cycle_exercise_id) references cycle_exercises(id) on delete cascade;
```

---

## Passo 6 — Chiudi le registrazioni pubbliche

**Questo è il controllo più importante di tutti, e non richiede SQL.**

L'app crea automaticamente una riga in `coaches` per qualsiasi utente
autenticato che non ne abbia una (`src/pages/Home.jsx`). Non è un buco in sé —
l'id è forzato a `auth.uid()` — ma **lo diventa se chiunque può registrarsi**:
basterebbe una chiamata all'API di Supabase per crearsi un account e ritrovarsi
dentro l'app dei coach.

Supabase → **Authentication → Sign In / Providers → Email**:

- **Allow new users to sign up** → **OFF**
- **Confirm email** → **ON**

Con la registrazione chiusa, i nuovi coach li crei tu da
**Authentication → Users → Add user**.

---

## Passo 7 — Controlla i suggerimenti automatici

Supabase → **Advisors → Security**. Segnala da solo tabelle senza RLS,
policy permissive e funzioni con `search_path` mutabile. Vale la pena
guardarlo dopo ogni modifica allo schema.

---

## Riepilogo

| # | Cosa | Dove | Fatto |
|---|---|---|---|
| 1 | Fotografia RLS attuale | SQL Editor | ☐ |
| 2 | Policy per tabella | SQL Editor | ☐ |
| 3 | Indici per le policy | SQL Editor | ☐ |
| 4 | Vincolo unico su `client_loads` | SQL Editor | ☐ |
| 5 | Cascate sulle foreign key | SQL Editor | ☐ |
| 6 | **Registrazione pubblica OFF** | Authentication | ☐ |
| 7 | Advisors → Security pulito | Advisors | ☐ |
