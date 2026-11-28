-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE DELLE SEGNALAZIONI (28 novembre 2026)
--  Cosa non va, un'idea, cosa cambiare: scritto nell'app invece che in un
--  audio su WhatsApp.
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge una tabella vuota, una funzione per il
--      «✋ anche io» e uno spazio file privato per le foto dello schermo.
--      Nessun `delete`, nessun `drop`, nessuna riga toccata. Gli unici
--      `revoke` riguardano la tabella e la funzione nuove: servono a far sì
--      che di una segnalazione si cambino solo stato e risposta.
--      Si rilancia quante volte si vuole.
--
--  Finché non la lanci, l'app funziona come adesso e la sezione SEGNALAZIONI
--  non compare.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · LE SEGNALAZIONI ════════════════════════════════════════════
create table if not exists segnalazioni (
  id          uuid primary key default gen_random_uuid(),
  creata      timestamptz not null default now(),
  -- 'problema' 🐞 qualcosa non va · 'idea' 💡 · 'modifica' ✏️ da cambiare
  tipo        text not null,
  testo       text not null,
  coach_id    uuid references coaches(id),
  coach       text,          -- il nome com'era quando l'ha scritta
  versione    text,          -- la versione dell'app sul suo telefono
  dispositivo text,          -- «iPad · Safari 17.2 · app»
  errori      text,          -- gli ultimi errori di quel telefono, se ce n'erano
  foto        text,          -- il percorso nello spazio «segnalazioni»
  -- 'nuova' → 'letta' → 'in_corso' → 'fatta' oppure 'no'
  stato       text not null default 'nuova',
  risposta    text,          -- la risposta di chi sistema l'app
  aggiornata  timestamptz,   -- quando sono cambiati stato o risposta
  anche_io    uuid[] not null default '{}'  -- i coach che hanno detto «anche io»
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'segnalazioni_valori') then
    alter table segnalazioni add constraint segnalazioni_valori check (
      tipo in ('problema', 'idea', 'modifica')
      and stato in ('nuova', 'letta', 'in_corso', 'fatta', 'no')
      and char_length(testo) between 3 and 2000
      and (risposta    is null or char_length(risposta)    <= 1000)
      and (coach       is null or char_length(coach)       <= 40)
      and (versione    is null or char_length(versione)    <= 40)
      and (dispositivo is null or char_length(dispositivo) <= 120)
      and (errori      is null or char_length(errori)      <= 2000)
      and (foto        is null or char_length(foto)        <= 200)
    );
  end if;
end $$;

create index if not exists segnalazioni_creata on segnalazioni (creata desc);

-- Quando cambiano stato o risposta, l'ora la mette il database: così chi
-- l'ha scritta vede «c'è una risposta» anche se il telefono di chi risponde
-- ha l'orologio sbagliato. Un «anche io» non conta come novità.
create or replace function segnalazioni_aggiornata() returns trigger
language plpgsql as $$
begin
  if new.stato is distinct from old.stato or new.risposta is distinct from old.risposta then
    new.aggiornata := now();
  end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger
                 where tgname = 'segnalazioni_aggiornata' and tgrelid = 'public.segnalazioni'::regclass) then
    create trigger segnalazioni_aggiornata before update on segnalazioni
      for each row execute function segnalazioni_aggiornata();
  end if;
end $$;

-- Chi è entrato nell'app scrive e legge le segnalazioni. Dall'app nessuno le
-- cancella, e di una segnalazione già mandata si possono cambiare solo lo
-- stato e la risposta: il testo resta com'è stato scritto.
alter table segnalazioni enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'segnalazioni'
                   and policyname = 'segnalazioni: le scrive chi è entrato') then
    create policy "segnalazioni: le scrive chi è entrato" on segnalazioni
      for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'segnalazioni'
                   and policyname = 'segnalazioni: le legge chi è entrato') then
    create policy "segnalazioni: le legge chi è entrato" on segnalazioni
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'segnalazioni'
                   and policyname = 'segnalazioni: stato e risposta li cambia chi è entrato') then
    create policy "segnalazioni: stato e risposta li cambia chi è entrato" on segnalazioni
      for update to authenticated using (true) with check (true);
  end if;
end $$;

-- I permessi della tabella nuova: leggere e scrivere sì; cambiare, solo le
-- tre colonne della risposta. (Riguarda solo questa tabella, appena creata.)
revoke update on segnalazioni from authenticated;
grant select, insert on segnalazioni to authenticated;
grant update (stato, risposta, aggiornata) on segnalazioni to authenticated;


-- ═══ PASSO 2 · «✋ ANCHE IO» ═══════════════════════════════════════════════
-- Mette o toglie un coach dall'elenco di chi vuole la stessa cosa, in un
-- colpo solo: due coach che toccano insieme non si cancellano a vicenda.
create or replace function segnalazione_anche_io(segnalazione uuid, chi uuid, voglio boolean)
returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  elenco uuid[];
begin
  if auth.uid() is null then
    raise exception 'serve l''accesso';
  end if;
  update segnalazioni
     set anche_io = case when voglio then array_append(array_remove(anche_io, chi), chi)
                         else array_remove(anche_io, chi) end
   where id = segnalazione
  returning anche_io into elenco;
  return elenco;
end $$;

revoke execute on function segnalazione_anche_io(uuid, uuid, boolean) from public, anon;
grant execute on function segnalazione_anche_io(uuid, uuid, boolean) to authenticated;


-- ═══ PASSO 3 · LE FOTO DELLO SCHERMO ═══════════════════════════════════════
-- Spazio file PRIVATO: le foto si vedono solo dall'app. Si aggiungono e si
-- leggono; dall'app non si cambiano e non si cancellano. 5 MB al massimo:
-- l'app le rimpicciolisce prima di mandarle, e restano sotto i 400 kB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('segnalazioni', 'segnalazioni', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'segnalazioni: foto aggiunte da chi è entrato') then
    create policy "segnalazioni: foto aggiunte da chi è entrato" on storage.objects
      for insert to authenticated with check (bucket_id = 'segnalazioni');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'segnalazioni: foto viste da chi è entrato') then
    create policy "segnalazioni: foto viste da chi è entrato" on storage.objects
      for select to authenticated using (bucket_id = 'segnalazioni');
  end if;
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'tabella segnalazioni' as cosa, (to_regclass('public.segnalazioni') is not null)::text as ok
union all
select 'funzione anche io', (to_regprocedure('public.segnalazione_anche_io(uuid,uuid,boolean)') is not null)::text
union all
select 'spazio foto (privato)', coalesce((select (not public)::text from storage.buckets where id = 'segnalazioni'), 'false')
union all
select 'permessi sulle foto (attesi 2)', (select count(*) from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname like 'segnalazioni:%')::text;

-- Atteso: tre «true» e un 2.
