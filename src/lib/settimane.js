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

/** Le fasi delle ripetizioni: [{ campo: 'reps_a', da: 1, a: 2 }, ...]. */
export function fasi(totale) {
  const n = settimaneDi({ settimane: totale })
  const quante = Math.min(CAMPI.length, n)
  const base = Math.floor(n / quante)
  const avanzo = n % quante
  let da = 1
  return CAMPI.slice(0, quante).map((campo, i) => {
    const lunghezza = base + (i < avanzo ? 1 : 0)
    const fase = { campo, da, a: da + lunghezza - 1 }
    da += lunghezza
    return fase
  })
}

/** La fase a cui appartiene una settimana. */
export function faseDi(settimana, totale) {
  const elenco = fasi(totale)
  const s = Math.min(elenco[elenco.length - 1].a, Math.max(1, Number(settimana) || 1))
  return elenco.find(f => s >= f.da && s <= f.a)
}

/** «SETT. 1-3», o «SETT. 4» quando la fase è lunga una settimana sola. */
export const etichettaFase = f => (f.da === f.a ? `SETT. ${f.da}` : `SETT. ${f.da}-${f.a}`)
