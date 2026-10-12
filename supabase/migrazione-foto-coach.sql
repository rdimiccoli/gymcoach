-- ═══════════════════════════════════════════════════════════════════════════
--  UNA FOTO PER OGNI COACH
--
--  Accanto al nome si può mettere una foto. Chi non la mette tiene la sua
--  emoji; chi non ha nemmeno quella tiene la sua iniziale. Niente cambia da
--  solo per nessuno.
--
--  La foto NON sta nel database: sta in uno spazio file. Una foto dentro una
--  riga di tabella la fa pesare e se la trascina dietro ogni volta che l'app
--  legge i profili, cioè a ogni avvio. Nella tabella resta solo il percorso.
--
--  🔒  NON CANCELLA NIENTE. Una colonna, uno spazio file e i permessi per
--      usarlo. Nessun `delete`, nessun `drop`, nessuna riga toccata.
--      Si rilancia quante volte si vuole.
--
--  Se NON lo lanci, l'app funziona lo stesso: si accorge da sola che la
--  colonna non c'è e nelle impostazioni non propone la foto.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · DOVE SI SEGNA LA FOTO ══════════════════════════════════════
-- Solo il percorso del file, non la foto. Vuota per tutti.
alter table coaches add column if not exists foto text;


-- ═══ PASSO 2 · LO SPAZIO FILE ═════════════════════════════════════════════
-- Pubblico in lettura: le foto dei coach si vedono dentro l'app, e tenerle
-- dietro a un permesso vorrebbe dire chiedere un indirizzo firmato a ogni
-- cerchio disegnato — lento, e per niente. Scrivere resta riservato a chi è
-- entrato (PASSO 3).
insert into storage.buckets (id, name, public)
values ('coach', 'coach', true)
on conflict (id) do update set public = true;


-- ═══ PASSO 3 · CHI PUÒ METTERE E TOGLIERE LE FOTO ═════════════════════════
-- Solo chi è entrato nell'app, e solo dentro lo spazio «coach»: non si tocca
-- nient'altro dello spazio file.
drop policy if exists "foto coach: le carica chi è entrato"  on storage.objects;
drop policy if exists "foto coach: le cambia chi è entrato"  on storage.objects;
drop policy if exists "foto coach: le toglie chi è entrato"  on storage.objects;

create policy "foto coach: le carica chi è entrato" on storage.objects
  for insert to authenticated with check (bucket_id = 'coach');

create policy "foto coach: le cambia chi è entrato" on storage.objects
  for update to authenticated using (bucket_id = 'coach') with check (bucket_id = 'coach');

create policy "foto coach: le toglie chi è entrato" on storage.objects
  for delete to authenticated using (bucket_id = 'coach');


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Atteso: lo spazio «coach» esiste ed è pubblico, e ci sono i tre permessi.
select id as spazio_file, public as pubblico from storage.buckets where id = 'coach';

select policyname as permesso, cmd as per_cosa
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'foto coach%'
order by cmd;

-- E i profili, con quello che si vede nel cerchio di ciascuno.
select name,
       case when foto is not null then 'foto'
            when emoji is not null then 'emoji ' || emoji
            else 'iniziale' end as nel_cerchio
from coaches
order by name;


-- ═══════════════════════════════════════════════════════════════════════════
--  PER TORNARE INDIETRO
--    update coaches set foto = null;   -- tutti tornano a emoji o iniziale
--  I file restano nello spazio «coach» e si possono togliere a mano da
--  Storage nel pannello di Supabase.
-- ═══════════════════════════════════════════════════════════════════════════
