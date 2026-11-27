/**
 * La nota accanto al nome: «NUOVA», «OVER», «ARRIVA TARDI».
 *
 * Prima si scriveva dentro il cognome («Bianchi Carmela nuova»), e finiva in
 * mezzo al nome in ogni elenco. Ora ha un posto suo, e si vede come un
 * cartellino accanto al nome (si scrive in TURNI, con la matita).
 */
export default function NotaPersona({ nota }) {
  const testo = String(nota ?? '').trim()
  if (!testo) return null
  return <span title="Nota" style={stile}>{testo.toUpperCase()}</span>
}

const stile = {
  display: 'inline-block', marginLeft: '8px', verticalAlign: 'middle', maxWidth: '12em',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  padding: '1px 7px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
  color: 'var(--testo-forte)', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)',
}
