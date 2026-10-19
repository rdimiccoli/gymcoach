import { describe, it, expect } from 'vitest'
import { giorniDi, elencoGiorni, giornoValido, etichettaGiorno, GIORNI_PREDEFINITI } from './giorni'

describe('quanti giorni ha una scheda', () => {
  it('le schede di prima, senza la colonna, valgono tre', () => {
    // È il caso vero del giorno in cui esce l'app e la migrazione non è
    // ancora stata lanciata: `giorni` arriva undefined.
    expect(giorniDi({ name: 'Forza I' })).toBe(GIORNI_PREDEFINITI)
    expect(giorniDi({ giorni: null })).toBe(3)
    expect(giorniDi(null)).toBe(3)
  })

  it('legge il numero scelto', () => {
    expect(giorniDi({ giorni: 5 })).toBe(5)
    expect(giorniDi({ giorni: 4 })).toBe(4)
  })

  it('non si va oltre cinque, né sotto uno', () => {
    expect(giorniDi({ giorni: 9 })).toBe(5)
    expect(giorniDi({ giorni: 0 })).toBe(1)
    expect(giorniDi({ giorni: -3 })).toBe(1)
  })

  it('un numero scritto storto non rompe niente', () => {
    expect(giorniDi({ giorni: 'tre' })).toBe(3)
    expect(giorniDi({ giorni: 4.7 })).toBe(4)
  })

  it('l\'elenco delle linguette', () => {
    expect(elencoGiorni({ giorni: 5 })).toEqual([1, 2, 3, 4, 5])
    expect(elencoGiorni({})).toEqual([1, 2, 3])
  })

  it('cambiando scheda il giorno resta dentro i limiti', () => {
    // Si era sul giorno 5 di una scheda da cinque, si apre una da tre.
    expect(giornoValido(5, { giorni: 3 })).toBe(3)
    expect(giornoValido(2, { giorni: 5 })).toBe(2)
    expect(giornoValido(0, { giorni: 3 })).toBe(1)
  })

  it('oltre tre giorni l\'etichetta si accorcia, o non ci sta', () => {
    expect(etichettaGiorno(2, 3)).toBe('GIORNO 2')
    expect(etichettaGiorno(2, 5)).toBe('G2')
  })
})
