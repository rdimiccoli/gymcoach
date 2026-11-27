/**
 * I nomi scritti tutti allo stesso modo.
 *
 * Nel database 206 nomi su 335 sono in maiuscolo («ROSSI MARIA»), altri in
 * minuscolo, altri normali: l'elenco sembrava in disordine. Qui si mostrano
 * tutti con la maiuscola all'inizio, SENZA cambiare come sono salvati.
 *
 * Un nome scritto apposta in un modo misto («McKenzie», «De la Cruz») si
 * rispetta: si sistema solo ciò che è tutto maiuscolo o tutto minuscolo.
 */

const lettere = s => s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')

export function bello(testo) {
  const t = String(testo ?? '').trim().replace(/\s+/g, ' ')
  const l = lettere(t)
  if (!l || (l !== l.toUpperCase() && l !== l.toLowerCase())) return t
  // Maiuscola dopo l'inizio, uno spazio, un apostrofo o un trattino:
  // «D'AMICO» → «D'Amico», «MARIA-GRAZIA» → «Maria-Grazia».
  return t.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, prima, lettera) => prima + lettera.toUpperCase())
}

/** «Rossi Maria»: cognome e nome, come negli elenchi. */
export const nomeCompleto = p => `${bello(p?.surname)} ${bello(p?.name)}`.trim()

/** «Maria Rossi»: per le frasi. */
export const nomeECognome = p => `${bello(p?.name)} ${bello(p?.surname)}`.trim()
