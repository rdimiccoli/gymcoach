import { describe, it, expect, beforeEach } from 'vitest'

Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
const memoria = new Map()
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
}

const { fetchConCopia, usaMagazzino, chiaveDi, daCopiare, statoRete, pulisciCopie, accessoSalvato, sessioneAncheSenzaRete, GIORNI_VALIDI, SENZA_COPIA } = await import('./copiaDati')

// Il telefono finto: un magazzino in memoria al posto di IndexedDB.
const scaffale = new Map()
usaMagazzino({
  prendi: async k => scaffale.get(k) ?? null,
  metti: async v => { scaffale.set(v.chiave, v) },
  tutte: async () => [...scaffale.values()],
  togli: async k => { scaffale.delete(k) },
  svuota: async () => { scaffale.clear() },
})

const ANONIMA = 'chiave-anonima'
const INDIRIZZO = 'https://x.supabase.co/rest/v1/turns?select=*&coach_id=eq.c1'
const conAccesso = { method: 'GET', headers: { Authorization: 'Bearer jwt-di-sandro', Accept: 'application/json' } }
const senzaAccesso = { method: 'GET', headers: { Authorization: `Bearer ${ANONIMA}` } }
const aspetta = () => new Promise(r => setTimeout(r, 0))

let chiamate
const rispondeBene = corpo => async () => { chiamate++; return new Response(corpo, { status: 200, headers: { 'content-type': 'application/json', 'content-range': '0-0/*' } }) }
const reteGiu = async () => { chiamate++; throw new TypeError('Failed to fetch') }

beforeEach(() => {
  scaffale.clear(); memoria.clear(); chiamate = 0
  navigator.onLine = true
  globalThis.dispatchEvent?.(new Event('online'))
})

describe('la copia delle letture', () => {
  it('una lettura andata bene lascia la copia; senza rete risponde la copia', async () => {
    const vero = fetchConCopia(rispondeBene('[{"id":"t2"}]'), { chiavePubblica: ANONIMA })
    await (await vero(INDIRIZZO, conAccesso)).text()
    await aspetta()
    expect(scaffale.size).toBe(1)

    const giu = fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })
    const r = await giu(INDIRIZZO, conAccesso)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual([{ id: 't2' }])
    expect(r.headers.get('content-range')).toBe('0-0/*')
    expect(statoRete().senzaRete).toBe(true)
    expect(statoRete().copiaDel).toBeGreaterThan(0)
  })

  it('anche una pagina di righe (206) si copia, e torna com\'era', async () => {
    const pagina = async () => new Response('[{"id":"l1"}]', { status: 206, headers: { 'content-range': '0-999/2500' } })
    await (await fetchConCopia(pagina, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).text()
    await aspetta()
    const r = await fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('0-999/2500')
    expect(await r.json()).toEqual([{ id: 'l1' }])
  })

  it('il telefono senza rete: la copia subito, senza nemmeno provare', async () => {
    await (await fetchConCopia(rispondeBene('[1]'), { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).text()
    await aspetta()
    navigator.onLine = false
    chiamate = 0
    const r = await fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)
    expect(await r.json()).toEqual([1])
    expect(chiamate).toBe(0)
  })

  it('senza copia, l\'errore di rete arriva com\'è', async () => {
    await expect(fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).rejects.toThrow('Failed to fetch')
  })

  it('una lettura senza accesso non si copia: il suo «niente» non deve coprire i dati veri', async () => {
    await (await fetchConCopia(rispondeBene('[]'), { chiavePubblica: ANONIMA })(INDIRIZZO, senzaAccesso)).text()
    await aspetta()
    expect(scaffale.size).toBe(0)
    expect(daCopiare(INDIRIZZO, 'GET', senzaAccesso, ANONIMA)).toBe(false)
    expect(daCopiare(INDIRIZZO, 'GET', conAccesso, ANONIMA)).toBe(true)
  })

  it('le letture delle copie di sicurezza non si copiano, e l\'intestazione non parte', async () => {
    let partite
    const vero = async (_i, init) => { partite = new Headers(init.headers); return new Response('[1]', { status: 200 }) }
    const init = { method: 'GET', headers: new Headers({ Authorization: 'Bearer jwt-di-sandro', [SENZA_COPIA]: '1' }) }
    await (await fetchConCopia(vero, { chiavePubblica: ANONIMA })(INDIRIZZO, init)).text()
    await aspetta()
    expect(scaffale.size).toBe(0)
    expect(partite.has(SENZA_COPIA)).toBe(false)
    expect(partite.get('Authorization')).toBe('Bearer jwt-di-sandro')
  })

  it('senza accesso ma con un accesso salvato: la copia, o un errore chiaro — mai un elenco vuoto', async () => {
    await (await fetchConCopia(rispondeBene('[{"id":"t2"}]'), { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).text()
    await aspetta()
    const conSalvato = fetchConCopia(rispondeBene('[]'), { chiavePubblica: ANONIMA, accessoPresente: () => true })
    chiamate = 0
    // stessa lettura, ma partita senza accesso: risponde la copia
    const chiaveAnonima = chiaveDi(INDIRIZZO, senzaAccesso)
    scaffale.set(chiaveAnonima, { ...scaffale.get(chiaveDi(INDIRIZZO, conAccesso)), chiave: chiaveAnonima })
    expect(await (await conSalvato(INDIRIZZO, senzaAccesso)).json()).toEqual([{ id: 't2' }])
    expect(chiamate).toBe(0)
    // senza copia: un errore, non il vuoto
    const r = await conSalvato('https://x.supabase.co/rest/v1/clients?select=*', senzaAccesso)
    expect(r.status).toBe(401)
    expect(chiamate).toBe(0)
    // senza accesso salvato (prima di entrare) si va al database come sempre
    await fetchConCopia(rispondeBene('[]'), { chiavePubblica: ANONIMA, accessoPresente: () => false })(INDIRIZZO, senzaAccesso)
    expect(chiamate).toBe(1)
  })

  it('le scritture e i file passano dritti, sempre', async () => {
    const giu = fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })
    await expect(giu(INDIRIZZO, { ...conAccesso, method: 'POST' })).rejects.toThrow()
    await expect(giu('https://x.supabase.co/storage/v1/object/list/copie', conAccesso)).rejects.toThrow()
    expect(daCopiare(INDIRIZZO, 'PATCH', conAccesso, ANONIMA)).toBe(false)
  })

  it('una riga sola e un elenco sono due letture diverse', () => {
    const uno = chiaveDi(INDIRIZZO, { headers: { Accept: 'application/vnd.pgrst.object+json' } })
    const tanti = chiaveDi(INDIRIZZO, { headers: { Accept: 'application/json' } })
    expect(uno).not.toBe(tanti)
    expect(chiaveDi(INDIRIZZO, {})).toContain('/rest/v1/turns?select=*&coach_id=eq.c1')
  })

  it('una copia scaduta non si usa, e la pulizia la butta', async () => {
    const vecchia = Date.now() - (GIORNI_VALIDI + 1) * 86_400_000
    const chiave = chiaveDi(INDIRIZZO, conAccesso)
    scaffale.set(chiave, { chiave, corpo: '[1]', quando: vecchia })
    scaffale.set('fresca', { chiave: 'fresca', corpo: '[2]', quando: Date.now() })
    await expect(fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).rejects.toThrow()
    expect(await pulisciCopie()).toBe(1)
    expect([...scaffale.keys()]).toEqual(['fresca'])
  })

  it('appena una lettura passa, la striscia «senza rete» sparisce', async () => {
    await (await fetchConCopia(rispondeBene('[1]'), { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)).text()
    await aspetta()
    await fetchConCopia(reteGiu, { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)
    expect(statoRete().senzaRete).toBe(true)
    await fetchConCopia(rispondeBene('[1]'), { chiavePubblica: ANONIMA })(INDIRIZZO, conAccesso)
    expect(statoRete().senzaRete).toBe(false)
  })
})

describe('l\'accesso senza rete', () => {
  const CHIAVE = 'sb-x-auth-token'
  const salvato = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1' } }

  it('si ritrova l\'accesso salvato, anche scaduto', () => {
    expect(accessoSalvato(CHIAVE)).toBeNull()
    memoria.set(CHIAVE, JSON.stringify(salvato))
    expect(accessoSalvato(CHIAVE)).toEqual(salvato)
    memoria.set(CHIAVE, '{rotto')
    expect(accessoSalvato(CHIAVE)).toBeNull()
  })

  it('senza rete getSession risponde subito con quello salvato; con la rete come prima', async () => {
    memoria.set(CHIAVE, JSON.stringify(salvato))
    let vere = 0
    const auth = { getSession: async () => { vere++; return { data: { session: null }, error: { message: 'rete' } } } }
    sessioneAncheSenzaRete(auth, CHIAVE)
    navigator.onLine = false
    expect((await auth.getSession()).data.session).toEqual(salvato)
    expect(vere).toBe(0)
    navigator.onLine = true
    expect((await auth.getSession()).data.session).toBeNull()
    expect(vere).toBe(1)
  })
})
