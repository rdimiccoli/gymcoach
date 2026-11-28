import { describe, it, expect, vi, beforeEach } from 'vitest'

const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}
vi.mock('../supabaseClient', () => ({ supabase: {} }))

const {
  novitaPer, etichettaNovita, ordina, tipoDi, aperta, parametriRisposta,
  leggiBozza, salvaBozza, dimenticaBozza, ultimaVisita, segnaVisita,
} = await import('./segnalazioni')

beforeEach(() => memoria.clear())

const s = (id, extra = {}) => ({ id, tipo: 'idea', testo: `testo ${id}`, coach_id: 'c1', coach: 'Sandro', creata: '2026-11-20T10:00:00Z', stato: 'nuova', aggiornata: null, anche_io: [], ...extra })

describe('le novità', () => {
  const elenco = [
    s('a'), // nuova, di Sandro
    s('b', { stato: 'fatta', aggiornata: '2026-11-27T10:00:00Z', risposta: 'fatto' }),       // di Sandro, risposta dopo la visita
    s('c', { stato: 'letta', aggiornata: '2026-11-25T10:00:00Z' }),                          // di Sandro, prima della visita
    s('d', { coach_id: 'c2', stato: 'in_corso', aggiornata: '2026-11-27T11:00:00Z' }),       // di Manu
    s('e', { coach_id: 'c2' }),                                                             // nuova, di Manu
  ]
  const visita = new Date('2026-11-26T00:00:00Z').getTime()

  it('a un coach: solo le sue, cambiate dopo la sua ultima visita', () => {
    expect(novitaPer(elenco, { coachId: 'c1', visita }).map(x => x.id)).toEqual(['b'])
    expect(novitaPer(elenco, { coachId: 'c2', visita }).map(x => x.id)).toEqual(['d'])
  })

  it('le parole giuste', () => {
    expect(etichettaNovita(0)).toBe('')
    expect(etichettaNovita(1)).toBe('1 novità')
    expect(etichettaNovita(3)).toBe('3 novità')
  })
})

describe('l\'ordine', () => {
  it('aperte prima, dalla più recente; chiuse dopo, dalla chiusa da meno', () => {
    const { aperte, chiuse } = ordina([
      s('vecchia', { creata: '2026-11-01T10:00:00Z' }),
      s('chiusa-prima', { stato: 'fatta', aggiornata: '2026-11-10T10:00:00Z' }),
      s('recente', { creata: '2026-11-25T10:00:00Z', stato: 'in_corso' }),
      s('chiusa-dopo', { stato: 'no', aggiornata: '2026-11-20T10:00:00Z' }),
    ])
    expect(aperte.map(x => x.id)).toEqual(['recente', 'vecchia'])
    expect(chiuse.map(x => x.id)).toEqual(['chiusa-dopo', 'chiusa-prima'])
    expect(aperta({ stato: 'letta' })).toBe(true)
    expect(aperta({ stato: 'fatta' })).toBe(false)
  })

  it('un tipo sconosciuto diventa «qualcosa non va»', () => {
    expect(tipoDi('boh').id).toBe('problema')
    expect(tipoDi('idea').icona).toBe('💡')
  })
})

describe('il pulsante RISPONDI dell\'email', () => {
  const id = '6f1c2b0e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
  const codice = 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d'

  it('legge segnalazione e codice dall\'indirizzo', () => {
    expect(parametriRisposta(`?rispondi=${id}&chiave=${codice}`)).toEqual({ id, codice })
  })

  it('un indirizzo incompleto o strano non apre niente', () => {
    expect(parametriRisposta('')).toBeNull()
    expect(parametriRisposta(`?rispondi=${id}`)).toBeNull()
    expect(parametriRisposta(`?rispondi=${id}&chiave=abc`)).toBeNull()
    expect(parametriRisposta('?type=recovery')).toBeNull()
  })
})

describe('quello che resta sul telefono', () => {
  it('la bozza non si perde, e si butta dopo l\'invio', () => {
    expect(leggiBozza()).toBeNull()
    salvaBozza({ tipo: 'idea', testo: 'vorrei' })
    expect(leggiBozza()).toEqual({ tipo: 'idea', testo: 'vorrei' })
    salvaBozza({ tipo: 'strano', testo: 'x' })
    expect(leggiBozza().tipo).toBeNull()
    dimenticaBozza()
    expect(leggiBozza()).toBeNull()
    salvaBozza({ tipo: null, testo: '   ' })
    expect(leggiBozza()).toBeNull()
  })

  it('l\'ultima visita', () => {
    expect(ultimaVisita()).toBe(0)
    segnaVisita(1234)
    expect(ultimaVisita()).toBe(1234)
  })
})
