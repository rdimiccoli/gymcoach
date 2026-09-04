-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE
--  Presenze · Turni condivisi fra coach · Categorie esercizi
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  È scritta per essere rieseguibile: ogni pezzo è `if not exists` o
--  `create or replace`. Lanciarla due volte non fa danni.
--
--  ORDINE: se devi ancora lanciare `dati-dimostrativi.sql`, lancia PRIMA
--  quello e POI questa. Al contrario funziona lo stesso, ma le categorie
--  del PASSO 3 non troverebbero gli esercizi da assegnare.
--
--  ⚠️  Il PASSO 2 RISCRIVE LE POLICY DI SICUREZZA di sette tabelle.
--      Fai il backup: Supabase → Database → Backups.
--      Dopo averla eseguita, entra nell'app e controlla di vedere ancora
--      turni e atlete: se una policy fosse sbagliata, vedresti tutto vuoto.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · PRESENZE ═══════════════════════════════════════════════════
-- Nel database non esisteva il concetto di «chi c'era». C'era `current_week`,
-- avanzata a mano: un surrogato che non distingue chi si è allenata da chi ha
-- saltato tre sessioni.

-- ── La regola che rende la cosa sicura ───────────────────────────────────
-- ASSENZA DI RIGA = PRESENTE. Il coach segna solo CHI MANCA.
-- Se non tocca niente, «+1 A TUTTE» si comporta esattamente come oggi: le
-- avanza tutte. La funzione non può quindi rompere nulla per chi la ignora,
-- e a chi la usa costano due tocchi invece di dodici.

create table if not exists client_attendance (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  session_date  date not null default current_date,
  present       boolean not null default true,
  created_at    timestamptz not null default now(),
  -- Una sola riga per atleta al giorno: segnare due volte corregge, non duplica.
  unique (client_id, session_date)
);

-- SUBITO, non più in basso: finché l'RLS è spenta la tabella è leggibile e
-- scrivibile da chiunque abbia la chiave anon, che è pubblica dentro l'app.
alter table client_attendance enable row level security;

create index if not exists idx_attendance_client on client_attendance (client_id);
create index if not exists idx_attendance_data   on client_attendance (session_date);


-- ═══ PASSO 2 · TURNI CONDIVISI ════════════════════════════════════════════
-- Oggi la policy è `coach_id = auth.uid()`: un turno è visibile SOLO alla
-- coach che lo possiede. Se Sandro è malato, i suoi turni non li apre nessuno.
--
-- ── La scelta che ho fatto, e perché ──────────────────────────────────────
-- Fra i tre modi possibili (condivisione esplicita / un ruolo che vede tutto /
-- tutte vedono tutto) ho scelto il PRIMO: un turno resta privato finché non lo
-- si condivide esplicitamente con una collega.
--
-- Motivo: è l'unico che NON cambia niente il giorno che lo esegui. Le altre
-- due aprono l'accesso ai dati di tutte, e su una scelta del genere è meglio
-- partire chiusi e aprire quando serve, che il contrario.
-- Gli altri due modi restano costruibili sopra questo, in qualsiasi momento.
--
-- Chi riceve un turno condiviso può LAVORARCI (atlete, schede, carichi, note)
-- ma NON può rinominarlo né eliminarlo: quelle restano di chi lo possiede.

create table if not exists turn_coaches (
  turn_id    uuid not null references turns(id)   on delete cascade,
  coach_id   uuid not null references coaches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (turn_id, coach_id)
);

alter table turn_coaches enable row level security;

create index if not exists idx_turn_coaches_coach on turn_coaches (coach_id);

-- ── Funzioni di accesso ───────────────────────────────────────────────────
-- SECURITY DEFINER non è pigrizia: senza, una policy su `clients` che legge
-- `turns` farebbe scattare anche la policy di `turns`, con ricorsioni e
-- risultati imprevedibili. È il modo consigliato da Supabase.
-- Sono sicure perché rispondono solo sì/no sull'utente corrente e non
-- restituiscono mai dati.

create or replace function public.turno_accessibile(p_turn uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from turns t
    where t.id = p_turn
      and (
        t.coach_id = auth.uid()
        or exists (select 1 from turn_coaches tc
                   where tc.turn_id = t.id and tc.coach_id = auth.uid())
      )
  );
$$;

create or replace function public.scheda_accessibile(p_cycle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cycles c
                 where c.id = p_cycle and public.turno_accessibile(c.turn_id));
$$;

create or replace function public.atleta_accessibile(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients cl
                 where cl.id = p_client and public.turno_accessibile(cl.turn_id));
$$;

create or replace function public.esercizio_scheda_accessibile(p_ce uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cycle_exercises ce
                 where ce.id = p_ce and public.scheda_accessibile(ce.cycle_id));
$$;

-- ── Le policy, riscritte ──────────────────────────────────────────────────
-- Si tolgono per nome quelle vecchie e si ricreano. Se i nomi sul tuo
-- database fossero diversi, il `drop ... if exists` semplicemente non trova
-- nulla e le vecchie resterebbero ATTIVE INSIEME alle nuove: in quel caso
-- controlla con la query in fondo e cancella a mano le superflue.

-- TURNI · vedere e lavorare sì, rinominare ed eliminare solo chi lo possiede
drop policy if exists "Coach vede solo i suoi turni" on turns;
drop policy if exists "turni: solo i propri"          on turns;
drop policy if exists "turni: visibili a chi ci lavora" on turns;
drop policy if exists "turni: crea solo i propri"       on turns;
drop policy if exists "turni: modifica solo i propri"   on turns;
drop policy if exists "turni: elimina solo i propri"    on turns;

create policy "turni: visibili a chi ci lavora" on turns
  for select to authenticated using (public.turno_accessibile(id));
create policy "turni: crea solo i propri" on turns
  for insert to authenticated with check (coach_id = auth.uid());
create policy "turni: modifica solo i propri" on turns
  for update to authenticated using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "turni: elimina solo i propri" on turns
  for delete to authenticated using (coach_id = auth.uid());

-- CHI LAVORA SU UN TURNO
drop policy if exists "condivisioni: chi le riguarda"   on turn_coaches;
drop policy if exists "condivisioni: decide chi possiede" on turn_coaches;

create policy "condivisioni: chi le riguarda" on turn_coaches
  for select to authenticated
  using (coach_id = auth.uid()
         or exists (select 1 from turns t where t.id = turn_id and t.coach_id = auth.uid()));
create policy "condivisioni: decide chi possiede" on turn_coaches
  for all to authenticated
  using     (exists (select 1 from turns t where t.id = turn_id and t.coach_id = auth.uid()))
  with check(exists (select 1 from turns t where t.id = turn_id and t.coach_id = auth.uid()));

-- ATLETE
drop policy if exists "Coach vede solo i suoi clienti"   on clients;
drop policy if exists "clienti: solo dei propri turni"    on clients;
drop policy if exists "atlete: dei turni su cui lavoro"   on clients;
create policy "atlete: dei turni su cui lavoro" on clients
  for all to authenticated
  using (public.turno_accessibile(turn_id)) with check (public.turno_accessibile(turn_id));

-- SCHEDE
drop policy if exists "Coach vede solo i suoi cicli"    on cycles;
drop policy if exists "schede: solo dei propri turni"    on cycles;
drop policy if exists "schede: dei turni su cui lavoro"  on cycles;
create policy "schede: dei turni su cui lavoro" on cycles
  for all to authenticated
  using (public.turno_accessibile(turn_id)) with check (public.turno_accessibile(turn_id));

-- ESERCIZI DELLE SCHEDE
drop policy if exists "Coach vede solo i suoi esercizi ciclo"   on cycle_exercises;
drop policy if exists "esercizi scheda: solo dei propri turni"   on cycle_exercises;
drop policy if exists "esercizi scheda: dei turni su cui lavoro" on cycle_exercises;
create policy "esercizi scheda: dei turni su cui lavoro" on cycle_exercises
  for all to authenticated
  using (public.scheda_accessibile(cycle_id)) with check (public.scheda_accessibile(cycle_id));

-- CARICHI
drop policy if exists "Coach vede solo i suoi carichi"  on client_loads;
drop policy if exists "carichi: solo dei propri clienti" on client_loads;
drop policy if exists "carichi: delle atlete su cui lavoro" on client_loads;
create policy "carichi: delle atlete su cui lavoro" on client_loads
  for all to authenticated
  using (public.atleta_accessibile(client_id)) with check (public.atleta_accessibile(client_id));

-- NOTE
drop policy if exists "Coach vede solo le sue note"   on client_notes;
drop policy if exists "note: delle atlete su cui lavoro" on client_notes;
create policy "note: delle atlete su cui lavoro" on client_notes
  for all to authenticated
  using (public.atleta_accessibile(client_id)) with check (public.atleta_accessibile(client_id));

-- PRESENZE
drop policy if exists "presenze: delle atlete su cui lavoro" on client_attendance;
create policy "presenze: delle atlete su cui lavoro" on client_attendance
  for all to authenticated
  using (public.atleta_accessibile(client_id)) with check (public.atleta_accessibile(client_id));


-- ═══ PASSO 3 · CATEGORIE ESERCIZI ═════════════════════════════════════════
-- `exercises` era una lista piatta di nomi, condivisa fra tutte le coach:
-- cresce in fretta, e a duecento voci cercare «panca» vuol dire scorrere.

alter table exercises add column if not exists muscle_group text;
alter table exercises add column if not exists equipment    text;

create index if not exists idx_exercises_gruppo   on exercises (muscle_group);
create index if not exists idx_exercises_attrezzo on exercises (equipment);

-- Assegnazione iniziale per gli esercizi dello scenario dimostrativo, così la
-- funzione ha qualcosa da mostrare subito. Tocca solo quelli ancora senza
-- categoria: se ne hai già assegnate a mano, restano.
update exercises e set muscle_group = v.gruppo, equipment = v.attrezzo
from (values
  ('Squat sumo','Gambe','Bilanciere'),          ('Leg press','Gambe','Macchina'),
  ('Leg curl','Gambe','Macchina'),              ('Stacco rumeno','Gambe','Bilanciere'),
  ('Affondi camminati','Gambe','Corpo libero'), ('Balzi step piccolo alternati','Gambe','Corpo libero'),
  ('Panca obliqua','Petto','Bilanciere'),       ('Panca stretta','Petto','Bilanciere'),
  ('Spinte oblique','Petto','Manubri'),         ('Spinte declinate','Petto','Manubri'),
  ('Croci ai cavi','Petto','Cavi'),             ('Croci 30','Petto','Manubri'),
  ('Rematore T-bar','Dorso','Bilanciere'),      ('Alzate dorso al cavo','Dorso','Cavi'),
  ('Lat machine presa inversa','Dorso','Macchina'),
  ('Military press','Spalle','Bilanciere'),     ('Alzate laterali 45°','Spalle','Manubri'),
  ('Thruster bilanciere','Spalle','Bilanciere'),
  ('Curl in piedi','Braccia','Manubri'),        ('Curl panca 45°','Braccia','Manubri'),
  ('Plank','Core','Corpo libero'),              ('Barchetta','Core','Corpo libero'),
  ('Mountain climber','Core','Corpo libero'),
  ('Swing','Total body','Kettlebell'),          ('Burpees con ostacolo','Total body','Corpo libero'),
  ('Jumping jack','Total body','Corpo libero')
) as v(nome, gruppo, attrezzo)
where e.name = v.nome and e.muscle_group is null;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- 1. Le policy attive adesso. Su turns devono essercene 4 (select, insert,
--    update, delete); sulle altre una sola. Se ne vedi di più, quelle vecchie
--    non sono state trovate dal drop: cancella a mano le superflue.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('turns','turn_coaches','clients','cycles','cycle_exercises',
                    'client_loads','client_notes','client_attendance')
order by tablename, cmd, policyname;

-- 2. Che cosa è stato creato
select 'presenze registrate' as cosa, count(*)::text from client_attendance
union all select 'turni condivisi',      count(*)::text from turn_coaches
union all select 'esercizi con categoria', count(*)::text from exercises where muscle_group is not null
union all select 'esercizi senza categoria', count(*)::text from exercises where muscle_group is null;

-- 3. CONTROLLO FINALE, il più importante: dopo aver eseguito tutto, apri
--    l'app e verifica di vedere ancora i tuoi turni e le tue atlete.
--    Se vedessi tutto vuoto, una policy è sbagliata: torna al backup.
