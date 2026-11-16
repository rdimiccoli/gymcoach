-- ═══════════════════════════════════════════════════════════════════════════
--  CHI FA QUALI GIORNI DELLA SCHEDA
--
--  Una scheda da tre giorni non la fanno tutti per intero: Alessia fa il
--  Giorno 1 e il 2, Greta il 2 e il 3. Il coach lo segna sulla scheda
--  (SCHEDE → ⋮ → Giorni di ognuno), e in seduta chi non fa quel giorno va in
--  fondo, in grigio, sotto «Oggi non previsti».
--
--  Una tabella nuova:
--    giorni_persona (scheda, persona, giorni)
--
--  LA REGOLA: nessuna riga = la persona fa tutti i giorni, come è sempre
--  stato. Le schede che esistono restano identiche.
--
--  🔒  NON CANCELLA NIENTE. Una tabella nuova, vuota; nessuna riga di altre
--      tabelle toccata. Si rilancia quante volte si vuole.
--
--  Se NON lo lanci, l'app funziona esattamente come adesso: la voce «Giorni
--  di ognuno» non compare.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists giorni_persona (
  cycle_id    uuid not null references cycles(id)  on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  giorni      integer[] not null,
  created_at  timestamptz not null default now(),
  primary key (cycle_id, client_id)
);

-- Subito: finché è spenta la tabella è aperta a chiunque abbia la chiave
-- anon, che dentro l'app è pubblica.
alter table giorni_persona enable row level security;

create index if not exists idx_giorni_persona_client on giorni_persona (client_id);

-- Un paracadute: almeno un giorno, e solo giorni fra 1 e 5.
do $$
begin
  alter table giorni_persona add constraint giorni_persona_validi
    check (cardinality(giorni) between 1 and 5 and giorni <@ array[1, 2, 3, 4, 5]);
exception
  when duplicate_object then null;  -- c'è già: si rilancia senza danni
end $$;

-- Le stesse regole delle assegnazioni scheda → persone.
drop policy if exists "giorni di ognuno: delle schede su cui lavoro" on giorni_persona;
create policy "giorni di ognuno: delle schede su cui lavoro" on giorni_persona
  for all to authenticated
  using      (public.scheda_accessibile(cycle_id))
  with check (public.scheda_accessibile(cycle_id) and public.atleta_accessibile(client_id));


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Ci si aspetta «true» e 0 righe (all'inizio nessuno ha una scelta).
select
  (select count(*) from information_schema.tables
    where table_name = 'giorni_persona') > 0 as giorni_pronti,
  (select count(*) from giorni_persona)      as scelte_in_tutto;
