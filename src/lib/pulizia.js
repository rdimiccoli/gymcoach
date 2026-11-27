/**
 * «Mettere in ordine»: cosa c'è da sistemare negli elenchi.
 *
 * Il 27/11/2026 c'erano 80 persone attive su 335 senza nemmeno un peso, 3
 * persone iscritte in due turni (con lo storico diviso in due) e 3 esercizi
 * doppi che differivano per uno spazio o una barra. Qui si trovano; si
 * sistemano uno alla volta, sempre con conferma.
 */

/** Il nome «nudo»: solo lettere e cifre, minuscole, senza accenti. */
export function chiaveNome(...parti) {
  return parti.join(' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Gruppi di persone attive con lo stesso nome e cognome, in più righe. */
export function personeDoppie(persone) {
  const gruppi = {}
  for (const p of persone || []) {
    const k = chiaveNome(p.surname, p.name)
    if (k) (gruppi[k] ||= []).push(p)
  }
  return Object.values(gruppi).filter(g => g.length > 1)
}

/**
 * Gruppi di esercizi uguali a meno di spazi, barre e maiuscole:
 * «Alzate a V» e «Alzate AV», «Fianchi KB/ al cavo» e «Fianchi KB / al cavo».
 */
export function eserciziDoppi(esercizi) {
  const gruppi = {}
  for (const e of esercizi || []) {
    const k = chiaveNome(e.name)
    if (k) (gruppi[k] ||= []).push(e)
  }
  return Object.values(gruppi).filter(g => g.length > 1)
}

/** Fra due doppioni, quale tenere: quello con più pesi (poi il più vecchio). */
export function chiTenere(gruppo, pesiDi = () => 0) {
  return [...gruppo].sort((a, b) =>
    (pesiDi(b) - pesiDi(a)) || String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )[0]
}
