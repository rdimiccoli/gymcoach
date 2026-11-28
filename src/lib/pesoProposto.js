/**
 * Il peso proposto per oggi.
 *
 * Accanto al riquadro PREC., dove la cella di oggi è ancora vuota, compare un
 * numero col punto di domanda («55?»): il peso che probabilmente si farà.
 * Un tocco lo segna; + e − partono da lì.
 *
 * ── Perché questo calcolo ───────────────────────────────────────────────
 * Provato il 28/11/2026 sui pesi veri della palestra: 467 coppie di
 * settimane una dopo l'altra, stessa persona, stesso esercizio, stessa
 * scheda. Da una settimana all'altra:
 *   - due dischi in più (es. +5 kg)  25 volte su 100 — il caso più comune
 *   - lo stesso peso                 21 su 100 (c'è già PREC. ↵)
 *   - un disco in più                18 su 100
 *   - quattro dischi in più          12 su 100
 *   - meno di prima                   4 su 100
 * Indovinare il numero esatto è difficile: il calcolo migliore ci prende
 * 3 volte su 10. Ma il punto non è indovinare: partendo dalla proposta
 * invece che dal peso della volta prima, per arrivare al peso giusto
 * servono in media 1,6 tocchi invece di 2,3.
 *
 * Il calcolo: il peso della volta prima più un ottavo (12,5%, l'aumento
 * tipico in palestra), arrotondato al passo dell'esercizio (2,5, 2 o 1 kg,
 * vedi passoPeso.js), e comunque almeno un passo sopra. Si è provato anche
 * «quanto sale di solito QUESTA persona»: stessi tocchi, e serve uno storico
 * che 85 coppie su 100 ancora non hanno.
 *
 * Si propone solo quando c'è un peso della settimana SUBITO PRIMA nella
 * stessa scheda: dopo una settimana saltata, o col primo peso di una
 * scheda nuova (ripetizioni diverse), un aumento non è il caso tipico.
 */

/** L'aumento tipico da una settimana all'altra: un ottavo. */
export const AUMENTO = 0.125

/**
 * `prec`: il peso della settimana prima. `passo`: 2.5, 2 o 1.
 * Torna il peso proposto, o null se non c'è niente da proporre.
 */
export function pesoProposto(prec, passo = 1) {
  const kg = Number(prec)
  if (!Number.isFinite(kg) || kg <= 0) return null
  const p = Number(passo) > 0 ? Number(passo) : 1
  // Il primo multiplo del passo sopra il peso di prima: 20 → 22,5; 21 → 22,5.
  const minimo = (Math.floor(kg / p + 1e-9) + 1) * p
  const conAumento = Math.round((kg * (1 + AUMENTO)) / p + 1e-9) * p
  return Number(Math.max(minimo, conAumento).toFixed(2))
}

/** «55», «22,5»: con la virgola, come si scrive in Italia. */
export const scriviKg = kg => String(kg).replace('.', ',')
