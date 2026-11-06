-- ═══════════════════════════════════════════════════════════════════════════
--  OGNI QUANTE SETTIMANE CAMBIANO LE RIPETIZIONI
--
--  Fino a qui ogni esercizio aveva tre caselle di ripetizioni (SETT. 1-2,
--  3-4, 5-6): la progressione era sempre a due settimane. Ora il coach
--  sceglie, scheda per scheda, ogni quante settimane cambiano — ogni
--  settimana, ogni due, ogni tre — e le caselle diventano tante quanti i
--  blocchi (con 8 settimane «ogni 1» sono otto caselle).
--
--  Servono due colonne:
--    cycles.ogni                 — ogni quante settimane cambiano
--    cycle_exercises.reps_fasi   — le caselle, una per blocco
--
--  Le schede e gli esercizi che esistono restano come sono: senza «ogni»
--  valgono le tre fasi di sempre, e le ripetizioni restano nelle colonne
--  reps_a, reps_b, reps_c, che l'app continua anche a scrivere.
--
--  🔒  NON CANCELLA NIENTE. Due colonne nuove, vuote. Nessun `delete`,
--      nessun `drop table`, nessuna riga toccata. Si rilancia quante volte
--      si vuole.
--
--  Se NON lo lanci, l'app funziona esattamente come adesso: la scelta del
--  passo non compare e le caselle restano tre.
-- ═══════════════════════════════════════════════════════════════════════════

alter table cycles add column if not exists ogni integer;
alter table cycle_exercises add column if not exists reps_fasi text[];

-- Un paracadute: l'app manda sempre un passo fra 1 e 16.
do $$
begin
  alter table cycles add constraint cycles_ogni_1_16
    check (ogni is null or (ogni >= 1 and ogni <= 16));
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Ci si aspettano due «true», e gli stessi numeri di prima.
select
  (select count(*) from information_schema.columns
    where table_name = 'cycles' and column_name = 'ogni') > 0              as passo_pronto,
  (select count(*) from information_schema.columns
    where table_name = 'cycle_exercises' and column_name = 'reps_fasi') > 0 as caselle_pronte,
  (select count(*) from cycles)                                              as schede_in_tutto,
  (select count(*) from cycle_exercises)                                     as esercizi_in_tutto;
