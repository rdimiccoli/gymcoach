/**
 * Come si aprono i turni: per esercizio o per atleta.
 *
 * Sandro ha turni da tredici persone divise su tre schede diverse. Per lui
 * «un esercizio e sotto chi lo fa» non funziona: gli serve l'elenco delle
 * persone, e toccare quella che ha davanti.
 *
 * Manu invece ha turni dove seguono tutti la stessa scheda, e per quelli la
 * vista per esercizio è più rapida: ti metti allo squat e segni dodici
 * persone da una schermata sola.
 *
 * Quindi non è una decisione da prendere una volta per tutta l'app: è una
 * preferenza di ogni coach. Chi non la tocca trova quello che trovava prima.
 *
 * Sta nel telefono e non nel database: non voleva un'altra migrazione da
 * lanciare a mano, e il prezzo è che chi cambia telefono la rimette. Il
 * giorno che dà fastidio si sposta su `coaches` in cinque minuti.
 */

export const PER_ESERCIZIO = 'esercizi'
export const PER_ATLETA = 'atleti'

const chiave = idCoach => `gymcoach.vista-turni.${idCoach}`

/** Per esercizio finché qualcuno non sceglie altro: nessuno cambia vista da solo. */
export function vistaTurni(idCoach) {
  try {
    return localStorage.getItem(chiave(idCoach)) === PER_ATLETA ? PER_ATLETA : PER_ESERCIZIO
  } catch {
    // Modalità privata, cookie bloccati: si riparte dal comportamento noto.
    return PER_ESERCIZIO
  }
}

export function impostaVistaTurni(idCoach, vista) {
  try {
    localStorage.setItem(chiave(idCoach), vista === PER_ATLETA ? PER_ATLETA : PER_ESERCIZIO)
  } catch { /* se non si può salvare, vale per questa sessione e basta */ }
}
