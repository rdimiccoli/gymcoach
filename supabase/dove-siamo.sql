-- ═══════════════════════════════════════════════════════════════════════════
--  DOVE SIAMO — quali passi sono già stati lanciati
--
--  SOLO LETTURA. Non cambia niente, non cancella niente, non scrive niente.
--  Si può lanciare quante volte si vuole, anche a occhi chiusi.
--
--  Serve perché la tabella dei conteggi è uguale prima e dopo la migrazione,
--  e guardandola non si capisce a che punto siamo. Questo invece lo dice.
--
--  Lancia tutto in blocco: escono tre tabelle.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1 · I PEZZI ══════════════════════════════════════════════════════════
select cosa, stato from (
  select 1 as ord, 'colonna coaches.nascosto' as cosa,
         case when exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'coaches'
                             and column_name = 'nascosto')
              then 'c''è  ✅  (credenziale unica, PASSO 2)'
              else 'MANCA  ❌  (PASSO 2 non lanciato)' end as stato
  union all
  select 2, 'colonna coaches.emoji',
         case when exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'coaches'
                             and column_name = 'emoji')
              then 'c''è  ✅  (script delle emoji)'
              else 'MANCA  ❌  (script delle emoji non lanciato)' end
  union all
  select 3, 'funzione e_un_profilo_coach',
         case when to_regprocedure('public.e_un_profilo_coach(uuid)') is null
              then 'MANCA  ❌  (PASSO 3 non lanciato)'
              else 'c''è  ✅  (credenziale unica, PASSO 3)' end
  union all
  select 4, 'funzione colleghi()  — deve essere sparita',
         case when to_regprocedure('public.colleghi()') is null
              then 'sparita  ✅'
              else 'C''È ANCORA  ⚠️  (fa uscire i nomi dei coach da un account all''altro)' end
) t order by ord;


-- ═══ 2 · LA REGOLA CHE DECIDE TUTTO ═══════════════════════════════════════
-- Da `turno_accessibile` dipendono a cascata schede, atlete, carichi, note,
-- presenze e ospiti. È lei che dice se il database separa ancora i due coach.
select 'chi può aprire un turno' as cosa,
       case
         when p.prosrc like '%turn_coaches%'      then 'VECCHIA  ❌  separa ancora i coach — la migrazione grossa NON è stata lanciata'
         when p.prosrc like '%auth.uid() is not null%' then 'NUOVA  ✅  chi è entrato vede tutto — la migrazione grossa È stata lanciata'
         else 'non la riconosco  ⚠️  mandami il testo qui sotto'
       end as stato,
       p.prosrc as testo_della_regola
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'turno_accessibile';


-- ═══ 3 · LE REGOLE SUI PROFILI E SUI TURNI ════════════════════════════════
-- Su `coaches` dopo la migrazione devono esserci DUE regole, una per leggere
-- e una per cambiare il nome. Se ce n'è una sola che dice `id = auth.uid()`,
-- siamo ancora a prima.
select tablename as tabella, policyname as regola, cmd as per_cosa,
       coalesce(qual, with_check) as condizione
from pg_policies
where schemaname = 'public' and tablename in ('coaches', 'turns')
order by tablename, cmd, policyname;
