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

  it('chi usava già l app e non ha mai visto novità vede le più recenti', () => {
    expect(titoli(novitaDaMostrare({ elenco }))).toEqual(['C', 'B', 'A'])
  })

  it('al massimo otto schermate, tenendo le più nuove', () => {
    const tante = Array.from({ length: 12 }, (_, i) => ({ id: `2026-01-${String(30 - i).padStart(2, '0')}`, schede: [{ titolo: `N${i}` }] }))
    const viste = titoli(novitaDaMostrare({ elenco: tante }))
    expect(viste).toHaveLength(8)
    expect(viste[0]).toBe('N0')
  })

  it('un secondo rilascio nello stesso giorno arriva anche a chi ha visto il primo', () => {
    const due = [{ id: '2026-12-01-2', schede: [{ titolo: 'E' }] }, ...elenco]
    expect(titoli(novitaDaMostrare({ ultimaVista: '2026-12-01', elenco: due }))).toEqual(['E'])
  })

  it('chi ha saltato più aggiornamenti li vede tutti, dal più recente', () => {
    expect(titoli(novitaDaMostrare({ ultimaVista: '2026-10-01', elenco }))).toEqual(['C', 'B'])
  })

  it('chi è aggiornato non vede niente', () => {
    expect(novitaDaMostrare({ ultimaVista: '2026-12-01', elenco })).toEqual([])
  })

  it('una novità che il database non sa ancora fare non si annuncia', () => {
    expect(titoli(novitaDaMostrare({ elenco }))).not.toContain('D')
    expect(titoli(novitaDaMostrare({ ultimaVista: '2026-11-11', elenco, capacita: { nuovaColonna: true } }))).toEqual(['C', 'D'])
  })

  it('dalle impostazioni si rivede l ultimo aggiornamento, anche se uscito in due volte', () => {
    expect(titoli(ultimeNovita({}, elenco))).toEqual(['C'])
    const due = [{ id: '2026-12-01-2', schede: [{ titolo: 'E' }] }, ...elenco]
    expect(titoli(ultimeNovita({}, due))).toEqual(['E', 'C'])
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
