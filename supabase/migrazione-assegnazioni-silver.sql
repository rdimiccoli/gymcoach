-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE
--  Schede assegnate solo ad alcune persone · Atleti Silver ospiti di un turno
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  ⚠️  IL COACH USA GIÀ L'APP CON DATI VERI.
--      Questo script AGGIUNGE soltanto: due tabelle nuove e una colonna.
--      Non cancella né modifica niente di quello che c'è. NON rilanciare
--      `dati-dimostrativi.sql`, che invece svuota tutto.
--
--  È rieseguibile: lanciarlo due volte non fa danni.
--  Finché non lo lanci, l'app funziona esattamente come adesso: si accorge
--  da sola se queste tabelle ci sono e, se mancano, non mostra le funzioni.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ CONTROLLO · la migrazione precedente deve esserci ════════════════════
-- Le regole di accesso qui sotto usano le funzioni create da
-- `migrazione-presenze-condivisione-categorie.sql`. Se mancano, meglio
-- fermarsi subito con un messaggio chiaro che a metà con uno oscuro.
do $$
begin
  if to_regprocedure('public.turno_accessibile(uuid)')  is null
  or to_regprocedure('public.scheda_accessibile(uuid)') is null
  or to_regprocedure('public.atleta_accessibile(uuid)') is null then
    raise exception 'Manca la migrazione precedente: esegui prima migrazione-presenze-condivisione-categorie.sql, poi questa.';
  end if;
end $$;


-- ═══ PASSO 1 · A CHI È ASSEGNATA UNA SCHEDA ═══════════════════════════════
-- Finora una scheda valeva per tutte le persone del suo turno, senza
-- eccezioni. Qui si può restringere a qualcuno.
--
-- LA REGOLA: nessuna riga per una scheda = vale per TUTTO il turno.
-- È così che tutte le schede esistenti continuano a funzionare identiche
-- senza toccarle, e che chi viene aggiunto al turno più avanti entra da solo
-- nelle schede «per tutti».

create table if not exists cycle_clients (
  cycle_id    uuid not null references cycles(id)  on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (cycle_id, client_id)
);

-- Subito, prima di qualsiasi altra cosa: finché è spenta la tabella è aperta
-- a chiunque abbia la chiave anon, che dentro l'app è pubblica.
alter table cycle_clients enable row level security;

create index if not exists idx_cycle_clients_client on cycle_clients (client_id);

drop policy if exists "assegnazioni: delle schede su cui lavoro" on cycle_clients;
create policy "assegnazioni: delle schede su cui lavoro" on cycle_clients
  for all to authenticated
  using      (public.scheda_accessibile(cycle_id))
  with check (public.scheda_accessibile(cycle_id) and public.atleta_accessibile(client_id));


-- ═══ PASSO 2 · ATLETI SILVER ══════════════════════════════════════════════
-- Silver = può disdire la lezione del suo turno e presentarsi a quella di un
-- altro. Il segno serve a una cosa sola: sono loro, e solo loro, a comparire
-- nell'elenco degli ospiti che un coach può aggiungere a un turno.

alter table clients add column if not exists silver boolean not null default false;


-- ═══ PASSO 3 · OSPITI DEL GIORNO ══════════════════════════════════════════
-- Maria Rossi è nel turno delle 09:00; oggi viene alle 18:30. Non si sposta e
-- non si duplica niente: una riga qui dice «oggi, alle 18:30, c'è anche Maria
-- Rossi».
--
-- La scheda segue la persona, non l'orario: i carichi segnati da ospite
-- finiscono sulla SUA scheda, alla SUA settimana, esattamente come al suo
-- turno. Storico, grafici e record restano continui.
--
-- Il giorno dopo la riga non conta più: l'app cerca solo quelle di oggi.
-- Restano nel database come traccia di chi si è spostato e quando.

create table if not exists client_visits (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  turn_id     uuid not null references turns(id)   on delete cascade,
  -- La data la manda l'app, nel fuso italiano. Il default del server è in
  -- UTC: fra mezzanotte e le due scriverebbe il giorno prima.
  visit_date  date not null default current_date,
  created_at  timestamptz not null default now(),
  -- Aggiungere due volte la stessa persona allo stesso turno lo stesso giorno
  -- non crea doppioni.
  unique (client_id, turn_id, visit_date)
);

alter table client_visits enable row level security;

create index if not exists idx_visits_turno_giorno on client_visits (turn_id, visit_date);

-- Chi lavora sul turno che ospita vede e gestisce gli ospiti di quel turno,
-- ma può aggiungere solo persone che è già autorizzato a vedere. Nessuno
-- scopre un atleta di un collega aggiungendolo come ospite.
drop policy if exists "ospiti: dei turni su cui lavoro" on client_visits;
create policy "ospiti: dei turni su cui lavoro" on client_visits
  for all to authenticated
  using      (public.turno_accessibile(turn_id))
  with check (public.turno_accessibile(turn_id) and public.atleta_accessibile(client_id));


-- ═══ PASSO 4 · SICUREZZA PER L'AGGIUNTA DI ATLETI ═════════════════════════
-- L'app non usa più `clients.current_week` e non lo manda quando crea un
-- atleta. Se quella colonna esiste ancora (cioè se `dati-dimostrativi.sql`
-- non è stato rilanciato dopo l'ultimo aggiornamento) e fosse obbligatoria
-- senza un valore di partenza, aggiungere un atleta fallirebbe.
-- Qui le si dà un valore di partenza, se c'è. Se non c'è, non succede niente.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clients'
               and column_name = 'current_week') then
    alter table clients alter column current_week set default 1;
  end if;
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'tabella assegnazioni'   as cosa, (to_regclass('public.cycle_clients') is not null)::text as ok
union all
select 'tabella ospiti',          (to_regclass('public.client_visits') is not null)::text
union all
select 'colonna silver',          (exists (select 1 from information_schema.columns
                                           where table_schema = 'public' and table_name = 'clients'
                                             and column_name = 'silver'))::text
union all
select 'regole di accesso',       (select count(*) from pg_policies
                                   where schemaname = 'public'
                                     and tablename in ('cycle_clients', 'client_visits'))::text || ' di 2';

-- Atteso: tre «true» e «2 di 2».
-- Poi apri l'app e controlla di vedere ancora turni e atleti come prima.
