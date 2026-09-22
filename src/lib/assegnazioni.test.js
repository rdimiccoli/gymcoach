import { describe, it, expect } from 'vitest'
import {
  mappaAssegnazioni, personeDellaScheda, schedeSeguite, senzaScheda, raggruppaOspiti,
} from './assegnazioni'
import { oggiLocale } from './schede'

// Turno delle 09:00 con quattro persone; turno delle 18:30 con due.
const mat = 't-mat', ser = 't-ser'
const anna  = { id: 'anna',  turn_id: mat, name: 'Anna' }
const bea   = { id: 'bea',   turn_id: mat, name: 'Bea' }
const carla = { id: 'carla', turn_id: mat, name: 'Carla' }
const dario = { id: 'dario', turn_id: mat, name: 'Dario' }
const elio  = { id: 'elio',  turn_id: ser, name: 'Elio' }
const turnoMat = [anna, bea, carla, dario]

const forza   = { id: 's-forza',   turn_id: mat }
const metab   = { id: 's-metab',   turn_id: mat }
const seraOk  = { id: 's-sera',    turn_id: ser }

describe('mappaAssegnazioni', () => {
  it('raccoglie le righe per scheda', () => {
    const m = mappaAssegnazioni([
      { cycle_id: 's-forza', client_id: 'anna' },
      { cycle_id: 's-forza', client_id: 'bea' },
      { cycle_id: 's-metab', client_id: 'carla' },
    ])
    expect([...m['s-forza']]).toEqual(['anna', 'bea'])
    expect([...m['s-metab']]).toEqual(['carla'])
  })

  it('senza righe non inventa niente', () => {
    expect(mappaAssegnazioni()).toEqual({})
    expect(mappaAssegnazioni([])).toEqual({})
  })
})

describe('personeDellaScheda', () => {
  // La regola su cui si regge tutto: le schede che esistevano prima non
  // hanno assegnazioni, e devono continuare a mostrare tutto il turno.
  it('senza assegnazioni la scheda vale per tutto il turno', () => {
    expect(personeDellaScheda(forza, turnoMat, {})).toEqual(turnoMat)
  })

  it('con assegnazioni mostra solo le persone scelte', () => {
    const a = mappaAssegnazioni([
      { cycle_id: 's-forza', client_id: 'anna' },
      { cycle_id: 's-forza', client_id: 'carla' },
    ])
    expect(personeDellaScheda(forza, turnoMat, a)).toEqual([anna, carla])
  })

  it('un insieme vuoto conta come «nessuna assegnazione»', () => {
    // Togliere l'ultima spunta non deve far sparire tutti.
    expect(personeDellaScheda(forza, turnoMat, { 's-forza': new Set() })).toEqual(turnoMat)
  })

  it('senza scheda restituisce tutti', () => {
    expect(personeDellaScheda(null, turnoMat, {})).toEqual(turnoMat)
  })
})

describe('schedeSeguite', () => {
  it('solo le schede del proprio turno', () => {
    expect(schedeSeguite(elio, [forza, metab, seraOk], {})).toEqual([seraOk])
  })

  it('le schede per tutti più quelle assegnate a quella persona', () => {
    const a = mappaAssegnazioni([{ cycle_id: 's-metab', client_id: 'anna' }])
    expect(schedeSeguite(anna, [forza, metab], a)).toEqual([forza, metab])
    expect(schedeSeguite(bea, [forza, metab], a)).toEqual([forza])
  })
})

describe('senzaScheda', () => {
  it('nessuno, finché almeno una scheda vale per tutti', () => {
    const a = mappaAssegnazioni([{ cycle_id: 's-forza', client_id: 'anna' }])
    expect(senzaScheda(turnoMat, [forza, metab], a)).toEqual([])
  })

  // Il caso per cui la funzione esiste.
  it('trova chi resta fuori quando tutte le schede sono assegnate', () => {
    const a = mappaAssegnazioni([
      { cycle_id: 's-forza', client_id: 'anna' },
      { cycle_id: 's-metab', client_id: 'bea' },
    ])
    expect(senzaScheda(turnoMat, [forza, metab], a)).toEqual([carla, dario])
  })

  it('niente avviso se il turno non ha proprio schede attive', () => {
    // La card dice già «Nessuna scheda attiva»: ripeterlo sarebbe rumore.
    expect(senzaScheda(turnoMat, [], {})).toEqual([])
  })
})

describe('raggruppaOspiti', () => {
  it('due ospiti con la stessa scheda diventano una card sola', () => {
    const gruppi = raggruppaOspiti([anna, bea], [forza, seraOk], {})
    expect(gruppi).toHaveLength(1)
    expect(gruppi[0].scheda).toBe(forza)
    expect(gruppi[0].persone).toEqual([anna, bea])
  })

  it('ognuno porta la sua scheda, non quella del turno che lo ospita', () => {
    const a = mappaAssegnazioni([
      { cycle_id: 's-forza', client_id: 'anna' },
      { cycle_id: 's-metab', client_id: 'bea' },
    ])
    const gruppi = raggruppaOspiti([anna, bea], [forza, metab, seraOk], a)
    expect(gruppi.map(g => g.scheda.id)).toEqual(['s-forza', 's-metab'])
    expect(gruppi.every(g => g.scheda.turn_id === mat)).toBe(true)
  })

  it('chi non ha schede attive non sparisce', () => {
    const gruppi = raggruppaOspiti([elio], [forza], {})
    expect(gruppi).toEqual([{ scheda: null, persone: [elio] }])
  })
})

describe('oggiLocale', () => {
  it('scrive la data nel formato che vuole il database', () => {
    expect(oggiLocale(new Date(2026, 8, 4))).toBe('2026-09-04')
    expect(oggiLocale(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  // Il motivo per cui esiste: alle 00:30 in Italia è ancora ieri in UTC.
  it('usa il giorno del telefono anche subito dopo mezzanotte', () => {
    expect(oggiLocale(new Date(2026, 8, 22, 0, 30))).toBe('2026-09-22')
  })
})
