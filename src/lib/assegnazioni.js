/**
 * Chi segue quale scheda.
 *
 * LA REGOLA, da cui dipende tutto il resto: una scheda senza assegnazioni vale
 * per TUTTO il suo turno. È quello che rende la funzione innocua per chi non
 * la usa — le schede che esistevano prima continuano a mostrare tutti — e fa
 * entrare da sola nelle schede «per tutti» chi viene aggiunto più avanti.
 *
 * Qui dentro niente database: solo il ragionamento, così si può testare.
 */

/** Dalle righe di `cycle_clients` a { idScheda: Set(idAtleta) }. */
export function mappaAssegnazioni(righe = []) {
  const mappa = {}
  for (const r of righe) (mappa[r.cycle_id] ||= new Set()).add(r.client_id)
  return mappa
}

const assegnata = (scheda, assegnazioni) => assegnazioni[scheda.id]?.size > 0

/** Le persone che seguono una scheda, fra quelle del suo turno. */
export function personeDellaScheda(scheda, atleti, assegnazioni = {}) {
  if (!scheda || !assegnata(scheda, assegnazioni)) return atleti
  const scelte = assegnazioni[scheda.id]
  return atleti.filter(a => scelte.has(a.id))
}

/**
 * Le schede attive che una persona segue: quelle del SUO turno, valide per
 * tutti oppure assegnate proprio a quella persona.
 *
 * È ciò che un ospite si porta dietro: la scheda segue la persona, non
 * l'orario in cui si presenta.
 */
export function schedeSeguite(atleta, schedeAttive, assegnazioni = {}) {
  return schedeAttive.filter(s =>
    s.turn_id === atleta.turn_id &&
    (!assegnata(s, assegnazioni) || assegnazioni[s.id].has(atleta.id))
  )
}

/**
 * Chi, in un turno, non è in nessuna scheda attiva.
 *
 * Il rischio che questa funzione esiste a coprire: una scheda assegnata solo
 * ad alcuni fa sparire gli altri dalla schermata di allenamento, senza che
 * nessuno se ne accorga.
 *
 * Vuoto quando il turno non ha schede attive (la card lo dice già con
 * «Nessuna scheda attiva») e quando almeno una vale per tutti.
 */
export function senzaScheda(atleti, schedeAttive, assegnazioni = {}) {
  if (!schedeAttive.length) return []
  if (schedeAttive.some(s => !assegnata(s, assegnazioni))) return []
  const coperti = new Set(schedeAttive.flatMap(s => [...assegnazioni[s.id]]))
  return atleti.filter(a => !coperti.has(a.id))
}

/**
 * Gli ospiti di un turno, raggruppati per la scheda che seguono.
 *
 * Due persone venute dallo stesso turno con la stessa scheda diventano una
 * card sola: si allenano sulla stessa scheda, si segnano nella stessa
 * schermata. Chi non ha nessuna scheda attiva finisce in un gruppo a parte
 * con `scheda: null`, per non sparire.
 */
export function raggruppaOspiti(ospiti, schedeAttive, assegnazioni = {}) {
  const gruppi = new Map()
  const aggiungi = (chiave, scheda, persona) => {
    const g = gruppi.get(chiave) || { scheda, persone: [] }
    g.persone.push(persona)
    gruppi.set(chiave, g)
  }
  for (const persona of ospiti) {
    const seguite = schedeSeguite(persona, schedeAttive, assegnazioni)
    if (!seguite.length) aggiungi('', null, persona)
    else seguite.forEach(s => aggiungi(s.id, s, persona))
  }
  return [...gruppi.values()]
}
