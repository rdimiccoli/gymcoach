import { test, expect } from '@playwright/test'
import { NOVITA } from '../src/lib/novita.js'

/**
 * Le prove dell'app vera, con il database finto (finto-supabase.js).
 * L'orologio è fermo al 27/11/2026 alle 13:35: il turno delle 13:30 è «in
 * corso» e la sua scheda (iniziata il 21/9, 8 settimane) è finita.
 */

const URL = '/prove/index.html'

async function apri(page, { novitaViste = NOVITA[0].id } = {}) {
  await page.clock.setFixedTime(new Date('2026-11-27T13:35:00'))
  await page.addInitScript(v => {
    localStorage.setItem('gymcoach.intro-vista', '1')
    localStorage.setItem('gymcoach.coach-attivo.u1', 'c1')
    if (v) localStorage.setItem('gymcoach.novita-viste', v)
  }, novitaViste)
  const errori = []
  page.on('pageerror', e => errori.push(e.message))
  await page.goto(URL)
  return errori
}

const scorreDiLato = page => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

test.describe('telefono', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Home: turno in corso, scheda finita, chi non si vede', async ({ page }) => {
    const errori = await apri(page)
    await expect(page.getByText('ORA IN CORSO')).toBeVisible()
    await expect(page.getByText('FINITA · PREPARA LA NUOVA')).toBeVisible()
    await expect(page.getByText(/NON SI VEDONO DA 3 SETTIMANE · 1/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Spira Luca/ })).toBeVisible()
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('seduta: settimana extra, +2,5, PREC. che si copia', async ({ page }) => {
    const errori = await apri(page)
    await page.getByText('13:30').first().click()
    await expect(page.getByText('SCHEDA FINITA')).toBeVisible()
    await expect(page.getByText(/SETTIMANA\s*10\s*· EXTRA/)).toBeVisible()
    await page.getByRole('button', { name: /^Squat$/ }).click()
    // PREC. si tocca: 52,5 diventa il peso di oggi
    await page.getByRole('button', { name: /Rifai il peso della volta prima: 4x8, 52.5/ }).click()
    await expect(page.getByText('✓').first()).toBeVisible()
    // il + sale di 2,5 (lo squat di Marco va a salti di 2,5)
    const piu = page.getByRole('button', { name: 'Più 2,5 chili' }).first()
    await expect(piu).toHaveText('+2,5')
    await piu.click()
    await expect(page.getByText('55', { exact: true })).toBeVisible()
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('nessuna schermata scorre di lato', async ({ page }) => {
    const errori = await apri(page)
    for (const voce of ['SCHEDE', 'TURNI', 'ATLETI', 'IMPOST.']) {
      await page.getByText(voce, { exact: true }).last().click()
      await page.waitForTimeout(300)
      expect(await scorreDiLato(page), voce).toBe(false)
    }
    expect(errori).toEqual([])
  })

  test('testo più grande, solo su questo telefono', async ({ page }) => {
    await apri(page)
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await page.getByRole('radio', { name: 'Molto grande' }).click()
    expect(await page.evaluate(() => document.documentElement.dataset.testo)).toBe('molto')
    expect(await page.evaluate(() => localStorage.getItem('gymcoach.testo'))).toBe('molto')
  })

  test('mettere in ordine: doppioni trovati e uniti', async ({ page }) => {
    const errori = await apri(page)
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await page.getByText('🧹 Mettere in ordine').click()
    await expect(page.getByText('PERSONE ISCRITTE DUE VOLTE · 1')).toBeVisible()
    await expect(page.getByText('ESERCIZI DOPPI · 1')).toBeVisible()
    await page.getByRole('button', { name: 'UNISCI…' }).first().click()
    await page.getByRole('button', { name: '✓ SÌ, UNISCI' }).click()
    await expect(page.getByText('PERSONE ISCRITTE DUE VOLTE · 0')).toBeVisible()
    expect(errori).toEqual([])
  })

  test('il peso proposto: «35?» al posto del trattino, un tocco e si segna', async ({ page }) => {
    const errori = await apri(page)
    await page.getByText('13:30').first().click()
    await page.getByRole('button', { name: /^Panca piana$/ }).click()
    // La settimana scorsa 30 kg: si propone un ottavo in più, al disco (35).
    const proposta = page.getByRole('button', { name: 'Proposta per oggi: 35 chili. Tocca per segnarla' })
    await expect(proposta).toHaveText(/35\?\s*PROPOSTA/)
    await proposta.click()
    await expect(proposta).toHaveCount(0)
    await expect(page.getByText('35', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() =>
      window.__dbFinto.client_loads.find(l => l.client_id === 'p1' && l.cycle_exercise_id === 's2_e2' && l.week === 10)?.kg)).toBe(35)
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('il cruscotto: la settimana, le dieci prima, coach per coach', async ({ page }) => {
    const errori = await apri(page)
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await page.getByText('📊 Cruscotto').click()
    await expect(page.getByText('QUESTA SETTIMANA · DA LUNEDÌ 23/11')).toBeVisible()
    await expect(page.getByText('97', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Questa settimana', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Settimana del 16/11: 103 persone, 550 pesi' }).click()
    await expect(page.getByText(/Settimana del 16\/11: 103 persone · 550 pesi/)).toBeVisible()
    await expect(page.getByText('Sandro', { exact: true })).toBeVisible()
    await expect(page.getByText('Manu', { exact: true })).toBeVisible()
    await expect(page.getByText(/persona non si vede da 3 settimane/)).toBeVisible()
    await page.getByRole('button', { name: 'Vedi i numeri ›' }).click()
    await expect(page.getByRole('cell', { name: '23/11 (in corso)' })).toBeVisible()
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('il registro degli errori: si scrive da solo, e nell\'app non si vede', async ({ page }) => {
    await apri(page)
    // Un errore del programma che nessuno gestisce finisce nel registro.
    // (Una promessa e non un timer: l'orologio finto delle prove si tiene
    // gli errori dei timer e non li fa arrivare alla pagina.)
    await page.addScriptTag({ content: "Promise.reject(new Error('prova del registro'))" })
    await expect.poll(() => page.evaluate(() => window.__dbFinto.errori_app.map(e => e.messaggio).join('|'))).toContain('prova del registro')
    // Ai coach non serve: nelle impostazioni non c'è.
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await expect(page.getByText(/Versione dell'app/)).toBeVisible()
    await expect(page.getByText(/Registro degli errori/i)).toHaveCount(0)
  })

  test('le copie di sicurezza: scaricare una copia di tutto', async ({ page }) => {
    const errori = await apri(page)
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await page.getByText('💾 Copie di sicurezza').click()
    await expect(page.getByText(/Ancora nessuna/)).toBeVisible()
    const [scaricata] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '💾 SCARICA UNA COPIA DI TUTTO' }).click(),
    ])
    expect(scaricata.suggestedFilename()).toMatch(/^gymcoach-copia-2026-11-27-\d{4}\.json$/)
    const testo = await (await scaricata.createReadStream()).toArray().then(pezzi => Buffer.concat(pezzi).toString('utf8'))
    const copia = JSON.parse(testo)
    expect(copia.app).toBe('GymCoach')
    expect(copia.tabelle.client_loads.length).toBeGreaterThan(10)
    expect(copia.tabelle.clients.length).toBe(7)
    expect(errori).toEqual([])
  })

  test('senza rete: la striscia in cima, e il turno si apre', async ({ page, context }) => {
    const errori = await apri(page)
    await expect(page.getByText('ORA IN CORSO')).toBeVisible()
    await context.setOffline(true)
    await expect(page.getByText('SENZA RETE')).toBeVisible()
    await page.getByText('13:30').first().click()
    await expect(page.getByText('SCHEDA FINITA')).toBeVisible()
    await expect(page.getByText('SENZA RETE')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('SENZA RETE')).toHaveCount(0)
    expect(errori).toEqual([])
  })

  test('le segnalazioni: si scrive, con la foto, e la bozza non si perde', async ({ page }) => {
    const errori = await apri(page)
    // In fondo alla Home, l'invito
    await page.getByRole('button', { name: /Qualcosa non va, o hai un'idea\?/ }).click()
    await page.getByRole('button', { name: '＋ SCRIVI UNA SEGNALAZIONE' }).click()
    await page.getByRole('radio', { name: /UN'IDEA/ }).click()
    await page.getByLabel('COSA TI PIACEREBBE AVERE?').fill('Vedere il peso massimo di ognuno')
    // si esce per sbaglio e si rientra: il testo c'è ancora
    await page.getByRole('button').first().click()
    await page.getByRole('button', { name: '＋ SCRIVI UNA SEGNALAZIONE' }).click()
    await expect(page.getByLabel('COSA TI PIACEREBBE AVERE?')).toHaveValue('Vedere il peso massimo di ognuno')
    // una foto dello schermo, piccola
    await page.locator('input[type="file"]').setInputFiles({
      name: 'schermo.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    })
    await expect(page.getByAltText('La foto che stai mandando')).toBeVisible()
    await page.getByRole('button', { name: '✓ INVIA' }).click()
    await expect(page.getByText('INVIATA, GRAZIE!')).toBeVisible()
    const riga = await page.evaluate(() => window.__dbFinto.segnalazioni[0])
    expect(riga).toMatchObject({ tipo: 'idea', testo: 'Vedere il peso massimo di ognuno', coach_id: 'c1', coach: 'Sandro', stato: 'nuova' })
    expect(riga.foto).toMatch(/\.jpg$/)
    await page.getByRole('button', { name: 'VEDI LE SEGNALAZIONI' }).click()
    await expect(page.getByText('Vedere il peso massimo di ognuno')).toBeVisible()
    // nessun tasto per rispondere dentro l'app
    await expect(page.getByText(/sistemi l'app\?/)).toHaveCount(0)
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('le segnalazioni: dal pulsante RISPONDI dell\'email, poi il coach vede la risposta', async ({ page }) => {
    const id = '6f1c2b0e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
    const chiave = 'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d'
    await page.addInitScript(([id, chiave]) => localStorage.setItem('gymcoach.prove.segnalazioni', JSON.stringify([{
      id, chiave, creata: '2026-11-27T12:00:00Z', tipo: 'problema', testo: 'Il + non salva nel turno delle 18',
      coach_id: 'c1', coach: 'Sandro', stato: 'nuova', risposta: null, aggiornata: null, anche_io: ['c2'], foto: null,
      dispositivo: 'iPad · Safari 17.2 · app', versione: '28/11 10:54', errori: '17:58 · Seduta · Carico non salvato',
    }])), [id, chiave])
    const errori = []
    page.on('pageerror', e => errori.push(e.message))
    await page.clock.setFixedTime(new Date('2026-11-27T13:35:00'))
    await page.addInitScript(() => {
      localStorage.setItem('gymcoach.intro-vista', '1')
      localStorage.setItem('gymcoach.coach-attivo.u1', 'c1')
    })
    await page.addInitScript(v => localStorage.setItem('gymcoach.novita-viste', v), NOVITA[0].id)

    // Un codice sbagliato non apre niente
    await page.goto(`${URL}?rispondi=${id}&chiave=b0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d`)
    await expect(page.getByText(/Questo collegamento non funziona/)).toBeVisible()

    // Quello giusto: la segnalazione, che diventa «letta»
    await page.goto(`${URL}?rispondi=${id}&chiave=${chiave}`)
    await expect(page.getByText('Il + non salva nel turno delle 18')).toBeVisible()
    await expect(page.getByText(/17:58 · Seduta · Carico non salvato/)).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__dbFinto.segnalazioni[0].stato)).toBe('letta')
    await page.getByRole('radio', { name: 'FATTA' }).click()
    await page.getByLabel(/LA TUA RISPOSTA/).fill('Fatto: ora salva subito')
    await page.getByRole('button', { name: '✓ SALVA' }).click()
    await expect(page.getByText('SALVATO')).toBeVisible()
    expect(await page.evaluate(() => window.__dbFinto.segnalazioni[0])).toMatchObject({ stato: 'fatta', risposta: 'Fatto: ora salva subito' })

    // Si passa all'app: il coach (qui Sandro) vede la novità in Home
    await page.getByRole('button', { name: 'APRI GYMCOACH' }).click()
    expect(await page.evaluate(() => window.location.search)).toBe('')
    await expect(page.getByText('SEGNALAZIONI · 1 NOVITÀ')).toBeVisible()
    await page.getByText('SEGNALAZIONI · 1 NOVITÀ').click()
    await expect(page.getByRole('button', { name: /CHIUSE · 1/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('↳ Fatto: ora salva subito')).toBeVisible()
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })

  test('le segnalazioni: «anche io» su quella di un collega', async ({ page }) => {
    await apri(page)
    await page.evaluate(() => window.__dbFinto.segnalazioni.push({
      id: 'sx', creata: new Date().toISOString(), tipo: 'problema', testo: 'Il timer del circuito non suona', coach_id: 'c2', coach: 'Manu',
      stato: 'in_corso', risposta: null, aggiornata: null, anche_io: [], foto: null,
    }))
    await page.getByText('IMPOST.', { exact: true }).last().click()
    await page.getByText('📮 Segnalazioni').click()
    await page.getByRole('button', { name: /Il timer del circuito non suona/ }).click()
    await page.getByRole('button', { name: '✋ ANCHE IO' }).click()
    await expect(page.getByText('✋ Anche: tu')).toBeVisible()
    expect(await page.evaluate(() => window.__dbFinto.segnalazioni[0].anche_io)).toEqual(['c1'])
  })

  test('dopo un aggiornamento compaiono le novità', async ({ page }) => {
    await apri(page, { novitaViste: '2026-11-01' })
    await expect(page.getByText(/NOVITÀ 1 DI \d/)).toBeVisible()
    await expect(page.getByText(NOVITA[0].schede[0].titolo)).toBeVisible()
  })
})

for (const [nome, larghezza, altezza] of [['iPad 9,7"', 1024, 768], ['iPad 9ª gen', 1080, 810], ['iPad Air', 1180, 820]]) {
  test(`${nome} sdraiato: la seduta è a due colonne`, async ({ page }) => {
    await page.setViewportSize({ width: larghezza, height: altezza })
    const errori = await apri(page)
    await page.getByText('13:30').first().click()
    await expect(page.getByRole('button', { name: /^Squat$/, pressed: true })).toBeVisible()
    await page.getByRole('button', { name: /Panca piana/ }).click()
    await expect(page.getByRole('button', { name: /Panca piana/, pressed: true })).toBeVisible()
    expect(await scorreDiLato(page)).toBe(false)
    expect(errori).toEqual([])
  })
}

test('iPad in piedi: una colonna sola', async ({ page }) => {
  await page.setViewportSize({ width: 810, height: 1080 })
  await apri(page)
  await page.getByText('13:30').first().click()
  await expect(page.getByText('SCHEDA FINITA')).toBeVisible()
  await expect(page.locator('button[aria-pressed="true"]', { hasText: 'Squat' })).toHaveCount(0)
})
