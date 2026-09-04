import { describe, it, expect } from 'vitest'
import { raggruppaEsercizi, repsPerSettimana, tipoGruppo, secondiDaTesto, numeroDaTesto, settimanaDaCalendario, TIPO } from './schede'

const ex = (id, gruppo = null, reps = {}) => ({
  id,
  superset_group: gruppo,
  reps_a: reps.a ?? '3x8',
  reps_b: reps.b ?? '3x10',
  reps_c: reps.c ?? '3x12',
})

describe('repsPerSettimana', () => {
  const e = ex(1, null, { a: 'A', b: 'B', c: 'C' })

  it('cambia colonna ogni due settimane', () => {
    expect(repsPerSettimana(e, 1)).toBe('A')
    expect(repsPerSettimana(e, 2)).toBe('A')
    expect(repsPerSettimana(e, 3)).toBe('B')
    expect(repsPerSettimana(e, 4)).toBe('B')
    expect(repsPerSettimana(e, 5)).toBe('C')
    expect(repsPerSettimana(e, 6)).toBe('C')
  })

  it('oltre la sesta settimana resta sull_ultima colonna invece di rompersi', () => {
    expect(repsPerSettimana(e, 7)).toBe('C')
    expect(repsPerSettimana(e, 99)).toBe('C')
  })

  it('non esplode su un esercizio mancante', () => {
    expect(repsPerSettimana(null, 3)).toBeUndefined()
    expect(repsPerSettimana(undefined, 1)).toBeUndefined()
  })
})

describe('tipoGruppo', () => {
  it('riconosce circuiti e superserie dal prefisso', () => {
    expect(tipoGruppo('CIR-A')).toBe(TIPO.CIRCUITO)
    expect(tipoGruppo('SS-B')).toBe(TIPO.SUPERSERIE)
  })

  it('senza etichetta è un esercizio singolo', () => {
    expect(tipoGruppo(null)).toBe(TIPO.SINGOLO)
    expect(tipoGruppo(undefined)).toBe(TIPO.SINGOLO)
    expect(tipoGruppo('')).toBe(TIPO.SINGOLO)
  })

  it('un_etichetta sconosciuta resta un gruppo, non viene spezzata', () => {
    // Era la divergenza fra le tre copie: CycleForm la trattava come singolo,
    // spezzando esercizi che il coach aveva messo insieme.
    expect(tipoGruppo('QUALCOSA')).toBe(TIPO.SUPERSERIE)
  })
})

describe('raggruppaEsercizi', () => {
  it('tiene separati gli esercizi singoli', () => {
    const gruppi = raggruppaEsercizi([ex(1), ex(2), ex(3)])
    expect(gruppi).toHaveLength(3)
    expect(gruppi.every(g => g.type === TIPO.SINGOLO)).toBe(true)
  })

  it('unisce gli esercizi con la stessa etichetta', () => {
    const gruppi = raggruppaEsercizi([ex(1, 'SS-A'), ex(2, 'SS-A'), ex(3)])
    expect(gruppi).toHaveLength(2)
    expect(gruppi[0].type).toBe(TIPO.SUPERSERIE)
    expect(gruppi[0].exercises.map(e => e.id)).toEqual([1, 2])
    expect(gruppi[1].type).toBe(TIPO.SINGOLO)
  })

  it('mantiene l_ordine di arrivo anche con gruppi non contigui', () => {
    const gruppi = raggruppaEsercizi([ex(1, 'SS-A'), ex(2), ex(3, 'SS-A'), ex(4, 'CIR-B')])
    expect(gruppi.map(g => g.label)).toEqual(['SS-A', null, 'CIR-B'])
    expect(gruppi[0].exercises.map(e => e.id)).toEqual([1, 3])
  })

  it('tiene distinti gruppi diversi', () => {
    const gruppi = raggruppaEsercizi([ex(1, 'SS-A'), ex(2, 'SS-B'), ex(3, 'CIR-A')])
    expect(gruppi).toHaveLength(3)
    expect(gruppi.map(g => g.type)).toEqual([TIPO.SUPERSERIE, TIPO.SUPERSERIE, TIPO.CIRCUITO])
  })

  it('accetta anche la forma supersetGroup usata da CycleForm', () => {
    const gruppi = raggruppaEsercizi([
      { id: 1, supersetGroup: 'CIR-A' },
      { id: 2, supersetGroup: 'CIR-A' },
    ])
    expect(gruppi).toHaveLength(1)
    expect(gruppi[0].type).toBe(TIPO.CIRCUITO)
  })

  it('con indice conserva la posizione originale, che serve al trascinamento', () => {
    const gruppi = raggruppaEsercizi([ex(1, 'SS-A'), ex(2), ex(3, 'SS-A')], { indice: true })
    expect(gruppi[0].exercises.map(e => e.idx)).toEqual([0, 2])
    expect(gruppi[1].exercises[0].idx).toBe(1)
  })

  it('regge liste vuote, nulle e con buchi', () => {
    expect(raggruppaEsercizi([])).toEqual([])
    expect(raggruppaEsercizi(null)).toEqual([])
    expect(raggruppaEsercizi(undefined)).toEqual([])
    expect(raggruppaEsercizi([ex(1), null, ex(2)])).toHaveLength(2)
  })
})

describe('secondiDaTesto', () => {
  it('legge le durate come le scrive il coach', () => {
    // Valori presi dai dati reali del circuito CIR-A
    expect(secondiDaTesto('50s')).toBe(50)
    expect(secondiDaTesto('10s')).toBe(10)
    expect(secondiDaTesto('30s')).toBe(30)
    expect(secondiDaTesto('15s')).toBe(15)
  })

  it('accetta un numero nudo come secondi, e i minuti come minuti', () => {
    expect(secondiDaTesto('45')).toBe(45)
    expect(secondiDaTesto("2'")).toBe(120)
    expect(secondiDaTesto('1 min')).toBe(60)
    expect(secondiDaTesto(' 20 S ')).toBe(20)
  })

  it('rifiuta quello che non è una durata, invece di inventarsi un numero', () => {
    // Se il timer partisse su queste, direbbe tempi sbagliati a voce alta
    expect(secondiDaTesto('3x10')).toBeNull()
    expect(secondiDaTesto('MAX')).toBeNull()
    expect(secondiDaTesto('2xMAX + 15" + MAX + DROP')).toBeNull()
    expect(secondiDaTesto('3x8 +8')).toBeNull()
    expect(secondiDaTesto('')).toBeNull()
    expect(secondiDaTesto(null)).toBeNull()
    expect(secondiDaTesto('0s')).toBeNull()
  })
})

describe('numeroDaTesto', () => {
  it('legge il numero di giri', () => {
    expect(numeroDaTesto('3')).toBe(3)
    expect(numeroDaTesto('4 giri')).toBe(4)
    expect(numeroDaTesto('x5')).toBe(5)
  })

  it('rifiuta valori senza numeri o nulli', () => {
    expect(numeroDaTesto('MAX')).toBeNull()
    expect(numeroDaTesto(null)).toBeNull()
    expect(numeroDaTesto('0')).toBeNull()
  })
})

describe('settimanaDaCalendario', () => {
  const giorniFa = n => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return { start_date: d.toISOString().slice(0, 10) }
  }

  it('conta le settimane dalla data di inizio', () => {
    expect(settimanaDaCalendario(giorniFa(0))).toBe(1)
    expect(settimanaDaCalendario(giorniFa(6))).toBe(1)
    expect(settimanaDaCalendario(giorniFa(7))).toBe(2)
    expect(settimanaDaCalendario(giorniFa(25))).toBe(4)  // lo scenario dimostrativo
    expect(settimanaDaCalendario(giorniFa(35))).toBe(6)
  })

  it('si ferma alla sesta: le schede durano sei settimane', () => {
    expect(settimanaDaCalendario(giorniFa(90))).toBe(6)
    expect(settimanaDaCalendario(giorniFa(400))).toBe(6)
  })

  it('non azzarda una settimana su una scheda che deve ancora iniziare', () => {
    const domani = new Date()
    domani.setDate(domani.getDate() + 1)
    expect(settimanaDaCalendario({ start_date: domani.toISOString().slice(0, 10) })).toBeNull()
  })

  it('senza data non inventa niente', () => {
    expect(settimanaDaCalendario(null)).toBeNull()
    expect(settimanaDaCalendario({})).toBeNull()
    expect(settimanaDaCalendario({ start_date: 'non-una-data' })).toBeNull()
  })
})
