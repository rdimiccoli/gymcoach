import { supabase } from '../supabaseClient'
import { run } from './notify'
import { capacita } from './capacita'

/**
 * Archivia: la persona sparisce dagli elenchi ma non si perde niente — si
 * riattiva da ATLETI → MOSTRA ARCHIVIO, con tutto il suo storico.
 */
export async function archiviaPersone(ids) {
  if (!ids.length) return true
  const { error } = await run(
    supabase.from('clients').update({ is_active: false }).in('id', ids),
    'Persone non archiviate.'
  )
  return !error
}

/**
 * Unisce due righe della stessa persona: tutto quello che ha `togliere`
 * passa a `tenere`, poi `togliere` si ARCHIVIA (non si cancella).
 *
 * I pesi si spostano uno per uno solo dove `tenere` non ne ha già uno nella
 * stessa casella (stessa riga di scheda, stessa settimana): lì resta il suo.
 * Se una tabella non passa, ci si ferma PRIMA di archiviare: niente è perso,
 * al massimo resta da finire.
 *
 * Torna { ok, spostati, saltati }.
 */
export async function unisciPersone(tenere, togliere) {
  const caps = await capacita()

  // 1 · I pesi, saltando le caselle già occupate.
  const { data: suoi, error: e1 } = await run(
    supabase.from('client_loads').select('id, cycle_exercise_id, week').eq('client_id', togliere),
    'Impossibile leggere i pesi da unire.'
  )
  if (e1) return { ok: false }
  const idRighe = [...new Set((suoi || []).map(r => r.cycle_exercise_id))]
  let occupate = new Set()
  if (idRighe.length) {
    const { data: giaSuoi, error: e2 } = await run(
      supabase.from('client_loads').select('cycle_exercise_id, week').eq('client_id', tenere).in('cycle_exercise_id', idRighe),
      'Impossibile leggere i pesi da unire.'
    )
    if (e2) return { ok: false }
    occupate = new Set((giaSuoi || []).map(r => `${r.cycle_exercise_id}_${r.week}`))
  }
  const daSpostare = (suoi || []).filter(r => !occupate.has(`${r.cycle_exercise_id}_${r.week}`)).map(r => r.id)
  if (daSpostare.length) {
    const { error } = await run(
      supabase.from('client_loads').update({ client_id: tenere }).in('id', daSpostare),
      'Pesi non spostati.'
    )
    if (error) return { ok: false }
  }

  // 2 · Note, ospiti, assegnazioni, giorni: dove ci sono.
  const tabelle = [
    'client_notes',
    caps.silver && 'client_visits',
    caps.assegnazioni && 'cycle_clients',
    caps.giorniPersona && 'giorni_persona',
  ].filter(Boolean)
  for (const t of tabelle) {
    const { error } = await run(
      supabase.from(t).update({ client_id: tenere }).eq('client_id', togliere),
      'Unione non finita: una parte è rimasta sulla riga vecchia.'
    )
    if (error) return { ok: false, spostati: daSpostare.length }
  }

  // 3 · Solo adesso la riga vecchia esce dagli elenchi.
  const ok = await archiviaPersone([togliere])
  return { ok, spostati: daSpostare.length, saltati: (suoi || []).length - daSpostare.length }
}
