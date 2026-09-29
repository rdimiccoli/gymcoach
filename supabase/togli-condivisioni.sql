-- ═══════════════════════════════════════════════════════════════════════════
--  Rimette ogni coach nei suoi turni
--
--  Le regole del database sono giuste e attive: il diagnostico lo conferma.
--  Il motivo per cui Sandro vedeva i turni di Manu è che quei turni gli erano
--  stati CONDIVISI a mano, con «CHI PUÒ APRIRLO OLTRE A TE» nella matita del
--  turno. L'app faceva quello che le era stato detto.
--
--  Qui si tolgono quelle condivisioni. Lancia PASSO 1 e PASSO 2.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · guarda cosa stai per togliere ══════════════════════════════
-- Solo lettura. Devono uscire le tre righe che hai già visto nel diagnostico.
select t.name as turno,
       coalesce(proprietario.name, proprietario.email) as di_chi_e,
       coalesce(ospite.name, ospite.email)             as lo_vede_anche
from turn_coaches tc
left join turns   t             on t.id = tc.turn_id
left join coaches proprietario  on proprietario.id = t.coach_id
left join coaches ospite        on ospite.id = tc.coach_id;


-- ═══ PASSO 2 · toglile ════════════════════════════════════════════════════
-- Non cancella turni, schede, atleti o carichi: toglie solo il permesso di
-- vederli. Da qui ogni coach vede esclusivamente i propri.
delete from turn_coaches;


-- ═══ PASSO 3 · la funzione che elencava i colleghi ════════════════════════
-- Serviva solo a riempire quell'elenco. Ora la funzione è stata tolta
-- dall'app, e questa è l'unica cosa nel database che faceva uscire il nome di
-- un coach da un altro account: via anche lei.
drop function if exists public.colleghi();


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'condivisioni rimaste' as cosa, count(*)::text as valore from turn_coaches
union all
select 'turni di ' || coalesce(c.name, c.email),
       (select count(*) from turns t where t.coach_id = c.id)::text
from coaches c;

-- Atteso: «condivisioni rimaste = 0».
-- Poi fai riaprire l'app ai due coach: ognuno deve vedere solo i suoi turni.


-- ═══════════════════════════════════════════════════════════════════════════
--  FACOLTATIVO · il coach dimostrativo rimasto in giro
--
--  Nel database c'è ancora il profilo «Sandro · sandro@esempio.it», con i 3
--  turni dei dati dimostrativi. Il suo account di accesso non esiste più
--  (gli account sono 2, i profili 3), quindi nessuno può entrarci e nessuno
--  vede quei turni.
--
--  Dà però un fastidio concreto: comparendo nell'elenco dei colleghi, nella
--  matita del turno si leggevano DUE Sandro. È molto probabilmente il motivo
--  per cui quel turno è finito condiviso con tutti e due.
--
--  ➜ NON usare le righe qui sotto: si affidano alle cancellazioni a catena del
--    database, che non abbiamo mai verificato. Al loro posto c'è uno script
--    dedicato, che cancella pezzo per pezzo e fa prima vedere cosa sparirà:
--
--        supabase/togli-coach-dimostrativo.sql
--
--    Queste due righe restano solo come traccia di com'era nato il problema.
-- ═══════════════════════════════════════════════════════════════════════════

-- select t.name as turno_che_sparirebbe,
--        (select count(*) from clients cl where cl.turn_id = t.id) as atleti_finti
-- from turns t
-- join coaches c on c.id = t.coach_id
-- where c.email = 'sandro@esempio.it';

-- delete from coaches where email = 'sandro@esempio.it';
