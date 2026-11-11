/**
 * Tutte le righe di una lettura, anche più di mille.
 *
 * Supabase risponde al massimo con 1.000 righe per richiesta (si cambia
 * nelle impostazioni API del progetto) e, se ce ne sono di più, NON dà
 * errore: manda le prime mille e basta. Con lo storico dei carichi ci si
 * arriva in fretta — 20 persone × 7 esercizi × 8 settimane fanno già 1.120
 * righe — e i carichi in più sparivano senza che nessuno lo sapesse.
 *
 * Qui si legge a pagine finché una pagina torna non piena.
 *
 * `crea` costruisce la query da capo per ogni pagina, e deve avere un ordine
 * fisso (`.order(...)` su colonne che insieme non si ripetono): senza, due
 * pagine potrebbero darsi righe uguali o saltarne.
 *
 * Torna { data, error } come `run`: alla prima pagina che fallisce, l'errore
 * (con il suo avviso a schermo) e nessun dato — mezzo storico mostrato come
 * se fosse tutto sarebbe peggio di nessuno.
 */
import { run } from './notify'

export const PAGINA = 1000

export async function tutteLeRighe(crea, messaggioErrore) {
  const tutte = []
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await run(crea().range(da, da + PAGINA - 1), messaggioErrore)
    if (error) return { data: null, error }
    tutte.push(...(data || []))
    if (!data || data.length < PAGINA) return { data: tutte, error: null }
  }
}
