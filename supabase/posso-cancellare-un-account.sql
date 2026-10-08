-- ═══════════════════════════════════════════════════════════════════════════
--  CANCELLARE UN ACCOUNT PORTA VIA ANCHE IL PROFILO?
--
--  SOLO LETTURA. Non cambia niente, non cancella niente.
--
--  Account di accesso e profilo coach sono due cose diverse, ma nascevano
--  con lo stesso identificativo. Se fra i due c'è un legame «a cascata»,
--  cancellare l'account porterebbe via il profilo — e dietro il profilo i
--  turni, le atlete e i carichi.
--
--  Questo lo dice. Prima di cancellare qualunque account, lancialo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1 · IL LEGAME FRA ACCOUNT E PROFILO ══════════════════════════════════
-- Se non esce NESSUNA riga, non c'è legame: cancellare l'account lascia il
-- profilo dov'è, e non si perde niente.
-- Se esce una riga con «CASCADE», cancellare l'account cancella il profilo.
select 'coaches.' || a.attname          as colonna,
       'punta a ' || cl.relname         as punta_a,
       case c.confdeltype
         when 'c' then 'A CASCATA  ⚠️  cancellando l''account sparisce il profilo'
         when 'r' then 'BLOCCATO  ✅  il database rifiuta di cancellare l''account'
         when 'n' then 'si svuota  ⚠️'
         when 'a' then 'nessuna azione  ✅  il profilo resta'
         else c.confdeltype::text
       end                               as cosa_succede
from pg_constraint c
join pg_class      t  on t.oid  = c.conrelid
join pg_class      cl on cl.oid = c.confrelid
join pg_attribute  a  on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f' and t.relname = 'coaches';


-- ═══ 2 · COSA C'È APPESO AL PROFILO DI MANU ═══════════════════════════════
-- Quello che si perderebbe se sparisse il profilo. Serve a sapere la posta
-- in gioco, non a spaventare.
select coalesce(c.name, c.email)                                          as profilo,
       (select count(*) from turns t where t.coach_id = c.id)             as turni,
       (select count(*) from clients cl
          join turns t on t.id = cl.turn_id where t.coach_id = c.id)      as atlete,
       (select count(*) from client_loads l
          join clients cl on cl.id = l.client_id
          join turns t on t.id = cl.turn_id where t.coach_id = c.id)      as carichi
from coaches c
order by profilo;


-- ═══ 3 · QUALI PROFILI HANNO ANCORA UN ACCOUNT ════════════════════════════
-- `auth.users` è la tabella degli accessi. Se questa query dà errore di
-- permessi non è un problema: salta il punto 3, bastano gli altri due.
select coalesce(c.name, c.email) as profilo,
       case when u.id is null then 'nessun account  (il profilo vive lo stesso)'
            else 'ha un account: ' || u.email end as accesso
from coaches c
left join auth.users u on u.id = c.id
order by profilo;
