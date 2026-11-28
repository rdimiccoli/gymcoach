-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE DEL 28 NOVEMBRE 2026
--  Il registro degli errori · Il cruscotto · Le copie di sicurezza
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge una tabella vuota, una «vista» (una
--      tabella che si calcola da sola dai pesi già segnati, senza copiarli)
--      e uno spazio file privato. Nessun `delete`, nessun `drop`, nessuna
--      riga toccata. Si rilancia quante volte si vuole.
--
--  Finché non la lanci, l'app funziona come adesso: si accorge da sola che
--  questi pezzi mancano e non mostra il registro degli errori, il cruscotto
--  e la copia automatica della settimana. Il pulsante «Scarica una copia di
--  tutto» funziona anche senza.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · IL REGISTRO DEGLI ERRORI ═══════════════════════════════════
-- Quando qualcosa va storto sul telefono di un coach, l'app scrive qui una
-- riga: cosa, quando, in quale schermata, su che telefono. Così non serve
-- più ricordarsi a voce «ieri alle sei mi è comparso un messaggio rosso».
--
-- Le scritte hanno una lunghezza massima: un errore che si ripete a raffica
-- non può riempire il database.
create table if not exists errori_app (
  id          uuid primary key default gen_random_uuid(),
  quando      timestamptz not null default now(),
  tipo        text not null,
  messaggio   text not null,
  dettaglio   text,
  pagina      text,
  coach       text,
  versione    text,
  dispositivo text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'errori_app_corti') then
    alter table errori_app add constraint errori_app_corti check (
      char_length(tipo) <= 20
      and char_length(messaggio) <= 300
      and (dettaglio   is null or char_length(dettaglio)   <= 2000)
      and (pagina      is null or char_length(pagina)      <= 40)
      and (coach       is null or char_length(coach)       <= 40)
      and (versione    is null or char_length(versione)    <= 40)
      and (dispositivo is null or char_length(dispositivo) <= 120)
    );
  end if;
end $$;

create index if not exists errori_app_quando on errori_app (quando desc);

-- Chi è entrato nell'app scrive e legge. Nessuno, dall'app, cambia o
-- cancella una riga: il registro dice com'è andata, non come vorremmo.
alter table errori_app enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'errori_app'
                   and policyname = 'errori: li scrive chi è entrato') then
    create policy "errori: li scrive chi è entrato" on errori_app
      for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'errori_app'
                   and policyname = 'errori: li legge chi è entrato') then
    create policy "errori: li legge chi è entrato" on errori_app
      for select to authenticated using (true);
  end if;
end $$;

grant select, insert on errori_app to authenticated;


-- ═══ PASSO 2 · IL CRUSCOTTO ═══════════════════════════════════════════════
-- Settimana per settimana, e coach per coach: quanti pesi sono stati segnati
-- e quante persone diverse si sono allenate.
--
-- La settimana è quella in cui il peso è stato SEGNATO la prima volta (ora
-- italiana, dal lunedì). Correggerlo dopo non lo sposta: l'app non cambia
-- `updated_at` quando riscrive un peso. Contare invece con la settimana
-- della scheda metteva dei pesi in settimane che devono ancora venire, se
-- la data d'inizio era stata spostata dopo.
--
-- Il coach è quello del turno della scheda: un ospite che fa il programma
-- di Sandro conta per Sandro.
--
-- Le righe con `tutti` = true sono il totale della palestra: una persona
-- che si allena con due coach lì conta una volta sola.
--
-- `security_invoker` vuol dire che vale la stessa regola dei pesi: chi non
-- è entrato nell'app non vede niente.
create or replace view andamento_settimane with (security_invoker = true) as
  with pesi as (
    select date_trunc('week', (l.updated_at at time zone 'UTC') at time zone 'Europe/Rome')::date as settimana,
           t.coach_id,
           l.client_id
    from client_loads l
    join cycle_exercises ce on ce.id = l.cycle_exercise_id
    join cycles c on c.id = ce.cycle_id
    join turns t on t.id = c.turn_id
    where l.updated_at is not null
  )
  select settimana,
         coach_id,
         grouping(coach_id) = 1 as tutti,
         count(*)::int as pesi,
         count(distinct client_id)::int as persone
  from pesi
  group by grouping sets ((settimana, coach_id), (settimana));

grant select on andamento_settimane to authenticated;


-- ═══ PASSO 3 · LE COPIE DI SICUREZZA ══════════════════════════════════════
-- Il piano gratuito di Supabase non fa copie da solo. Le fa l'app: una volta
-- a settimana mette qui un file con tutti i dati.
--
-- Lo spazio è PRIVATO: i file non hanno un indirizzo pubblico. E dall'app si
-- possono solo AGGIUNGERE copie e leggerle, non cambiarle né cancellarle:
-- nemmeno un errore, o qualcuno con la password in mano, può togliere le
-- copie vecchie. Se un giorno servisse fare spazio, si tolgono a mano da
-- Storage nel pannello di Supabase.
--
-- 20 MB al massimo per copia: oggi una copia pesa circa un megabyte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('copie', 'copie', false, 20971520, array['application/json'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'copie: le aggiunge chi è entrato') then
    create policy "copie: le aggiunge chi è entrato" on storage.objects
      for insert to authenticated with check (bucket_id = 'copie');
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'copie: le legge chi è entrato') then
    create policy "copie: le legge chi è entrato" on storage.objects
      for select to authenticated using (bucket_id = 'copie');
  end if;
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'tabella errori_app' as cosa,
       (to_regclass('public.errori_app') is not null)::text as ok
union all
select 'vista andamento_settimane', (to_regclass('public.andamento_settimane') is not null)::text
union all
select 'spazio file copie (privato)',
       coalesce((select (not public)::text from storage.buckets where id = 'copie'), 'false')
union all
select 'permessi sulle copie (attesi 2)',
       (select count(*) from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'copie:%')::text
union all
select 'settimane nel cruscotto', (select count(*) from andamento_settimane where tutti)::text;

-- Atteso: tre «true», un 2 e un numero (le settimane con almeno un peso).
