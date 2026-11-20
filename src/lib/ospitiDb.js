/**
 * Gli ospiti del giorno: chi oggi si allena in un turno che non è il suo.
 *
 * Una riga di `client_visits` dice solo «oggi, in questo turno, c'è anche
 * questa persona». Da lì si risale alla scheda che segue nel SUO turno,
 * perché la scheda segue la persona, non l'orario.
 */

import { supabase } from '../supabaseClient'
import { run } from './notify'
import { tutteLeRighe } from './tutteLeRighe'
import { oggiLocale } from './schede'
import { raggruppaOspiti } from './assegnazioni'
import { caricaAssegnazioni } from './assegnazioniDb'
import { capacita } from './capacita'

// Il turno di provenienza, con il nome del suo coach.
//
// I nomi dopo il «!» dicono a Supabase QUALE collegamento seguire. Fra turni
// e coach ce ne sono due: il proprietario del turno (`turns.coach_id`) e la
// vecchia tabella delle condivisioni `turn_coaches`. Senza indicazione
// Supabase non sceglie e risponde con un errore (300, «più di una
// relazione»): il 20/11/2026 l'elenco degli ospiti non si apriva per questo.
// Lo stesso vale per persona → turno, che passa anche da `client_visits`.
const CON_TURNO = 'turns!clients_turn_id_fkey(name, time, coaches!turns_coach_id_fkey(name))'

/**
 * { idTurnoOspitante: [{ scheda, persone }] } per oggi.
 *
 * Quattro richieste al massimo, e una sola quando non c'è nessun ospite —
 * che è il caso di quasi tutti i giorni.
 */
export async function caricaOspitiDiOggi(idTurni) {
  if (!idTurni?.length) return {}

  const { data: visite } = await run(
    supabase.from('client_visits').select('client_id, turn_id')
      .in('turn_id', idTurni).eq('visit_date', oggiLocale()),
    'Impossibile caricare gli ospiti di oggi.'
  )
  if (!visite?.length) return {}

  const { data: persone } = await run(
    supabase.from('clients').select(`id, name, surname, turn_id, ${CON_TURNO}`)
      .in('id', [...new Set(visite.map(v => v.client_id))]),
    'Impossibile caricare i nomi degli ospiti.'
  )
  const perId = Object.fromEntries((persone || []).map(p => [p.id, p]))

  const turniDOrigine = [...new Set((persone || []).map(p => p.turn_id))]
  const { data: schede } = await run(
    supabase.from('cycles').select('*').in('turn_id', turniDOrigine).eq('is_active', true),
    'Impossibile caricare le schede degli ospiti.'
  )
  const { assegnazioni: puoAssegnare } = await capacita()
  const assegnazioni = puoAssegnare ? await caricaAssegnazioni((schede || []).map(s => s.id)) : {}

  const risultato = {}
  for (const idTurno of idTurni) {
    const ospitiQui = visite
      .filter(v => v.turn_id === idTurno)
      .map(v => perId[v.client_id])
      .filter(Boolean)
    if (ospitiQui.length) risultato[idTurno] = raggruppaOspiti(ospitiQui, schede || [], assegnazioni)
  }
  return risultato
}

/**
 * Chi può essere aggiunto come ospite qui: tutte le persone attive degli
 * ALTRI turni, di qualsiasi coach, Silver o no. In ordine di cognome.
 *
 * Fino al 20/11/2026 erano solo i Silver. Il coach ora vede anche di chi è
 * il turno da cui la persona viene: le 09:00 di Manu e le 09:00 di Sandro
 * sono due turni diversi.
 *
 * Le persone sono qualche centinaio e crescono: si legge a pagine, perché
 * oltre le mille Supabase taglierebbe l'elenco senza dirlo.
 */
export async function ospitiPossibili(idTurno) {
  const { data } = await tutteLeRighe(
    () => supabase.from('clients').select(`id, name, surname, silver, turn_id, ${CON_TURNO}`)
      .eq('is_active', true).neq('turn_id', idTurno)
      .order('surname').order('name').order('id'),
    'Impossibile caricare gli atleti.'
  )
  return data || []
}

/** Aggiunge o toglie un ospite per oggi. */
export function segnaOspite(idTurno, idAtleta, presente) {
  const giorno = oggiLocale()
  return presente
    ? run(
        supabase.from('client_visits').upsert(
          { client_id: idAtleta, turn_id: idTurno, visit_date: giorno },
          { onConflict: 'client_id,turn_id,visit_date', ignoreDuplicates: true }
        ),
        'Ospite non aggiunto.'
      )
    : run(
        supabase.from('client_visits').delete()
          .eq('client_id', idAtleta).eq('turn_id', idTurno).eq('visit_date', giorno),
        'Ospite non tolto.'
      )
}

/** «09:00», o il nome del turno se l'orario manca. Per dire da dove viene. */
export const turnoDOrigine = persona =>
  persona?.turns?.time || persona?.turns?.name?.split('—')[0]?.trim() || ''

/** «09:00 · Manu»: il turno e il coach da cui viene la persona. */
export function daDove(persona) {
  const coach = persona?.turns?.coaches?.name
  return [turnoDOrigine(persona), coach].filter(Boolean).join(' · ')
}
