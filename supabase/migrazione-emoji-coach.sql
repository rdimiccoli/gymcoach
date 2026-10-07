-- ═══════════════════════════════════════════════════════════════════════════
--  UN'IMMAGINE ACCANTO AL NOME DEL COACH
--
--  Nella schermata «chi sei?» i nomi sono scritti tutti uguali. Un segno
--  colorato si riconosce prima di una parola, e ognuno trova il suo al volo.
--
--  Ogni coach sceglie la sua emoji da IMPOSTAZIONI → LA TUA IMMAGINE. Chi non
--  sceglie niente vede la propria iniziale nel cerchio: funziona da subito,
--  senza che nessuno debba fare niente.
--
--  🔒  NON CANCELLA NIENTE. È una colonna nuova e basta: nessun `delete`,
--      nessun `drop`, nessuna riga toccata. I profili che ci sono restano
--      identici, con `emoji` vuota, cioè con la loro iniziale.
--
--  Si può lanciare prima o dopo `migrazione-credenziale-unica.sql`, e
--  rilanciare quante volte si vuole: la seconda volta non fa niente.
--
--  Se NON lo lanci, l'app funziona lo stesso: si accorge da sola che la
--  colonna non c'è, nasconde la scelta dell'immagine nelle impostazioni e
--  mostra le iniziali. Nessuna schermata rotta, nessun errore.
-- ═══════════════════════════════════════════════════════════════════════════

alter table coaches add column if not exists emoji text;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
-- Attesa: una riga per profilo, con «emoji» vuota. Il numero di profili deve
-- essere lo stesso di prima.
select name, email, emoji
from coaches
order by name;


-- ═══════════════════════════════════════════════════════════════════════════
--  SE UN GIORNO VUOI TOGLIERLA
--  La colonna si svuota senza perdere nient'altro:
--    update coaches set emoji = null;
--  Toglierla del tutto (`alter table coaches drop column emoji`) non serve:
--  l'app non se ne accorgerebbe comunque, perché controlla se c'è.
-- ═══════════════════════════════════════════════════════════════════════════
