/**
 * Quanti giorni ha una scheda.
 *
 * Erano tre, scritti a mano in sette punti del codice. Tre bastavano finché
 * l'app serviva i corsi di gruppo, ma un coach che si allena cinque volte a
 * settimana non poteva usarla per sé, e ogni tanto c'è un cliente che viene
 * quattro volte.
 *
 * Il massimo è cinque e non di più per una ragione che si vede a schermo: le
 * linguette dei giorni stanno in riga sopra il turno, e su un telefono oltre
 * le cinque diventano illeggibili o vanno mandate a capo, cambiando aspetto
 * anche a chi di giorni ne usa tre.
 *
 * Le schede che esistono non hanno la colonna, o ce l'hanno vuota: valgono
 * tre, cioè esattamente come prima. Nessuno si accorge di niente finché non
 * cambia il numero apposta.
 */

export const GIORNI_MIN = 1
export const GIORNI_MAX = 5
export const GIORNI_PREDEFINITI = 3

/** Quanti giorni ha questa scheda, con i piedi per terra. */
export function giorniDi(scheda) {
  const grezzo = scheda?.giorni
  // `null` va distinto da zero: una scheda che non ha mai scelto il numero
  // vale tre, non uno. Number(null) fa 0, e senza questo controllo una
  // scheda di prima si sarebbe ritrovata con un giorno solo.
  if (grezzo === null || grezzo === undefined || grezzo === '') return GIORNI_PREDEFINITI
  const n = Number(grezzo)
  if (!Number.isFinite(n)) return GIORNI_PREDEFINITI
  return Math.min(GIORNI_MAX, Math.max(GIORNI_MIN, Math.trunc(n)))
}

/** [1, 2, 3] — i numeri dei giorni, per disegnare le linguette. */
export function elencoGiorni(scheda) {
  return Array.from({ length: giorniDi(scheda) }, (_, i) => i + 1)
}

/**
 * Il giorno da mostrare, tenuto dentro i limiti della scheda.
 * Passando da una scheda da cinque giorni a una da tre mentre si è sul
 * giorno 5, senza questo si resterebbe su una linguetta che non c'è.
 */
export function giornoValido(giorno, scheda) {
  const max = giorniDi(scheda)
  const n = Number(giorno)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(max, Math.trunc(n))
}

/**
 * L'etichetta della linguetta. Fino a tre ci sta «GIORNO 1»; da quattro in
 * su la riga si stringe e resta solo «G1», che è ancora chiaro perché le
 * linguette sono in fila e numerate.
 */
export function etichettaGiorno(giorno, quanti) {
  return quanti > 3 ? `G${giorno}` : `GIORNO ${giorno}`
}
