import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
}

// Il database finto: 2.500 pesi (tre pagine), una tabella che manca.
let tabelle
let spazio
const caricati = []
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: nome => {
      let da = 0, a = 999
      const q = {
        select: () => q, order: () => q, setHeader: () => q,
        range: (x, y) => { da = x; a = y; return q },
        then: (ok, ko) => {
          const t = tabelle[nome]
          const r = t === 'manca' ? { data: null, error: { code: 'PGRST205' } }
            : t === 'rotta' ? { data: null, error: { code: '42501', message: 'permission denied' } }
            : { data: (t || []).slice(da, a + 1), error: null }
          return Promise.resolve(r).then(ok, ko)
        },
      }
      return q
    },
    storage: {
      from: () => ({
        list: async () => spazio,
        upload: async (nome, blob) => { caricati.push({ nome, testo: await blob.text() }); return { error: null } },
      }),
    },
  },
}))

const { preparaCopia, copiaDellaSettimana, serveCopia, nomeCopia, quantoTempoFa, peso, TABELLE } = await import('./copie')

beforeEach(() => {
  memoria.clear(); caricati.length = 0
  navigator.onLine = true
  tabelle = Object.fromEntries(TABELLE.map(t => [t.nome, [{ id: `${t.nome}-1` }]]))
  tabelle.client_loads = Array.from({ length: 2500 }, (_, i) => ({ id: `l${i}`, kg: 50 }))
  spazio = { data: [], error: null }
})

describe('la copia di tutto', () => {
  it('legge tutte le pagine di ogni tabella', async () => {
    const { copia } = await preparaCopia({ coach: 'Sandro' })
    expect(copia.app).toBe('GymCoach')
    expect(copia.da).toBe('Sandro')
    expect(copia.tabelle.client_loads).toHaveLength(2500)
    expect(copia.righe.client_loads).toBe(2500)
    expect(copia.righe.coaches).toBe(1)
  })

  it('una tabella che non esiste si salta e si segna', async () => {
    tabelle.frasi_record = 'manca'
    const { copia } = await preparaCopia()
    expect(copia.mancanti).toEqual(['frasi_record'])
    expect(copia.tabelle.frasi_record).toBeUndefined()
  })

  it('una tabella che non si legge ferma tutto: mezza copia sarebbe peggio di nessuna', async () => {
    tabelle.clients = 'rotta'
    const { copia, errore } = await preparaCopia()
    expect(copia).toBeNull()
    expect(errore).toContain('clients')
  })
})

describe('la copia della settimana, da sola', () => {
  it('nessuna copia ancora: la fa e la carica', async () => {
    expect(await copiaDellaSettimana({ coach: 'Manu' })).toBe('fatta')
    expect(caricati).toHaveLength(1)
    expect(caricati[0].nome).toMatch(/^gymcoach-copia-\d{4}-\d{2}-\d{2}-\d{4}-[a-z0-9]+\.json$/)
    expect(JSON.parse(caricati[0].testo).tabelle.client_loads).toHaveLength(2500)
  })

  it('l\'ultima ha tre giorni: non serve', async () => {
    spazio = { data: [{ name: 'gymcoach-copia-x.json', created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }], error: null }
    expect(await copiaDellaSettimana()).toBe('non-serve')
    expect(caricati).toHaveLength(0)
  })

  it('l\'ultima ha otto giorni: la rifà', async () => {
    spazio = { data: [{ name: 'gymcoach-copia-x.json', created_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }], error: null }
    expect(await copiaDellaSettimana()).toBe('fatta')
  })

  it('senza lo spazio «copie» (migrazione non lanciata) non fa niente', async () => {
    spazio = { data: null, error: { statusCode: '404', message: 'Bucket not found' } }
    expect(await copiaDellaSettimana()).toBe('spazio-assente')
    expect(caricati).toHaveLength(0)
  })

  it('guarda al massimo ogni 12 ore, e questo telefono ne fa una a settimana', async () => {
    expect(await copiaDellaSettimana()).toBe('fatta')
    expect(await copiaDellaSettimana()).toBe('controllata-da-poco')
    memoria.set('gymcoach.copie-controllo', '0') // passate le 12 ore
    expect(await copiaDellaSettimana()).toBe('fatta-da-poco-qui')
    expect(caricati).toHaveLength(1)
  })

  it('senza rete non prova', async () => {
    navigator.onLine = false
    expect(await copiaDellaSettimana()).toBe('senza-rete')
  })
})

describe('le scritte', () => {
  it('nome, quanto tempo fa, peso', () => {
    expect(nomeCopia(new Date(2026, 10, 28, 8, 5))).toBe('gymcoach-copia-2026-11-28-0805.json')
    const adesso = new Date(2026, 10, 28, 9)
    expect(quantoTempoFa(new Date(2026, 10, 28, 1), adesso)).toBe('oggi')
    expect(quantoTempoFa(new Date(2026, 10, 27, 23), adesso)).toBe('ieri')
    expect(quantoTempoFa(new Date(2026, 10, 21, 10), adesso)).toBe('7 giorni fa')
    expect(peso(1_340_000)).toBe('1,3 MB')
    expect(peso(840_000)).toBe('840 kB')
    expect(serveCopia(null)).toBe(true)
  })
})
