import { describe, it, expect } from 'vitest'
import { analizzaEsercizio, riassunto } from './progressi'

const v = (...kg) => kg.map(k => ({ kg: k }))

describe('i progressi di un esercizio', () => {
  it('da dove è partito, dove è, quanto è cresciuto', () => {
    const a = analizzaEsercizio(v(30, 32.5, 35, 37.5))
    expect(a).toMatchObject({ primo: 30, ultimo: 37.5, migliore: 37.5, variazione: 7.5, percentuale: 25, stato: 'su', alMassimo: true })
  })

  it('conta i record: ogni volta che supera tutto quello che c era prima', () => {
    // 40 (inizio) → 45 record → 42 → 45 non è record (uguale) → 47.5 record
    const a = analizzaEsercizio(v(40, 45, 42, 45, 47.5))
    expect(a.record).toBe(2)
    expect(a.sonoRecord).toEqual([false, true, false, false, true])
  })

  it('il primo carico non è un record, è il punto di partenza', () => {
    expect(analizzaEsercizio(v(50)).record).toBe(0)
    expect(analizzaEsercizio(v(50)).stato).toBe('nuovo')
  })

  it('riconosce chi è fermo e chi è sceso', () => {
    expect(analizzaEsercizio(v(20, 25, 20)).stato).toBe('fermo')
    expect(analizzaEsercizio(v(20, 17.5)).stato).toBe('giu')
  })

  it('da zero non c è percentuale (corpo libero), ma il carico conta', () => {
    const a = analizzaEsercizio(v(0, 5))
    expect(a.percentuale).toBeNull()
    expect(a.stato).toBe('su')
  })
})

describe('il riassunto', () => {
  it('fa la media delle percentuali, mai dei chili', () => {
    // Pressa da 100 a 120 (+20%), panca da 20 a 30 (+50%): media +35%,
    // non «+30 kg».
    const r = riassunto([analizzaEsercizio(v(100, 120)), analizzaEsercizio(v(20, 30)), analizzaEsercizio(v(10))])
    expect(r).toMatchObject({ esercizi: 3, misurabili: 2, inCrescita: 2, crescitaMedia: 35 })
  })

  it('senza dati confrontabili non inventa una crescita', () => {
    expect(riassunto([analizzaEsercizio(v(10))]).crescitaMedia).toBeNull()
  })
})
