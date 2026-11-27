import { describe, it, expect } from 'vitest'
import { bello, nomeCompleto, nomeECognome } from './nomi'

describe('i nomi scritti tutti uguali', () => {
  it('tutto maiuscolo o tutto minuscolo: maiuscola all\'inizio', () => {
    expect(bello('ROSSI')).toBe('Rossi')
    expect(bello('maria grazia')).toBe('Maria Grazia')
    expect(bello("D'AMICO")).toBe("D'Amico")
    expect(bello('DE LUCA')).toBe('De Luca')
    expect(bello('ANNA-MARIA')).toBe('Anna-Maria')
    expect(bello('NICOLÒ')).toBe('Nicolò')
  })

  it('scritto apposta misto: si rispetta', () => {
    expect(bello('McKenzie')).toBe('McKenzie')
    expect(bello('Rossi')).toBe('Rossi')
  })

  it('spazi in più e campi vuoti', () => {
    expect(bello('  ROSSI   MARIA ')).toBe('Rossi Maria')
    expect(bello(null)).toBe('')
  })

  it('cognome e nome, o nome e cognome', () => {
    expect(nomeCompleto({ name: 'MARIA', surname: 'ROSSI' })).toBe('Rossi Maria')
    expect(nomeECognome({ name: 'maria', surname: 'rossi' })).toBe('Maria Rossi')
  })
})
