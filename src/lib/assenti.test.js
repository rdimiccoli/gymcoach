import { describe, it, expect } from 'vitest'
import { mappaUltimi, chiManca, maiAllenati } from './assenti'

const adesso = new Date('2026-11-27T10:00:00')
const ultimi = mappaUltimi([
  { client_id: 'anna', ultimo: '2026-10-28T18:00:00Z', pesi: 40 },
  { client_id: 'paolo', ultimo: '2026-11-03T18:00:00Z', pesi: 12 },
  { client_id: 'lucia', ultimo: '2026-11-25T18:00:00Z', pesi: 30 },
])
const persone = [{ id: 'anna' }, { id: 'paolo' }, { id: 'lucia' }, { id: 'nuova' }]

describe('chi non si vede', () => {
  it('ferme da più di tre settimane, dalla più lontana', () => {
    expect(chiManca(persone, ultimi, adesso).map(p => p.id)).toEqual(['anna', 'paolo'])
  })

  it('chi non ha mai un peso non è «assente»: è un\'altra lista', () => {
    expect(chiManca(persone, ultimi, adesso).map(p => p.id)).not.toContain('nuova')
    expect(maiAllenati(persone, ultimi).map(p => p.id)).toEqual(['nuova'])
  })

  it('date sbagliate o righe vuote non rompono niente', () => {
    expect(mappaUltimi([{ client_id: 'x', ultimo: 'boh' }, null].filter(Boolean))).toEqual({})
    expect(chiManca(null, {}, adesso)).toEqual([])
  })
})
