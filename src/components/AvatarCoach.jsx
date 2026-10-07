import { avatarDi } from '../lib/avatarCoach'

/**
 * Il cerchio con l'emoji — o con l'iniziale, per chi non ne ha scelta una.
 *
 * Una misura sola non basta: 52px nell'elenco «chi sei?», più piccolo accanto
 * al nome nelle impostazioni. Tutto scala da `size`, così non ci sono due
 * misure scritte a mano che un giorno divergono.
 */
export default function AvatarCoach({ coach, size = 52 }) {
  const { tipo, valore } = avatarDi(coach)
  return (
    <span aria-hidden="true" style={{
      flexShrink: 0, width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo-forte)',
      // L'emoji si disegna da sé e porta i suoi colori; l'iniziale è una
      // lettera, e prende il carattere condensato dell'app come tutto il resto.
      ...(tipo === 'emoji'
        ? { fontSize: `${Math.round(size * 0.52)}px`, lineHeight: 1 }
        : {
            color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: `${Math.round(size * 0.48)}px`, fontWeight: '900', letterSpacing: '0.5px',
          }),
    }}>{valore}</span>
  )
}
