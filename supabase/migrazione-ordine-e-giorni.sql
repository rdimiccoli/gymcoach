-- ═══════════════════════════════════════════════════════════════════════════
--  L'ORDINE DELLE PERSONE  E  I GIORNI DELLA SCHEDA
--
--  Due richieste arrivate dallo stesso coach:
--
--  1. «Faccio lavorare in coppia le persone che hanno carichi simili: posso
--     gestire io l'ordine?» → ora in TURNI, aperto il turno, c'è RIORDINA e
--     accanto a ogni nome una freccia su e una giù. Chi sta in coppia lo si
--     mette vicino. Chi non tocca niente resta in ordine alfabetico, come
--     prima.
--
--  2. «Io mi alleno cinque volte a settimana, ma tre giorni è il massimo.»
--     → quante giornate ha una scheda lo si sceglie creandola, da 1 a 5, e si
--     può cambiare dopo. Le schede che già esistono restano a tre: non hanno
--     il numero, e senza numero vale tre. Nessuno si accorge di niente.
--
--  🔒  NON CANCELLA NIENTE. Due colonne nuove, vuote. Nessun `delete`,
--      nessun `drop table`, nessuna riga toccata. Si rilancia quante volte
--      si vuole.
--
--  Se NON lo lanci, l'app funziona esattamente come adesso: si accorge da
--  sola che le colonne non ci sono, le frecce salvano niente e il numero di
--  giorni non compare. Nessuna schermata si rompe.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · L'ORDINE DELLE PERSONE DI UN TURNO ═════════════════════════
-- Vuota per tutti. Vuota significa «in ordine alfabetico», che è quello che
-- succede oggi: l'app mette in fondo chi non ha un numero e li ordina per
-- cognome.
alter table clients add column if not exists sort_order integer;

-- Serve a leggere l'elenco di un turno già ordinato, senza far ordinare
-- tredici righe al telefono.
create index if not exists clients_turno_ordine
  on clients (turn_id, sort_order nulls last, surname, name);


-- ═══ PASSO 2 · QUANTI GIORNI HA UNA SCHEDA ════════════════════════════════
-- Vuota per le schede che esistono: vuoto vale tre.
alter table cycles add column if not exists giorni integer;

-- Un paracadute, non una regola di prodotto: l'app non manda mai un numero
-- fuori da 1-5, e questo impedisce che ci arrivi per sbaglio da altrove
-- (una query a mano, un import). Il vuoto resta permesso, ed è il caso
-- normale per tutte le schede di prima.
do $$
begin
  alter table cycles add constraint cycles_giorni_1_5
    check (giorni is null or (giorni >= 1 and giorni <= 5));
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;


-- ═══ PASSO 3 · TOGLIERE IL TETTO AI GIORNI DEGLI ESERCIZI ═════════════════
-- Se in passato qualcuno ha messo un vincolo «day fra 1 e 3» su
-- cycle_exercises, da qui in poi rifiuterebbe gli esercizi del giorno 4 e 5.
-- Questo passo lo cerca e lo sostituisce con lo stesso vincolo allargato a
-- cinque. Se non c'è nessun vincolo, non fa niente: nessun errore.
do $$
declare
  nome text;
begin
  for nome in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'cycle_exercises'
       and con.contype = 'c'
       -- Il vincolo deve riguardare davvero la colonna `day`: si guarda
       -- l'elenco delle colonne a cui è attaccato, non il testo.
       and con.conkey @> array[(
             select att.attnum from pg_attribute att
              where att.attrelid = rel.oid and att.attname = 'day'
           )]::smallint[]
  loop
    execute format('alter table cycle_exercises drop constraint %I', nome);
    raise notice 'Tolto il vecchio vincolo sul giorno: %', nome;
  end loop;

  begin
    alter table cycle_exercises add constraint cycle_exercises_day_1_5
      check (day >= 1 and day <= 5);
  exception
    when duplicate_object then null;
  end;
end $$;


-- ═══ VERIFICA · COSA C'È ADESSO ═══════════════════════════════════════════
-- Ci si aspettano tre righe «sì». Il conto delle schede e delle persone deve
-- essere lo stesso di prima: niente è stato cancellato.
select
  (select count(*) from information_schema.columns
    where table_name = 'clients' and column_name = 'sort_order')  > 0 as ordine_persone_pronto,
  (select count(*) from information_schema.columns
    where table_name = 'cycles'  and column_name = 'giorni')      > 0 as giorni_scheda_pronto,
  (select count(*) from cycles)                                        as schede_in_tutto,
  (select count(*) from clients)                                       as persone_in_tutto,
  (select count(*) from clients where sort_order is not null)           as persone_con_ordine_scelto,
  (select count(*) from cycles  where giorni     is not null)           as schede_con_giorni_scelti;
