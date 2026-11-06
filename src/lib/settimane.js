/**
 * Quante settimane dura una scheda, e come si dividono le ripetizioni.
 *
 * Erano sei, scritte in una decina di punti. Ma non c'è una durata giusta:
 * a volte una scheda dura due settimane, a volte otto, e lo decide il coach
 * ogni volta che ne crea una. Ora è un numero della scheda, e tutto il resto
 * — «settimana 3 di 8», la barra, l'avviso di fine scheda — lo legge da qui.
 *
 * ── Le ripetizioni ────────────────────────────────────────────────────────
 * Ogni esercizio ha tre caselle di ripetizioni. Con sei settimane valgono
 * due settimane ciascuna: 1-2, 3-4, 5-6. Con un'altra durata le tre fasi —
 * inizio, metà, fine — si allungano o si accorciano, dividendosi le
 * settimane il più possibile in parti uguali; se avanzano settimane le
 * prendono le prime fasi. Così:
 *    6 → 1-2 · 3-4 · 5-6    (esattamente come prima)
 *    8 → 1-3 · 4-6 · 7-8
 *    4 → 1-2 · 3 · 4
 *    2 → 1 · 2              (due caselle: la terza non servirebbe)
 * Il coach non deve scrivere niente in più: la regola è sempre «tre fasi»,
 * e le caselle dicono da sole a quali settimane si riferiscono.
 *
 * Le schede che esistono non hanno il numero: valgono sei, come prima.
 *
 * ── Il passo: ogni quante settimane cambiano ─────────────────────────────
 * Le tre fasi automatiche non bastano a tutti: c'è chi fa progredire ogni
 * settimana, chi ogni due, chi ogni tre. Allora la scheda può avere anche un
 * PASSO (`ogni`): le ripetizioni cambiano ogni N settimane, e le caselle
 * sono tante quanti i blocchi. Con 8 settimane:
 *    ogni 1 → 8 caselle · ogni 2 → 1-2 · 3-4 · 5-6 · 7-8 · ogni 3 → 1-3 · 4-6 · 7-8
 * Una casella lasciata vuota vale come quella prima: il coach scrive solo
 * quando le ripetizioni cambiano davvero.
 *
 * Senza passo (le schede di prima) restano le tre fasi automatiche, e con
 * sei settimane sono identiche a «ogni 2».
 */

export const SETTIMANE_MIN = 1
// Un tetto c'è solo perché la barra delle settimane deve starci su un
// telefono. Sedici sono quattro mesi.
export const SETTIMANE_MAX = 16
export const SETTIMANE_PREDEFINITE = 6

const CAMPI = ['reps_a', 'reps_b', 'reps_c']

/** Quante settimane dura questa scheda. Senza numero: sei. */
export function settimaneDi(scheda) {
  const grezzo = scheda?.settimane
  // null va distinto da zero: Number(null) fa 0, e una scheda di prima si
  // ritroverebbe lunga una settimana invece di sei.
  if (grezzo === null || grezzo === undefined || grezzo === '') return SETTIMANE_PREDEFINITE
  const n = Number(grezzo)
  if (!Number.isFinite(n)) return SETTIMANE_PREDEFINITE
  return Math.min(SETTIMANE_MAX, Math.max(SETTIMANE_MIN, Math.trunc(n)))
}

/** Ogni quante settimane cambiano le ripetizioni. `null` = tre fasi automatiche. */
export function ogniDi(scheda) {
  const grezzo = scheda?.ogni
  if (grezzo === null || grezzo === undefined || grezzo === '') return null
  const n = Number(grezzo)
  if (!Number.isFinite(n)) return null
  return Math.min(settimaneDi(scheda), Math.max(1, Math.trunc(n)))
}

/**
 * Le fasi delle ripetizioni: [{ indice: 0, campo: 'reps_a', da: 1, a: 2 }, ...].
 * `campo` c'è solo per le prime tre, che hanno ancora la loro colonna.
 */
export function fasi(totale, ogni = null) {
  const n = settimaneDi({ settimane: totale })
  if (ogni !== null && ogni !== undefined) {
    const passo = Math.min(n, Math.max(1, Math.trunc(Number(ogni)) || 1))
    const elenco = []
    for (let da = 1, i = 0; da <= n; da += passo, i++) {
      elenco.push({ indice: i, campo: CAMPI[i] ?? null, da, a: Math.min(n, da + passo - 1) })
    }
    return elenco
  }
  const quante = Math.min(CAMPI.length, n)
  const base = Math.floor(n / quante)
  const avanzo = n % quante
  let da = 1
  return CAMPI.slice(0, quante).map((campo, i) => {
    const lunghezza = base + (i < avanzo ? 1 : 0)
    const fase = { indice: i, campo, da, a: da + lunghezza - 1 }
    da += lunghezza
    return fase
  })
}

/** La fase a cui appartiene una settimana. */
export function faseDi(settimana, totale, ogni = null) {
  const elenco = fasi(totale, ogni)
  const s = Math.min(elenco[elenco.length - 1].a, Math.max(1, Number(settimana) || 1))
  return elenco.find(f => s >= f.da && s <= f.a)
}

/** «SETT. 1-3», o «SETT. 4» quando la fase è lunga una settimana sola. */
export const etichettaFase = f => (f.da === f.a ? `SETT. ${f.da}` : `SETT. ${f.da}-${f.a}`)

/**
 * Le ripetizioni di un esercizio per una fase.
 *
 * Le caselle stanno in `reps_fasi` (una per blocco); le schede di prima ne
 * hanno solo tre, in reps_a/b/c. Una casella vuota vale come quella prima:
 * si torna indietro finché se ne trova una scritta.
 */
export function repsDiFase(esercizio, indice) {
  if (!esercizio) return undefined
  const caselle = Array.isArray(esercizio.reps_fasi) && esercizio.reps_fasi.length
    ? esercizio.reps_fasi
    : [esercizio.reps_a, esercizio.reps_b, esercizio.reps_c]
  for (let i = Math.min(indice, caselle.length - 1); i >= 0; i--) {
    const v = caselle[i]
    if (v !== null && v !== undefined && String(v).trim() !== '') return v
  }
  return undefined
}

/**
 * Le caselle di un esercizio rifatte per una nuova divisione delle settimane.
 *
 * Cambiare il passo (o la durata) di una scheda già scritta cambierebbe il
 * significato delle caselle: con «ogni 2» la seconda casella è la settimana
 * 3-4, con «ogni 1» è la settimana 2. Per non stravolgere il programma, ogni
 * nuova casella prende le ripetizioni che la sua prima settimana aveva PRIMA.
 * Il coach poi cambia solo quello che vuole.
 *
 * `prima` e `dopo`: { totale, ogni }.
 */
export function rimappaCaselle(esercizio, prima, dopo) {
  return fasi(dopo.totale, dopo.ogni)
    .map(f => repsDiFase(esercizio, faseDi(f.da, prima.totale, prima.ogni).indice) ?? '')
}

/**
 * Le caselle pronte per il database: tutte in reps_fasi, e le prime tre
 * anche nelle colonne di sempre (reps_a, b, c), che il CSV e le schede di
 * prima continuano a leggere. Con meno di tre caselle, quelle che mancano
 * ripetono l'ultima.
 */
export function colonneReps(caselle) {
  const c = k => caselle[Math.min(k, caselle.length - 1)] ?? ''
  return { reps_fasi: caselle, reps_a: c(0), reps_b: c(1), reps_c: c(2) }
}

/** Due divisioni sono uguali se hanno le stesse caselle sulle stesse settimane. */
export const stessaDivisione = (a, b) =>
  fasi(a.totale, a.ogni).map(etichettaFase).join() === fasi(b.totale, b.ogni).map(etichettaFase).join()
