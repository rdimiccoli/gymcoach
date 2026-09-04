import { useState } from 'react'
import { verificaIdentita, disattivaBlocco } from '../lib/biometria'

/**
 * Schermata di blocco mostrata all'apertura dell'app quando lo sblocco
 * biometrico è attivo su questo dispositivo.
 *
 * La verifica parte con un tocco e non da sola: Safari (e altri) pretendono
 * un gesto dell'utente prima di aprire il prompt di sistema, e un tentativo
 * automatico fallirebbe mostrando subito un errore senza motivo.
 */
export default function BloccoBiometrico({ nomeCoach, onSbloccato, onEsci }) {
  const [verifica, setVerifica] = useState(false)
  const [errore, setErrore] = useState('')
  const [credenzialePersa, setCredenzialePersa] = useState(false)

  async function sblocca() {
    setErrore('')
    setVerifica(true)
    const esito = await verificaIdentita()
    setVerifica(false)
    if (esito.ok) { onSbloccato(); return }
    setErrore(esito.errore)
    if (esito.credenzialePersa) setCredenzialePersa(true)
  }

  // Se il sensore non riconosce più la credenziale (dati biometrici resettati
  // sul telefono), senza questa via d'uscita la coach resterebbe chiusa fuori.
  function rimuoviBlocco() {
    disattivaBlocco()
    onSbloccato()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'var(--fondo)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px', textAlign: 'center',
    }}>
      <img src="/logo_OAD.png" alt="OAD" style={{ height: '34px', mixBlendMode: 'screen', marginBottom: '14px' }} />
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '34px', fontWeight: '900', color: '#fff', letterSpacing: '2px', lineHeight: 1 }}>
        GYM<span style={{ color: 'var(--accento)' }}>COACH</span>
      </div>
      {nomeCoach && (
        <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '2px', marginTop: '8px', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {nomeCoach}
        </div>
      )}

      <div style={{ fontSize: '64px', margin: '40px 0 8px', lineHeight: 1 }}>
        {verifica ? '⏳' : '🔒'}
      </div>
      <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginBottom: '32px', maxWidth: '280px', lineHeight: 1.45 }}>
        {verifica
          ? 'Verifica in corso...'
          : 'Sblocca con impronta, volto o PIN del dispositivo per accedere alle schede.'}
      </div>

      {errore && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '8px', padding: '12px 14px', marginBottom: '18px',
          color: '#fca5a5', fontSize: '12px', maxWidth: '300px', lineHeight: 1.4,
        }}>
          {errore}
          {credenzialePersa && (
            <div style={{ marginTop: '6px', color: 'var(--testo-medio)' }}>
              Il sensore registrato non è più valido su questo dispositivo.
            </div>
          )}
        </div>
      )}

      <button onClick={sblocca} disabled={verifica} style={{
        width: '100%', maxWidth: '300px',
        background: 'var(--accento)', border: 'none', borderRadius: '6px',
        padding: '17px', color: '#fff',
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px',
        fontWeight: '800', letterSpacing: '2px',
        opacity: verifica ? 0.5 : 1, cursor: 'pointer',
      }}>
        {verifica ? 'ATTENDI...' : '👆 SBLOCCA'}
      </button>

      {credenzialePersa && (
        <button onClick={rimuoviBlocco} style={{
          width: '100%', maxWidth: '300px', marginTop: '10px',
          background: 'transparent', border: '1px solid var(--testo-fioco)',
          borderRadius: '6px', padding: '14px', color: 'var(--testo-forte)',
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
          fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
        }}>
          RIMUOVI IL BLOCCO ED ENTRA
        </button>
      )}

      {/* Via d'uscita sempre disponibile. Non indebolisce il lucchetto: porta al
          login, dove serve comunque la password. Senza, chi ha un sensore che
          non lo riconosce più resterebbe chiuso fuori dall'app. */}
      <button onClick={onEsci} style={{
        width: '100%', maxWidth: '300px', marginTop: '22px',
        background: 'transparent', border: '1px solid var(--bordo-forte)',
        borderRadius: '6px', padding: '13px',
        color: 'var(--testo-chiaro)',
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
        fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
      }}>
        NON FUNZIONA? ENTRA CON LA PASSWORD
      </button>
      <div style={{ color: 'var(--testo-fioco)', fontSize: '11px', marginTop: '10px', maxWidth: '280px', lineHeight: 1.4 }}>
        Lo sblocco biometrico verrà disattivato su questo dispositivo: potrai
        riattivarlo dalle impostazioni.
      </div>
    </div>
  )
}
