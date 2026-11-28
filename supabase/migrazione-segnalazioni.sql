-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE DELLE SEGNALAZIONI (28 novembre 2026)
--  Cosa non va, un'idea, cosa cambiare: scritto nell'app invece che in un
--  audio su WhatsApp, e un'email a chi sistema l'app per ognuna.
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge una tabella vuota, le funzioni per
--      «✋ anche io», per l'email e per rispondere, e uno spazio file per le
--      foto dello schermo. Nessun `delete`, nessun `drop`, nessuna riga
--      toccata. Gli unici `revoke` riguardano la tabella e le funzioni nuove.
--      Si rilancia quante volte si vuole.
--
--  Finché non la lanci, l'app funziona come adesso e la sezione SEGNALAZIONI
--  non compare.
--
--  DOPO averla lanciata, per ricevere le email: vedi «L'EMAIL» in fondo.
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
  aggiornata  timestamptz,   -- quando è arrivata una risposta o un passo avanti
  anche_io    uuid[] not null default '{}',  -- i coach che hanno detto «anche io»
  -- Il codice del pulsante RISPONDI nell'email: chi ce l'ha può rispondere a
  -- QUESTA segnalazione, anche senza entrare nell'app. Dall'app non si legge.
  chiave      uuid not null default gen_random_uuid()
);
alter table segnalazioni add column if not exists chiave uuid not null default gen_random_uuid();

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

-- L'ora di una novità la mette il database: una risposta, o un passo avanti
-- (in lavorazione, fatta, non si fa). «Letta» da sola non conta, e nemmeno
-- un «anche io»: al coach non deve comparire una novità che non dice niente.
create or replace function segnalazioni_aggiornata() returns trigger
language plpgsql as $$
begin
  if new.risposta is distinct from old.risposta
     or (new.stato is distinct from old.stato and new.stato <> 'letta') then
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
-- cambia né le cancella: lo stato e la risposta passano dal pulsante
-- RISPONDI dell'email (PASSO 4), e il codice di quel pulsante non si legge.
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
end $$;

revoke select, update on segnalazioni from authenticated;
grant insert on segnalazioni to authenticated;
grant select (id, creata, tipo, testo, coach_id, coach, versione, dispositivo, errori, foto,
              stato, risposta, aggiornata, anche_io) on segnalazioni to authenticated;


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


-- ═══ PASSO 3 · L'EMAIL A CHI SISTEMA L'APP ═════════════════════════════════
-- A ogni segnalazione nuova il database manda un'email (con Resend, gratuito
-- fino a 100 al giorno) all'indirizzo salvato nella cassaforte di Supabase
-- (Vault). Se la chiave o l'indirizzo non ci sono, non manda niente.
-- L'email non può mai fermare una segnalazione: se qualcosa va storto, la
-- segnalazione resta salvata lo stesso.
create extension if not exists pg_net;

create or replace function segnalazioni_html(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function segnalazioni_avvisa() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  chiave_resend text;
  destinatario  text;
  icona         text;
  nome_tipo     text;
  collegamento  text;
  oggetto       text;
  corpo         text;
begin
  select decrypted_secret into chiave_resend from vault.decrypted_secrets where name = 'segnalazioni_resend' limit 1;
  select decrypted_secret into destinatario  from vault.decrypted_secrets where name = 'segnalazioni_email' limit 1;
  if coalesce(chiave_resend, '') = '' or coalesce(destinatario, '') = '' then
    return new;
  end if;

  icona := case new.tipo when 'problema' then '🐞' when 'idea' then '💡' else '✏️' end;
  nome_tipo := case new.tipo when 'problema' then 'Qualcosa non va' when 'idea' then 'Un''idea' else 'Da cambiare' end;
  collegamento := 'https://gymcoach-lac.vercel.app/?rispondi=' || new.id || '&chiave=' || new.chiave;
  oggetto := icona || ' ' || nome_tipo || ' · ' || coalesce(new.coach, 'un coach') || ': '
             || left(regexp_replace(new.testo, '\s+', ' ', 'g'), 60)
             || case when char_length(new.testo) > 60 then '…' else '' end;

  corpo := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">'
    || '<p style="font-size:13px;color:#666;margin:0 0 4px">Segnalazione da <b>' || segnalazioni_html(coalesce(new.coach, 'un coach'))
    || '</b> · ' || to_char(new.creata at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI') || '</p>'
    || '<h2 style="margin:0 0 12px;font-size:21px">' || icona || ' ' || nome_tipo || '</h2>'
    || '<p style="white-space:pre-wrap;margin:0 0 16px;font-size:17px">' || segnalazioni_html(new.testo) || '</p>'
    || case when new.foto is not null then '<p style="margin:0 0 16px">📷 C''è una foto dello schermo: la vedi aprendo RISPONDI.</p>' else '' end
    || '<p style="margin:0 0 8px"><a href="' || collegamento || '" style="display:inline-block;background:#D95C1A;color:#ffffff;'
    || 'text-decoration:none;font-weight:bold;font-size:17px;padding:14px 26px;border-radius:6px">RISPONDI</a></p>'
    || '<p style="font-size:13px;color:#666;margin:0 0 18px">Da lì scegli a che punto è (letta, in lavorazione, fatta, non si fa) '
    || 'e scrivi la risposta: ' || segnalazioni_html(coalesce(new.coach, 'chi l''ha scritta')) || ' la vede nell''app.</p>'
    || case when new.dispositivo is not null or new.versione is not null then
         '<p style="font-size:12px;color:#888;margin:0 0 6px">' || segnalazioni_html(concat_ws(' · ', new.dispositivo, 'versione ' || new.versione)) || '</p>'
       else '' end
    || case when new.errori is not null then
         '<p style="font-size:12px;color:#888;margin:0 0 4px">Gli ultimi errori di quel telefono:</p>'
         || '<pre style="font-size:12px;color:#444;white-space:pre-wrap;background:#f3f3f3;padding:8px;border-radius:4px;margin:0">'
         || segnalazioni_html(new.errori) || '</pre>'
       else '' end
    || '</div>';

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', 'GymCoach <onboarding@resend.dev>',
      'to', jsonb_build_array(destinatario),
      'subject', oggetto,
      'html', corpo),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || chiave_resend,
      'Content-Type', 'application/json')
  );
  return new;
exception when others then
  return new;
end $$;

revoke execute on function segnalazioni_html(text) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                 where tgname = 'segnalazioni_avvisa' and tgrelid = 'public.segnalazioni'::regclass) then
    create trigger segnalazioni_avvisa after insert on segnalazioni
      for each row execute function segnalazioni_avvisa();
  end if;
end $$;


-- ═══ PASSO 4 · IL PULSANTE «RISPONDI» DELL'EMAIL ══════════════════════════
-- Il pulsante apre l'app su una pagina sola, anche senza entrare: si vede la
-- segnalazione, si sceglie a che punto è e si risponde. Funziona solo con il
-- codice di QUELLA segnalazione, che sta nell'email.
-- Aprirla la segna come letta.
create or replace function segnalazione_da_rispondere(quale uuid, codice uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  r segnalazioni;
begin
  select * into r from segnalazioni where id = quale and chiave = codice;
  if not found then
    return null;
  end if;
  if r.stato = 'nuova' then
    update segnalazioni set stato = 'letta' where id = r.id;
    r.stato := 'letta';
  end if;
  return json_build_object(
    'id', r.id, 'creata', r.creata, 'tipo', r.tipo, 'testo', r.testo, 'coach', r.coach,
    'versione', r.versione, 'dispositivo', r.dispositivo, 'errori', r.errori, 'foto', r.foto,
    'stato', r.stato, 'risposta', r.risposta, 'anche_io', coalesce(array_length(r.anche_io, 1), 0));
end $$;

create or replace function segnalazione_rispondi(quale uuid, codice uuid, nuovo_stato text, testo_risposta text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if nuovo_stato not in ('letta', 'in_corso', 'fatta', 'no') then
    raise exception 'stato non valido';
  end if;
  update segnalazioni
     set stato = nuovo_stato,
         risposta = nullif(btrim(left(coalesce(testo_risposta, ''), 1000)), '')
   where id = quale and chiave = codice;
  return found;
end $$;

revoke execute on function segnalazione_da_rispondere(uuid, uuid) from public;
revoke execute on function segnalazione_rispondi(uuid, uuid, text, text) from public;
grant execute on function segnalazione_da_rispondere(uuid, uuid) to anon, authenticated;
grant execute on function segnalazione_rispondi(uuid, uuid, text, text) to anon, authenticated;


-- ═══ PASSO 5 · LE FOTO DELLO SCHERMO ═══════════════════════════════════════
-- Si vedono con il loro indirizzo, che è lungo e casuale: serve perché la
-- pagina RISPONDI funziona anche senza entrare nell'app. Dall'app si
-- aggiungono e basta: non si cambiano e non si cancellano. 5 MB al massimo
-- (l'app le rimpicciolisce prima di mandarle: restano sotto i 400 kB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('segnalazioni', 'segnalazioni', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'segnalazioni: foto aggiunte da chi è entrato') then
    create policy "segnalazioni: foto aggiunte da chi è entrato" on storage.objects
      for insert to authenticated with check (bucket_id = 'segnalazioni');
  end if;
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'tabella segnalazioni' as cosa, (to_regclass('public.segnalazioni') is not null)::text as ok
union all
select 'funzione anche io', (to_regprocedure('public.segnalazione_anche_io(uuid,uuid,boolean)') is not null)::text
union all
select 'pulsante rispondi', (to_regprocedure('public.segnalazione_rispondi(uuid,uuid,text,text)') is not null)::text
union all
select 'invio delle email (pg_net)', exists (select 1 from pg_extension where extname = 'pg_net')::text
union all
select 'spazio foto', exists (select 1 from storage.buckets where id = 'segnalazioni')::text;

-- Atteso: cinque «true».


-- ═══════════════════════════════════════════════════════════════════════════
--  L'EMAIL · da fare UNA volta, dopo la migrazione
--
--  1. Crea un account gratuito su resend.com (va bene entrare con Google,
--     con la STESSA email su cui vuoi ricevere le segnalazioni).
--  2. In Resend: «API Keys» → «Create API Key», permesso «Sending access».
--     Copia la chiave (comincia con re_). Non incollarla in chat.
--  3. Qui nel SQL Editor lancia queste due righe, con i tuoi dati al posto
--     di quelli tra virgolette (restano nella cassaforte di Supabase, non
--     nel codice dell'app):
--
--       select vault.create_secret('re_LA_TUA_CHIAVE', 'segnalazioni_resend');
--       select vault.create_secret('la-tua-email@esempio.it', 'segnalazioni_email');
--
--  4. Manda una segnalazione di prova dall'app. Se l'email non arriva entro
--     un minuto (guarda anche nello spam), questa riga dice cosa ha risposto
--     Resend:
--
--       select created, status_code, content from net._http_response order by created desc limit 3;
--
--  Per cambiare chiave o indirizzo:
--       select vault.update_secret((select id from vault.secrets where name = 'segnalazioni_email'), 'nuova@esempio.it');
-- ═══════════════════════════════════════════════════════════════════════════
