/**
 * I progressi di una persona, esercizio per esercizio.
 *
 * Il profilo era un elenco di carichi. Quello che il coach vuole mostrare
 * al cliente è un'altra cosa: «stai migliorando? dove?». Qui si calcola,
 * per ogni esercizio, da dove è partito, dove è adesso, quante volte ha
 * battuto il suo massimo — e un riassunto di tutto.
 *
 * Una regola che vale ovunque: i chili di esercizi diversi non si sommano
 * né si confrontano (120 alla pressa non sono «più» di 30 alla panca). Per
 * questo il riassunto è una PERCENTUALE media: quanto è cresciuto ogni
 * esercizio rispetto a sé stesso.
 */

/**
 * `voci`: i carichi di UN esercizio, dal più vecchio al più recente,
 * ognuno { kg, ... }. Gli zeri contano (corpo libero), i vuoti no.
 */
export function analizzaEsercizio(voci) {
  const kg = (voci || []).map(v => Number(v.kg)).filter(Number.isFinite)
  if (!kg.length) return null
  const primo = kg[0]
  const ultimo = kg[kg.length - 1]
  const migliore = Math.max(...kg)

  // Un record è un carico più alto di TUTTI quelli prima. Il primo carico
  // non conta: non batte niente, è solo il punto di partenza.
  let record = 0
  let massimo = primo
  const sonoRecord = kg.map((v, i) => {
    if (i === 0) return false
    if (v > massimo) { massimo = v; record++; return true }
    return false
  })

  const variazione = arrotonda(ultimo - primo)
  const stato = kg.length < 2 ? 'nuovo' : variazione > 0 ? 'su' : variazione < 0 ? 'giu' : 'fermo'
  return {
    primo, ultimo, migliore, record, sonoRecord, variazione, stato,
    // Da zero non c'è una percentuale che abbia senso.
    percentuale: kg.length >= 2 && primo > 0 ? arrotonda(((ultimo - primo) / primo) * 100, 0) : null,
    alMassimo: kg.length >= 2 && ultimo >= migliore && migliore > primo,
  }
}

/** Il riassunto di tutti gli esercizi di una persona. */
export function riassunto(analisi) {
  const valide = analisi.filter(Boolean)
  const misurabili = valide.filter(a => a.stato !== 'nuovo')
  const conPercentuale = misurabili.filter(a => a.percentuale !== null)
  return {
    esercizi: valide.length,
    misurabili: misurabili.length,
    inCrescita: misurabili.filter(a => a.stato === 'su').length,
    record: valide.reduce((s, a) => s + a.record, 0),
    crescitaMedia: conPercentuale.length
      ? arrotonda(conPercentuale.reduce((s, a) => s + a.percentuale, 0) / conPercentuale.length, 0)
      : null,
  }
}

function arrotonda(n, cifre = 2) {
  const f = 10 ** cifre
  return Math.round(n * f) / f
}

/** «7,5» all'italiana, senza zeri inutili. */
export const numero = n => String(n).replace('.', ',')
