import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRASI_DI_SERIE, FRASE_SEMPLICE, componiFrase, scegliFrase, fraseValida, LUNGHEZZA_MASSIMA } from './frasiRecord'

const marco = { nome: 'Marco', kg: 52.5, esercizio: 'Squat' }

describe('le frasi del record', () => {
  it('sostituisce nome, chili ed esercizio', () => {
    expect(componiFrase('{kg} di {esercizio}: bravo {nome}!', marco)).toBe('52,5 kg di Squat: bravo Marco!')
  })

  it('accetta maiuscole e spazi, come scrive chi usa il telefono', () => {
    expect(componiFrase('Grande { Nome }, {KG}!', marco)).toBe('Grande Marco, 52,5 kg!')
  })

  it('una parola fra graffe che non conosce la lascia com è', () => {
    expect(componiFrase('Ciao {cognome}', marco)).toBe('Ciao {cognome}')
  })

  it('a caso, ma mai due volte di fila la stessa', () => {
    const elenco = ['a', 'b']
    for (let i = 0; i < 20; i++) expect(scegliFrase(elenco, 'a', Math.random)).toBe('b')
  })

  it('senza frasi la festa c è lo stesso', () => {
    expect(scegliFrase([])).toBe(FRASE_SEMPLICE)
    expect(scegliFrase(['   '])).toBe(FRASE_SEMPLICE)
  })

  it('né vuote né troppo lunghe', () => {
    expect(fraseValida('  ')).toBe(false)
    expect(fraseValida('x'.repeat(LUNGHEZZA_MASSIMA + 1))).toBe(false)
    expect(fraseValida('Grande {nome}!')).toBe(true)
  })

  it('le frasi di serie sono valide e stanno tutte nello script SQL', () => {
    const sql = readFileSync(new URL('../../supabase/migrazione-frasi-record.sql', import.meta.url), 'utf8')
    for (const f of FRASI_DI_SERIE) {
      expect(fraseValida(f)).toBe(true)
      expect(sql).toContain(`'${f.replace(/'/g, "''")}'`)
    }
  })
})
