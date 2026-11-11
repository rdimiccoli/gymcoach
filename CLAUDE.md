# GymCoach — regole per chi modifica l'app

- I testi che il coach vede e i commenti nel codice sono in italiano semplice.
  Chi usa l'app ha spesso più di cinquant'anni: pulsanti grandi, parole chiare.
- **Ogni modifica che il coach vede va annunciata nel tutorial delle novità**:
  una voce nuova in cima a `src/lib/novita.js` (istruzioni nel commento del
  file). Compare una volta sola su ogni telefono, dopo l'aggiornamento.
  Le correzioni invisibili non servono.
- Ogni cancellazione chiede prima conferma, e dice cosa si perde.
- Le migrazioni SQL in `supabase/` aggiungono e non cancellano mai niente;
  l'app deve funzionare uguale prima e dopo (vedi `src/lib/capacita.js`).
- Si pubblica portando `main` al ramo di lavoro: Vercel pubblica da solo.
