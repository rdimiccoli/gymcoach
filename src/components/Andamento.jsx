import { useState } from 'react'
import { numero } from '../lib/progressi'

/**
 * Andamento di un carico nel tempo.
 *
 * Lo storico era una colonna di numeri da leggere e confrontare a mente. Una
 * riga che sale dice la stessa cosa in un colpo d'occhio — ed è quello che il
 * coach mostra al cliente quando gli chiede «ma sto migliorando?».
 *
 * Disegnato secondo le regole della skill dei grafici: una serie sola e quindi
 * nessuna legenda (il titolo dice cos'è), linea da 2px, alone del 10% sotto,
 * punti da 8px con un anello del colore dello sfondo, griglia a filo e
 * sommessa, un'etichetta sola — l'ultimo valore — invece di un numero su ogni
 * punto. I record battuti hanno un alone in più, spiegato sotto il grafico.
 *
 * Toccando il grafico (o passandoci col mouse) una riga verticale va sul
 * punto più vicino: non bisogna centrare il pallino col dito. Il valore si
 * legge nella riga SOPRA il grafico, non in un fumetto: un fumetto sotto il
 * dito resta coperto dal dito, e in alto finiva sopra il nome
 * dell'esercizio. Gli stessi valori stanno comunque nell'elenco sotto, che è
 * la versione in tabella del grafico.
 *
 * SVG a mano, nessuna libreria: i punti sono al massimo qualche decina.
 */
export default function Andamento({ punti, altezza = 112 }) {
  const [scelto, setScelto] = useState(null)
  // Con un punto solo non c'è nessun andamento da mostrare: meglio niente che
  // una riga piatta che suggerisce una stabilità mai misurata.
  if (!punti || punti.length < 2) return null

  const L = 300
  const A = altezza
  const sx = 34   // spazio per le etichette dei kg
  const dx = 14
  const su = 22   // spazio per il valore finale, sopra il punto
  const giu = 20  // spazio per le etichette delle settimane

  const valori = punti.map(p => p.kg)
  const min = Math.min(...valori)
  const max = Math.max(...valori)
  // Se il carico non è mai cambiato la linea sarebbe schiacciata sul bordo:
  // le si dà respiro, restando centrata.
  const ampiezza = max - min || Math.max(1, max * 0.1)
  const basso = min - ampiezza * 0.25
  const alto = max + ampiezza * 0.25

  const x = i => sx + (i * (L - sx - dx)) / (punti.length - 1)
  const y = v => su + ((alto - v) / (alto - basso)) * (A - su - giu)

  const linea = punti.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ')
  const area = `${linea} L${x(punti.length - 1).toFixed(1)} ${(A - giu).toFixed(1)} L${sx} ${(A - giu).toFixed(1)} Z`
  const ultimo = punti.length - 1
  const ciSonoRecord = punti.some(p => p.record)

  // Il punto più vicino al dito: si cerca la X, non il pallino.
  function vicino(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * L
    let migliore = 0
    punti.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(migliore) - px)) migliore = i })
    setScelto(migliore)
  }

  const i = scelto
  // Senza un punto scelto la riga dice l'ultimo valore: quello che conta.
  const p = punti[i ?? ultimo]

  return (
    <div>
      {/* Il valore: prima i chili, poi di quando è */}
      <div role="status" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minHeight: '26px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff' }}>
          {numero(p.kg)} kg
        </span>
        <span style={{ color: 'var(--testo-medio)', fontSize: '13px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i === null ? 'ultimo · ' : ''}{p.dettaglio || p.etichetta}
        </span>
        {p.record && <span style={{ color: 'var(--attenzione)', fontSize: '12px', fontWeight: '800', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px', flexShrink: 0 }}>🏆 RECORD</span>}
      </div>
      <svg
        viewBox={`0 0 ${L} ${A}`} width="100%" height={A}
        role="img" tabIndex={0}
        aria-label={`Andamento: da ${numero(punti[0].kg)} kg (${punti[0].etichetta}) a ${numero(punti[ultimo].kg)} kg (${punti[ultimo].etichetta}). Valori nell'elenco qui sotto.`}
        style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y', outline: 'none' }}
        onPointerDown={vicino}
        onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) vicino(e) }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setScelto(null) }}
        onBlur={() => setScelto(null)}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') setScelto(s => Math.min(ultimo, (s ?? -1) + 1))
          if (e.key === 'ArrowLeft') setScelto(s => Math.max(0, (s ?? ultimo + 1) - 1))
          if (e.key === 'Escape') setScelto(null)
        }}
      >
        {/* Le due guide: il minimo e il massimo davvero raggiunti, a filo */}
        <line x1={sx} y1={y(max)} x2={L - dx} y2={y(max)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {min !== max && <line x1={sx} y1={y(min)} x2={L - dx} y2={y(min)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />}
        <text x={sx - 6} y={y(max) + 3.5} textAnchor="end" fill="var(--testo-debole)" fontSize="10" fontFamily="Barlow Condensed, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{numero(max)}</text>
        {min !== max && (
          <text x={sx - 6} y={y(min) + 3.5} textAnchor="end" fill="var(--testo-debole)" fontSize="10" fontFamily="Barlow Condensed, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{numero(min)}</text>
        )}

        <path d={area} fill="rgba(217,92,26,0.10)" />
        <path d={linea} fill="none" stroke="var(--accento)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* la riga verticale sul punto scelto */}
        {i !== null && (
          <line x1={x(i)} y1={su - 6} x2={x(i)} y2={A - giu} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        )}

        {punti.map((pt, k) => (
          <g key={k}>
            {pt.record && <circle cx={x(k)} cy={y(pt.kg)} r="8" fill="none" stroke="var(--accento)" strokeOpacity="0.45" strokeWidth="1.5" />}
            <circle cx={x(k)} cy={y(pt.kg)} r={k === ultimo || k === i ? 5 : 4}
              fill="var(--accento)" stroke="#0d0d0d" strokeWidth="2" />
          </g>
        ))}

        {/* Un'etichetta sola: l'ultimo valore, che è quello che conta */}
        {i === null && (
          <text x={L - dx} y={Math.max(12, y(punti[ultimo].kg) - 11)} textAnchor="end"
            fill="#fff" fontSize="13" fontWeight="800" fontFamily="Barlow Condensed, sans-serif">
            {numero(punti[ultimo].kg)} kg
          </text>
        )}

        <text x={sx} y={A - 5} textAnchor="start" fill="var(--testo-debole)" fontSize="10" fontFamily="Barlow Condensed, sans-serif">{punti[0].etichetta}</text>
        <text x={L - dx} y={A - 5} textAnchor="end" fill="var(--testo-debole)" fontSize="10" fontFamily="Barlow Condensed, sans-serif">{punti[ultimo].etichetta}</text>
      </svg>


      {ciSonoRecord && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: 'var(--testo-debole)', fontSize: '12px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="var(--accento)" strokeOpacity="0.45" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="4" fill="var(--accento)" />
          </svg>
          record battuto · tocca il grafico per i valori
        </div>
      )}
    </div>
  )
}

/**
 * Il trend in piccolo, accanto al nome dell'esercizio: la linea nel grigio
 * di sfondo, il punto di oggi nel colore dell'app.
 */
export function Linetta({ valori, largo = 64, alto = 24 }) {
  if (!valori || valori.length < 2) return <span style={{ width: largo, display: 'inline-block' }} />
  const min = Math.min(...valori)
  const max = Math.max(...valori)
  const amp = max - min || 1
  const x = i => 2 + (i * (largo - 6)) / (valori.length - 1)
  const y = v => 3 + ((max - v) / amp) * (alto - 6) + (max === min ? (alto - 6) / 2 : 0)
  const d = valori.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const u = valori.length - 1
  return (
    <svg width={largo} height={alto} viewBox={`0 0 ${largo} ${alto}`} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(u)} cy={y(valori[u])} r="3" fill="var(--accento)" />
    </svg>
  )
}
