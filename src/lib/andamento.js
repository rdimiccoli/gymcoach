/**
 * I conti del cruscotto: settimana per settimana, coach per coach.
 *
 * I numeri arrivano già sommati dal database (vista `andamento_settimane`,
 * migrazione del 28/11/2026): qui si mettono in fila le settimane, si
 * riempiono quelle vuote e si divide per coach. Niente qui legge il database:
 * così i conti si provano da soli.
 */

const due = n => String(n).padStart(2, '0')
const comeTesto = d => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`

/** Il lunedì della settimana di `data`, come «2026-11-23» (ora del telefono). */
export function lunediDi(data = new Date()) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const giorno = (d.getDay() + 6) % 7 // lunedì 0 … domenica 6
  d.setDate(d.getDate() - giorno)
  return comeTesto(d)
}

/** Il lunedì `n` settimane prima di quello dato. */
export function settimanePrima(lunedi, n) {
  const [a, m, g] = lunedi.split('-').map(Number)
  const d = new Date(a, m - 1, g)
  d.setDate(d.getDate() - 7 * n)
  return comeTesto(d)
}

/** «23/11». */
export function etichettaSettimana(lunedi) {
  const [, m, g] = lunedi.split('-')
  return `${g}/${m}`
}

/**
 * Le ultime `quante` settimane fino a quella di oggi compresa, dalla più
 * vecchia: [{ settimana, persone, pesi }]. Una settimana senza pesi c'è lo
 * stesso, a zero: un buco nel grafico è un'informazione.
 */
export function ultimeSettimane(righe, oggi = new Date(), quante = 10) {
  const questa = lunediDi(oggi)
  const totali = new Map((righe || []).filter(r => r.tutti).map(r => [String(r.settimana).slice(0, 10), r]))
  return Array.from({ length: quante }, (_, i) => {
    const settimana = settimanePrima(questa, quante - 1 - i)
    const r = totali.get(settimana)
    return { settimana, persone: r?.persone || 0, pesi: r?.pesi || 0 }
  })
}

/**
 * Coach per coach, nella settimana data: [{ coach, persone, pesi, attive }],
 * dal più frequentato. `attive`: le persone attive nei suoi turni.
 * Ci sono tutti i coach dell'elenco, anche chi questa settimana è a zero.
 */
export function perCoach(righe, settimana, coaches, attivePerCoach = {}) {
  const diQuesta = new Map((righe || [])
    .filter(r => !r.tutti && String(r.settimana).slice(0, 10) === settimana)
    .map(r => [r.coach_id, r]))
  return (coaches || [])
    .map(c => ({
      coach: c,
      persone: diQuesta.get(c.id)?.persone || 0,
      pesi: diQuesta.get(c.id)?.pesi || 0,
      attive: attivePerCoach[c.id] || 0,
    }))
    .sort((a, b) => b.persone - a.persone || b.pesi - a.pesi || a.coach.name.localeCompare(b.coach.name))
}

/** { idCoach: quante } dalle persone (con `turn_id`) e dai turni (con `coach_id`). */
export function contaPerCoach(persone, turni) {
  const coachDelTurno = new Map((turni || []).map(t => [t.id, t.coach_id]))
  const conti = {}
  for (const p of persone || []) {
    const coach = coachDelTurno.get(p.turn_id)
    if (coach) conti[coach] = (conti[coach] || 0) + 1
  }
  return conti
}

/** «190», «1055», «12.055»: come si scrivono in Italia (il punto dalle decine di migliaia). */
export const numero = n => Number(n || 0).toLocaleString('it-IT')
