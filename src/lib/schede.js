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

/**
 * Legge una durata scritta a mano dal coach: "50s", "30", "1'", "2 min".
 * Ritorna secondi, oppure null se non è interpretabile — nel qual caso il
 * timer non si offre nemmeno, invece di inventarsi un numero.
 */
export function secondiDaTesto(testo) {
  if (testo == null) return null
  const s = String(testo).trim().toLowerCase().replace(',', '.')
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secondi|''|'|m|min|minuti)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const minuti = ["'", 'm', 'min', 'minuti'].includes(m[2])
  return Math.round(minuti ? n * 60 : n)
}

/** Numero di giri di un circuito: "3", "3 giri", "x3". */
export function numeroDaTesto(testo) {
  if (testo == null) return null
  const m = String(testo).trim().match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isFinite(n) && n > 0 ? n : null
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

/**
 * A che settimana dovrebbe essere una scheda, secondo la sua data di inizio.
 *
 * È l'informazione che prima si chiedeva al coach di scegliere a mano con le
 * card FASE 1/2/3: il calendario la sa già, e non sbaglia.
 * Ritorna null se la data manca o è nel futuro.
 */
export function settimanaDaCalendario(scheda) {
  if (!scheda?.start_date) return null
  // La T00:00:00 non è decorativa: senza, "2026-09-04" viene letta come
  // mezzanotte UTC e in Italia diventa il giorno prima.
  const inizio = new Date(`${scheda.start_date}T00:00:00`)
  if (Number.isNaN(inizio.getTime())) return null
  const giorni = Math.floor((Date.now() - inizio.getTime()) / 86_400_000)
  if (giorni < 0) return null
  return Math.min(6, Math.floor(giorni / 7) + 1)
}
