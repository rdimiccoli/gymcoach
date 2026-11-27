-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · MIGRAZIONE DEL 27 NOVEMBRE 2026
--  Una nota accanto al nome · L'ultimo allenamento di ognuno
--
--  Da eseguire nel SQL Editor di Supabase, tutto insieme.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge una colonna vuota e una «vista» (una
--      tabella che si calcola da sola dai pesi già segnati, senza copiarli).
--      Nessun `delete`, nessun `drop`. Si rilancia quante volte si vuole.
--
--  Finché non la lanci, l'app funziona come adesso: si accorge da sola che
--  questi pezzi mancano, e non mostra la nota, il riquadro «Non si vedono da
--  3 settimane» e la pulizia di chi non ha mai fatto un allenamento.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · LA NOTA ACCANTO AL NOME ════════════════════════════════════
-- Oggi chi vuole ricordare «nuova», «over» o «arriva tardi» lo scrive dentro
-- il cognome. Qui ha un posto suo: corto, facoltativo, vuoto per tutti.
alter table clients add column if not exists nota text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_nota_corta') then
    alter table clients add constraint clients_nota_corta
      check (nota is null or char_length(nota) <= 30);
  end if;
end $$;


-- ═══ PASSO 2 · L'ULTIMO ALLENAMENTO DI OGNUNO ═════════════════════════════
-- Per ogni persona: quando è stato segnato il suo ultimo peso, e quanti ne
-- ha in tutto. Non copia niente: si ricalcola ogni volta dai pesi.
--
-- `security_invoker` vuol dire che vale la stessa regola dei pesi: chi non
-- è entrato nell'app non vede niente.
create or replace view ultimi_allenamenti with (security_invoker = true) as
  select client_id, max(updated_at) as ultimo, count(*) as pesi
  from client_loads
  group by client_id;

grant select on ultimi_allenamenti to authenticated;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'colonna nota' as cosa,
       (exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'clients'
                  and column_name = 'nota'))::text as ok
union all
select 'vista ultimi_allenamenti', (to_regclass('public.ultimi_allenamenti') is not null)::text
union all
select 'persone con almeno un peso', (select count(*) from ultimi_allenamenti)::text;

-- Atteso: due «true» e un numero (le persone che hanno almeno un peso).
