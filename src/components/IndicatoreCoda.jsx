import { useState, useEffect } from 'react'
import { subscribeCoda, sincronizza } from '../lib/coda'

/**
 * Compare solo se c'è davvero qualcosa in attesa. Serve a due cose: dire alla
 * coach che i carichi non sono persi, e darle un modo di forzare l'invio invece
 * di restare a chiedersi se sia successo qualcosa.
 */
export default function IndicatoreCoda({ userId }) {
  const [quanti, setQuanti] = useState(0)
  const [inCorso, setInCorso] = useState(false)

  useEffect(() => subscribeCoda(setQuanti), [])

  if (!quanti) return null

  async function forza() {
    setInCorso(true)
    await sincronizza(userId)
    setInCorso(false)
  }

  return (
    <div onClick={inCorso ? undefined : forza} style={{
      position: 'fixed', left: '12px', right: '12px', bottom: '84px', zIndex: 900,
      background: 'rgba(30,22,8,0.97)',
      border: '1px solid rgba(234,179,8,0.45)',
      borderRadius: '8px', padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      cursor: inCorso ? 'default' : 'pointer',
    }}>
      <span style={{ fontSize: '15px' }}>{inCorso ? '⏳' : '📡'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#eab308', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
          {quanti} {quanti === 1 ? 'CARICO IN ATTESA' : 'CARICHI IN ATTESA'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '1px' }}>
          {inCorso ? 'Invio in corso...' : 'Salvati sul telefono. Partono da soli appena torna la rete — tocca per riprovare ora.'}
        </div>
      </div>
    </div>
  )
}
