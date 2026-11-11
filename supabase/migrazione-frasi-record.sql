-- ═══════════════════════════════════════════════════════════════════════════
--  LE FRASI DELLA FESTA PER I RECORD
--
--  Quando un cliente batte il suo record, l'app fa festa e mostra una frase
--  divertente presa a caso. Con questo script le frasi stanno nel database e
--  valgono su tutti i telefoni.
--
--  Le frasi le gestisce SOLO chi amministra Supabase, dal pannello (Table
--  Editor → frasi_record), che non è soggetto alle regole qui sotto. Dall'app
--  i coach possono soltanto leggerle: il database rifiuta ogni modifica.
--
--  Crea una tabella nuova, `frasi_record`, e ci mette le frasi di serie
--  (le stesse che l'app usa finché lo script non c'è). Le frasi di serie si
--  mettono SOLO se la tabella è vuota: rilanciando lo script non si
--  duplicano, e non tornano quelle che hai tolto.
--
--  🔒  NON CANCELLA NIENTE. Una tabella nuova; nessuna riga di altre tabelle
--      toccata. Si rilancia quante volte si vuole.
--
--  Se NON lo lanci, l'app funziona lo stesso: la festa c'è, con le frasi di
--  serie scritte nell'app.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists frasi_record (
  id uuid primary key default gen_random_uuid(),
  testo text not null,
  created_at timestamptz not null default now()
);

-- Un paracadute: l'app manda frasi fra 1 e 140 caratteri.
do $$
begin
  alter table frasi_record add constraint frasi_record_lunghezza
    check (char_length(btrim(testo)) between 1 and 140);
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;

-- Dall'app solo lettura: c'è la regola per leggere e nessuna per scrivere,
-- quindi aggiungere, cambiare o togliere una frase dall'app viene rifiutato.
-- Il pannello di Supabase non passa da queste regole: lì si modifica.
alter table frasi_record enable row level security;
drop policy if exists "frasi del record: di chi è entrato" on frasi_record;
drop policy if exists "frasi del record: le leggono i coach" on frasi_record;
create policy "frasi del record: le leggono i coach" on frasi_record
  for select to authenticated using (true);

-- Le frasi di serie, solo la prima volta (tabella vuota).
insert into frasi_record (testo)
select testo from unnest(array[
  '{nome} ha appena fatto arrabbiare la gravità!',
  'Attenzione: nuovo livello sbloccato per {nome}!',
  '{kg} di {esercizio}: qualcuno chiami i giornali!',
  'Il bilanciere ha chiesto pietà. {nome} no.',
  'Oggi {nome} ha fatto colazione con pane e determinazione!',
  'Nuovo record per {nome}! Il ferro trema.',
  'Ufficiale: oggi {nome} è più forte di ieri.',
  '{kg}! {nome}, chi ti ferma più?',
  'Il {esercizio} ha trovato chi lo comanda: {nome}!',
  'Applausi in sala per {nome}!',
  'Record battuto! Anche lo specchio della palestra è impressionato.',
  '{nome} + {esercizio} = storia.',
  'Houston, abbiamo un record: {kg}!',
  'Il coach approva. Il bilanciere un po'' meno.',
  '{nome} ha appena alzato l''asticella. Letteralmente.'
]) with ordinality as frasi(testo, n)
where not exists (select 1 from frasi_record)
order by n;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Ci si aspetta «true» e, la prima volta, 15 frasi.
select
  (select count(*) from information_schema.tables
    where table_name = 'frasi_record') > 0 as frasi_pronte,
  (select count(*) from frasi_record)      as frasi_in_tutto;
