import { describe, it, expect, vi, beforeEach } from 'vitest'

// Un telefono finto: la memoria del browser e il database.
const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}

const spedizioni = []
let risposta = () => Promise.resolve({ error: null })
vi.mock('../supabaseClient', () => ({
  supabase: { from: () => ({ upsert: righe => { spedizioni.push(righe); return risposta(righe) } }) },
}))
const avvisi = []
vi.mock('./notify', () => ({ notifyError: t => avvisi.push(t) }))

const { sincronizza, inAttesa } = await import('./coda')

const CHIAVE = 'gymcoach.coda.carichi'
const voce = (cella, kg, ts = Date.now()) => ({
  k: `p_${cella}_1`, ts, client_id: 'p', cycle_exercise_id: cella, kg, week: 1,
})
const metti = voci => localStorage.setItem(CHIAVE, JSON.stringify(voci))
const leggi = () => JSON.parse(localStorage.getItem(CHIAVE) || '[]')

beforeEach(() => {
  memoria.clear(); spedizioni.length = 0; avvisi.length = 0
  risposta = () => Promise.resolve({ error: null })
})

describe('la coda dei pesi senza rete', () => {
  it('un peso segnato mentre la coda parte non si perde', async () => {
    metti([voce('squat', 50)])
    let lascia
    risposta = () => new Promise(ok => { lascia = () => ok({ error: null }) })
    const giro = sincronizza()
    await Promise.resolve()
    // la coach segna la panca proprio adesso
    metti([...leggi(), voce('panca', 30)])
    lascia()
    expect(await giro).toBe(1)
    expect(leggi().map(v => v.cycle_exercise_id)).toEqual(['panca'])
  })

  it('un peso ripesato durante la spedizione resta, con il valore nuovo', async () => {
    const vecchio = voce('squat', 50, Date.now() - 60_000)
    metti([vecchio])
    let lascia
    risposta = () => new Promise(ok => { lascia = () => ok({ error: null }) })
    const giro = sincronizza()
    await Promise.resolve()
    metti([{ ...vecchio, kg: 52.5, ts: Date.now() }])
    lascia()
    await giro
    expect(leggi().map(v => v.kg)).toEqual([52.5])
  })

  it('se il server ne rifiuta uno, scarta solo quello', async () => {
    metti([voce('squat', 50), voce('cancellato', 40), voce('panca', 30)])
    risposta = righe => Promise.resolve({
      error: righe.some(r => r.cycle_exercise_id === 'cancellato') ? { code: '23503', message: 'foreign key' } : null,
    })
    expect(await sincronizza()).toBe(0)
    // uno per uno: tre spedizioni dopo quella di gruppo
    expect(spedizioni.length).toBe(4)
    expect(avvisi[0]).toMatch(/^1 peso in attesa non è stato accettato/)
  })

  it('senza rete i pesi restano tutti', async () => {
    metti([voce('squat', 50), voce('panca', 30)])
    risposta = () => Promise.resolve({ error: { message: 'Failed to fetch' } })
    expect(await sincronizza()).toBe(2)
    expect(inAttesa()).toBe(2)
  })

  it('due giri insieme diventano uno', async () => {
    metti([voce('squat', 50)])
    await Promise.all([sincronizza(), sincronizza(), sincronizza()])
    expect(spedizioni.length).toBe(1)
  })

  it('un peso fermo da più di due settimane non parte, ma lo si dice', async () => {
    metti([voce('squat', 50, Date.now() - 15 * 24 * 3600 * 1000), voce('panca', 30)])
    await sincronizza()
    expect(spedizioni[0].map(r => r.cycle_exercise_id)).toEqual(['panca'])
    expect(avvisi[0]).toMatch(/^1 peso fermo/)
  })
})
