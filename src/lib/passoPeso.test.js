import { describe, it, expect } from 'vitest'
import { passoDaiPesi, passiDalloStorico, scriviPasso } from './passoPeso'

describe('il passo del +', () => {
  it('dischi e bilancieri: 2,5', () => {
    expect(passoDaiPesi([40, 42.5, 45, 47.5, 50, 52.5])).toBe(2.5)
  })

  it('manubri: 2', () => {
    expect(passoDaiPesi([8, 10, 12, 14, 16])).toBe(2)
  })

  it('pesi tondi, multipli di tutti e due: vince 2,5', () => {
    expect(passoDaiPesi([10, 20, 30, 40, 50])).toBe(2.5)
  })

  it('pesi sparsi: resta 1, come prima', () => {
    expect(passoDaiPesi([7, 9, 11, 13, 15])).toBe(1)
  })

  it('pochi pesi o tutti a zero: resta 1', () => {
    expect(passoDaiPesi([40, 42.5])).toBe(1)
    expect(passoDaiPesi([0, 0, 0, 0, 0, 0])).toBe(1)
    expect(passoDaiPesi(null)).toBe(1)
  })

  it('qualche eccezione non cambia il passo', () => {
    // 8 su 10 multipli di 2,5
    expect(passoDaiPesi([40, 42.5, 45, 47.5, 50, 52.5, 55, 57.5, 41, 43])).toBe(2.5)
  })

  it('un passo per esercizio, dallo storico', () => {
    const r = (exercise_id, kg) => ({ kg, cycle_exercises: { exercise_id } })
    expect(passiDalloStorico([
      ...[40, 45, 50, 52.5, 55].map(kg => r('squat', kg)),
      ...[6, 8, 10, 12, 14].map(kg => r('curl', kg)),
    ])).toEqual({ squat: 2.5, curl: 2 })
  })

  it('si scrive con la virgola', () => {
    expect(scriviPasso(2.5)).toBe('2,5')
    expect(scriviPasso(2)).toBe('2')
  })
})
