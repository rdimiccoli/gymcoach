/**
 * Il carico dell'ultima volta, anche se era in un'altra scheda.
 *
 * Una scheda nuova partiva da zero: alla prima settimana accanto al carico
 * non c'era nessun «prec.», e il coach doveva andarsi a cercare a mano, per
 * ogni persona e ogni esercizio, quanto aveva sollevato nella scheda prima.
 *
 * Lo stesso esercizio in due schede è su due righe diverse di
 * `cycle_exercises`, ma con lo stesso `exercise_id`: è quello che li lega.
 * Per ogni persona e ogni esercizio si prende l'ultimo carico segnato in
 * una scheda iniziata PRIMA di questa (o lo stesso giorno) — mai da questa,
 * che ha già i suoi, e mai da una venuta dopo, che guardando una scheda
 * vecchia non è «la volta prima».
 *
 * Si mostra e basta: niente viene copiato nella scheda nuova. Un carico
 * copiato sembrerebbe un allenamento fatto, e lo storico dei progressi
 * conterebbe una settimana che non c'è stata.
 *
 * `righe`: [{ kg, week, client_id, cycle_exercises: { exercise_id, cycle_id,
 *            cycles: { name, start_date } } }]
 * `scheda`: quella aperta, { id, start_date }.
 *
 * Torna { «idPersona_idEsercizio»: { kg, settimana, scheda } }.
 */
export function ultimiCarichiPrima(righe, scheda) {
  const inizio = scheda?.start_date || null
  const ultimi = {}
  for (const r of righe || []) {
    const riga = r.cycle_exercises
    const kg = r.kg == null || r.kg === '' ? NaN : Number(r.kg)
    if (!riga?.exercise_id || !Number.isFinite(kg) || riga.cycle_id === scheda?.id) continue
    const altra = riga.cycles || {}
    const data = altra.start_date || ''
    // Una scheda iniziata dopo questa non è «la volta prima».
    if (inizio && data && data > inizio) continue
    const chiave = `${r.client_id}_${riga.exercise_id}`
    const visto = ultimi[chiave]
    const piuRecente = !visto || data > visto.data || (data === visto.data && (r.week ?? 0) > visto.settimana)
    if (piuRecente) ultimi[chiave] = { kg, settimana: r.week ?? 0, scheda: altra.name || '', data }
  }
  return ultimi
}
