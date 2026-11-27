import { supabase } from '../supabaseClient'
import { run } from './notify'
import { tutteLeRighe } from './tutteLeRighe'
import { mappaUltimi } from './assenti'

/**
 * L'ultimo peso di ognuno, da tutta la vista: sono poche centinaia di righe,
 * meno di quante costerebbe un filtro con centinaia di id nell'indirizzo.
 */
export async function caricaUltimi() {
  const { data } = await tutteLeRighe(
    () => supabase.from('ultimi_allenamenti').select('client_id, ultimo, pesi').order('client_id'),
    'Impossibile sapere chi si è allenato.'
  )
  return data ? mappaUltimi(data) : null
}

/** Le persone attive dei turni dati, con il loro turno. */
export async function personeAttive(idTurni) {
  if (!idTurni?.length) return []
  const { data } = await run(
    supabase.from('clients').select('*, turns!clients_turn_id_fkey(name, time)')
      .in('turn_id', idTurni).eq('is_active', true).order('surname').order('name'),
    'Impossibile caricare le persone.'
  )
  return data || []
}
