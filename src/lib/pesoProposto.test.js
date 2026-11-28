import { describe, it, expect } from 'vitest'
import { pesoProposto, scriviKg } from './pesoProposto'

describe('il peso proposto', () => {
  it('un ottavo in più, arrotondato al disco', () => {
    expect(pesoProposto(40, 2.5)).toBe(45)     // 45 esatto
    expect(pesoProposto(80, 2.5)).toBe(90)
    expect(pesoProposto(30, 2.5)).toBe(35)     // 33,75 → 35
    expect(pesoProposto(22.5, 2.5)).toBe(25)   // 25,3 → 25
  })

  it('almeno un passo sopra la volta prima', () => {
    expect(pesoProposto(10, 2.5)).toBe(12.5)   // 11,25 → 12,5
    expect(pesoProposto(4, 1)).toBe(5)
    expect(pesoProposto(8, 2)).toBe(10)        // manubri: 9 → 10
  })

  it('un peso fuori passo sale al primo multiplo del passo', () => {
    expect(pesoProposto(21, 2.5)).toBe(22.5)
  })

  it('niente proposta senza un peso vero', () => {
    expect(pesoProposto(0, 2.5)).toBeNull()
    expect(pesoProposto(undefined, 2.5)).toBeNull()
    expect(pesoProposto('', 2.5)).toBeNull()
    expect(pesoProposto('abc', 2.5)).toBeNull()
  })

  it('un passo strano vale 1', () => {
    expect(pesoProposto(20, 0)).toBe(23)       // 22,5 → 23 (passo 1)
    expect(pesoProposto(20, undefined)).toBe(23)
  })

  it('i chili con la virgola', () => {
    expect(scriviKg(22.5)).toBe('22,5')
    expect(scriviKg(55)).toBe('55')
  })
})
