/**
 * Vibrazione di conferma.
 *
 * Con il telefono in mano mentre si guarda l'atleta e non lo schermo, la
 * vibrazione conferma il tocco senza doverlo verificare con gli occhi. Su
 * un'app dove si tocca «+» centinaia di volte a sessione cambia la sensazione
 * d'uso più di quanto sembri.
 *
 * iOS non supporta navigator.vibrate: lì semplicemente non succede niente, e
 * va bene così — è un rinforzo, non un canale d'informazione. Niente che la
 * coach debba sapere passa solo da qui.
 */

const disponibile = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function batti(schema) {
  if (!disponibile) return
  // La chiamata può fallire se il dispositivo ha la vibrazione disattivata o se
  // la pagina non è in primo piano: non deve mai propagare un errore.
  try { navigator.vibrate(schema) } catch { /* silenzio */ }
}

/** Tocco leggero: un carico modificato, una spunta. */
export const tocco = () => batti(8)

/** Qualcosa è andato a buon fine: due colpetti brevi. */
export const conferma = () => batti([12, 40, 12])

/** Qualcosa è andato storto: un colpo più lungo. */
export const errore = () => batti(45)
