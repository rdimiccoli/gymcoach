import { describe, it, expect, vi, beforeEach } from 'vitest'

const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
}
vi.mock('../supabaseClient', () => ({ supabase: {} }))

const {
  novitaPer, etichettaNovita, ordina, testoSegnalazioni, tipoDi, aperta,
  sonoGestore, impostaGestore, leggiBozza, salvaBozza, dimenticaBozza, ultimaVisita, segnaVisita,
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
    expect(novitaPer(elenco, { coachId: 'c1', gestore: false, visita }).map(x => x.id)).toEqual(['b'])
    expect(novitaPer(elenco, { coachId: 'c2', gestore: false, visita }).map(x => x.id)).toEqual(['d'])
  })

  it('al gestore: tutte quelle ancora nuove', () => {
    expect(novitaPer(elenco, { coachId: 'c1', gestore: true, visita }).map(x => x.id)).toEqual(['a', 'e'])
  })

  it('le parole giuste, al singolare e al plurale', () => {
    expect(etichettaNovita(0, false)).toBe('')
    expect(etichettaNovita(1, false)).toBe('1 risposta')
    expect(etichettaNovita(2, false)).toBe('2 risposte')
    expect(etichettaNovita(1, true)).toBe('1 nuova')
    expect(etichettaNovita(3, true)).toBe('3 nuove')
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

describe('il testo da copiare', () => {
  it('solo le aperte, con chi ha detto anche io e la risposta', () => {
    const testo = testoSegnalazioni([
      s('a', { tipo: 'problema', testo: 'Il + non salva\nnel turno delle 18', anche_io: ['c2'], stato: 'in_corso', risposta: 'Ci guardo' }),
      s('b', { stato: 'fatta' }),
    ], { c2: 'Manu' })
    expect(testo).toContain('GymCoach · segnalazioni aperte (1)')
    expect(testo).toContain('🐞 QUALCOSA NON VA · Sandro · 20/11 · In lavorazione')
    expect(testo).toContain('Il + non salva / nel turno delle 18')
    expect(testo).toContain('✋ anche: Manu')
    expect(testo).toContain('↳ Ci guardo')
    expect(testo).not.toContain('testo b')
    expect(testoSegnalazioni([s('x', { stato: 'no' })])).toBe('')
  })
})

describe('quello che resta sul telefono', () => {
  it('il telefono del gestore', () => {
    expect(sonoGestore()).toBe(false)
    impostaGestore(true)
    expect(sonoGestore()).toBe(true)
    impostaGestore(false)
    expect(sonoGestore()).toBe(false)
  })

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
