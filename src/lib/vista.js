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
 * ── Dove sta scritta ────────────────────────────────────────────────────
 * All'inizio stava solo nel telefono, per non dover lanciare un'altra
 * migrazione, e il prezzo scritto qui era: «chi cambia telefono la rimette».
 * Quel prezzo è diventato caro l'8/10/2026, quando l'app ha iniziato a
 * girare anche su tablet e computer: Sandro avrebbe dovuto accenderla tre
 * volte, una per ogni schermo, e ritrovarsela spenta sul quarto.
 *
 * Ora la risposta vera è la colonna `coaches.vista`, che segue la persona
 * ovunque entri. Il telefono resta come riserva per il tempo fra la messa
 * online dell'app e il lancio della migrazione: finché la colonna non c'è,
 * si comporta esattamente come prima.
 */

export const PER_ESERCIZIO = 'esercizi'
export const PER_ATLETA = 'atleti'

const chiave = idCoach => `gymcoach.vista-turni.${idCoach}`

/** Solo «atleti» conta come scelta: qualunque altra cosa è la vista di sempre. */
const normalizza = v => (v === PER_ATLETA ? PER_ATLETA : null)

/**
 * Come si aprono i turni per questo coach.
 *
 * Prima guarda il profilo, che vale su tutti i dispositivi; se la colonna non
 * c'è ancora guarda il telefono. Chi non ha mai scelto niente trova la vista
 * per esercizio, come è sempre stato.
 */
export function vistaTurni(coach) {
  // Si accetta ancora il solo id, per non rompere nessuna chiamata rimasta.
  const profilo = typeof coach === 'string' ? null : coach
  const id = profilo ? profilo.id : coach

  const dalProfilo = normalizza(profilo?.vista)
  if (dalProfilo) return dalProfilo
  // Il profilo dice esplicitamente «per esercizio»: vince sul telefono,
  // altrimenti spegnerla da un dispositivo non la spegnerebbe davvero.
  if (profilo && profilo.vista === PER_ESERCIZIO) return PER_ESERCIZIO

  try {
    return normalizza(localStorage.getItem(chiave(id))) || PER_ESERCIZIO
  } catch {
    // Modalità privata, cookie bloccati: si riparte dal comportamento noto.
    return PER_ESERCIZIO
  }
}

/** La riserva nel telefono, per quando la colonna sul profilo non c'è. */
export function impostaVistaTurni(idCoach, vista) {
  try {
    localStorage.setItem(chiave(idCoach), vista === PER_ATLETA ? PER_ATLETA : PER_ESERCIZIO)
  } catch { /* se non si può salvare, vale per questa sessione e basta */ }
}
