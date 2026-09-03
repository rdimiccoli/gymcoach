import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { run, subscribe, notifyError, notifyOk } from './notify'

// `run` è il punto in cui passa ogni scrittura dell'app: se smettesse di
// segnalare gli errori si tornerebbe al bug originale, dove il coach vedeva
// il dato salvato anche quando la scrittura era fallita.

let avvisi
let annulla
let consoleSpy

beforeEach(() => {
  avvisi = []
  annulla = subscribe(m => avvisi.push(m))
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  annulla()
  consoleSpy.mockRestore()
})

describe('run', () => {
  it('restituisce i dati e non avvisa nessuno quando va bene', async () => {
    const esito = await run(Promise.resolve({ data: [{ id: 1 }], error: null }), 'non deve comparire')
    expect(esito.data).toEqual([{ id: 1 }])
    expect(esito.error).toBeNull()
    expect(avvisi).toHaveLength(0)
  })

  it('azzera i dati e avvisa quando fallisce', async () => {
    const errore = { message: 'permission denied', code: '42501' }
    const esito = await run(Promise.resolve({ data: null, error: errore }), 'Carichi NON salvati.')

    expect(esito.error).toBe(errore)
    // Chi chiama deve trovare data null anche se il server ne avesse mandati
    expect(esito.data).toBeNull()
    expect(avvisi).toHaveLength(1)
    expect(avvisi[0].type).toBe('error')
    expect(avvisi[0].text).toBe('Carichi NON salvati.')
  })

  it('scrive in console l_errore vero, che serve per capire cosa è successo', async () => {
    const errore = { message: 'boom' }
    await run(Promise.resolve({ data: null, error: errore }), 'messaggio per il coach')
    expect(consoleSpy).toHaveBeenCalledWith('messaggio per il coach', errore)
  })

  it('non restituisce dati sporchi quando il server manda sia data che error', async () => {
    const esito = await run(
      Promise.resolve({ data: [{ id: 9 }], error: { message: 'parziale' } }),
      'errore'
    )
    expect(esito.data).toBeNull()
  })
})

describe('notifiche', () => {
  it('distingue errori e conferme', () => {
    notifyError('rosso')
    notifyOk('verde')
    expect(avvisi.map(a => a.type)).toEqual(['error', 'ok'])
    expect(avvisi.map(a => a.text)).toEqual(['rosso', 'verde'])
  })

  it('dà a ogni avviso un id distinto, altrimenti React ne perde uno', () => {
    notifyError('a'); notifyError('b'); notifyError('c')
    const ids = new Set(avvisi.map(a => a.id))
    expect(ids.size).toBe(3)
  })

  it('smette di consegnare dopo la disiscrizione', () => {
    annulla()
    notifyError('nel vuoto')
    expect(avvisi).toHaveLength(0)
    annulla = subscribe(m => avvisi.push(m)) // ripristino per afterEach
  })
})
