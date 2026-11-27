/**
 * Gli avvisi sulla card di un turno, in Home.
 *
 * Fino al 27/11/2026 che una scheda fosse all'ultima settimana lo diceva solo
 * SCHEDE, e nessuno ci andava a guardare: una scheda finita restava aperta e
 * i pesi nuovi finivano sopra quelli dell'ultima settimana. Ora lo dice la
 * card che il coach tocca ogni giorno.
 */
import { settimanaVera } from './schede'
import { settimaneDi } from './settimane'

/** 'finita', 'ultima' o null. */
export function statoScheda(scheda) {
  const vera = settimanaVera(scheda)
  if (vera === null) return null
  const totale = settimaneDi(scheda)
  if (vera > totale) return 'finita'
  if (vera === totale) return 'ultima'
  return null
}

/**
 * Il turno è adesso? Da 10 minuti prima dell'inizio a 75 minuti dopo: un
 * turno dura un'ora, e il quarto d'ora in più copre chi finisce tardi.
 * `orario`: «18:30». Senza orario leggibile, no.
 */
export function turnoInCorso(orario, adesso = new Date()) {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(orario || '').trim())
  if (!m) return false
  const inizio = Number(m[1]) * 60 + Number(m[2])
  const ora = adesso.getHours() * 60 + adesso.getMinutes()
  return ora >= inizio - 10 && ora < inizio + 75
}
