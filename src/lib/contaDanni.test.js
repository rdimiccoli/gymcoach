import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un finto database: per ogni tabella, quante righe «vede» un conteggio e
// quali id tornano da una select. `guasto` fa fallire tutto.
let righe = {}
let conteggi = {}
let guasto = false

function query(tabella) {
  const q = {
    head: false,
    select: (_, o) => { q.head = Boolean(o?.head); return q },
    eq: () => q, in: () => q, not: () => q,
    then(ok) {
      if (guasto) return Promise.resolve(ok({ data: null, count: null, error: { message: 'rete' } }))
      if (q.head) return Promise.resolve(ok({ data: null, count: conteggi[tabella] ?? 0, error: null }))
      return Promise.resolve(ok({ data: righe[tabella] ?? [], error: null }))
    },
  }
  return q
}
vi.mock('../supabaseClient', () => ({ supabase: { from: t => query(t) } }))

const { perditeTurno, perditePersona, perditeScheda, quanti } = await import('./contaDanni')

beforeEach(() => { righe = {}; conteggi = {}; guasto = false; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('cosa si perde prima di cancellare', () => {
  it('scrive i numeri in italiano, al singolare e al plurale', () => {
    expect(quanti(1, 'carico registrato', 'carichi registrati')).toBe('1 carico registrato')
    expect(quanti(214, 'carico registrato', 'carichi registrati')).toBe('214 carichi registrati')
  })

  it('un turno: persone, schede e carichi', async () => {
    righe = { clients: [{ id: 'a' }, { id: 'b' }], cycles: [{ id: 's' }] }
    conteggi = { client_loads: 37 }
    expect(await perditeTurno('t')).toEqual(['2 persone', '1 scheda', '37 carichi registrati'])
  })

  it('le voci a zero non si scrivono', async () => {
    conteggi = { client_loads: 5, client_notes: 0 }
    expect(await perditePersona('p')).toEqual(['5 carichi registrati'])
  })

  it('una scheda vuota non perde niente', async () => {
    expect(await perditeScheda('s')).toEqual([])
  })

  it('se il conto non riesce torna null, e il banner usa la frase generica', async () => {
    guasto = true
    expect(await perditeTurno('t')).toBeNull()
  })
})
