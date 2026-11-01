-- ═══════════════════════════════════════════════════════════════════════════
--  QUANTE SETTIMANE DURA UNA SCHEDA
--
--  Era sei, per tutte. Ora la sceglie il coach a ogni nuova scheda — due,
--  otto, quelle che servono — e si può cambiare dopo da MODIFICA in SCHEDE.
--  «Settimana 3 di 8», la barra, l'avviso di fine scheda e le caselle delle
--  ripetizioni si adattano da soli.
--
--  Le schede che già esistono non hanno il numero: vuoto vale sei, cioè
--  esattamente come prima. Nessuno si accorge di niente.
--
--  🔒  NON CANCELLA NIENTE. Una colonna nuova, vuota. Nessun `delete`,
--      nessun `drop table`, nessuna riga toccata. Si rilancia quante volte
--      si vuole.
--
--  Se NON lo lanci, l'app funziona esattamente come adesso: si accorge da
--  sola che la colonna non c'è e la scelta delle settimane non compare.
-- ═══════════════════════════════════════════════════════════════════════════

alter table cycles add column if not exists settimane integer;

-- Un paracadute: l'app manda sempre un numero fra 1 e 16. Il vuoto resta
-- permesso, ed è il caso di tutte le schede di prima.
do $$
begin
  alter table cycles add constraint cycles_settimane_1_16
    check (settimane is null or (settimane >= 1 and settimane <= 16));
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Ci si aspetta «true», e lo stesso numero di schede di prima.
select
  (select count(*) from information_schema.columns
    where table_name = 'cycles' and column_name = 'settimane') > 0 as durata_pronta,
  (select count(*) from cycles)                                     as schede_in_tutto,
  (select count(*) from cycles where settimane is not null)         as schede_con_durata_scelta;
