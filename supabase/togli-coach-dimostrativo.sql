-- ═══════════════════════════════════════════════════════════════════════════
--  Toglie il coach dimostrativo «Sandro · sandro@esempio.it»
--
--  Nel database sono rimasti tre profili coach ma gli account di accesso sono
--  due: il terzo, sandro@esempio.it, è l'avanzo dei dati dimostrativi. Nessuno
--  può entrarci, ma i suoi 3 turni finti restano lì e il suo nome compare
--  negli elenchi accanto a quello del Sandro vero.
--
--  ⚠️  QUESTO SCRIPT CANCELLA DEI DATI. Prima di lanciarlo fai un backup
--      dal pannello di Supabase (Database → Backups). È l'unico modo per
--      tornare indietro.
--
--  Cosa tocca: SOLO le righe che discendono da quel profilo — i suoi turni,
--  le sue schede, i suoi atleti finti e i loro carichi. Niente di Sandro vero
--  e niente di Manu, perché tutto passa da `coaches.email = 'sandro@esempio.it'`.
--
--  Cosa NON tocca: l'elenco degli esercizi. Gli esercizi non appartengono a un
--  coach, sono di tutti, e i due coach ormai li usano nelle loro schede.
--
--  Si può rilanciare quante volte si vuole: la seconda volta non trova più
--  niente e non fa niente.
--
--  Come si usa: SQL Editor di Supabase. Prima il PASSO 1 da solo, guardi cosa
--  sparirebbe; poi il PASSO 2; poi la VERIFICA.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · guarda cosa stai per cancellare ════════════════════════════
-- Solo lettura, non cambia niente. Se qui esce una riga con un nome che
-- riconosci — un turno vero, un'atleta vera — FERMATI e non lanciare il
-- PASSO 2.
select t.name                                                      as turno_che_sparisce,
       t.time                                                      as orario,
       (select count(*) from clients  cl where cl.turn_id = t.id)   as atleti_finti,
       (select count(*) from cycles   cy where cy.turn_id = t.id)   as schede_finte
from turns t
join coaches c on c.id = t.coach_id
where c.email = 'sandro@esempio.it'
order by t.time;

-- E questo è il profilo che sparisce. Deve uscire UNA riga sola.
select id, email, name
from coaches
where email = 'sandro@esempio.it';


-- ═══ PASSO 2 · cancella ═══════════════════════════════════════════════════
-- Le righe vengono tolte dal basso verso l'alto — prima i carichi, per ultimo
-- il profilo — senza affidarsi alle cancellazioni a catena del database: così
-- funziona anche se su qualche tabella la catena non è impostata.
--
-- Le tabelle arrivate con le migrazioni recenti vengono toccate solo se
-- esistono davvero, così lo script non si pianta su un database dove quelle
-- migrazioni non sono ancora state lanciate.
do $$
declare
  v_coach   uuid;
  v_turni   uuid[];
  v_schede  uuid[];
  v_atleti  uuid[];
  v_eserc   uuid[];
begin
  select id into v_coach from coaches where email = 'sandro@esempio.it';

  if v_coach is null then
    raise notice 'Niente da fare: il profilo sandro@esempio.it non c''è (già tolto).';
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_turni  from turns   where coach_id = v_coach;
  select coalesce(array_agg(id), '{}') into v_schede from cycles  where turn_id = any(v_turni);
  select coalesce(array_agg(id), '{}') into v_atleti from clients where turn_id = any(v_turni);
  select coalesce(array_agg(id), '{}') into v_eserc  from cycle_exercises where cycle_id = any(v_schede);

  raise notice 'Trovato: % turni, % schede, % atleti finti.',
    array_length(v_turni, 1), array_length(v_schede, 1), array_length(v_atleti, 1);

  delete from client_loads where client_id = any(v_atleti) or cycle_exercise_id = any(v_eserc);
  delete from client_notes where client_id = any(v_atleti) or cycle_exercise_id = any(v_eserc);

  if to_regclass('public.client_attendance') is not null then
    execute 'delete from client_attendance where client_id = any($1)' using v_atleti;
  end if;

  if to_regclass('public.client_visits') is not null then
    execute 'delete from client_visits where client_id = any($1) or turn_id = any($2)'
      using v_atleti, v_turni;
  end if;

  if to_regclass('public.cycle_clients') is not null then
    execute 'delete from cycle_clients where cycle_id = any($1) or client_id = any($2)'
      using v_schede, v_atleti;
  end if;

  if to_regclass('public.turn_coaches') is not null then
    execute 'delete from turn_coaches where turn_id = any($1) or coach_id = $2'
      using v_turni, v_coach;
  end if;

  delete from cycle_exercises where cycle_id = any(v_schede);
  delete from clients         where turn_id  = any(v_turni);
  delete from cycles          where turn_id  = any(v_turni);
  delete from turns           where coach_id = v_coach;
  delete from coaches         where id       = v_coach;

  raise notice 'Fatto: il profilo dimostrativo e tutto quello che ci stava sotto sono spariti.';
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Attesi: «profili coach rimasti = 2», «profilo dimostrativo = 0», e accanto
-- ai due coach veri il numero di turni che avevano prima. Se quel numero è
-- cambiato, ferma tutto e ripristina il backup.
select 'profili coach rimasti'  as cosa, count(*)::text as valore from coaches
union all
select 'profilo dimostrativo',  count(*)::text from coaches where email = 'sandro@esempio.it'
union all
select 'turni di ' || coalesce(c.name, c.email),
       (select count(*) from turns t where t.coach_id = c.id)::text
from coaches c;
