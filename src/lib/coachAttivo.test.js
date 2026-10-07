import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { coachScelto, scegliCoach, dimenticaCoach, decidiCoach } from './coachAttivo'

const SANDRO = { id: 's', name: 'Sandro' }
const MANU   = { id: 'm', name: 'Manu' }
const FINTO  = { id: 'f', name: 'Sandro', nascosto: true }

describe('ricordare chi sei su questo telefono', () => {
  beforeEach(() => {
    const magazzino = {}
    vi.stubGlobal('localStorage', {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v) },
      removeItem: k => { delete magazzino[k] },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('senza scelta non si ricorda niente', () => {
    expect(coachScelto('acc')).toBe(null)
  })

  it('la scelta si ricorda', () => {
    scegliCoach('acc', 's')
    expect(coachScelto('acc')).toBe('s')
  })

  it('ogni account ha la sua scelta', () => {
    scegliCoach('acc1', 's')
    scegliCoach('acc2', 'm')
    expect(coachScelto('acc1')).toBe('s')
    expect(coachScelto('acc2')).toBe('m')
  })

  it('si può dimenticare', () => {
    scegliCoach('acc', 's')
    dimenticaCoach('acc')
    expect(coachScelto('acc')).toBe(null)
  })

  it('senza account non salva e non legge', () => {
    scegliCoach(null, 's')
    expect(coachScelto(null)).toBe(null)
  })
})

describe('decidere quale profilo usare', () => {
  it('nessun profilo: non c\'è niente da scegliere', () => {
    expect(decidiCoach([], null)).toEqual({ coach: null, deveScegliere: false })
  })

  it('un profilo solo si prende senza chiedere', () => {
    expect(decidiCoach([SANDRO], null)).toEqual({ coach: SANDRO, deveScegliere: false })
  })

  it('più profili e nessuno scelto: si chiede', () => {
    expect(decidiCoach([SANDRO, MANU], null)).toEqual({ coach: null, deveScegliere: true })
  })

  it('più profili ma uno già scelto: si usa quello', () => {
    expect(decidiCoach([SANDRO, MANU], 'm')).toEqual({ coach: MANU, deveScegliere: false })
  })

  it('il profilo scelto non esiste più: si richiede', () => {
    expect(decidiCoach([SANDRO, MANU], 'sparito')).toEqual({ coach: null, deveScegliere: true })
  })

  it('i profili nascosti non si contano e non si scelgono', () => {
    // Col profilo dimostrativo nascosto resta un solo profilo vero: niente
    // domanda, e soprattutto nessun secondo «Sandro» da sbagliare.
    expect(decidiCoach([SANDRO, FINTO], null)).toEqual({ coach: SANDRO, deveScegliere: false })
    expect(decidiCoach([SANDRO, FINTO], 'f')).toEqual({ coach: SANDRO, deveScegliere: false })
  })

  it('senza la colonna «nascosto» tutti i profili valgono', () => {
    // Prima della migrazione la colonna non esiste e arriva undefined: i
    // profili devono restare tutti visibili, non sparire.
    const senzaColonna = [{ id: 's', name: 'Sandro' }, { id: 'm', name: 'Manu' }]
    expect(decidiCoach(senzaColonna, 'm').coach.id).toBe('m')
    expect(decidiCoach(senzaColonna, null).deveScegliere).toBe(true)
  })
})
