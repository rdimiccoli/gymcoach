// Lettura e scrittura del CSV delle schede, nello stesso formato che il
// database esporta:
//   id,sort_order,day,reps_a,reps_b,reps_c,superset_group,exercise_name
//
// Un semplice split(',') qui non regge: le notazioni reali contengono virgole
// e virgolette dentro i campi, per esempio
//   "2xMAX + 15"" + MAX + DROP"
// che va letto come  2xMAX + 15" + MAX + DROP

/**
 * Indovina il separatore guardando la prima riga, fuori dalle virgolette.
 *
 * Non è pignoleria: Excel in italiano esporta con il punto e virgola, e chi
 * copia delle celle da un foglio di calcolo e le incolla ottiene tabulazioni.
 * Accettare solo la virgola voleva dire fallire in tutti e due i casi più
 * probabili, per giunta con il messaggio sbagliato («manca la colonna...»).
 */
function separatore(testo) {
  const prima = String(testo ?? '').split(/\r?\n/).find(r => r.trim() !== '') || ''
  let traVirgolette = false
  const conta = { ',': 0, ';': 0, '\t': 0 }
  for (const c of prima) {
    if (c === '"') { traVirgolette = !traVirgolette; continue }
    if (!traVirgolette && c in conta) conta[c]++
  }
  // A parità vince la virgola: è il formato che esportiamo noi.
  return conta[';'] > conta[','] && conta[';'] >= conta['\t'] ? ';'
    : conta['\t'] > conta[','] ? '\t'
    : ','
}

/** Divide un testo CSV in righe di campi, rispettando virgolette ed escape. */
export function analizzaCsv(testo, sep = separatore(testo)) {
  const s = String(testo ?? '').replace(/\r\n?/g, '\n')
  const righe = []
  let riga = []
  let campo = ''
  let traVirgolette = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (traVirgolette) {
      if (c !== '"') { campo += c; continue }
      if (s[i + 1] === '"') { campo += '"'; i++ }  // virgoletta raddoppiata
      else traVirgolette = false
      continue
    }
    if (c === '"') traVirgolette = true
    else if (c === sep) { riga.push(campo); campo = '' }
    else if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || riga.length) { riga.push(campo); righe.push(riga) }

  // Via le righe completamente vuote (l'a capo finale ne produce sempre una)
  return righe.filter(r => r.some(c => c.trim() !== ''))
}

const NULLI = new Set(['', 'null', 'NULL', 'undefined', '-'])
const pulisci = v => (v ?? '').trim()
const oNullo = v => (NULLI.has(pulisci(v)) ? null : pulisci(v))

/**
 * Trasforma il CSV in esercizi pronti da inserire.
 * Ritorna { esercizi, problemi }: i problemi sono descrizioni leggibili, così
 * la coach vede cosa non va prima di scrivere qualsiasi cosa nel database.
 */
export function eserciziDaCsv(testo) {
  const righe = analizzaCsv(testo)
  if (righe.length < 2) {
    return { esercizi: [], problemi: ['Il testo non contiene né intestazione né righe.'] }
  }

  const intestazione = righe[0].map(h => pulisci(h).toLowerCase())
  const col = nome => intestazione.indexOf(nome)
  const iNome = col('exercise_name')
  const iGiorno = col('day')

  // Dire solo «manca la colonna X» lascia a indovinare: quasi sempre il
  // problema è che l'intestazione è finita tutta in una casella sola perché il
  // separatore era un altro. Mostrare cosa abbiamo letto lo rende evidente.
  const trovate = intestazione.filter(Boolean).join(', ') || '(nessuna)'
  if (iNome < 0 || iGiorno < 0) {
    const manca = iNome < 0 ? 'exercise_name' : 'day'
    return {
      esercizi: [],
      problemi: [
        `Manca la colonna "${manca}". Colonne lette: ${trovate}.`,
        intestazione.length === 1
          ? 'Sembra che le colonne non siano state separate: controlla che il file usi virgole, punti e virgola o tabulazioni.'
          : 'Controlla che l\'intestazione contenga sia "exercise_name" sia "day".',
      ],
    }
  }

  const iA = col('reps_a'), iB = col('reps_b'), iC = col('reps_c')
  const iGruppo = col('superset_group'), iOrdine = col('sort_order')

  const esercizi = []
  const problemi = []

  righe.slice(1).forEach((r, idx) => {
    const numeroRiga = idx + 2 // 1 = intestazione
    const nome = pulisci(r[iNome])
    if (!nome) { problemi.push(`Riga ${numeroRiga}: manca il nome dell'esercizio.`); return }

    const giorno = parseInt(pulisci(r[iGiorno]), 10)
    if (![1, 2, 3].includes(giorno)) {
      problemi.push(`Riga ${numeroRiga} ("${nome}"): giorno "${pulisci(r[iGiorno])}" non valido, deve essere 1, 2 o 3.`)
      return
    }

    const ordine = iOrdine >= 0 ? parseInt(pulisci(r[iOrdine]), 10) : NaN

    esercizi.push({
      nome,
      giorno,
      repsA: iA >= 0 ? pulisci(r[iA]) : '',
      repsB: iB >= 0 ? pulisci(r[iB]) : '',
      repsC: iC >= 0 ? pulisci(r[iC]) : '',
      gruppo: iGruppo >= 0 ? oNullo(r[iGruppo]) : null,
      ordine: Number.isFinite(ordine) ? ordine : idx,
    })
  })

  if (!esercizi.length && !problemi.length) problemi.push('Nessun esercizio trovato nel testo.')
  return { esercizi, problemi }
}

const virgoletta = v => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Produce il CSV di una scheda, nello stesso formato dell'esportazione. */
export function csvDaEsercizi(esercizi) {
  const intestazione = ['id', 'sort_order', 'day', 'reps_a', 'reps_b', 'reps_c', 'superset_group', 'exercise_name']
  const righe = (esercizi || []).map(e => [
    e.id ?? '',
    e.sort_order ?? '',
    e.day ?? '',
    e.reps_a ?? '',
    e.reps_b ?? '',
    e.reps_c ?? '',
    e.superset_group ?? 'null',
    e.exercises?.name ?? e.exercise_name ?? '',
  ].map(virgoletta).join(','))
  return [intestazione.join(','), ...righe].join('\n')
}
