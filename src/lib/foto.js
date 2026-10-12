import { supabase } from '../supabaseClient'

/**
 * La foto del coach.
 *
 * Sta in uno spazio file di Supabase, non nel database: una foto dentro una
 * riga di tabella la fa pesare e la trascina dietro a ogni lettura dei
 * profili, che l'app fa a ogni avvio.
 *
 * ── Perché si rimpicciolisce prima di mandarla ──────────────────────────
 * Una foto scattata col telefono pesa fra i tre e i cinque megabyte. Nel
 * cerchio dei profili si vede a 52 pixel. Mandarla intera vorrebbe dire far
 * aspettare il coach in sala pesi col wifi della palestra per un'immagine
 * grande quattrocento volte il necessario — e ricaricarla a ogni apertura.
 *
 * Si ritaglia quadrata al centro e si porta a 320 pixel: bastano anche per
 * schermi fitti, e il file scende sotto i 40 kB.
 *
 * ── Perché il nome del file cambia ogni volta ───────────────────────────
 * Se il percorso restasse lo stesso, il telefono continuerebbe a mostrare la
 * foto vecchia presa dalla sua memoria, e il coach penserebbe che il
 * caricamento non ha funzionato. Un nome nuovo a ogni cambio toglie il dubbio.
 */

const SPAZIO = 'coach'
const LATO = 320

/** L'indirizzo pubblico della foto, o null per chi non ne ha una. */
export function indirizzoFoto(percorso) {
  if (!percorso) return null
  try {
    return supabase.storage.from(SPAZIO).getPublicUrl(percorso).data?.publicUrl || null
  } catch {
    return null
  }
}

/**
 * Ritaglia al centro, porta a 320px e restituisce un JPEG.
 * L'orientamento delle foto scattate di traverso lo raddrizzano da soli i
 * browser di oggi quando l'immagine viene disegnata.
 */
export function rimpicciolisci(file, lato = LATO) {
  return new Promise((risolvi, rifiuta) => {
    const indirizzo = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(indirizzo)
      const tela = document.createElement('canvas')
      tela.width = lato
      tela.height = lato
      const pennello = tela.getContext('2d')
      // Il lato corto decide il ritaglio: così la faccia resta al centro
      // invece di schiacciarsi per entrare in un quadrato.
      const corto = Math.min(img.width, img.height)
      const x = (img.width - corto) / 2
      const y = (img.height - corto) / 2
      pennello.drawImage(img, x, y, corto, corto, 0, 0, lato, lato)
      tela.toBlob(
        b => (b ? risolvi(b) : rifiuta(new Error('immagine non convertita'))),
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(indirizzo)
      rifiuta(new Error('immagine non leggibile'))
    }
    img.src = indirizzo
  })
}

/**
 * Rimpicciolisce e carica. Ritorna { percorso } oppure { errore }.
 * L'errore è una frase da mostrare, non un oggetto tecnico.
 */
export async function caricaFoto(file, idCoach, percorsoVecchio) {
  if (!file) return { errore: 'Nessuna immagine scelta.' }
  if (!file.type?.startsWith('image/')) return { errore: 'Quello non è un file immagine.' }

  let piccola
  try {
    piccola = await rimpicciolisci(file)
  } catch {
    return { errore: 'Non riesco a leggere questa immagine. Provane un\'altra.' }
  }

  const percorso = `${idCoach}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from(SPAZIO)
    .upload(percorso, piccola, { contentType: 'image/jpeg', upsert: true })

  if (error) {
    console.error('foto non caricata', error)
    return { errore: 'Foto non caricata. Se il problema resta, va lanciata la migrazione «foto coach».' }
  }

  // La vecchia si toglie solo DOPO che la nuova è arrivata: se si togliesse
  // prima e il caricamento fallisse, il coach resterebbe senza nessuna delle
  // due. Se questa fallisce non importa: resta un file inutile, non un danno.
  if (percorsoVecchio && percorsoVecchio !== percorso) {
    await supabase.storage.from(SPAZIO).remove([percorsoVecchio]).catch(() => {})
  }

  return { percorso }
}

/** Toglie la foto. Il file sparisce, il profilo torna all'emoji o all'iniziale. */
export async function togliFoto(percorso) {
  if (!percorso) return { ok: true }
  const { error } = await supabase.storage.from(SPAZIO).remove([percorso])
  if (error) {
    console.error('foto non tolta', error)
    return { errore: 'Foto non tolta. Riprova.' }
  }
  return { ok: true }
}
