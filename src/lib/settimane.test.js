import { describe, it, expect } from 'vitest'
import { settimaneDi, fasi, faseDi, etichettaFase } from './settimane'

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
