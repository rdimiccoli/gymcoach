-- ═══════════════════════════════════════════════════════════════════════════
--  COME SI APRONO I TURNI: DAL TELEFONO AL PROFILO
--
--  «Come si aprono i turni — per esercizio o per atleta» era una preferenza
--  salvata nel telefono. Andava bene finché l'app girava solo lì.
--
--  Dall'8/10/2026 l'app si usa anche da tablet e da computer, e Sandro
--  avrebbe dovuto accendere la vista per atleta su ogni schermo, una per una,
--  ritrovandosela spenta sul successivo. Ora la scelta sta sul profilo e lo
--  segue ovunque entri.
--
--  🔒  NON CANCELLA NIENTE. Una colonna nuova, e una riga che accende la vista
--      per atleta a Sandro. Nessun `delete`, nessun `drop`. Si rilancia
--      quante volte si vuole.
--
--  Se NON lo lanci, l'app funziona lo stesso: si accorge da sola che la
--  colonna non c'è e continua a tenere la preferenza nel telefono, com'era.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · LA COLONNA ═════════════════════════════════════════════════
-- Vuota per tutti: chi non ha mai scelto niente continua a trovare i turni
-- per esercizio, esattamente come prima.
alter table coaches add column if not exists vista text;


-- ═══ PASSO 2 · SANDRO LI APRE PER ATLETA ══════════════════════════════════
-- Sandro ha turni da tredici persone divise su tre schede diverse: per lui
-- «un esercizio e sotto chi lo fa» non funziona, gli serve l'elenco delle
-- persone. Manu ha turni dove seguono tutti la stessa scheda, e per quelli la
-- vista per esercizio è più rapida: la sua riga resta vuota e non cambia
-- niente.
--
-- Da qui in poi Sandro la trova già accesa su qualunque dispositivo, anche su
-- uno nuovo. Può sempre cambiarla da IMPOSTAZIONI → COME SI APRONO I TURNI.
update coaches set vista = 'atleti' where email = 'dibiasesandro77@gmail.com';


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Atteso: Sandro «atleti», Manu vuoto (NULL).
select name, email, coalesce(vista, '— per esercizio (come prima)') as come_apre_i_turni
from coaches
order by name;


-- ═══════════════════════════════════════════════════════════════════════════
--  PER TORNARE INDIETRO
--    update coaches set vista = null;        -- tutti come prima
--    update coaches set vista = 'atleti' where email = '...';   -- solo a uno
-- ═══════════════════════════════════════════════════════════════════════════
