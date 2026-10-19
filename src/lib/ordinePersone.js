/**
 * L'ordine in cui compaiono le persone di un turno.
 *
 * Di base è alfabetico per cognome, che è l'unico ordine che non ha bisogno
 * di essere deciso da nessuno. Ma un coach che fa lavorare in coppia due
 * persone con carichi simili — Borracino e Spira — se le ritrova lontane
 * nell'elenco, e a ogni esercizio deve scorrere su e giù per trovarle
 * entrambe.
 *
 * ── Perché l'ordine e non le «coppie» ─────────────────────────────────────
 * La richiesta era «fare delle coppie, o quanto meno gestire io l'ordine».
 * Potendo mettere i nomi dove si vuole, le coppie ci sono già: si mettono i
 * due uno sotto l'altro. Le coppie come concetto a sé avrebbero portato
 * domande senza una risposta sola — cosa succede se uno dei due manca, se
 * sono in tre, se arriva un ospite — e un'altra cosa da spiegare a chi usa
 * l'app con le mani occupate. Un concetto invece di due.
 *
 * Chi non tocca niente resta in ordine alfabetico, come è sempre stato.
 */

/** Numera tutti da 1 nell'ordine in cui stanno adesso. */
export function numeraDaCapo(persone) {
  return persone.map((p, i) => ({ ...p, sort_order: i + 1 }))
}

/**
 * Sposta la persona in posizione `da` di un passo in su (-1) o in giù (+1),
 * e rinumera tutti. Fuori dai bordi non fa niente.
 */
export function spostaDi(persone, da, passo) {
  const a = da + passo
  if (da < 0 || da >= persone.length || a < 0 || a >= persone.length) return persone
  const copia = [...persone]
  const [tolta] = copia.splice(da, 1)
  copia.splice(a, 0, tolta)
  return numeraDaCapo(copia)
}

/**
 * Le righe da salvare: solo quelle a cui il numero è cambiato davvero.
 *
 * Salvare tutte le righe a ogni spostamento vorrebbe dire venticinque
 * scritture per muovere una persona di un posto, sul wifi della palestra.
 */
export function daSalvare(prima, dopo) {
  const vecchio = new Map(prima.map(p => [p.id, p.sort_order ?? null]))
  return dopo
    .filter(p => vecchio.get(p.id) !== p.sort_order)
    .map(p => ({ id: p.id, sort_order: p.sort_order }))
}

/**
 * L'ordine da usare a schermo quando i dati arrivano già ordinati dal
 * database: serve solo a chi riceve un elenco mescolato, come i test.
 * Chi non ha un numero va in fondo, in ordine alfabetico.
 */
export function ordinate(persone) {
  return [...persone].sort((a, b) => {
    const na = a.sort_order ?? Infinity
    const nb = b.sort_order ?? Infinity
    if (na !== nb) return na - nb
    return `${a.surname ?? ''} ${a.name ?? ''}`.localeCompare(`${b.surname ?? ''} ${b.name ?? ''}`)
  })
}

/**
 * Aggiunge l'ordinamento a una query sulle persone.
 *
 * `conOrdine` dice se la colonna `sort_order` esiste davvero nel database:
 * quando non c'è si ordina solo per cognome e nome, come si è sempre fatto.
 * Chi non ha un numero finisce in fondo, in ordine alfabetico.
 */
export function ordinaElenco(query, conOrdine) {
  const q = conOrdine ? query.order('sort_order', { nullsFirst: false }) : query
  return q.order('surname').order('name')
}
