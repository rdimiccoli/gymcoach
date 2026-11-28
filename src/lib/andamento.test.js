import { describe, it, expect } from 'vitest'
import { lunediDi, settimanePrima, etichettaSettimana, ultimeSettimane, perCoach, contaPerCoach, numero } from './andamento'

describe('le settimane', () => {
  it('il lunedì della settimana, anche di domenica', () => {
    expect(lunediDi(new Date(2026, 10, 28))).toBe('2026-11-23') // sabato
    expect(lunediDi(new Date(2026, 10, 29))).toBe('2026-11-23') // domenica
    expect(lunediDi(new Date(2026, 10, 23))).toBe('2026-11-23') // lunedì
    expect(lunediDi(new Date(2026, 10, 30))).toBe('2026-11-30')
  })

  it('indietro di qualche settimana, anche cambiando mese', () => {
    expect(settimanePrima('2026-11-23', 1)).toBe('2026-11-16')
    expect(settimanePrima('2026-11-23', 9)).toBe('2026-09-21')
    expect(etichettaSettimana('2026-09-21')).toBe('21/09')
  })

  it('dieci settimane in fila, quelle vuote a zero', () => {
    const righe = [
      { settimana: '2026-11-23', coach_id: null, tutti: true, persone: 190, pesi: 708 },
      { settimana: '2026-11-23', coach_id: 'c1', tutti: false, persone: 104, pesi: 374 },
      { settimana: '2026-11-09', coach_id: null, tutti: true, persone: 171, pesi: 814 },
    ]
    const s = ultimeSettimane(righe, new Date(2026, 10, 28), 10)
    expect(s).toHaveLength(10)
    expect(s[0].settimana).toBe('2026-09-21')
    expect(s[9]).toEqual({ settimana: '2026-11-23', persone: 190, pesi: 708 })
    expect(s[8]).toEqual({ settimana: '2026-11-16', persone: 0, pesi: 0 })
    expect(s[7].persone).toBe(171)
  })
})

describe('coach per coach', () => {
  const coaches = [{ id: 'c1', name: 'Sandro' }, { id: 'c2', name: 'Manu' }, { id: 'c3', name: 'Ilaria' }]
  const righe = [
    { settimana: '2026-11-23', coach_id: 'c1', tutti: false, persone: 40, pesi: 200 },
    { settimana: '2026-11-23', coach_id: 'c2', tutti: false, persone: 104, pesi: 374 },
    { settimana: '2026-11-16', coach_id: 'c3', tutti: false, persone: 9, pesi: 9 },
    { settimana: '2026-11-23', coach_id: null, tutti: true, persone: 140, pesi: 574 },
  ]

  it('dal più frequentato, con chi è a zero in fondo', () => {
    const elenco = perCoach(righe, '2026-11-23', coaches, { c1: 150, c2: 120 })
    expect(elenco.map(r => r.coach.name)).toEqual(['Manu', 'Sandro', 'Ilaria'])
    expect(elenco[0]).toMatchObject({ persone: 104, pesi: 374, attive: 120 })
    expect(elenco[2]).toMatchObject({ persone: 0, pesi: 0, attive: 0 })
  })

  it('le persone attive contate per coach del turno', () => {
    const turni = [{ id: 't1', coach_id: 'c1' }, { id: 't2', coach_id: 'c2' }]
    const persone = [{ turn_id: 't1' }, { turn_id: 't1' }, { turn_id: 't2' }, { turn_id: 'senza' }]
    expect(contaPerCoach(persone, turni)).toEqual({ c1: 2, c2: 1 })
  })

  it('i numeri grandi col punto, dalle decine di migliaia (regola italiana)', () => {
    expect(numero(1055)).toBe('1055')
    expect(numero(12055)).toBe('12.055')
    expect(numero(0)).toBe('0')
    expect(numero(undefined)).toBe('0')
  })
})
