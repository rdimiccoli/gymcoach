/**
 * Chi fa quali giorni di una scheda.
 *
 * Una scheda da tre giorni non la fanno tutti per intero: Alessia viene due
 * volte e fa il Giorno 1 e il 2, Greta il 2 e il 3. Il coach lo segna sulla
 * scheda (⋮ → Giorni di ognuno), e il mese dopo, con la scheda nuova, può
 * cambiare combinazione.
 *
 * LA REGOLA: nessuna scelta = tutti i giorni, come è sempre stato. Chi non ha
 * niente di segnato non deve sistemare niente.
 *
 * In seduta, aprendo un giorno, chi non lo fa NON sparisce: va in fondo, in
 * grigio, sotto «Oggi non previsti». Se una volta viene lo stesso, il coach
 * la trova e le segna i carichi come sempre.
 */

/**
 * I giorni scelti, puliti: numeri fra 1 e `totale`, in ordine, senza
 * doppioni. null quando non c'è una scelta vera — vuota, o con tutti i
 * giorni dentro — cioè «tutti i giorni».
 */
export function normalizza(giorni, totale) {
  if (!Array.isArray(giorni)) return null
  const puliti = [...new Set(giorni.map(Number))]
    .filter(g => Number.isInteger(g) && g >= 1 && g <= totale)
    .sort((a, b) => a - b)
  if (!puliti.length || puliti.length >= totale) return null
  return puliti
}

/** Questa persona fa questo giorno? Senza scelta, sì. */
export const fa = (giorni, giorno) => !giorni || giorni.includes(Number(giorno))

/** «G1 · G3», o null se fa tutti i giorni (niente da ricordare). */
export const etichettaGiorni = giorni => (giorni ? giorni.map(g => `G${g}`).join(' · ') : null)

/** Righe del database → { idPersona: [giorni] }, solo le scelte vere. */
export function mappaGiorni(righe, totale) {
  const mappa = {}
  for (const r of righe || []) {
    const g = normalizza(r.giorni, totale)
    if (g) mappa[r.client_id] = g
  }
  return mappa
}

/**
 * Prima chi fa questo giorno, poi chi no — ognuno nel suo ordine di sempre.
 * `giornoDi(elemento)` dice i giorni di un elemento dell'elenco.
 * Torna { previsti, altri }.
 */
export function dividiPerGiorno(elenco, giorno, giornoDi) {
  const previsti = [], altri = []
  for (const x of elenco || []) (fa(giornoDi(x), giorno) ? previsti : altri).push(x)
  return { previsti, altri }
}

/**
 * Accende o spegne un giorno nella scelta di una persona. Non si può
 * spegnere l'ultimo rimasto: una persona che non fa nessun giorno non è
 * nella scheda (per quello c'è «a chi è assegnata»).
 */
export function cambiaGiorno(giorni, giorno, totale) {
  const tutti = Array.from({ length: totale }, (_, i) => i + 1)
  const ora = giorni || tutti
  const dopo = ora.includes(giorno) ? ora.filter(g => g !== giorno) : [...ora, giorno]
  if (!dopo.length) return giorni
  return normalizza(dopo, totale)
}
