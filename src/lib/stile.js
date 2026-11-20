/**
 * Stili condivisi.
 *
 * I colori vivono in src/index.css come variabili CSS (--accento, --sup,
 * --testo-medio…): lì c'è il vocabolario. Qui stanno i pochi insiemi di
 * proprietà che si ripetono e che non sono un colore.
 */

/**
 * Ripristina l'aspetto che il browser mette d'ufficio su un <button>.
 *
 * Otto elementi cliccabili erano <div onClick>: non raggiungibili da tastiera
 * né annunciati come pulsanti da un lettore di schermo. Diventando <button>
 * si portano dietro sfondo, bordo, imbottitura, carattere e allineamento del
 * browser — che vanno spenti, altrimenti l'aspetto cambia.
 *
 * Va messo in testa all'oggetto di stile, con lo spread: quello che viene
 * dopo vince, ed è esattamente quello che serve.
 *
 *   style={{ ...comePulsante, background: 'var(--sup)', padding: '12px' }}
 */
export const comePulsante = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
  WebkitAppearance: 'none',
}

/**
 * Il segno degli atleti Silver: una targhetta argento accanto al nome.
 *
 * Prima era arancione come tutto il resto, e in mezzo ai pulsanti arancioni
 * non si notava. I coach hanno chiesto l'argento: si capisce senza leggere.
 */
export const distintivoSilver = {
  display: 'inline-block', marginLeft: '8px', padding: '1px 7px', borderRadius: '3px', verticalAlign: 'middle',
  fontSize: '11px', fontWeight: '900', letterSpacing: '1px', lineHeight: 1.5,
  color: '#15171a', background: 'linear-gradient(135deg, #f3f5f8 0%, var(--argento) 45%, var(--argento-scuro) 100%)',
  boxShadow: '0 0 8px var(--argento-alone)',
}

/** L'alone argento attorno a una riga intera, per chi è Silver. */
export const aloneSilver = {
  border: '1px solid var(--argento-bordo)',
  boxShadow: '0 0 12px var(--argento-alone), inset 0 0 10px rgba(212,217,224,.06)',
}
