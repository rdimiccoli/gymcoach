-- ═══════════════════════════════════════════════════════════════════════════
--  DIAGNOSI · perché due coach si vedono i turni a vicenda
--
--  Non modifica NIENTE: legge e basta. Lancialo tutto e mandami la tabella
--  che esce.
-- ═══════════════════════════════════════════════════════════════════════════

with
-- 1. Le protezioni sono accese? Se qui compare «false», la tabella è aperta a
--    chiunque e nessuna regola viene applicata.
protezione as (
  select 1 as ord,
         'protezione attiva su ' || c.relname as voce,
         c.relrowsecurity::text as valore
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('turns', 'cycles', 'clients', 'cycle_exercises', 'client_loads')
),

-- 2. Quali regole esistono davvero, e cosa dicono. Una regola che dice
--    soltanto «true» lascia passare tutto.
regole as (
  select 2 as ord,
         'regola · ' || tablename || ' · ' || policyname || ' [' || cmd || ']' as voce,
         coalesce(qual, with_check, 'SENZA CONDIZIONE') as valore
  from pg_policies
  where schemaname = 'public' and tablename in ('turns', 'cycles')
),

-- 3. Le funzioni su cui si appoggiano le regole esistono?
funzioni as (
  select 3 as ord,
         'funzione ' || p.proname as voce,
         'esiste, security definer = ' || p.prosecdef::text as valore
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('turno_accessibile', 'scheda_accessibile', 'atleta_accessibile')
),

-- 4. Quanti sono gli account di accesso veri e propri.
--    Se qui c'è 1 solo, Sandro e Manu stanno entrando con lo stesso account:
--    in quel caso nessuna regola può dividerli, perché per il database sono
--    la stessa persona.
accessi as (
  select 4 as ord, 'account di accesso (auth.users)' as voce, count(*)::text as valore
  from auth.users
),

-- 5. Chi possiede cosa.
proprieta as (
  select 5 as ord,
         'coach · ' || coalesce(c.name, '(senza nome)') || ' · ' || c.email as voce,
         (select count(*) from turns t where t.coach_id = c.id)::text || ' turni' as valore
  from coaches c
),

-- 6. Turni senza proprietario: appartengono a nessuno e le regole non sanno
--    a chi mostrarli.
orfani as (
  select 6 as ord, 'turni senza proprietario' as voce, count(*)::text as valore
  from turns where coach_id is null
),

-- 7. Condivisioni fatte a mano. Se qui c'è più di 0, qualcuno ha usato
--    «CHI PUÒ APRIRLO OLTRE A TE» e i turni sono condivisi apposta:
--    basta toglierle, non è un difetto.
condivisioni as (
  select 7 as ord,
         'condivisione · turno ' || coalesce(t.name, '?') || ' → ' || coalesce(c.name, c.email) as voce,
         'condiviso a mano' as valore
  from turn_coaches tc
  left join turns t   on t.id = tc.turn_id
  left join coaches c on c.id = tc.coach_id
),
condivisioni_totale as (
  select 7 as ord, 'condivisioni a mano in totale' as voce, count(*)::text as valore
  from turn_coaches
)

select voce, valore from (
  select * from protezione
  union all select * from regole
  union all select * from funzioni
  union all select * from accessi
  union all select * from proprieta
  union all select * from orfani
  union all select * from condivisioni_totale
  union all select * from condivisioni
) tutto
order by ord, voce;
