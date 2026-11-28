/**
 * Copia un testo negli appunti del telefono, per incollarlo su WhatsApp.
 *
 * Il modo nuovo (`navigator.clipboard`) non c'è su tutti i telefoni e non
 * funziona fuori da https: in quel caso si passa dal modo vecchio, con una
 * casella di testo nascosta. Torna true se il testo è stato copiato.
 */
export async function copiaNegliAppunti(testo) {
  if (!testo) return false
  try {
    await navigator.clipboard.writeText(testo)
    return true
  } catch {
    try {
      const casella = document.createElement('textarea')
      casella.value = testo
      casella.setAttribute('readonly', '')
      casella.style.position = 'fixed'
      casella.style.opacity = '0'
      document.body.appendChild(casella)
      casella.select()
      const fatto = document.execCommand('copy')
      document.body.removeChild(casella)
      return fatto
    } catch {
      return false
    }
  }
}
