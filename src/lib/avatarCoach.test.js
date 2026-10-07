import { describe, it, expect } from 'vitest'
import { avatarDi, EMOJI_COACH } from './avatarCoach'

describe('l\'immagine accanto al nome', () => {
  it('chi ha scelto un\'emoji vede quella', () => {
    expect(avatarDi({ name: 'Sandro', emoji: '🔥' })).toEqual({ tipo: 'emoji', valore: '🔥' })
  })

  it('chi non ha scelto niente vede la sua iniziale', () => {
    expect(avatarDi({ name: 'Sandro' })).toEqual({ tipo: 'iniziale', valore: 'S' })
    expect(avatarDi({ name: 'manu' })).toEqual({ tipo: 'iniziale', valore: 'M' })
  })

  it('prima della migrazione la colonna non esiste: si cade sull\'iniziale', () => {
    // È il caso vero del giorno in cui l'app esce e lo script non è ancora
    // stato lanciato: `emoji` arriva undefined e non deve rompere niente.
    expect(avatarDi({ name: 'Manu', emoji: undefined }).tipo).toBe('iniziale')
  })

  it('un\'emoji fatta di spazi vale come nessuna scelta', () => {
    expect(avatarDi({ name: 'Sandro', emoji: '   ' })).toEqual({ tipo: 'iniziale', valore: 'S' })
  })

  it('senza nome si ripiega sull\'email', () => {
    expect(avatarDi({ email: 'oad@palestra.it' })).toEqual({ tipo: 'iniziale', valore: 'O' })
  })

  it('senza niente non si rompe', () => {
    expect(avatarDi({})).toEqual({ tipo: 'iniziale', valore: '?' })
    expect(avatarDi(null)).toEqual({ tipo: 'iniziale', valore: '?' })
  })

  it('un nome che comincia con un carattere composto non viene tagliato a metà', () => {
    const { valore } = avatarDi({ name: '🦁 Leo' })
    expect(valore).toBe('🦁')
  })

  it('le emoji proposte sono dieci e tutte diverse', () => {
    expect(EMOJI_COACH).toHaveLength(10)
    expect(new Set(EMOJI_COACH).size).toBe(10)
  })
})
