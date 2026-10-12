-- ═══════════════════════════════════════════════════════════════════════════
--  UN COACH NUOVO SI AGGIUNGE DALL'APP
--
--  Finora un profilo coach si creava solo da qui, a mano. Con un terzo coach
--  in arrivo e altri che verranno, i coach devono poter fare da soli.
--
--  Si aggiunge il PROFILO, non l'accesso: la credenziale resta una sola, e il
--  coach nuovo entra con quella e tocca il suo nome in CHI SEI?.
--
--  ⚠️  NON accendere le registrazioni pubbliche per ottenere la stessa cosa.
--      Da quando la regola è «chi è entrato vede tutto», aprirle vorrebbe dire
--      lasciare che chiunque dal sito si crei un account e legga turni,
--      atlete e carichi. L'interruttore deve restare SPENTO: vedi SICUREZZA.md.
--
--  🔒  NON CANCELLA NIENTE. Due permessi e due valori predefiniti: nessun
--      `delete`, nessun `drop table`, nessuna riga toccata. Si rilancia
--      quante volte si vuole.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 1 · L'IDENTIFICATIVO SE LO DÀ IL DATABASE ══════════════════════
-- I profili di oggi hanno come identificativo quello del vecchio account
-- personale. I nuovi non hanno nessun account dietro, quindi se lo genera il
-- database invece di inventarselo l'app. Non tocca le righe che ci sono.
alter table coaches alter column id set default gen_random_uuid();


-- ═══ PASSO 2 · L'EMAIL NON È PIÙ OBBLIGATORIA ═════════════════════════════
-- Serviva quando l'email ERA il modo di entrare. Adesso l'accesso è uno solo
-- e condiviso: l'email di un profilo non vuol più dire niente, e chiederla a
-- chi aggiunge un collega sarebbe una domanda senza risposta giusta.
-- Se era già facoltativa, questa riga non fa niente.
alter table coaches alter column email drop not null;


-- ═══ PASSO 3 · IL PERMESSO DI CREARE UN PROFILO ═══════════════════════════
-- Quando ho scritto la migrazione della credenziale unica ho tolto apposta
-- questo permesso: allora l'app non creava più profili da sola, e lasciarlo
-- aperto avrebbe solo permesso di generare coach fantasma per sbaglio.
-- Adesso serve, perché a crearli è un coach che tocca un pulsante apposta.
drop policy if exists "profili: ne crea uno chi è entrato" on coaches;
create policy "profili: ne crea uno chi è entrato" on coaches
  for insert to authenticated with check (true);

-- Nota: NON si aggiunge il permesso di ELIMINARE un profilo, ed è voluto.
-- Dietro un profilo ci sono turni, atlete e carichi: un tocco sbagliato non
-- deve poterli staccare. Un profilo creato per errore si corregge entrandoci
-- e cambiandogli il nome da IMPOSTAZIONI → MODIFICA; uno che non serve più si
-- toglie dall'elenco senza cancellare niente, con:
--   update coaches set nascosto = true where name = 'Nome';


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Attesi: tre permessi su `coaches` (vedere, cambiare il nome, crearne uno),
-- e nessuno per eliminare.
select policyname as permesso, cmd as per_cosa
from pg_policies
where schemaname = 'public' and tablename = 'coaches'
order by cmd;

-- E i profili che ci sono adesso.
select name, email, coalesce(vista, '— per esercizio') as apre_i_turni, nascosto
from coaches
order by name;
