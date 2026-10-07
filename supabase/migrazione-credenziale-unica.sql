-- ═══════════════════════════════════════════════════════════════════════════
--  UNA CREDENZIALE SOLA, DUE PROFILI
--
--  Sandro e Manu si sono accordati: vogliono entrare con una credenziale sola
--  e scegliere dentro l'app per chi stanno lavorando, potendo guardare i turni
--  dell'altro quando serve.
--
--  Fino a oggi il profilo del coach ERA l'account: `coaches.id` è
--  l'identificativo dell'accesso, e ogni regola dice `coach_id = auth.uid()`.
--  Con un account solo quella regola non può più funzionare: l'account è uno,
--  i profili due.
--
--  ⚠️  COSA CAMBIA DAVVERO, detto chiaro
--      Da qui in poi il database NON separa più i due coach. Chi è entrato
--      può leggere e scrivere i dati di tutti e due. La separazione resta
--      solo dentro l'app, nella scelta «chi sei?», ed è una comodità, non una
--      barriera. È esattamente quello che i due coach hanno chiesto.
--
--  🔒  NON CANCELLA NIENTE.
--      Qui dentro non c'è nessun `delete`, nessun `drop table`, nessun
--      `drop column`. Si toccano soltanto le REGOLE DI VISIBILITÀ (le policy)
--      e una funzione: sono permessi, non dati. Turni, schede, atlete e
--      carichi restano dove sono, con gli stessi identificativi.
--      L'unica riga di dati che viene toccata è nel PASSO 4, che è
--      facoltativo, riguarda solo il profilo dimostrativo, e si annulla con
--      una riga.
--
--  Fai comunque un backup prima (Database → Backups): costa un minuto.
--
--  Come si usa: SQL Editor di Supabase, un passo alla volta, nell'ordine.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 0 · PRIMA DI TUTTO, UNA COSA DA GUARDARE A MANO ════════════════
--
--  Vai su Authentication → Sign In / Providers → Email e controlla che
--  «Allow new users to sign up» sia SPENTO.
--
--  Non è un dettaglio e non è rimandabile. Da questa migrazione in poi la
--  regola è «chi è entrato vede tutto»: se la registrazione pubblica fosse
--  aperta, chiunque dal sito potrebbe crearsi un account da solo e leggere
--  turni, atlete e carichi della palestra.
--
--  Finora quella voce era segnata come «da fare» in SICUREZZA.md e non è mai
--  stata confermata. Controllala adesso.
--
--  Se è accesa: spegnila, e solo dopo vai avanti.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · FOTOGRAFIA DI COM'È ADESSO ═════════════════════════════════
-- Solo lettura. Segnati questi numeri: alla fine devono essere identici.
select 'profili coach' as cosa, count(*)::text as quanti from coaches
union all select 'turni',    count(*)::text from turns
union all select 'schede',   count(*)::text from cycles
union all select 'atlete',   count(*)::text from clients
union all select 'carichi',  count(*)::text from client_loads
union all select 'note',     count(*)::text from client_notes
union all select 'turni di ' || coalesce(c.name, c.email),
                 (select count(*) from turns t where t.coach_id = c.id)::text
          from coaches c;


-- ═══ PASSO 2 · UN INTERRUTTORE PER NASCONDERE UN PROFILO ══════════════════
-- Colonna nuova, parte spenta per tutti: nessun profilo cambia comportamento.
-- Serve al PASSO 4. Aggiungere una colonna non tocca i dati che ci sono.
alter table coaches add column if not exists nascosto boolean not null default false;


-- ═══ PASSO 3 · LE REGOLE ══════════════════════════════════════════════════
-- Tutto l'impianto passa da una funzione sola, `turno_accessibile`: schede,
-- atlete, carichi, note, presenze e ospiti la richiamano a cascata. Cambiando
-- lei cambia tutto il resto, senza toccarne le policy.

-- 3a · chi può aprire un turno
--
-- Prima: «il turno è mio, oppure me l'hanno condiviso».
-- Adesso: «sono entrato». La condivisione fra coach non esiste più dal
-- 29/9/2026, e il proprietario non serve più a decidere chi vede: lo decide
-- l'app con la scelta del profilo.
create or replace function public.turno_accessibile(p_turn uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from turns t where t.id = p_turn);
$$;

-- 3b · creare, rinominare ed eliminare un turno
--
-- Prima volevano `coach_id = auth.uid()`, che con la credenziale comune non
-- sarebbe mai vero: l'account non è nessuno dei due profili, e creare un
-- turno fallirebbe. Adesso la condizione è che il `coach_id` scritto sia un
-- profilo coach che esiste davvero — così un turno non può restare orfano.
create or replace function public.e_un_profilo_coach(p_coach uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from coaches c where c.id = p_coach);
$$;

drop policy if exists "turni: crea solo i propri"     on turns;
drop policy if exists "turni: modifica solo i propri" on turns;
drop policy if exists "turni: elimina solo i propri"  on turns;

create policy "turni: crea per un profilo che esiste" on turns
  for insert to authenticated with check (public.e_un_profilo_coach(coach_id));
create policy "turni: modifica chi è entrato" on turns
  for update to authenticated
  using (public.turno_accessibile(id)) with check (public.e_un_profilo_coach(coach_id));
create policy "turni: elimina chi è entrato" on turns
  for delete to authenticated using (public.turno_accessibile(id));

-- 3c · la tabella dei profili
--
-- Era chiusa: ognuno vedeva solo sé stesso. Serviva a non far uscire le email
-- da un account all'altro. Adesso l'elenco dei profili è proprio la schermata
-- «chi sei?», quindi deve essere leggibile da chi è entrato.
--
-- Le vecchie regole si tolgono per nome, che però non conosciamo: le togliamo
-- tutte in blocco e le riscriviamo. Il ciclo stampa quali ha tolto, così
-- resta scritto cosa c'era prima.
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'coaches'
  loop
    execute format('drop policy %I on coaches', r.policyname);
    raise notice 'tolta la vecchia regola su coaches: %', r.policyname;
  end loop;
end $$;

alter table coaches enable row level security;

create policy "profili: li vede chi è entrato" on coaches
  for select to authenticated using (true);
-- Serve a IMPOSTAZIONI → MODIFICA per sistemare i nomi.
create policy "profili: il nome lo cambia chi è entrato" on coaches
  for update to authenticated using (true) with check (true);

-- Nota: non c'è nessuna regola per CREARE o ELIMINARE un profilo, ed è voluto.
-- L'app non ne crea più da sola — prima lo faceva al primo accesso, e con la
-- credenziale comune avrebbe prodotto un terzo coach fantasma accanto a
-- Sandro e Manu. Un profilo nuovo si aggiunge da qui, a mano:
--   insert into coaches (id, email, name) values (gen_random_uuid(), 'x@y.it', 'Nome');

-- 3d · la funzione dei colleghi, se è ancora in giro
-- Serviva alla condivisione dei turni, tolta il 29/9/2026. Era il PASSO 3 di
-- togli-condivisioni.sql, che non sappiamo se sia mai stato lanciato.
drop function if exists public.colleghi();


-- ═══ PASSO 4 · FACOLTATIVO · il profilo dimostrativo ══════════════════════
--
--  Se nel database c'è ancora «Sandro · sandro@esempio.it» (l'avanzo dei dati
--  dimostrativi), nella schermata «chi sei?» comparirebbero TRE nomi, di cui
--  DUE scritti «Sandro». È la stessa confusione che il 29/9/2026 ha fatto
--  condividere un turno alla persona sbagliata.
--
--  Questo passo NON cancella niente: accende solo l'interruttore «nascosto»
--  su quel profilo, che sparisce dall'elenco ma resta nel database con tutti
--  i suoi dati.
--
--  Si annulla in qualsiasi momento con:
--    update coaches set nascosto = false where email = 'sandro@esempio.it';
--
--  Se preferisci non toccarlo, salta pure: l'app funziona lo stesso, solo che
--  nell'elenco ci saranno due Sandro.
update coaches set nascosto = true where email = 'sandro@esempio.it';


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Gli stessi numeri del PASSO 1. Devono essere IDENTICI: se uno è cambiato,
-- fermati e ripristina il backup.
select 'profili coach' as cosa, count(*)::text as quanti from coaches
union all select 'turni',    count(*)::text from turns
union all select 'schede',   count(*)::text from cycles
union all select 'atlete',   count(*)::text from clients
union all select 'carichi',  count(*)::text from client_loads
union all select 'note',     count(*)::text from client_notes
union all select 'turni di ' || coalesce(c.name, c.email),
                 (select count(*) from turns t where t.coach_id = c.id)::text
          from coaches c;

-- E i profili che compariranno nella schermata «chi sei?»:
select name, email, nascosto from coaches order by nascosto, name;


-- ═══════════════════════════════════════════════════════════════════════════
--  DOPO, FUORI DA QUI
--
--  1. Crea l'account comune: Authentication → Users → Add user, con una
--     email neutra (per esempio oad@...), password a scelta, e spunta
--     «Auto Confirm User» così non serve confermare via email.
--
--  2. I due account attuali restano attivi e funzionanti: non li tocchiamo.
--     Entrando da quelli si vedrà la stessa schermata «chi sei?», perché
--     adesso i profili sono leggibili da chiunque sia entrato.
--
--  3. Sandro e Manu aprono l'app, toccano AGGIORNA sul banner, entrano con la
--     credenziale comune e toccano il proprio nome. La scelta resta nel
--     telefono: la domanda non ricomparirà.
--
--  4. Lo sblocco con l'impronta è legato all'account, non al profilo: chi
--     l'aveva attivo dovrà riattivarlo da IMPOSTAZIONI dopo il primo accesso
--     con la credenziale nuova.
-- ═══════════════════════════════════════════════════════════════════════════
