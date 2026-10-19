import { describe, it, expect } from 'vitest'
import { numeraDaCapo, spostaDi, daSalvare, ordinate, ordinaElenco } from './ordinePersone'

const p = (id, surname, sort_order = null) => ({ id, surname, name: 'X', sort_order })

describe('ordine delle persone di un turno', () => {
  it('numera da capo partendo da 1', () => {
    const fuori = numeraDaCapo([p('a', 'Borracino'), p('b', 'Spira')])
    expect(fuori.map(x => x.sort_order)).toEqual([1, 2])
  })

  it('sposta in giù e rinumera', () => {
    const elenco = numeraDaCapo([p('a', 'Antonelli'), p('b', 'Borracino'), p('c', 'Spira')])
    const fuori = spostaDi(elenco, 0, +1)
    expect(fuori.map(x => x.id)).toEqual(['b', 'a', 'c'])
    expect(fuori.map(x => x.sort_order)).toEqual([1, 2, 3])
  })

  it('sposta in su', () => {
    const elenco = numeraDaCapo([p('a', 'Antonelli'), p('b', 'Borracino'), p('c', 'Spira')])
    expect(spostaDi(elenco, 2, -1).map(x => x.id)).toEqual(['a', 'c', 'b'])
  })

  it('il primo non va più su e l\'ultimo non va più giù', () => {
    const elenco = numeraDaCapo([p('a', 'A'), p('b', 'B')])
    expect(spostaDi(elenco, 0, -1)).toBe(elenco)
    expect(spostaDi(elenco, 1, +1)).toBe(elenco)
  })

  it('il caso del coach: Borracino e Spira finiscono vicini', () => {
    // In ordine alfabetico stanno lontani: fra loro ci sono altri tre.
    const turno = numeraDaCapo([
      p('bor', 'Borracino'), p('c', 'Cassano'), p('d', 'Dimiccoli'),
      p('f', 'Fiorella'), p('spi', 'Spira'),
    ])
    let fuori = turno
    // Spira sale fino a sotto Borracino: tre passi.
    for (let i = 0; i < 3; i++) {
      fuori = spostaDi(fuori, fuori.findIndex(x => x.id === 'spi'), -1)
    }
    expect(fuori.map(x => x.id)).toEqual(['bor', 'spi', 'c', 'd', 'f'])
  })

  it('si salvano solo le righe cambiate davvero', () => {
    const prima = numeraDaCapo([p('a', 'A'), p('b', 'B'), p('c', 'C')])
    const dopo = spostaDi(prima, 0, +1)
    // Scambiando i primi due, il terzo non si muove: non va riscritto.
    expect(daSalvare(prima, dopo).map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('il primo spostamento numera tutti, non solo i due scambiati', () => {
    // Nessuno ha ancora un numero: è il caso di ogni turno finché il coach
    // non tocca le frecce la prima volta. Salvarne solo due lascerebbe gli
    // altri senza numero, cioè in fondo all'elenco al prossimo accesso.
    const prima = [p('a', 'A'), p('b', 'B'), p('c', 'C')]
    const dopo = spostaDi(numeraDaCapo(prima), 2, -1)
    expect(daSalvare(prima, dopo)).toHaveLength(3)
  })

  it('senza spostamenti non si salva niente', () => {
    const elenco = numeraDaCapo([p('a', 'A'), p('b', 'B')])
    expect(daSalvare(elenco, elenco)).toEqual([])
  })

  it('chi non ha un numero va in fondo, in ordine alfabetico', () => {
    const fuori = ordinate([
      p('z', 'Zanetti'), p('spi', 'Spira', 2), p('a', 'Antonelli'), p('bor', 'Borracino', 1),
    ])
    expect(fuori.map(x => x.id)).toEqual(['bor', 'spi', 'a', 'z'])
  })

  it('prima della migrazione ordina solo per cognome, come ha sempre fatto', () => {
    // Una finta query che segna i criteri che riceve.
    const finta = () => {
      const chiamate = []
      const q = { chiamate, order: (c) => { chiamate.push(c); return q } }
      return q
    }
    expect(ordinaElenco(finta(), false).chiamate).toEqual(['surname', 'name'])
    expect(ordinaElenco(finta(), true).chiamate).toEqual(['sort_order', 'surname', 'name'])
  })
})
