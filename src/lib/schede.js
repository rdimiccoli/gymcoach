// Logica delle schede, condivisa fra le pagine.
//
// `groupExercises` era copiato quasi identico in TurnDetail, CycleShare e
// CycleForm, e le tre copie erano già divergenti: in CycleForm un gruppo con
// un'etichetta non riconosciuta veniva spezzato in esercizi singoli, nelle
// altre due restava un gruppo. Qui vale una regola sola.

export const TIPO = {
  SINGOLO: 'single',
  SUPERSERIE: 'superset',
  CIRCUITO: 'circuit',
}

export const isCircuito = etichetta => Boolean(etichetta?.startsWith('CIR-'))
export const isSuperserie = etichetta => Boolean(etichetta?.startsWith('SS-'))

/**
 * Se c'è un'etichetta c'è un gruppo. Solo `CIR-` fa circuito, tutto il resto è
 * superserie: un'etichetta sconosciuta indica comunque che quegli esercizi
 * vanno insieme, spezzarli sarebbe peggio che raggrupparli con il tipo sbagliato.
 */
export function tipoGruppo(etichetta) {
  if (!etichetta) return TIPO.SINGOLO
  return isCircuito(etichetta) ? TIPO.CIRCUITO : TIPO.SUPERSERIE
}

/** Le ripetizioni cambiano ogni due settimane: a = 1-2, b = 3-4, c = 5-6. */
export function repsPerSettimana(esercizio, settimana) {
  if (!esercizio) return undefined
  if (settimana <= 2) return esercizio.reps_a
  if (settimana <= 4) return esercizio.reps_b
  return esercizio.reps_c
}

/**
 * Raggruppa una lista di esercizi in serie singole, superserie e circuiti,
 * preservando l'ordine di arrivo.
 *
 * Accetta entrambe le forme in cui l'etichetta gira nell'app: `superset_group`
 * come arriva dal database, `supersetGroup` come la tiene CycleForm in locale.
 *
 * @param {boolean} indice — aggiunge a ogni esercizio la sua posizione
 *   originale nella lista, che a CycleForm serve per il trascinamento.
 */
export function raggruppaEsercizi(esercizi, { indice = false } = {}) {
  const gruppi = []
  const visti = {}
  ;(esercizi || []).forEach((esercizio, i) => {
    if (!esercizio) return
    const voce = indice ? { ...esercizio, idx: i } : esercizio
    const etichetta = esercizio.superset_group ?? esercizio.supersetGroup ?? null

    if (!etichetta) {
      gruppi.push({ type: TIPO.SINGOLO, label: null, exercises: [voce] })
      return
    }
    if (!visti[etichetta]) {
      visti[etichetta] = { type: tipoGruppo(etichetta), label: etichetta, exercises: [] }
      gruppi.push(visti[etichetta])
    }
    visti[etichetta].exercises.push(voce)
  })
  return gruppi
}
