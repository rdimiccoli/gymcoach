import { describe, it, expect, vi } from 'vitest'
import { statoScheda, turnoInCorso } from './avvisiTurno'

describe('gli avvisi sulla card del turno', () => {
  it('ultima settimana, finita, oppure niente', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T10:00:00'))
    expect(statoScheda({ start_date: '2026-10-20', settimane: 6 })).toBe('ultima') // settimana 6
    expect(statoScheda({ start_date: '2026-10-09', settimane: 6 })).toBe('finita') // settimana 8
    expect(statoScheda({ start_date: '2026-11-20', settimane: 6 })).toBeNull()
    expect(statoScheda({})).toBeNull()
    vi.useRealTimers()
  })

  it('il turno dell\'ora in corso', () => {
    const alle = (h, m) => new Date(2026, 10, 27, h, m)
    expect(turnoInCorso('18:30', alle(18, 25))).toBe(true)
    expect(turnoInCorso('18:30', alle(18, 19))).toBe(false)
    expect(turnoInCorso('18:30', alle(19, 44))).toBe(true)
    expect(turnoInCorso('18:30', alle(19, 45))).toBe(false)
    expect(turnoInCorso('9.00', alle(9, 30))).toBe(true)
    expect(turnoInCorso('', alle(9, 30))).toBe(false)
  })
})
