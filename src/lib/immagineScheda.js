/**
 * La scheda di un cliente come immagine, da mandare su WhatsApp.
 *
 * Il messaggio di testo funziona, ma su WhatsApp diventa un muro di righe
 * con gli asterischi. Un'immagine curata — logo, nome, giorni, esercizi,
 * carichi — il cliente la apre, la salva, la ritrova in galleria in sala.
 *
 * Si disegna su un <canvas> a mano, senza librerie: è una pagina di testo
 * in colonna, e il canvas la fa in poche decine di righe. Larga 1080 pixel,
 * la misura con cui WhatsApp la mostra nitida; alta quanto serve.
 *
 * Due passate: la prima misura (quanto è alta), la seconda disegna. Le
 * scritte troppo lunghe si accorciano con «…» misurandole davvero, invece
 * di uscire dal bordo.
 */

const LARGO = 1080
const MARGINE = 72
const FONT = '"Barlow Condensed", sans-serif'
const C = {
  fondo: '#0b0b0b',
  riga: '#1d1d1d',
  bianco: '#ffffff',
  medio: 'rgba(255,255,255,0.62)',
  fioco: 'rgba(255,255,255,0.38)',
  accento: '#D95C1A',
  accentoVelo: 'rgba(217,92,26,0.16)',
  circuito: '#4b8df8',
}

/** Aspetta i caratteri dell'app: senza, il canvas userebbe quello di sistema. */
async function caratteriPronti() {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all(['900', '800', '700', '600'].map(p =>
    document.fonts.load(`${p} 40px "Barlow Condensed"`).catch(() => {})))
}

function caricaLogo(src) {
  return new Promise(ok => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
}

/** Accorcia un testo finché non sta nella larghezza data. */
function adatta(ctx, testo, largo) {
  if (ctx.measureText(testo).width <= largo) return testo
  let t = testo
  while (t.length > 1 && ctx.measureText(t + '…').width > largo) t = t.slice(0, -1)
  return t + '…'
}

/**
 * Disegna la scheda e restituisce il PNG.
 *
 * `giorni`: [{ numero, gruppi: [{ tipo: 'single'|'superset'|'circuit',
 *              righe: [{ nome, reps, kg }] }] }]
 */
export async function disegnaScheda({ titolo, persona, fascia, sottotitolo, giorni, logo = '/logo_OAD.png' }) {
  await caratteriPronti()
  const immagineLogo = await caricaLogo(logo)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Le altezze di ogni pezzo: servono uguali alla misura e al disegno.
  const H = { testata: 330, giorno: 96, etichetta: 44, riga: 78, spazioGruppo: 14, spazioGiorno: 26, piede: 130 }
  const pieni = giorni.filter(g => g.gruppi.length)
  let alto = H.testata
  for (const g of pieni) {
    alto += H.giorno
    for (const gr of g.gruppi) {
      if (gr.tipo !== 'single') alto += H.etichetta
      alto += gr.righe.length * H.riga + H.spazioGruppo
    }
    alto += H.spazioGiorno
  }
  alto += H.piede

  canvas.width = LARGO
  canvas.height = alto

  // ── fondo e testata ────────────────────────────────────────────────────
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, LARGO, alto)
  ctx.fillStyle = C.accento
  ctx.fillRect(0, 0, LARGO, 10)

  if (immagineLogo) {
    const h = 64
    const w = (immagineLogo.width / immagineLogo.height) * h
    // Il logo ha il fondo nero: «screen» lo fa sparire sul nero del canvas,
    // come fa la Home con mix-blend-mode.
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(immagineLogo, MARGINE, 58, w, h)
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.fioco
  ctx.font = `700 26px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(fascia.toUpperCase(), LARGO - MARGINE, 100)
  ctx.textAlign = 'left'

  ctx.fillStyle = C.accento
  ctx.font = `900 72px ${FONT}`
  ctx.fillText(adatta(ctx, persona.toUpperCase(), LARGO - 2 * MARGINE), MARGINE, 214)

  ctx.fillStyle = C.bianco
  ctx.font = `800 40px ${FONT}`
  ctx.fillText(adatta(ctx, titolo, LARGO - 2 * MARGINE), MARGINE, 266)

  if (sottotitolo) {
    ctx.fillStyle = C.medio
    ctx.font = `600 28px ${FONT}`
    ctx.fillText(adatta(ctx, sottotitolo, LARGO - 2 * MARGINE), MARGINE, 306)
  }

  // ── i giorni ───────────────────────────────────────────────────────────
  let y = H.testata
  const destra = LARGO - MARGINE
  for (const g of pieni) {
    y += 34
    ctx.fillStyle = C.accento
    ctx.font = `900 40px ${FONT}`
    const testo = `GIORNO ${g.numero}`
    ctx.fillText(testo, MARGINE, y + 30)
    const fine = MARGINE + ctx.measureText(testo).width + 24
    ctx.fillStyle = C.riga
    ctx.fillRect(fine, y + 17, destra - fine, 2)
    y += H.giorno - 34

    for (const gr of g.gruppi) {
      const colore = gr.tipo === 'circuit' ? C.circuito : C.accento
      const inizio = y
      if (gr.tipo !== 'single') {
        ctx.fillStyle = colore
        ctx.font = `800 24px ${FONT}`
        ctx.fillText(gr.tipo === 'circuit' ? 'CIRCUITO' : 'SUPERSERIE', MARGINE + 22, y + 30)
        y += H.etichetta
      }
      for (const r of gr.righe) {
        // a destra: il carico (se c'è) e le ripetizioni
        let x = destra
        if (r.kg != null) {
          ctx.font = `800 34px ${FONT}`
          const t = `${String(r.kg).replace('.', ',')} kg`
          const w = ctx.measureText(t).width + 32
          ctx.fillStyle = C.accentoVelo
          arrotondato(ctx, x - w, y + 12, w, 52, 10)
          ctx.fill()
          ctx.fillStyle = C.accento
          ctx.textAlign = 'center'
          ctx.fillText(t, x - w / 2, y + 50)
          ctx.textAlign = 'left'
          x -= w + 20
        }
        if (r.reps) {
          ctx.fillStyle = C.medio
          ctx.font = `700 32px ${FONT}`
          ctx.textAlign = 'right'
          ctx.fillText(r.reps, x, y + 50)
          x -= ctx.measureText(r.reps).width + 24
          ctx.textAlign = 'left'
        }
        // a sinistra: il nome, accorciato se non ci sta
        const sx = MARGINE + (gr.tipo === 'single' ? 0 : 22)
        ctx.fillStyle = C.bianco
        ctx.font = `700 36px ${FONT}`
        ctx.fillText(adatta(ctx, r.nome, x - sx), sx, y + 50)
        // la riga sottile fra un esercizio e l'altro
        ctx.fillStyle = C.riga
        ctx.fillRect(sx, y + H.riga - 1, destra - sx, 1)
        y += H.riga
      }
      // superserie e circuiti: la barra colorata che li tiene insieme
      if (gr.tipo !== 'single') {
        ctx.fillStyle = colore
        arrotondato(ctx, MARGINE, inizio + 8, 6, y - inizio - 16, 3)
        ctx.fill()
      }
      y += H.spazioGruppo
    }
    y += H.spazioGiorno
  }

  // ── piede ──────────────────────────────────────────────────────────────
  ctx.fillStyle = C.riga
  ctx.fillRect(MARGINE, alto - H.piede + 30, LARGO - 2 * MARGINE, 2)
  ctx.fillStyle = C.fioco
  ctx.font = `700 28px ${FONT}`
  ctx.fillText('BUON ALLENAMENTO', MARGINE, alto - 46)
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('it-IT'), destra, alto - 46)
  ctx.textAlign = 'left'

  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('immagine non creata'))), 'image/png'))
}

function arrotondato(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Manda l'immagine: con la condivisione del telefono se c'è (si sceglie
 * WhatsApp e il contatto), altrimenti la scarica. Il file deve essere già
 * pronto: il telefono permette di aprire la condivisione solo subito dopo
 * il tocco, non dopo un'attesa.
 */
export async function mandaImmagine(blob, nomeFile, titolo) {
  const file = new File([blob], nomeFile, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titolo }); return 'condivisa' } catch (e) {
      if (e?.name === 'AbortError') return 'annullata'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomeFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'scaricata'
}
