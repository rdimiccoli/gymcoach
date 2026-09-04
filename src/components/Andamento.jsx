/**
 * Andamento di un carico nel tempo.
 *
 * Lo storico era una colonna di numeri da leggere e confrontare a mente. Una
 * riga che sale dice la stessa cosa in un colpo d'occhio — ed è quello che la
 * coach mostra all'atleta quando le chiede «ma sto migliorando?».
 *
 * SVG a mano, nessuna libreria: i punti sono al massimo qualche decina.
 *
 * Una sola scala colloca linea, punti ed etichette, e le etichette dell'asse
 * nominano il minimo e il massimo veri — non numeri tondi che il grafico non
 * raggiunge.
 */
export default function Andamento({ punti, altezza = 92 }) {
  // Con un punto solo non c'è nessun andamento da mostrare: meglio niente che
  // una riga piatta che suggerisce una stabilità mai misurata.
  if (!punti || punti.length < 2) return null

  const L = 264
  const A = altezza
  const sx = 34   // spazio per le etichette dei kg
  const dx = 10
  const su = 18   // spazio per il valore finale, che sta sopra il punto
  const giu = 18  // spazio per le etichette delle settimane

  const valori = punti.map(p => p.kg)
  const min = Math.min(...valori)
  const max = Math.max(...valori)

  // Se il carico non è mai cambiato la linea sarebbe schiacciata sul bordo:
  // le diamo comunque un respiro, restando centrata.
  const ampiezza = max - min || Math.max(1, max * 0.1)
  const basso = min - ampiezza * 0.28
  const alto = max + ampiezza * 0.28

  const x = i => sx + (i * (L - sx - dx)) / (punti.length - 1)
  const y = v => su + ((alto - v) / (alto - basso)) * (A - su - giu)

  const linea = punti.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ')
  const area = `${linea} L${x(punti.length - 1).toFixed(1)} ${(A - giu).toFixed(1)} L${sx} ${(A - giu).toFixed(1)} Z`

  const ultimo = punti[punti.length - 1]
  const numero = n => String(n).replace('.', ',')

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`} width="100%" height={A}
      role="img"
      aria-label={`Andamento: da ${numero(punti[0].kg)} kg (${punti[0].etichetta}) a ${numero(ultimo.kg)} kg (${ultimo.etichetta})`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Le due guide sono il massimo e il minimo davvero raggiunti */}
      <line x1={sx} y1={y(max)} x2={L - dx} y2={y(max)} stroke="var(--sup-alta)" strokeWidth="1" />
      <line x1={sx} y1={y(min)} x2={L - dx} y2={y(min)} stroke="var(--sup-alta)" strokeWidth="1" />
      <text x={sx - 6} y={y(max) + 3.5} textAnchor="end" fill="var(--testo-fioco)" fontSize="9" fontFamily="Barlow Condensed, sans-serif">{numero(max)}</text>
      {min !== max && (
        <text x={sx - 6} y={y(min) + 3.5} textAnchor="end" fill="var(--testo-fioco)" fontSize="9" fontFamily="Barlow Condensed, sans-serif">{numero(min)}</text>
      )}

      <path d={area} fill="var(--acc-riempimento)" />
      <path d={linea} fill="none" stroke="var(--accento)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

      {punti.slice(0, -1).map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.kg)} r="2.8" fill="var(--fondo)" stroke="var(--accento)" strokeWidth="1.8" />
      ))}

      {/* L'ultimo punto è quello che conta: più grande, con il valore accanto */}
      <circle cx={x(punti.length - 1)} cy={y(ultimo.kg)} r="4.6" fill="var(--accento)" />
      <text
        x={L - dx} y={Math.max(11, y(ultimo.kg) - 10)} textAnchor="end"
        fill="var(--testo)" fontSize="12" fontWeight="700" fontFamily="Barlow Condensed, sans-serif"
      >{numero(ultimo.kg)} kg</text>

      <text x={sx} y={A - 4} textAnchor="start" fill="var(--testo-fioco)" fontSize="9" fontFamily="Barlow Condensed, sans-serif">{punti[0].etichetta}</text>
      <text x={L - dx} y={A - 4} textAnchor="end" fill="var(--testo-fioco)" fontSize="9" fontFamily="Barlow Condensed, sans-serif">{ultimo.etichetta}</text>
    </svg>
  )
}
