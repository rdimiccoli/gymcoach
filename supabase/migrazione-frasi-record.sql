-- ═══════════════════════════════════════════════════════════════════════════
--  LE FRASI DELLA FESTA PER I RECORD
--
--  Quando un cliente batte il suo record, l'app fa festa: un'emoji, un
--  titolo grande e una frase divertente, presi a caso fra le righe di questa
--  tabella. Le righe stanno nel database e valgono su tutti i telefoni.
--
--  Ogni riga è una festa:
--    emoji   — vuota: 🏆
--    titolo  — vuoto: «NUOVO RECORD!»          (al massimo 30 caratteri)
--    testo   — vuoto: nessuna frase sotto       (al massimo 140 caratteri)
--  Almeno uno fra titolo e testo dev'esserci. In titolo e testo si possono
--  scrivere {nome}, {kg} e {esercizio}: l'app li sostituisce.
--
--  Le righe le gestisce SOLO chi amministra Supabase (SQL Editor o Table
--  Editor), che non è soggetto alle regole qui sotto. Dall'app i coach
--  possono soltanto leggerle: il database rifiuta ogni modifica.
--
--  Le frasi di serie si mettono SOLO se la tabella è vuota: rilanciando lo
--  script non si duplicano, e non tornano quelle che hai tolto.
--
--  🔒  NON CANCELLA NIENTE. Una tabella nuova; nessuna riga di altre tabelle
--      toccata. Si rilancia quante volte si vuole.
--
--  Se NON lo lanci, l'app funziona lo stesso: la festa c'è, con le frasi di
--  serie scritte nell'app.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists frasi_record (
  id uuid primary key default gen_random_uuid(),
  emoji text,
  titolo text,
  testo text,
  created_at timestamptz not null default now()
);

-- Se la tabella c'era già nella prima versione (solo testo, obbligatorio).
alter table frasi_record add column if not exists emoji text;
alter table frasi_record add column if not exists titolo text;
alter table frasi_record alter column testo drop not null;
alter table frasi_record drop constraint if exists frasi_record_lunghezza;

-- I paracadute: una riga deve dire qualcosa, e starci sullo schermo.
do $$
begin
  alter table frasi_record add constraint frasi_record_dice_qualcosa
    check (coalesce(btrim(titolo), '') <> '' or coalesce(btrim(testo), '') <> '');
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;

do $$
begin
  alter table frasi_record add constraint frasi_record_lunghezze
    check (char_length(coalesce(titolo, '')) <= 30
       and char_length(coalesce(testo, '')) <= 140
       and char_length(coalesce(emoji, '')) <= 16);
exception
  when duplicate_object then null;
end $$;

-- Dall'app solo lettura: c'è la regola per leggere e nessuna per scrivere,
-- quindi aggiungere, cambiare o togliere una riga dall'app viene rifiutato.
alter table frasi_record enable row level security;
drop policy if exists "frasi del record: di chi è entrato" on frasi_record;
drop policy if exists "frasi del record: le leggono i coach" on frasi_record;
create policy "frasi del record: le leggono i coach" on frasi_record
  for select to authenticated using (true);

-- Le frasi di serie, solo la prima volta (tabella vuota). Senza emoji e
-- senza titolo: valgono 🏆 e «NUOVO RECORD!».
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
-- Ci si aspetta «true» e, la prima volta, 15 righe.
select
  (select count(*) from information_schema.columns
    where table_name = 'frasi_record' and column_name = 'titolo') > 0 as frasi_pronte,
  (select count(*) from frasi_record)                                 as frasi_in_tutto;
