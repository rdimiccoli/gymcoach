-- ═══════════════════════════════════════════════════════════════════════════
--  POTER ELIMINARE UN ESERCIZIO DAL CATALOGO
--
--  Nella nuova pagina ESERCIZI c'è il pulsante ELIMINA. Fino a oggi l'app
--  non aveva mai cancellato un esercizio dal catalogo, quindi non è detto
--  che il database lo permetta. Se non lo permette, l'app se ne accorge,
--  lo dice, e si ferma PRIMA di toccare qualsiasi scheda o carico.
--
--  Questo script aggiunge quel permesso, a chi è entrato nell'app.
--
--  🔒  NON CANCELLA NIENTE. Aggiunge solo un permesso. Nessun `delete`,
--      nessun `drop table`. Si rilancia quante volte si vuole.
--
--  Se il permesso c'era già, non cambia niente.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "esercizi: li elimina chi è entrato" on exercises;

create policy "esercizi: li elimina chi è entrato" on exercises
  for delete to authenticated using (true);


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Tra le righe deve comparire «esercizi: li elimina chi è entrato» con
-- cmd = DELETE.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'exercises'
 order by cmd, policyname;
