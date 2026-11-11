import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRASI_DI_SERIE, FRASE_SEMPLICE, componiFrase, scegliFrase, fraseValida, variante, LUNGHEZZA_MASSIMA } from './frasiRecord'

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
    const elenco = [{ titolo: 'BOOM!', testo: 'a' }, { testo: 'b' }]
    const prima = scegliFrase(elenco, null, () => 0)
    for (let i = 0; i < 20; i++) expect(scegliFrase(elenco, prima, Math.random).testo).toBe('b')
  })

  it('senza frasi la festa c è lo stesso', () => {
    expect(scegliFrase([]).testo).toBe(FRASE_SEMPLICE)
    expect(scegliFrase(['   ', { emoji: '🔥' }]).testo).toBe(FRASE_SEMPLICE)
  })

  it('ogni riga può avere emoji, titolo e testo; i vuoti restano vuoti', () => {
    expect(variante({ emoji: ' 🚀 ', titolo: 'DECOLLO!', testo: '' })).toEqual({ emoji: '🚀', titolo: 'DECOLLO!', testo: null })
    expect(variante('Solo testo')).toEqual({ emoji: null, titolo: null, testo: 'Solo testo' })
  })

  it('solo il titolo va bene; né titolo né testo no', () => {
    expect(variante({ titolo: 'MOSTRO {nome}!' })).toMatchObject({ titolo: 'MOSTRO {nome}!', testo: null })
    expect(variante({ emoji: '🏆', titolo: '  ', testo: null })).toBeNull()
  })

  it('i segnaposto valgono anche nel titolo', () => {
    expect(componiFrase('Grande {NOME}!', marco)).toBe('Grande Marco!')
  })

  it('una frase tutta in maiuscolo mette in maiuscolo anche nome, chili ed esercizio', () => {
    expect(componiFrase('APPLAUSI PER {NOME}!', marco)).toBe('APPLAUSI PER MARCO!')
    expect(componiFrase('{KG} DI {ESERCIZIO}: CHIAMATE I GIORNALI!', marco)).toBe('52,5 KG DI SQUAT: CHIAMATE I GIORNALI!')
    expect(componiFrase('IL BILANCIERE HA CHIESTO PIETÀ. {NOME} NO.', marco)).toBe('IL BILANCIERE HA CHIESTO PIETÀ. MARCO NO.')
    // una frase normale resta normale, e una fatta solo di segnaposto pure
    expect(componiFrase('Applausi per {nome}!', marco)).toBe('Applausi per Marco!')
    expect(componiFrase('{nome} + {esercizio}', marco)).toBe('Marco + Squat')
  })

  it('né vuote né troppo lunghe', () => {
    expect(fraseValida('  ')).toBe(false)
    expect(fraseValida('x'.repeat(LUNGHEZZA_MASSIMA + 1))).toBe(false)
    expect(fraseValida('Grande {nome}!')).toBe(true)
  })

  it('le frasi di serie sono valide e stanno tutte nello script SQL', () => {
    const sql = readFileSync(new URL('../../supabase/migrazione-frasi-record.sql', import.meta.url), 'utf8')
    expect(sql).toContain('emoji text')
    expect(sql).toContain('titolo text')
    for (const f of FRASI_DI_SERIE) {
      expect(fraseValida(f)).toBe(true)
      expect(sql).toContain(`'${f.replace(/'/g, "''")}'`)
    }
  })
})
