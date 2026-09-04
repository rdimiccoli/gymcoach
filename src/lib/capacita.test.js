import { describe, it, expect, vi } from 'vitest'

// capacita.js apre il client Supabase al momento dell'import: qui interessa
// solo come legge l'esito, non come lo ottiene.
vi.mock('../supabaseClient', () => ({ supabase: {} }))

const { leggiEsito } = await import('./capacita')

describe('leggiEsito', () => {
  it('nessun errore significa che la funzione c’è', () => {
    expect(leggiEsito(null)).toBe(true)
    expect(leggiEsito(undefined)).toBe(true)
  })

  it('riconosce una tabella che non esiste', () => {
    expect(leggiEsito({ code: '42P01' })).toBe(false)   // Postgres
    expect(leggiEsito({ code: 'PGRST205' })).toBe(false) // PostgREST
  })

  it('riconosce una colonna che non esiste', () => {
    expect(leggiEsito({ code: '42703' })).toBe(false)
    expect(leggiEsito({ code: 'PGRST204' })).toBe(false)
  })

  // Il caso che conta davvero: la palestra ha il wifi che va e viene, e una
  // richiesta fallita non deve far sparire una funzione che esiste.
  it('un problema di rete non è una prova di assenza', () => {
    expect(leggiEsito({ message: 'Failed to fetch' })).toBe(true)
    expect(leggiEsito({ code: '' })).toBe(true)
    expect(leggiEsito({ code: undefined })).toBe(true)
  })

  it('un permesso negato non è una prova di assenza', () => {
    // 42501 = insufficient_privilege: la tabella c'è, la policy dice di no.
    expect(leggiEsito({ code: '42501' })).toBe(true)
  })
})
