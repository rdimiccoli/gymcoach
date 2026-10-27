import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un finto database che risponde come serve a ogni prova e si segna, in
// ordine, ogni cancellazione che gli si chiede. È l'ordine che si controlla:
// i carichi stanno appesi alle righe di `cycle_exercises`, e cancellare
// quelle prima di sapere se l'esercizio si può eliminare è il danno da
// evitare.
let risposteEsercizio = []
let registro = []

function query(tabella, op) {
  const q = {
    eq: () => q, in: () => q, not: () => q,
    select: () => q,
    then(ok) {
      registro.push(`${op} ${tabella}`)
      if (tabella === 'exercises' && op === 'delete') return Promise.resolve(ok(risposteEsercizio.shift()))
      return Promise.resolve(ok({ data: [], error: null }))
    },
  }
  return q
}

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: tabella => ({
      delete: () => query(tabella, 'delete'),
      update: () => query(tabella, 'update'),
      select: () => query(tabella, 'select'),
    }),
  },
}))
vi.mock('./notify', () => ({
  run: async q => { const r = await q; return r.error ? { data: null, error: r.error } : r },
  notifyError: vi.fn(),
}))

const { eliminaEsercizio, unisciEsercizi } = await import('./eserciziDb')

const CANCELLATO = { data: [{ id: 'x' }], error: null }
const ANCORA_USATO = { data: null, error: { code: '23503' } }
const PERMESSO_NEGATO = { data: [], error: null }

beforeEach(() => { registro = []; risposteEsercizio = [] })

describe('eliminare un esercizio', () => {
  it('se non è usato si cancella e basta, senza toccare le schede', async () => {
    risposteEsercizio = [CANCELLATO]
    expect(await eliminaEsercizio('x')).toBe(true)
    expect(registro).toEqual(['delete exercises'])
  })

  it('se è usato toglie prima le schede e poi lo cancella', async () => {
    risposteEsercizio = [ANCORA_USATO, CANCELLATO]
    expect(await eliminaEsercizio('x')).toBe(true)
    expect(registro).toEqual(['delete exercises', 'delete cycle_exercises', 'delete exercises'])
  })

  it('se manca il permesso si ferma prima di toccare un solo carico', async () => {
    risposteEsercizio = [PERMESSO_NEGATO]
    expect(await eliminaEsercizio('x')).toBe(false)
    expect(registro).not.toContain('delete cycle_exercises')
  })
})

describe('unire un doppione', () => {
  it('sposta le schede e poi cancella il doppione', async () => {
    risposteEsercizio = [CANCELLATO]
    expect(await unisciEsercizi('doppione', 'giusto')).toBe(true)
    expect(registro).toEqual(['update cycle_exercises', 'delete exercises'])
  })

  it('non cancella mai le schede, nemmeno se il doppione risulta ancora usato', async () => {
    risposteEsercizio = [ANCORA_USATO]
    expect(await unisciEsercizi('doppione', 'giusto')).toBe(false)
    expect(registro).not.toContain('delete cycle_exercises')
  })
})
