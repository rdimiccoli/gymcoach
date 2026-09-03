// Sblocco biometrico dell'app (Face ID / impronta / Windows Hello) tramite WebAuthn.
//
// COSA FA E COSA NON FA — leggere prima di modificare.
//
// La sessione Supabase resta salvata sul dispositivo, quindi la coach è di fatto
// sempre dentro: chiunque prenda in mano il telefono sbloccato vede e modifica i
// dati di tutte le atlete. Questo modulo mette un lucchetto davanti a quella porta.
//
// Non c'è un server che verifica la firma: ci fidiamo del risultato che il sistema
// operativo restituisce al browser. Significa che è una barriera contro chi prende
// in mano il telefono, NON contro chi sa aprire i devtools — ma quella porta è già
// spalancata oggi, quindi il lucchetto non toglie niente e aggiunge parecchio.
//
// Per farne una vera autenticazione servirebbe una Edge Function che generi la
// sfida e verifichi la firma con la chiave pubblica registrata.

const CHIAVE_CREDENZIALE = 'gymcoach.bio.credenziale'
const CHIAVE_UTENTE = 'gymcoach.bio.utente'
const CHIAVE_RIFIUTO = 'gymcoach.bio.invito-rifiutato'

// Dopo quanto tempo in secondo piano l'app si richiude da sola.
export const MINUTI_RIBLOCCO = 5

// ── localStorage difensivo ──────────────────────────────────────────────────
// In finestra anonima o con i dati dei siti bloccati, l'accesso stesso può
// lanciare un'eccezione: non deve mai far cadere l'app.
function leggi(chiave) {
  try { return window.localStorage.getItem(chiave) } catch { return null }
}
function scrivi(chiave, valore) {
  try { window.localStorage.setItem(chiave, valore); return true } catch { return false }
}
function cancella(chiave) {
  try { window.localStorage.removeItem(chiave) } catch { /* niente da fare */ }
}

// ── base64url <-> ArrayBuffer ───────────────────────────────────────────────
// Esportate per poterle testare: un errore di padding qui si manifesterebbe
// solo mesi dopo, sul telefono di una coach, come uno sblocco che non funziona.
export function aBase64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function daBase64url(testo) {
  const base64 = testo.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

// ── Stato ───────────────────────────────────────────────────────────────────

/** Il dispositivo ha un sensore biometrico utilizzabile? */
export async function biometriaDisponibile() {
  try {
    if (!window.isSecureContext) return false // WebAuthn richiede https
    if (!window.PublicKeyCredential) return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Il lucchetto è attivo su QUESTO dispositivo per QUESTO coach? */
export function bloccoAttivo(userId) {
  return Boolean(userId && leggi(CHIAVE_CREDENZIALE) && leggi(CHIAVE_UTENTE) === userId)
}

/** L'invito ad attivarlo è già stato rifiutato una volta? */
export function invitoRifiutato() {
  return leggi(CHIAVE_RIFIUTO) === '1'
}
export function rifiutaInvito() {
  scrivi(CHIAVE_RIFIUTO, '1')
}

// ── Attivazione ─────────────────────────────────────────────────────────────

/**
 * Registra il sensore del dispositivo. Ritorna { ok, errore }.
 * La credenziale è legata al dominio: attivandola sull'anteprima non vale in
 * produzione, e viceversa. È il comportamento previsto da WebAuthn.
 */
export async function attivaBlocco(userId, email, nome) {
  try {
    const sfida = crypto.getRandomValues(new Uint8Array(32))
    const credenziale = await navigator.credentials.create({
      publicKey: {
        challenge: sfida,
        rp: { name: 'GymCoach', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId), // max 64 byte: un UUID sta comodo
          name: email || 'coach',
          displayName: nome || email || 'Coach',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // il sensore del dispositivo, non una chiavetta
          userVerification: 'required',        // pretende impronta/volto/PIN, non la sola presenza
          residentKey: 'discouraged',          // l'id ce lo teniamo noi
        },
        timeout: 60000,
        attestation: 'none',
      },
    })
    if (!credenziale) return { ok: false, errore: 'Registrazione annullata.' }

    if (!scrivi(CHIAVE_CREDENZIALE, aBase64url(credenziale.rawId))) {
      return { ok: false, errore: 'Il browser non permette di salvare i dati del sito.' }
    }
    scrivi(CHIAVE_UTENTE, userId)
    cancella(CHIAVE_RIFIUTO)
    return { ok: true }
  } catch (e) {
    return { ok: false, errore: messaggioErrore(e) }
  }
}

/** Toglie il lucchetto da questo dispositivo. */
export function disattivaBlocco() {
  cancella(CHIAVE_CREDENZIALE)
  cancella(CHIAVE_UTENTE)
}

// ── Sblocco ─────────────────────────────────────────────────────────────────

/** Chiede l'impronta/il volto. Ritorna { ok, errore, credenzialePersa }. */
export async function verificaIdentita() {
  const idSalvato = leggi(CHIAVE_CREDENZIALE)
  if (!idSalvato) return { ok: false, errore: 'Nessun sensore registrato su questo dispositivo.' }

  try {
    const risultato = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: daBase64url(idSalvato), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return risultato ? { ok: true } : { ok: false, errore: 'Verifica annullata.' }
  } catch (e) {
    // Se la coach ha resettato i dati biometrici del telefono, la credenziale
    // non esiste più: va segnalato, altrimenti resta chiusa fuori per sempre.
    const persa = e?.name === 'NotAllowedError' && !document.hasFocus()
    return { ok: false, errore: messaggioErrore(e), credenzialePersa: e?.name === 'InvalidStateError' || persa }
  }
}

function messaggioErrore(e) {
  switch (e?.name) {
    case 'NotAllowedError':  return 'Verifica annullata o scaduta.'
    case 'InvalidStateError': return 'Questo sensore risulta già registrato.'
    case 'NotSupportedError': return 'Questo dispositivo non supporta lo sblocco biometrico.'
    case 'SecurityError':     return 'Dominio non valido per lo sblocco biometrico.'
    case 'AbortError':        return 'Verifica interrotta.'
    default:                  return e?.message || 'Verifica non riuscita.'
  }
}
