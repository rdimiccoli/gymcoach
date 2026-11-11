/**
 * Le frasi della festa per un record.
 *
 * Quando un cliente batte il suo massimo di sempre, la schermata si riempie
 * di coriandoli e compare una di queste frasi, presa a caso.
 *
 * Le frasi vere stanno nel database, tabella `frasi_record`, e le gestisce
 * solo chi amministra Supabase, dal pannello (Table Editor): dall'app si
 * leggono e basta. Così si cambiano senza toccare il codice e senza un
 * nuovo rilascio.
 *
 * Nelle frasi si possono mettere tre parole fra graffe, che l'app sostituisce:
 *   {nome}       il nome del cliente          → Marco
 *   {kg}         il carico del record          → 52,5 kg
 *   {esercizio}  l'esercizio                   → Squat
 *
 * Le frasi di serie sono scritte senza maschile né femminile («per {nome}»,
 * non «è passato»): i turni sono misti, e una frase al maschile per una
 * signora del turno delle 9 stonerebbe proprio nel momento della festa.
 * Le stesse frasi sono nello script SQL che crea la tabella, e da lì si
 * possono togliere come le altre. Finché la tabella non c'è, valgono queste.
 */

export const FRASI_DI_SERIE = [
  '{nome} ha appena fatto arrabbiare la gravità!',
  'Attenzione: nuovo livello sbloccato per {nome}!',
  '{kg} di {esercizio}: qualcuno chiami i giornali!',
  'Il bilanciere ha chiesto pietà. {nome} no.',
  'Oggi {nome} ha fatto colazione con pane e determinazione!',
  'Nuovo record per {nome}! Il ferro trema.',
  'Ufficiale: oggi {nome} è più forte di ieri.',
  '{kg}! {nome}, chi ti ferma più?',
  'Il {esercizio} ha trovato chi lo comanda: {nome}!',
  'Applausi in sala per {nome}!',
  'Record battuto! Anche lo specchio della palestra è impressionato.',
  '{nome} + {esercizio} = storia.',
  'Houston, abbiamo un record: {kg}!',
  'Il coach approva. Il bilanciere un po\' meno.',
  '{nome} ha appena alzato l\'asticella. Letteralmente.',
]

/** Quando i coach hanno tolto tutte le frasi: la festa c'è lo stesso. */
export const FRASE_SEMPLICE = 'Nuovo record per {nome}!'

export const SEGNAPOSTO = ['nome', 'kg', 'esercizio']

/** «52.5» → «52,5 kg». */
export const scriviKg = kg => `${String(kg).replace('.', ',')} kg`

/**
 * La frase con i segnaposto sostituiti. Accetta anche maiuscole e spazi
 * («{ Nome }»): chi scrive dal telefono non deve indovinare la grafia esatta.
 * Una parola fra graffe che non è un segnaposto resta com'è.
 */
export function componiFrase(testo, { nome = '', kg = '', esercizio = '' } = {}) {
  const valori = { nome, kg: kg === '' ? '' : scriviKg(kg), esercizio }
  return String(testo ?? '').replace(/\{\s*(\w+)\s*\}/g, (tutto, parola) => {
    const chiave = parola.toLowerCase()
    return chiave in valori ? valori[chiave] : tutto
  })
}

/**
 * Una frase a caso, ma mai la stessa di prima: due record di fila con la
 * stessa battuta la smontano. `caso` si passa nei test.
 */
export function scegliFrase(elenco, precedente = null, caso = Math.random) {
  const frasi = (elenco || []).filter(f => f && String(f).trim())
  if (!frasi.length) return FRASE_SEMPLICE
  const tra = frasi.length > 1 ? frasi.filter(f => f !== precedente) : frasi
  return tra[Math.floor(caso() * tra.length) % tra.length]
}

/** Il testo è accettabile? Né vuoto né lunghissimo (sullo schermo deve starci). */
export const LUNGHEZZA_MASSIMA = 140
export function fraseValida(testo) {
  const t = String(testo ?? '').trim()
  return t.length > 0 && t.length <= LUNGHEZZA_MASSIMA
}
