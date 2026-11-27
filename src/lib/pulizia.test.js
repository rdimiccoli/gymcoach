import { describe, it, expect } from 'vitest'
import { chiaveNome, personeDoppie, eserciziDoppi, chiTenere } from './pulizia'

describe('mettere in ordine', () => {
  it('il nome nudo ignora spazi, barre, accenti e maiuscole', () => {
    expect(chiaveNome('Alzate a V')).toBe(chiaveNome('Alzate AV'))
    expect(chiaveNome('Fianchi KB/ al cavo')).toBe(chiaveNome('Fianchi KB / al cavo'))
    expect(chiaveNome('Addominali  romani panca')).toBe(chiaveNome('Addominali romani panca'))
    expect(chiaveNome('NICOLÒ', "D'AMICO")).toBe(chiaveNome('Nicolo', 'DAmico'))
    expect(chiaveNome('Gruppo 1')).not.toBe(chiaveNome('Gruppo 2'))
  })

  it('persone iscritte due volte', () => {
    const g = personeDoppie([
      { id: 1, name: 'Anna', surname: 'ROSSI' }, { id: 2, name: 'anna', surname: 'Rossi' },
      { id: 3, name: 'Luca', surname: 'Bianchi' },
    ])
    expect(g.map(x => x.map(p => p.id))).toEqual([[1, 2]])
  })

  it('esercizi doppi', () => {
    const g = eserciziDoppi([{ id: 'a', name: 'Alzate a V' }, { id: 'b', name: 'Alzate AV' }, { id: 'c', name: 'Squat' }])
    expect(g.map(x => x.map(e => e.id))).toEqual([['a', 'b']])
  })

  it('si tiene quello con più pesi, a parità il più vecchio', () => {
    const pesi = { a: 3, b: 40 }
    expect(chiTenere([{ id: 'a' }, { id: 'b' }], p => pesi[p.id]).id).toBe('b')
    expect(chiTenere([{ id: 'x', created_at: '2026-10-01' }, { id: 'y', created_at: '2026-09-01' }]).id).toBe('y')
  })
})
