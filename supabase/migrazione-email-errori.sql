-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · IL RIASSUNTO DEGLI ERRORI PER EMAIL (28 novembre 2026)
--
--  Ogni sera un'email a chi sviluppa l'app con gli errori che l'app ha
--  annotato da sola nelle ultime 24 ore (tabella errori_app), raggruppati:
--  quante volte, in che schermata, con quali coach, su quanti telefoni.
--  Se non ci sono stati errori, niente email.
--
--  Una al giorno e non una per errore: un errore che si ripete su quattro
--  tablet consumerebbe le 100 email al giorno del piano gratuito di Resend,
--  comprese quelle delle segnalazioni.
--
--  Usa la stessa chiave e lo stesso indirizzo delle segnalazioni (cassaforte
--  di Supabase: segnalazioni_resend e segnalazioni_email). Va lanciata DOPO
--  migrazione-registro-cruscotto-copie.sql e migrazione-segnalazioni.sql.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge tre funzioni e un lavoro programmato.
--      Nessun `delete`, nessun `drop`, nessuna riga toccata.
--      Si rilancia quante volte si vuole.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · GLI ATTREZZI ═══════════════════════════════════════════════
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- La stessa della migrazione delle segnalazioni: qui per stare in piedi da sola.
create or replace function segnalazioni_html(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- I nomi delle schermate come li chiamano i coach.
create or replace function errori_nome_pagina(p text) returns text
language sql immutable as $$
  select case p
    when 'home' then 'Home' when 'turn' then 'Seduta' when 'turn-atleti' then 'Turno'
    when 'cycles' then 'Schede' when 'cycle-form' then 'Scheda' when 'cycle-share' then 'Condividi scheda'
    when 'settings' then 'Impostazioni' when 'turns' then 'Turni' when 'athletes' then 'Atleti'
    when 'athlete-profile' then 'Profilo atleta' when 'pulizia' then 'Mettere in ordine'
    when 'cruscotto' then 'Cruscotto' when 'segnalazioni' then 'Segnalazioni'
    else p end
$$;


-- ═══ PASSO 2 · IL RIASSUNTO ═══════════════════════════════════════════════
-- `prova` = true: manda l'email anche se oggi non ci sono errori, per vedere
-- che arriva. Torna una frase che dice cosa ha fatto.
create or replace function errori_riassunto_email(prova boolean default false)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  chiave_resend text;
  destinatario  text;
  quanti        int;
  diversi       int;
  righe         text;
  oggetto       text;
  corpo         text;
begin
  select decrypted_secret into chiave_resend from vault.decrypted_secrets where name = 'segnalazioni_resend' limit 1;
  select decrypted_secret into destinatario  from vault.decrypted_secrets where name = 'segnalazioni_email' limit 1;
  if coalesce(chiave_resend, '') = '' or coalesce(destinatario, '') = '' then
    return 'Niente email: manca la chiave di Resend o l''indirizzo nella cassaforte.';
  end if;

  select count(*), count(distinct messaggio) into quanti, diversi
    from errori_app where quando > now() - interval '24 hours';

  if quanti = 0 and not prova then
    return 'Nessun errore nelle ultime 24 ore: niente email.';
  end if;

  select string_agg(riga, '' order by volte desc, ultima desc) into righe
  from (
    select count(*) as volte, max(quando) as ultima,
      '<tr><td style="padding:8px 10px 8px 0;vertical-align:top;font-size:18px;font-weight:bold;white-space:nowrap">'
      || count(*) || '×</td><td style="padding:8px 0;border-bottom:1px solid #eee">'
      || case when tipo = 'schermata' then '💥 ' else '' end
      || '<b>' || segnalazioni_html(messaggio) || '</b><br>'
      || '<span style="font-size:13px;color:#555">'
      || segnalazioni_html(concat_ws(' · ',
           case tipo when 'avviso' then 'avviso rosso a schermo'
                     when 'schermata' then 'schermata «Qualcosa è andato storto»'
                     else 'errore del programma' end,
           nullif(string_agg(distinct errori_nome_pagina(pagina), ', '), ''),
           nullif(string_agg(distinct coach, ', '), ''),
           count(distinct dispositivo) || case when count(distinct dispositivo) = 1 then ' telefono' else ' telefoni' end,
           'ultima volta alle ' || to_char(max(quando) at time zone 'Europe/Rome', 'HH24:MI')))
      || '</span>'
      || coalesce('<br><span style="font-family:monospace;font-size:11px;color:#888">'
           || segnalazioni_html(left(split_part(min(dettaglio), E'\n', 1), 200)) || '</span>', '')
      || '<br><span style="font-size:11px;color:#aaa">'
      || segnalazioni_html(string_agg(distinct dispositivo, ' / ')) || ' · versione '
      || segnalazioni_html(string_agg(distinct versione, ', ')) || '</span>'
      || '</td></tr>' as riga
    from errori_app
    where quando > now() - interval '24 hours'
    group by messaggio, tipo
    order by count(*) desc, max(quando) desc
    limit 20
  ) gruppi;

  oggetto := case when quanti = 0
    then '🩺 GymCoach: prova del riassunto errori (oggi nessun errore)'
    else '🩺 GymCoach: ' || quanti || case when quanti = 1 then ' errore' else ' errori' end
         || ' nelle ultime 24 ore' || case when diversi > 1 then ' (' || diversi || ' diversi)' else '' end
    end;

  corpo := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#111;max-width:620px">'
    || '<h2 style="margin:0 0 6px;font-size:20px">🩺 Gli errori di GymCoach</h2>'
    || '<p style="margin:0 0 14px;color:#555;font-size:13px">Le ultime 24 ore, fino alle '
    || to_char(now() at time zone 'Europe/Rome', 'HH24:MI "del" DD/MM') || '. L''app li annota da sola; ai coach non arriva niente.</p>'
    || case when quanti = 0
         then '<p>Nessun errore. Questa è solo una prova: quando ce ne saranno, arriveranno qui, una volta al giorno.</p>'
         else '<table style="border-collapse:collapse;width:100%">' || righe || '</table>'
              || case when diversi > 20 then '<p style="color:#555;font-size:13px">Qui ci sono i 20 più frequenti, su ' || diversi || '.</p>' else '' end
       end
    || '<p style="margin:18px 0 0;font-size:12px;color:#888">Tutti i dettagli: pannello di Supabase, tabella errori_app '
    || '(oppure chiedi a Claude «guarda gli errori»). Gli errori di chi manda una segnalazione «Qualcosa non va» '
    || 'arrivano anche dentro quella email.</p>'
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
  return 'Email partita: ' || quanti || ' errori nelle ultime 24 ore.';
end $$;

-- Solo il database la lancia (e chi la prova dal SQL Editor): dall'app no,
-- altrimenti chiunque potrebbe riempirti la casella.
revoke execute on function errori_riassunto_email(boolean) from public, anon, authenticated;
revoke execute on function errori_nome_pagina(text) from public, anon, authenticated;
revoke execute on function segnalazioni_html(text) from public, anon, authenticated;


-- ═══ PASSO 3 · OGNI SERA ══════════════════════════════════════════════════
-- Alle 21:00 UTC, cioè le 22:00 d'inverno e le 23:00 d'estate in Italia
-- (il programmatore di Supabase ragiona in UTC). Stesso nome: rilanciando
-- la migrazione l'orario si aggiorna, non si raddoppia.
select cron.schedule('gymcoach-riassunto-errori', '0 21 * * *', $$select public.errori_riassunto_email()$$);


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'funzione del riassunto' as cosa,
       (to_regprocedure('public.errori_riassunto_email(boolean)') is not null)::text as ok
union all
select 'lavoro serale programmato',
       exists (select 1 from cron.job where jobname = 'gymcoach-riassunto-errori')::text;

-- Atteso: due «true».


-- ═══════════════════════════════════════════════════════════════════════════
--  PER PROVARLA SUBITO (manda l'email anche se oggi non ci sono errori):
--
--       select errori_riassunto_email(true);
--
--  Per vedere quando è girata la sera:
--       select start_time, status, return_message from cron.job_run_details
--       where jobid = (select jobid from cron.job where jobname = 'gymcoach-riassunto-errori')
--       order by start_time desc limit 5;
-- ═══════════════════════════════════════════════════════════════════════════
