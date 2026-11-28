import { describe, it, expect, vi, beforeEach } from 'vitest'

// Il database finto: si guarda cosa arriva nella tabella.
const scritte = []
let risposta = () => ({ error: null })
vi.mock('../supabaseClient', () => ({
  supabase: { from: () => ({ insert: async riga => { scritte.push(riga); return risposta(riga) } }) },
}))

const memoria = new Map()
globalThis.window = {
  localStorage: {
    getItem: k => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
  },
  innerWidth: 1080, innerHeight: 810, matchMedia: () => ({ matches: true }), navigator: {},
}
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15', maxTouchPoints: 5 },
  configurable: true,
})

const { registraErrore, impostaContesto, dimenticaRegistro, descriviDispositivo, daIgnorare, preparaRiga, quandoCorto, erroriRecenti, MASSIMO_AL_GIORNO } = await import('./registroErrori')

beforeEach(() => {
  scritte.length = 0
  memoria.clear()
  risposta = () => ({ error: null })
  navigator.onLine = true
  dimenticaRegistro()
})

describe('che cosa si scrive', () => {
  it('una riga con schermata, coach, versione e telefono', async () => {
    impostaContesto({ pagina: 'turn', coach: 'Sandro' })
    expect(await registraErrore('avviso', 'Carichi rifiutati dal server. Riprova.', '42501 · permission denied')).toBe(true)
    expect(scritte).toHaveLength(1)
    expect(scritte[0]).toMatchObject({
      tipo: 'avviso', messaggio: 'Carichi rifiutati dal server. Riprova.', dettaglio: '42501 · permission denied',
      pagina: 'turn', coach: 'Sandro', versione: 'locale',
    })
    expect(scritte[0].dispositivo).toBe('iPad · Safari 17.2 · app · 1080×810')
  })

  it('lo stesso errore nella stessa schermata una volta sola', async () => {
    impostaContesto({ pagina: 'home' })
    await registraErrore('avviso', 'Impossibile caricare i turni.')
    await registraErrore('avviso', 'Impossibile caricare i turni.')
    impostaContesto({ pagina: 'turn' })
    await registraErrore('avviso', 'Impossibile caricare i turni.')
    expect(scritte).toHaveLength(2)
  })

  it(`al massimo ${MASSIMO_AL_GIORNO} righe al giorno per telefono`, async () => {
    for (let i = 0; i < MASSIMO_AL_GIORNO + 5; i++) await registraErrore('errore', `errore numero ${i}`)
    expect(scritte).toHaveLength(MASSIMO_AL_GIORNO)
  })

  it('senza rete non prova nemmeno', async () => {
    navigator.onLine = false
    expect(await registraErrore('avviso', 'Impossibile caricare gli atleti.')).toBe(false)
    expect(scritte).toHaveLength(0)
  })

  it('se la tabella non c\'è smette di provare', async () => {
    risposta = () => ({ error: { code: 'PGRST205' } })
    await registraErrore('avviso', 'primo')
    await registraErrore('avviso', 'secondo')
    expect(scritte).toHaveLength(1)
  })

  it('il rumore del browser non si scrive', async () => {
    expect(daIgnorare('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(daIgnorare('Script error.')).toBe(true)
    expect(daIgnorare('', '')).toBe(true)
    expect(daIgnorare('x', 'at chrome-extension://abc/content.js')).toBe(true)
    expect(daIgnorare('Cannot read properties of undefined')).toBe(false)
    expect(await registraErrore('errore', 'Script error.')).toBe(false)
  })

  it('i testi troppo lunghi si tagliano alla misura del database', () => {
    const r = preparaRiga({ tipo: 'errore', messaggio: 'x'.repeat(1000), dettaglio: 'y'.repeat(5000) }, { pagina: 'p'.repeat(100) })
    expect(r.messaggio).toHaveLength(300)
    expect(r.dettaglio).toHaveLength(2000)
    expect(r.pagina).toHaveLength(40)
    expect(preparaRiga({ messaggio: '' }).messaggio).toBe('(senza testo)')
  })
})

describe('il telefono, in due parole', () => {
  it('riconosce i telefoni e i tablet della palestra', () => {
    expect(descriviDispositivo({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1', larghezza: 390, altezza: 844 }))
      .toBe('iPhone · Safari 17.1 · browser · 390×844')
    expect(descriviDispositivo({ ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', installata: true }))
      .toBe('Android · Chrome 120 · app')
    expect(descriviDispositivo({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15', tocchi: 0 }))
      .toBe('Mac · Safari 16.6 · browser')
    expect(descriviDispositivo({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' }))
      .toBe('Windows · Edge 120 · browser')
  })
})

describe('leggere il registro', () => {
  const adesso = new Date(2026, 10, 28, 9, 0)

  it('oggi, ieri, o il giorno', () => {
    expect(quandoCorto(new Date(2026, 10, 28, 8, 5).toISOString(), adesso)).toBe('oggi 08:05')
    expect(quandoCorto(new Date(2026, 10, 27, 18, 40).toISOString(), adesso)).toBe('ieri 18:40')
    expect(quandoCorto(new Date(2026, 10, 25, 17, 0).toISOString(), adesso)).toBe('25/11 17:00')
  })

})

describe('gli errori recenti, per le segnalazioni', () => {
  it('anche quelli non scritti (senza rete), al massimo cinque, solo dell\'ultima ora', async () => {
    expect(erroriRecenti()).toBeNull()
    impostaContesto({ pagina: 'turn' })
    navigator.onLine = false
    await registraErrore('avviso', 'Carico non salvato', '42501 · permission denied\naltra riga')
    navigator.onLine = true
    const testo = erroriRecenti()
    expect(testo).toMatch(/^\d\d:\d\d · Seduta · Carico non salvato · 42501 · permission denied$/)
    for (let i = 0; i < 7; i++) await registraErrore('errore', `errore ${i}`)
    expect(erroriRecenti().split('\n')).toHaveLength(5)
    expect(erroriRecenti(60, Date.now() + 2 * 3_600_000)).toBeNull()
  })
})
