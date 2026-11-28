import { useState, useEffect } from 'react'
import { ascoltaRete, statoRete } from '../lib/copiaDati'
import { quandoCorto } from '../lib/registroErrori'

/**
 * La striscia «SENZA RETE» sotto la barra del titolo (e in cima alla Home).
 *
 * Compare solo quando il telefono è senza rete, o quando quello che si vede
 * viene dalla copia salvata sul telefono (vedi copiaDati.js): così nessuno
 * scambia per aggiornati dei dati di ieri sera. Sparisce da sola appena una
 * lettura torna a passare.
 */
export default function StrisciaSenzaRete() {
  const [stato, setStato] = useState(statoRete)
  useEffect(() => ascoltaRete(setStato), [])
  if (!stato.senzaRete) return null
  return (
    <div role="status" style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 16px', background: 'rgba(30,22,8,0.97)',
      borderBottom: '1px solid rgba(234,179,8,0.45)',
    }}>
      <span aria-hidden="true" style={{ fontSize: '14px' }}>📡</span>
      <span style={{ color: 'var(--testo-chiaro)', fontSize: '13px', lineHeight: 1.35 }}>
        <strong style={{ color: 'var(--attenzione)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px' }}>SENZA RETE</strong>
        {stato.copiaDel ? ` · dati salvati ${quandoCorto(stato.copiaDel)}` : ''}
        {'. I pesi che segni partono appena torna.'}
      </span>
    </div>
  )
}
