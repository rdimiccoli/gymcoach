/**
 * Le animazioni che non si possono fare solo con il CSS: un nome che scivola
 * nel suo nuovo posto, una riga che si chiude prima di sparire.
 *
 * Le altre — il salto del carico, il record, i fogli — stanno in index.css,
 * sotto «IL MOVIMENTO». Qui valgono le stesse regole: brevi, e niente per
 * chi sul telefono ha chiesto meno movimento.
 */

import { useRef, useLayoutEffect } from 'react'

export function riduciMovimento() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/**
 * Fa scivolare le righe nel loro nuovo posto quando l'ordine cambia.
 *
 * Senza, premendo ↑ un nome sparisce da una riga e ricompare in un'altra,
 * e bisogna rileggere l'elenco per capire chi si è spostato. Così si vede.
 *
 * Si usa così: le righe portano `data-scivola` con un nome che non cambia
 * fra un ordine e l'altro; prima di cambiare l'ordine si chiama `ricorda()`,
 * che si segna dove stanno; dopo che React ha ridisegnato, ognuna parte da
 * dove era e scivola dove è adesso.
 *
 * La foto si fa subito prima del cambio e non al disegno precedente: nel
 * frattempo il coach può aver fatto scorrere la pagina, e le posizioni
 * vecchie sarebbero sbagliate di quanto ha scorso.
 *
 * Sul tablet l'app è ingrandita con `zoom`: le posizioni lette dallo
 * schermo sono già ingrandite, lo spostamento da dare no. Il rapporto fra
 * l'altezza vista e quella vera della riga dice di quanto dividere.
 */
export function useScivola(contenitore) {
  const istantanea = useRef(null)

  useLayoutEffect(() => {
    const prima = istantanea.current
    if (!prima) return
    istantanea.current = null
    const radice = contenitore.current
    if (!radice || riduciMovimento()) return
    radice.querySelectorAll('[data-scivola]').forEach(riga => {
      const da = prima.get(riga.dataset.scivola)
      if (da === undefined || typeof riga.animate !== 'function') return
      const r = riga.getBoundingClientRect()
      const scala = riga.offsetHeight ? r.height / riga.offsetHeight : 1
      const dy = (da - r.top) / (scala || 1)
      if (Math.abs(dy) < 1) return
      riga.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
        { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
  })

  return function ricorda() {
    const radice = contenitore.current
    if (!radice) return
    istantanea.current = new Map(
      [...radice.querySelectorAll('[data-scivola]')].map(r => [r.dataset.scivola, r.getBoundingClientRect().top]))
  }
}

/**
 * Chiude una riga — altezza a zero e dissolvenza — prima che venga tolta.
 *
 * Torna una funzione da chiamare DOPO aver tolto la riga dallo stato: rimette
 * l'elemento com'era. Serve perché React può riusare lo stesso elemento per
 * la riga successiva (le chiavi delle righe esercizio sono posizioni), e
 * quella si ritroverebbe chiusa e invisibile.
 */
export async function chiudiRiga(el) {
  if (!el || riduciMovimento() || typeof el.animate !== 'function') return () => {}
  const stile = getComputedStyle(el)
  const overflowPrima = el.style.overflow
  el.style.overflow = 'hidden'
  const animazione = el.animate([
    { height: `${el.offsetHeight}px`, opacity: 1, marginTop: stile.marginTop, marginBottom: stile.marginBottom, paddingTop: stile.paddingTop, paddingBottom: stile.paddingBottom },
    { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' },
  ], { duration: 220, easing: 'ease-in', fill: 'forwards' })
  try { await animazione.finished } catch { /* annullata: va bene lo stesso */ }
  return () => { animazione.cancel(); el.style.overflow = overflowPrima }
}
