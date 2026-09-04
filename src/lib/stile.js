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
