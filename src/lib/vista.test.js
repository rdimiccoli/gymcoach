import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { vistaTurni, impostaVistaTurni, PER_ATLETA, PER_ESERCIZIO } from './vista'

describe('vista dei turni', () => {
  beforeEach(() => {
    const magazzino = {}
    vi.stubGlobal('localStorage', {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Il punto di tutta la funzione: Manu non deve accorgersi di niente.
  it('senza scelta si apre per esercizio, come prima', () => {
    expect(vistaTurni('manu')).toBe(PER_ESERCIZIO)
  })

  it('la scelta resta, e vale per un coach solo', () => {
    impostaVistaTurni('sandro', PER_ATLETA)
    expect(vistaTurni('sandro')).toBe(PER_ATLETA)
    expect(vistaTurni('manu')).toBe(PER_ESERCIZIO)
  })

  it('si può tornare indietro', () => {
    impostaVistaTurni('sandro', PER_ATLETA)
    impostaVistaTurni('sandro', PER_ESERCIZIO)
    expect(vistaTurni('sandro')).toBe(PER_ESERCIZIO)
  })

  it('un valore inventato non passa', () => {
    impostaVistaTurni('sandro', 'qualsiasi cosa')
    expect(vistaTurni('sandro')).toBe(PER_ESERCIZIO)
  })

  // In modalità privata localStorage può lanciare: l'app non deve fermarsi.
  it('se il telefono non lascia salvare, non si rompe niente', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloccato') },
      setItem: () => { throw new Error('bloccato') },
    })
    expect(() => impostaVistaTurni('sandro', PER_ATLETA)).not.toThrow()
    expect(vistaTurni('sandro')).toBe(PER_ESERCIZIO)
  })
})
