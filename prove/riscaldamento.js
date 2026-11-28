import { chromium } from '@playwright/test'

/**
 * Prima delle prove, l'app si apre una volta su tutti e due i server.
 *
 * Il server delle prove prepara i file al primo caricamento: con un centinaio
 * di file la prima pagina può metterci più dei 5 secondi che una prova
 * aspetta, e a fallire era sempre la prima prova della serie, qualunque
 * fosse. Così ogni prova trova i file già pronti.
 */
export default async function riscaldamento() {
  const browser = await chromium.launch()
  try {
    for (const indirizzo of ['http://localhost:5199/prove/index.html', 'http://localhost:5198/prove/index.html']) {
      const page = await browser.newPage()
      await page.goto(indirizzo, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
      await page.close()
    }
  } finally {
    await browser.close()
  }
}
