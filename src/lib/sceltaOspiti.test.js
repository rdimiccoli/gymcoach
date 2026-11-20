import { describe, it, expect } from 'vitest'
import { semplifica, corrisponde, gruppiOspiti } from './sceltaOspiti'

const maria = { id: 'm', name: 'Maria', surname: 'Rossi', silver: true }
const nicolo = { id: 'n', name: 'Nicolò', surname: "D'Amico", silver: false }
const greta = { id: 'g', name: 'Greta', surname: 'Bianchi', silver: false }
const luca = { id: 'l', name: 'Luca', surname: 'Verdi', silver: true }

describe('scegliere un ospite', () => {
  it('la ricerca non guarda accenti, maiuscole e spazi', () => {
    expect(semplifica('  NICOLÒ   d’Amico ')).toBe('nicolo d’amico')
  })

  it('trova per nome, cognome o pezzi di tutti e due, in qualsiasi ordine', () => {
    expect(corrisponde(maria, 'rossi')).toBe(true)
    expect(corrisponde(maria, 'ROSS mar')).toBe(true)
    expect(corrisponde(maria, 'maria bianchi')).toBe(false)
    expect(corrisponde(nicolo, 'nicolo')).toBe(true)
    expect(corrisponde(nicolo, 'amico')).toBe(true)
  })

  it('senza ricerca: chi era già qui, poi i Silver, poi tutti gli altri', () => {
    const gruppi = gruppiOspiti([maria, nicolo, greta, luca], new Set(['g']))
    expect(gruppi.map(g => [g.titolo, g.persone.map(p => p.id)])).toEqual([
      ['GIÀ QUI OGGI', ['g']],
      ['SILVER', ['m', 'l']],
      ['TUTTI GLI ALTRI', ['n']],
    ])
  })

  it('con la ricerca restano solo i gruppi con qualcuno dentro', () => {
    const gruppi = gruppiOspiti([maria, nicolo, greta, luca], new Set(), 'greta')
    expect(gruppi).toEqual([{ titolo: 'TUTTI GLI ALTRI', persone: [greta] }])
  })

  it('nessuno trovato: nessun gruppo', () => {
    expect(gruppiOspiti([maria], new Set(), 'zzz')).toEqual([])
    expect(gruppiOspiti(null)).toEqual([])
  })
})
