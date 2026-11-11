/**
 * Lo storico dei carichi di alcune persone su alcuni esercizi, in TUTTE le
 * schede — non solo in quella aperta.
 *
 * Serve a due cose: il massimo di sempre (il record) e l'ultimo carico della
 * scheda prima (vedi carichiPrecedenti.js), che la seduta e la condivisione
 * mostrano quando la scheda nuova non ha ancora un carico suo.
 *
 * Lo stesso esercizio in schede diverse ha righe cycle_exercises diverse:
 * si filtra per exercise_id. A pagine, perché lo storico di un turno supera
 * presto le mille righe (vedi tutteLeRighe.js).
 */
import { supabase } from '../supabaseClient'
import { run } from './notify'
import { tutteLeRighe } from './tutteLeRighe'
import { ultimiCarichiPrima } from './carichiPrecedenti'

/**
 * `righe`: tutti i carichi, con `cycle_exercises.exercise_id` e — se si
 * riesce a leggerla — la scheda (`cycle_exercises.cycles`).
 * `precedenti`: { «idPersona_idEsercizio»: { kg, settimana, scheda } }.
 * Se la lettura non passa: righe null (l'avviso è già a schermo).
 */
export async function storicoEsercizi(idPersone, idEsercizi, schedaAperta) {
  if (!idPersone.length || !idEsercizi.length) return { righe: [], precedenti: {} }
  const { data: righe } = await tutteLeRighe(() => supabase.from('client_loads')
    .select('kg, week, client_id, cycle_exercise_id, cycle_exercises!inner(exercise_id, cycle_id)')
    .in('client_id', idPersone)
    .in('cycle_exercises.exercise_id', idEsercizi)
    .order('client_id').order('cycle_exercise_id').order('week'),
    'Impossibile leggere i carichi delle schede precedenti.')
  if (!righe) return { righe: null, precedenti: {} }

  // Di che scheda è ogni carico, e quando è cominciata: serve a sapere qual
  // è «la scheda prima». Le schede sono poche: una lettura a parte, invece
  // di farle arrivare attaccate a ogni carico.
  const idSchede = [...new Set(righe.map(r => r.cycle_exercises?.cycle_id)
    .filter(id => id && id !== schedaAperta?.id))]
  if (!idSchede.length) return { righe, precedenti: {} }
  const { data: schede } = await run(
    supabase.from('cycles').select('id, name, start_date').in('id', idSchede),
    'Impossibile leggere le schede precedenti.')
  const perId = Object.fromEntries((schede || []).map(s => [s.id, s]))
  const conScheda = righe.map(r => ({
    ...r, cycle_exercises: { ...r.cycle_exercises, cycles: perId[r.cycle_exercises?.cycle_id] },
  }))
  return {
    righe: conScheda,
    precedenti: ultimiCarichiPrima(conScheda.filter(r => r.cycle_exercises.cycles), schedaAperta),
  }
}
