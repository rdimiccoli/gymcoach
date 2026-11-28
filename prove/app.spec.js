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
