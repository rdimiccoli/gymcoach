import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un finto database: ogni scrittura risponde con la prossima risposta in
// coda (o «tutte spostate»), e si segna in ordine cosa gli si chiede.
let risposte = []
let registro = []

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: () => ({
      update: valori => ({
        in: (_, ids) => ({
          select: () => {
            registro.push(`giorno ${valori.day}: ${ids.join(',')}`)
            const r = risposte.shift()
            return Promise.resolve(r ?? { data: ids.map(id => ({ id })), error: null })
          },
        }),
      }),
    }),
  },
}))
vi.mock('./notify', () => ({ notifyError: vi.fn() }))

const { scambiaNellaMappa, vociDelGiorno, scambiaGiorniDb } = await import('./scambiaGiorni')

const NIENTE = { data: [], error: null } // rifiutato dai permessi: nessun errore, nessuna riga
const ERRORE = { data: null, error: { message: 'rete' } }

beforeEach(() => { risposte = []; registro = [] })

describe('scambiare due giorni', () => {
  it('in memoria: il giorno 1 prende quelli del 2 e viceversa, gli altri restano', () => {
    const m = { 1: ['a'], 2: ['b', 'c'], 3: ['d'] }
    expect(scambiaNellaMappa(m, 1, 2)).toEqual({ 1: ['b', 'c'], 2: ['a'], 3: ['d'] })
  })

  it('con un giorno vuoto è uno spostamento di tutto', () => {
    expect(scambiaNellaMappa({ 1: ['a'], 2: [] }, 1, 2)).toEqual({ 1: [], 2: ['a'] })
  })

  it('nel database: prima un giorno, poi l altro', async () => {
    expect(await scambiaGiorniDb(['x1', 'x2'], ['y1'], 1, 2)).toBe('fatto')
    expect(registro).toEqual(['giorno 2: x1,x2', 'giorno 1: y1'])
  })

  it('se la seconda scrittura non passa, la prima si rimette com era', async () => {
    risposte = [undefined, ERRORE]
    expect(await scambiaGiorniDb(['x1'], ['y1'], 1, 2)).toBe('annullato')
    expect(registro).toEqual(['giorno 2: x1', 'giorno 1: y1', 'giorno 1: x1', 'giorno 2: y1'])
  })

  it('un rifiuto silenzioso (zero righe) conta come fallito', async () => {
    risposte = [NIENTE]
    expect(await scambiaGiorniDb(['x1'], ['y1'], 1, 2)).toBe('annullato')
  })

  it('se non si riesce nemmeno a rimettere a posto, lo dice', async () => {
    risposte = [undefined, ERRORE, ERRORE]
    expect(await scambiaGiorniDb(['x1'], ['y1'], 1, 2)).toBe('misto')
  })
})

describe('cosa c è in un giorno', () => {
  it('superserie e circuiti restano insieme', () => {
    const es = [
      { name: 'Squat' },
      { name: 'Rematore', supersetGroup: 'SS-A' }, { name: 'Lat machine', supersetGroup: 'SS-A' },
      { name: 'Burpees', supersetGroup: 'CIR-A' }, { name: 'Swing', supersetGroup: 'CIR-A' },
    ]
    expect(vociDelGiorno(es)).toEqual(['Squat', 'Rematore + Lat machine', 'Circuito: Burpees + Swing'])
  })

  it('oltre il massimo riassume', () => {
    const es = 'abcdefgh'.split('').map(name => ({ name }))
    expect(vociDelGiorno(es, 4)).toEqual(['a', 'b', 'c', 'e altri 5'])
  })
})
