import { describe, it, expect } from 'vitest'
import { normalizza, fa, etichettaGiorni, mappaGiorni, dividiPerGiorno, cambiaGiorno } from './giorniPersona'

describe('chi fa quali giorni', () => {
  it('pulisce la scelta: in ordine, senza doppioni, dentro la scheda', () => {
    expect(normalizza([3, 1, 3], 3)).toEqual([1, 3])
    expect(normalizza([1, 5], 3)).toEqual([1])
  })

  it('tutti i giorni, o nessuno, vuol dire «nessuna scelta»', () => {
    expect(normalizza([1, 2, 3], 3)).toBeNull()
    expect(normalizza([], 3)).toBeNull()
    expect(normalizza(null, 3)).toBeNull()
  })

  it('senza scelta fa tutti i giorni', () => {
    expect(fa(null, 2)).toBe(true)
    expect(fa([1, 3], 2)).toBe(false)
    expect(fa([1, 3], 3)).toBe(true)
  })

  it('il promemoria accanto al nome', () => {
    expect(etichettaGiorni([1, 3])).toBe('G1 · G3')
    expect(etichettaGiorni(null)).toBeNull()
  })

  it('dal database tiene solo le scelte vere', () => {
    expect(mappaGiorni([
      { client_id: 'alessia', giorni: [1, 2] },
      { client_id: 'greta', giorni: [1, 2, 3] },
    ], 3)).toEqual({ alessia: [1, 2] })
  })

  it('una scheda passata da 3 a 2 giorni: la scelta si adegua', () => {
    // Greta faceva G2 e G3: con due giorni le resta il G2.
    expect(mappaGiorni([{ client_id: 'greta', giorni: [2, 3] }], 2)).toEqual({ greta: [2] })
  })

  it('prima chi fa il giorno, poi gli altri, ognuno nel suo ordine', () => {
    const giorni = { a: [1, 2], b: [2, 3], c: null, d: [1, 3] }
    const { previsti, altri } = dividiPerGiorno(['a', 'b', 'c', 'd'], 2, x => giorni[x])
    expect(previsti).toEqual(['a', 'b', 'c'])
    expect(altri).toEqual(['d'])
  })

  it('accendere e spegnere i giorni', () => {
    expect(cambiaGiorno(null, 2, 3)).toEqual([1, 3])       // da «tutti» si toglie il 2
    expect(cambiaGiorno([1, 3], 2, 3)).toBeNull()          // rimesso il 2: di nuovo tutti
    expect(cambiaGiorno([1], 1, 3)).toEqual([1])           // l'ultimo non si spegne
  })
})
