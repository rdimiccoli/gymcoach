import { describe, it, expect } from 'vitest'
import { aBase64url, daBase64url } from './biometria'

// L'identificativo della credenziale WebAuthn passa da questa conversione ogni
// volta che si registra o si verifica un'impronta. Un errore di padding qui non
// si vedrebbe subito: si manifesterebbe mesi dopo, sul telefono di una coach,
// come uno sblocco che smette di funzionare senza motivo apparente.

describe('base64url', () => {
  it('non produce mai caratteri fuori dall_alfabeto url-safe', () => {
    for (let len = 1; len <= 80; len++) {
      const dati = crypto.getRandomValues(new Uint8Array(len))
      expect(aBase64url(dati.buffer)).not.toMatch(/[+/=]/)
    }
  })

  it('torna ai byte di partenza su tutte le lunghezze, resti inclusi', () => {
    // I resti modulo 4 (0, 1, 2, 3 byte in più) sono i casi dove il padding sbaglia
    for (const len of [1, 2, 3, 4, 5, 15, 16, 17, 32, 33, 64, 65, 100, 255]) {
      for (let giro = 0; giro < 25; giro++) {
        const originale = crypto.getRandomValues(new Uint8Array(len))
        const tornato = daBase64url(aBase64url(originale.buffer))
        expect(Array.from(tornato)).toEqual(Array.from(originale))
      }
    }
  })

  it('gestisce i byte estremi, non solo quelli casuali', () => {
    const estremi = new Uint8Array([0, 0, 0, 255, 255, 255, 128, 127, 1])
    expect(Array.from(daBase64url(aBase64url(estremi.buffer)))).toEqual(Array.from(estremi))
  })

  it('sul buffer vuoto non produce spazzatura', () => {
    expect(aBase64url(new Uint8Array([]).buffer)).toBe('')
    expect(daBase64url('')).toHaveLength(0)
  })
})
