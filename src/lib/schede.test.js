import { describe, it, expect } from 'vitest'
import { raggruppaEsercizi, repsPerSettimana, tipoGruppo, TIPO } from './schede'

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
