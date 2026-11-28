import { describe, it, expect } from 'vitest'
import { copiaInSql, valoreSql } from './copia-in-sql.mjs'

describe('da copia a SQL', () => {
  it('i valori, con gli apostrofi e gli elenchi', () => {
    expect(valoreSql(null)).toBe('null')
    expect(valoreSql(true)).toBe('true')
    expect(valoreSql(22.5)).toBe('22.5')
    expect(valoreSql("D'Amico")).toBe("'D''Amico'")
    expect(valoreSql(['4x10', '4x8'])).toBe('\'{"4x10","4x8"}\'')
    expect(valoreSql([1, 3])).toBe('\'{"1","3"}\'')
  })

  it('aggiunge e basta, nell\'ordine giusto', () => {
    const sql = copiaInSql({ app: 'GymCoach', fatta: '2026-11-28', tabelle: {
      client_loads: [{ id: 'l1', client_id: 'p1', kg: 50 }],
      clients: [{ id: 'p1', name: 'Marco' }],
    } })
    expect(sql.indexOf('"clients"')).toBeLessThan(sql.indexOf('"client_loads"'))
    expect(sql).toContain('on conflict do nothing;')
    expect(sql).not.toMatch(/\b(delete|drop|update|truncate)\b/i)
  })

  it('un file che non è una copia si rifiuta', () => {
    expect(() => copiaInSql({ tabelle: {} })).toThrow('non è una copia')
  })
})
