import { describe, it, expect } from 'vitest'
import { settimaneDi, ogniDi, fasi, faseDi, etichettaFase, repsDiFase, rimappaCaselle, stessaDivisione, colonneReps } from './settimane'

const range = n => fasi(n).map(f => etichettaFase(f)).join(' · ')

describe('durata della scheda', () => {
  it('una scheda di prima, senza numero, dura sei settimane', () => {
    expect(settimaneDi({})).toBe(6)
    expect(settimaneDi({ settimane: null })).toBe(6)
  })

  it('il numero resta dentro i limiti', () => {
    expect(settimaneDi({ settimane: 8 })).toBe(8)
    expect(settimaneDi({ settimane: 0 })).toBe(1)
    expect(settimaneDi({ settimane: 99 })).toBe(16)
  })
})

describe('le fasi delle ripetizioni', () => {
  it('con sei settimane sono esattamente quelle di prima', () => {
    expect(range(6)).toBe('SETT. 1-2 · SETT. 3-4 · SETT. 5-6')
  })

  it('si allungano e si accorciano con la durata', () => {
    expect(range(8)).toBe('SETT. 1-3 · SETT. 4-6 · SETT. 7-8')
    expect(range(4)).toBe('SETT. 1-2 · SETT. 3 · SETT. 4')
    expect(range(9)).toBe('SETT. 1-3 · SETT. 4-6 · SETT. 7-9')
  })

  it('con due settimane le caselle sono due, con una sola una', () => {
    expect(range(2)).toBe('SETT. 1 · SETT. 2')
    expect(range(1)).toBe('SETT. 1')
  })

  it('ogni settimana cade nella sua fase', () => {
    expect([1, 2, 3, 4, 5, 6].map(s => faseDi(s, 6).campo))
      .toEqual(['reps_a', 'reps_a', 'reps_b', 'reps_b', 'reps_c', 'reps_c'])
    expect(faseDi(7, 8).campo).toBe('reps_c')
    expect(faseDi(3, 8).campo).toBe('reps_a')
  })

  it('una settimana oltre la fine resta nell\'ultima fase', () => {
    expect(faseDi(10, 6).campo).toBe('reps_c')
  })
})

const passo = (n, ogni) => fasi(n, ogni).map(f => etichettaFase(f)).join(' · ')

describe('il passo: ogni quante settimane cambiano le ripetizioni', () => {
  it('a blocchi fissi, quanti ne servono', () => {
    expect(passo(8, 1)).toBe('SETT. 1 · SETT. 2 · SETT. 3 · SETT. 4 · SETT. 5 · SETT. 6 · SETT. 7 · SETT. 8')
    expect(passo(8, 2)).toBe('SETT. 1-2 · SETT. 3-4 · SETT. 5-6 · SETT. 7-8')
    expect(passo(8, 3)).toBe('SETT. 1-3 · SETT. 4-6 · SETT. 7-8')
    expect(passo(6, 6)).toBe('SETT. 1-6')
  })

  it('con sei settimane, ogni 2 è identico a prima', () => {
    expect(passo(6, 2)).toBe(range(6))
  })

  it('senza passo restano le tre fasi automatiche', () => {
    expect(ogniDi({ settimane: 8 })).toBeNull()
    expect(passo(8, null)).toBe(range(8))
  })

  it('il passo non supera la durata', () => {
    expect(ogniDi({ settimane: 4, ogni: 9 })).toBe(4)
  })

  it('ogni settimana cade nel suo blocco', () => {
    expect(faseDi(5, 8, 2).indice).toBe(2)
    expect(faseDi(8, 8, 1).indice).toBe(7)
  })
})

describe('le ripetizioni di una fase', () => {
  it('le schede di prima leggono le tre colonne', () => {
    const ex = { reps_a: '4x10', reps_b: '4x8', reps_c: '5x5' }
    expect([0, 1, 2].map(i => repsDiFase(ex, i))).toEqual(['4x10', '4x8', '5x5'])
  })

  it('oltre la terza, vale l ultima scritta', () => {
    expect(repsDiFase({ reps_a: '4x10', reps_b: '4x8', reps_c: '5x5' }, 5)).toBe('5x5')
  })

  it('una casella vuota vale come quella prima', () => {
    const ex = { reps_fasi: ['4x10', '', '4x8', null, ''] }
    expect([0, 1, 2, 3, 4].map(i => repsDiFase(ex, i))).toEqual(['4x10', '4x10', '4x8', '4x8', '4x8'])
  })
})

describe('cambiare il passo di una scheda già scritta', () => {
  const ex = { reps_a: '4x10', reps_b: '4x8', reps_c: '5x5' }

  it('ogni settimana tiene le ripetizioni che aveva prima', () => {
    // da 1-2 · 3-4 · 5-6 a una casella per settimana
    expect(rimappaCaselle(ex, { totale: 6, ogni: null }, { totale: 6, ogni: 1 }))
      .toEqual(['4x10', '4x10', '4x8', '4x8', '5x5', '5x5'])
  })

  it('allungando la scheda, le settimane nuove continuano con le ultime ripetizioni', () => {
    expect(rimappaCaselle(ex, { totale: 6, ogni: 2 }, { totale: 8, ogni: 2 }))
      .toEqual(['4x10', '4x8', '5x5', '5x5'])
  })

  it('nel database le prime tre caselle vanno anche nelle colonne di sempre', () => {
    expect(colonneReps(['4x10', '4x8', '5x5', '5x3']))
      .toEqual({ reps_fasi: ['4x10', '4x8', '5x5', '5x3'], reps_a: '4x10', reps_b: '4x8', reps_c: '5x5' })
    // una casella sola: le colonne ripetono quella
    expect(colonneReps(['3x12'])).toMatchObject({ reps_a: '3x12', reps_b: '3x12', reps_c: '3x12' })
  })

  it('riconosce quando la divisione non cambia', () => {
    expect(stessaDivisione({ totale: 6, ogni: null }, { totale: 6, ogni: 2 })).toBe(true)
    expect(stessaDivisione({ totale: 6, ogni: 2 }, { totale: 6, ogni: 1 })).toBe(false)
  })
})
