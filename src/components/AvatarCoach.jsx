import { avatarDi } from '../lib/avatarCoach'
import { indirizzoFoto } from '../lib/foto'

/**
 * Il cerchio del coach: la sua foto, oppure l'emoji che ha scelto, oppure la
 * sua iniziale per chi non ha fatto niente.
 *
 * Una misura sola non basta: 52px nell'elenco «chi sei?», più piccolo accanto
 * al nome nelle impostazioni, grande nella schermata dell'immagine. Tutto
 * scala da `size`, così non ci sono misure scritte a mano che divergono.
 */
export default function AvatarCoach({ coach, size = 52 }) {
  const { tipo, valore } = avatarDi(coach)

  const cerchio = {
    flexShrink: 0, width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo-forte)',
    overflow: 'hidden',
  }

  if (tipo === 'foto') {
    const indirizzo = indirizzoFoto(valore)
    if (indirizzo) {
      return (
        <span style={cerchio}>
          <img src={indirizzo} alt="" aria-hidden="true"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </span>
      )
    }
  }

  return (
    <span aria-hidden="true" style={{
      ...cerchio,
      // L'emoji si disegna da sé e porta i suoi colori; l'iniziale è una
      // lettera, e prende il carattere condensato dell'app come tutto il resto.
      ...(tipo === 'emoji'
        ? { fontSize: `${Math.round(size * 0.52)}px`, lineHeight: 1 }
        : {
            color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: `${Math.round(size * 0.48)}px`, fontWeight: '900', letterSpacing: '0.5px',
          }),
    }}>{tipo === 'foto' ? '' : valore}</span>
  )
}
