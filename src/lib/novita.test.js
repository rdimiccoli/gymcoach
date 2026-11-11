import { describe, it, expect } from 'vitest'
import { novitaDaMostrare, ultimeNovita, NOVITA } from './novita'

const elenco = [
  { id: '2026-12-01', schede: [{ titolo: 'C' }, { titolo: 'D', serve: 'nuovaColonna' }] },
  { id: '2026-11-11', schede: [{ titolo: 'B' }] },
  { id: '2026-10-01', schede: [{ titolo: 'A' }] },
]
const titoli = s => s.map(x => x.titolo)

describe('quando mostrare le novità', () => {
  it('su un telefono nuovo no: c è già la presentazione iniziale', () => {
    expect(novitaDaMostrare({ introDaFare: true, elenco })).toEqual([])
  })

  it('chi usava già l app e non ha mai visto novità vede solo l ultimo aggiornamento', () => {
    expect(titoli(novitaDaMostrare({ elenco }))).toEqual(['C'])
  })

  it('chi ha saltato più aggiornamenti li vede tutti, dal più recente', () => {
    expect(titoli(novitaDaMostrare({ ultimaVista: '2026-10-01', elenco }))).toEqual(['C', 'B'])
  })

  it('chi è aggiornato non vede niente', () => {
    expect(novitaDaMostrare({ ultimaVista: '2026-12-01', elenco })).toEqual([])
  })

  it('una novità che il database non sa ancora fare non si annuncia', () => {
    expect(titoli(novitaDaMostrare({ elenco }))).not.toContain('D')
    expect(titoli(novitaDaMostrare({ elenco, capacita: { nuovaColonna: true } }))).toEqual(['C', 'D'])
  })

  it('dalle impostazioni si rivede l ultimo aggiornamento', () => {
    expect(titoli(ultimeNovita({}, elenco))).toEqual(['C'])
  })
})

describe('l elenco vero', () => {
  it('è in ordine, dal più recente, con id tutti diversi', () => {
    const ids = NOVITA.map(n => n.id)
    expect([...ids].sort().reverse()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ogni schermata ha icona, titolo, testo e la strada per trovarla', () => {
    for (const s of NOVITA.flatMap(n => n.schede)) {
      expect(s.icona && s.titolo && s.testo).toBeTruthy()
      expect(s.dove?.length).toBeGreaterThan(0)
    }
  })
})
