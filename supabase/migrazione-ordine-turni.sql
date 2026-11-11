-- ═══════════════════════════════════════════════════════════════════════════
--  I TURNI NELL'ORDINE CHE VUOLE IL COACH
--
--  Fino a qui la Home metteva i turni in ordine di orario, e basta. Ora il
--  coach li sposta con ⇅ RIORDINA, e l'ordine scelto vale su tutti i
--  telefoni (e anche in TURNI e SCHEDE).
--
--  Serve una colonna:
--    turns.sort_order   — il posto del turno nell'elenco
--
--  I turni che esistono restano come sono: senza numero vanno per orario,
--  come prima. Un turno nuovo finisce in fondo.
--
--  🔒  NON CANCELLA NIENTE. Una colonna nuova, vuota. Nessun `delete`,
--      nessun `drop table`, nessuna riga toccata. Si rilancia quante volte
--      si vuole.
--
--  Se NON lo lanci, l'app funziona esattamente come adesso: il pulsante
--  ⇅ RIORDINA non compare e i turni restano in ordine di orario.
-- ═══════════════════════════════════════════════════════════════════════════

alter table turns add column if not exists sort_order integer;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Ci si aspetta un «true», e lo stesso numero di turni di prima.
select
  (select count(*) from information_schema.columns
    where table_name = 'turns' and column_name = 'sort_order') > 0 as ordine_turni_pronto,
  (select count(*) from turns)                                     as turni_in_tutto;
