/**
 * Lettura e scrittura di «chi fa quali giorni» (tabella giorni_persona).
 * Le regole stanno in giorniPersona.js, che resta senza database per poterlo
 * testare.
 */
import { supabase } from '../supabaseClient'
import { run } from './notify'
import { capacita } from './capacita'

/** { idScheda: [{ client_id, giorni }] } — vuoto se la tabella non c'è ancora. */
export async function caricaGiorniPersona(idSchede) {
  if (!idSchede?.length) return {}
  const { giorniPersona } = await capacita()
  if (!giorniPersona) return {}
  const { data } = await run(
    supabase.from('giorni_persona').select('cycle_id, client_id, giorni').in('cycle_id', idSchede),
    'Impossibile sapere chi fa quali giorni.'
  )
  const perScheda = {}
  for (const r of data || []) (perScheda[r.cycle_id] ||= []).push(r)
  return perScheda
}

/**
 * Salva le scelte di una scheda: { idPersona: [giorni] | null }.
 * null = tutti i giorni, cioè nessuna riga: quella che c'era si toglie (non
 * si perde niente: è la scelta di partenza).
 * Torna true se è passato tutto.
 */
export async function salvaGiorniPersona(idScheda, scelte) {
  const daScrivere = Object.entries(scelte).filter(([, g]) => g)
  const daTogliere = Object.entries(scelte).filter(([, g]) => !g).map(([id]) => id)
  if (daScrivere.length) {
    const { error } = await run(
      supabase.from('giorni_persona').upsert(
        daScrivere.map(([client_id, giorni]) => ({ cycle_id: idScheda, client_id, giorni })),
        { onConflict: 'cycle_id,client_id' }),
      'I giorni di ognuno non sono stati salvati.')
    if (error) return false
  }
  if (daTogliere.length) {
    const { error } = await run(
      supabase.from('giorni_persona').delete().eq('cycle_id', idScheda).in('client_id', daTogliere),
      'I giorni di ognuno non sono stati salvati.')
    if (error) return false
  }
  return true
}

/** Clonando una scheda, le scelte vanno con lei: si cambia solo chi cambia. */
export async function copiaGiorniPersona(daScheda, aScheda) {
  const righe = (await caricaGiorniPersona([daScheda]))[daScheda] || []
  if (!righe.length) return
  await run(
    supabase.from('giorni_persona').upsert(
      righe.map(r => ({ cycle_id: aScheda, client_id: r.client_id, giorni: r.giorni })),
      { onConflict: 'cycle_id,client_id' }),
    'Scheda clonata, ma i giorni di ognuno non sono stati copiati.')
}
