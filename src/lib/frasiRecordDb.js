/**
 * Le frasi della festa, lette dal database (tabella `frasi_record`).
 *
 * Si leggono a ogni apertura di un turno, non una volta per sempre: chi
 * aggiunge una frase dal pannello di Supabase la vede comparire dal turno
 * successivo, senza dover chiudere l'app.
 *
 * Finché lo script SQL non c'è, o se la lettura non riesce (rete), valgono
 * le frasi di serie: la festa non deve mai saltare per colpa delle frasi.
 * Una tabella vuota invece è una scelta (le frasi tolte tutte): allora la
 * festa c'è con la frase semplice (vedi scegliFrase).
 */
import { supabase } from '../supabaseClient'
import { capacita } from './capacita'
import { FRASI_DI_SERIE } from './frasiRecord'

export async function caricaFrasi() {
  const { frasiRecord } = await capacita()
  if (!frasiRecord) return FRASI_DI_SERIE
  // «*» e non le colonne per nome: emoji e titolo sono arrivati dopo il
  // testo, e una tabella della prima versione non le ha.
  const { data, error } = await supabase.from('frasi_record').select('*').order('created_at')
  if (error || !data) return FRASI_DI_SERIE
  return data.map(r => ({ emoji: r.emoji, titolo: r.titolo, testo: r.testo }))
}
