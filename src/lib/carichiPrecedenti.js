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
 * `scheda` porta anche `created_at`: serve per le schede partite lo stesso
 * giorno (vedi vieneDaPrima).
 *
 * Torna { «idPersona_idEsercizio»: { kg, settimana, scheda, idScheda,
 *          idRiga } }: `idRiga` è la riga di `cycle_exercises` da cui viene,
 *          e serve a ritrovarne le ripetizioni (vedi storicoDb.js).
 */
export function ultimiCarichiPrima(righe, scheda) {
  const inizio = scheda?.start_date || null
  const creata = scheda?.created_at || null
  const ultimi = {}
  for (const r of righe || []) {
    const riga = r.cycle_exercises
    const kg = r.kg == null || r.kg === '' ? NaN : Number(r.kg)
    if (!riga?.exercise_id || !Number.isFinite(kg) || riga.cycle_id === scheda?.id) continue
    const altra = riga.cycles || {}
    if (!vieneDaPrima(altra, inizio, creata)) continue
    const data = altra.start_date || ''
    const chiave = `${r.client_id}_${riga.exercise_id}`
    const visto = ultimi[chiave]
    const piuRecente = !visto || data > visto.data
      || (data === visto.data && (altra.created_at || '') > visto.creata)
      || (data === visto.data && (altra.created_at || '') === visto.creata && (r.week ?? 0) > visto.settimana)
    if (piuRecente) ultimi[chiave] = {
      kg, settimana: r.week ?? 0, scheda: altra.name || '', data, creata: altra.created_at || '',
      idScheda: riga.cycle_id, idRiga: r.cycle_exercise_id,
    }
  }
  return ultimi
}

/**
 * Un'altra scheda conta come «prima» di questa?
 *
 * - iniziata in un giorno precedente: sì;
 * - iniziata DOPO: no, guardando una scheda vecchia non è la volta prima;
 * - iniziata lo STESSO giorno: solo se è stata creata prima. Capita spesso:
 *   un turno con tre programmi li fa partire insieme, e senza questa regola
 *   «SCHEDA PREC.» poteva mostrare il peso dell'altro programma di questa
 *   stessa settimana.
 * Senza data d'inizio decide la data di creazione; senza nemmeno quella,
 * nel dubbio no.
 */
function vieneDaPrima(altra, inizio, creata) {
  const data = altra.start_date || null
  if (inizio && data) {
    if (data < inizio) return true
    if (data > inizio) return false
  }
  return Boolean(creata && altra.created_at && altra.created_at < creata)
}
