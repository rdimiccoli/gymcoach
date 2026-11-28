import { test, expect } from '@playwright/test'
import { NOVITA } from '../src/lib/novita.js'
import { datiFinti, conRelazioni } from './finto-supabase.js'

/**
 * Il turno che si apre senza rete, con il collegamento VERO a Supabase.
 *
 * Qui l'app non usa il database finto di app.spec.js: usa supabaseClient.js
 * così com'è, con la copia dei dati sul telefono (copiaDati.js) e l'accesso
 * che vale anche senza rete. Solo l'indirizzo è finto: a rispondere, al posto
 * di Supabase, è questa prova, con gli stessi dati inventati.
 */

const URL = 'http://localhost:5198/prove/index.html'
const SUPABASE = 'https://finto.supabase.co'
const CHIAVE_ACCESSO = 'sb-finto-auth-token'

// Un accesso che sembra vero: il gettone ha la forma di quelli di Supabase.
const base64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
function accesso(scadeFraSecondi) {
  const scade = Math.floor(Date.now() / 1000) + scadeFraSecondi
  return {
    access_token: `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: 'u1', role: 'authenticated', exp: scade })}.firma`,
    refresh_token: 'rinnovo-finto', token_type: 'bearer', expires_in: 3600, expires_at: scade,
    user: { id: 'u1', email: 'palestra@esempio.it', aud: 'authenticated', role: 'authenticated' },
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
  'access-control-expose-headers': 'content-range',
}

/** Un PostgREST in miniatura sopra i dati finti: filtri eq/in/is, pagine, una riga sola. */
function rispondiComeSupabase(richiesta, scritture) {
  const indirizzo = new globalThis.URL(richiesta.url())
  const metodo = richiesta.method()
  if (metodo === 'OPTIONS') return { status: 204, headers: CORS }
  const tabella = indirizzo.pathname.replace('/rest/v1/', '')
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    scritture.push({ tabella, metodo, corpo: richiesta.postDataJSON?.() })
    return { status: 201, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' }
  }
  let righe = datiFinti[tabella] || []
  for (const [chiave, valore] of indirizzo.searchParams) {
    if (['select', 'order', 'offset', 'limit'].includes(chiave) || chiave.includes('.')) continue
    if (valore.startsWith('eq.')) righe = righe.filter(r => String(r[chiave]) === valore.slice(3))
    else if (valore.startsWith('in.(')) {
      const ammessi = valore.slice(4, -1).split(',').map(v => v.replace(/^"|"$/g, ''))
      righe = righe.filter(r => ammessi.includes(String(r[chiave])))
    } else if (valore === 'is.null') righe = righe.filter(r => r[chiave] == null)
  }
  const da = Number(indirizzo.searchParams.get('offset') || 0)
  const quante = Number(indirizzo.searchParams.get('limit') || 100000)
  const pagina = righe.slice(da, da + quante).map(r => conRelazioni(r, tabella))
  const una = (richiesta.headers().accept || '').includes('vnd.pgrst.object')
  const corpo = una ? (pagina[0] ? JSON.stringify(pagina[0]) : null) : JSON.stringify(pagina)
  if (una && !corpo) return { status: 406, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"code":"PGRST116","message":"nessuna riga"}' }
  return {
    status: 200,
    headers: { ...CORS, 'content-type': 'application/json', 'content-range': `${da}-${da + pagina.length - 1}/${righe.length}` },
    body: metodo === 'HEAD' ? undefined : corpo,
  }
}

async function apri(page, { scade = 3600, senzaRete = false } = {}) {
  const scritture = []
  await page.route(`${SUPABASE}/rest/v1/**`, r => r.fulfill(rispondiComeSupabase(r.request(), scritture)))
  await page.route(`${SUPABASE}/storage/v1/**`, r => r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' }))
  // Il rinnovo dell'accesso non riesce mai: come quando la rete non c'è.
  await page.route(`${SUPABASE}/auth/v1/**`, r => r.request().method() === 'OPTIONS'
    ? r.fulfill({ status: 204, headers: CORS }) : r.abort('internetdisconnected'))
  await page.addInitScript(({ sessione, chiave, novita, finto }) => {
    localStorage.setItem('gymcoach.intro-vista', '1')
    localStorage.setItem('gymcoach.coach-attivo.u1', 'c1')
    localStorage.setItem('gymcoach.novita-viste', novita)
    localStorage.setItem(chiave, JSON.stringify(sessione))
    if (finto) Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true })
  }, { sessione: accesso(scade), chiave: CHIAVE_ACCESSO, novita: NOVITA[0].id, finto: senzaRete })
  const errori = []
  page.on('pageerror', e => errori.push(e.message))
  await page.goto(URL)
  return { scritture, errori }
}

test.use({ viewport: { width: 390, height: 844 } })

test('senza rete il turno si riapre dalla copia sul telefono, e il peso parte dopo', async ({ page, context }) => {
  const { scritture, errori } = await apri(page)

  // Con la rete: Home e turno, che lasciano la loro copia sul telefono.
  await expect(page.getByText('COACH')).toBeVisible()
  await page.getByText('13:30').first().click()
  await expect(page.getByRole('button', { name: /^Squat$/ })).toBeVisible()
  await page.getByRole('button', { name: /^Squat$/ }).click()
  await expect(page.getByRole('button', { name: /Rifai il peso della volta prima: 4x8, 52.5/ })).toBeVisible()
  await page.getByRole('button').first().click() // indietro, in Home
  await expect(page.getByText('I TUOI TURNI')).toBeVisible()

  // Cade il wifi: il turno si apre lo stesso, con i pesi di prima.
  await context.setOffline(true)
  await page.getByText('13:30').first().click()
  await expect(page.getByText(/SENZA RETE.*dati salvati oggi/)).toBeVisible()
  await page.getByRole('button', { name: /^Squat$/ }).click()
  const prec = page.getByRole('button', { name: /Rifai il peso della volta prima: 4x8, 52.5/ })
  await expect(prec).toBeVisible()

  // Un peso segnato senza rete resta in attesa sul telefono...
  await prec.click()
  await expect(page.getByText('1 CARICO IN ATTESA')).toBeVisible({ timeout: 5000 })
  expect(scritture.filter(s => s.tabella === 'client_loads')).toHaveLength(0)

  // ...e parte da solo quando la rete torna.
  await context.setOffline(false)
  await expect(page.getByText('1 CARICO IN ATTESA')).toHaveCount(0, { timeout: 10_000 })
  const pesi = scritture.filter(s => s.tabella === 'client_loads')
  expect(pesi).toHaveLength(1)
  expect(pesi[0].corpo).toEqual([expect.objectContaining({ client_id: 'p1', cycle_exercise_id: 's2_e1', kg: 52.5, week: 10 })])
  expect(errori).toEqual([])
})

test('accesso scaduto e niente rete: si entra lo stesso, senza password e senza aspettare', async ({ page }) => {
  const prima = Date.now()
  const { errori } = await apri(page, { scade: -7200, senzaRete: true })
  await expect(page.getByText('COACH')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/password/i)).toHaveCount(0)
  // Prima di questa modifica servivano circa 25 secondi di tentativi.
  expect(Date.now() - prima).toBeLessThan(8000)
  expect(errori).toEqual([])
})
