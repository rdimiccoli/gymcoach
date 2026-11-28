import { useState, useEffect } from 'react'
import { leggiErrori, testoPerWhatsapp, quandoCorto, NOMI_PAGINE, GIORNI_REGISTRO, VERSIONE } from '../lib/registroErrori'
import { copiaNegliAppunti } from '../lib/appunti'
import { notifyOk, notifyError } from '../lib/notify'
import { comePulsante } from '../lib/stile'
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

/**
 * REGISTRO DEGLI ERRORI — da IMPOSTAZIONI.
 *
 * Quello che l'app ha scritto da sola quando qualcosa è andato storto (vedi
 * registroErrori.js), gli ultimi trenta giorni. Non serve capirlo: basta
 * toccare COPIA PER WHATSAPP e mandarlo a chi sistema l'app.
 */
export default function RegistroErrori({ navigate, goBack, goHome }) {
  const [righe, setRighe] = useState(null)
  const [problema, setProblema] = useState(false)
  const [aperti, setAperti] = useState(() => new Set())

  useEffect(() => {
    let vivo = true
    leggiErrori().then(({ righe: r, error }) => {
      if (!vivo) return
      setProblema(!!error)
      setRighe(r)
    })
    return () => { vivo = false }
  }, [])

  async function copia() {
    const fatto = await copiaNegliAppunti(testoPerWhatsapp(righe))
    if (fatto) notifyOk('Copiato: incollalo su WhatsApp')
    else notifyError('Non sono riuscito a copiarlo. Fai uno screenshot.')
  }

  const apriChiudi = id => setAperti(prima => {
    const dopo = new Set(prima)
    if (dopo.has(id)) dopo.delete(id)
    else dopo.add(id)
    return dopo
  })

  return (
    <div style={pagina}>
      <TopBar title="REGISTRO DEGLI ERRORI" subtitle={`Ultimi ${GIORNI_REGISTRO} giorni · questa app: ${VERSIONE}`} onBack={goBack} />
      <div style={scorrimento}>
        <p style={nota}>
          Quando l'app ha un problema lo scrive qui da sola: cosa, quando, in quale
          schermata e su che telefono. Non serve capirlo: copialo e mandalo a chi
          sistema l'app.
        </p>

        {righe === null && <ScheletroElenco righe={4} />}

        {righe !== null && problema && (
          <div style={vuoto}>Non riesco a leggere il registro adesso. Riprova fra poco.</div>
        )}

        {righe !== null && !problema && righe.length === 0 && (
          <div style={vuoto}>👍 Nessun errore negli ultimi {GIORNI_REGISTRO} giorni.</div>
        )}

        {righe?.length > 0 && (<>
          <button type="button" onClick={copia} style={grande}>📋 COPIA PER WHATSAPP</button>
          <div style={{ ...titolo, marginTop: '18px' }}>
            {righe.length} {righe.length === 1 ? 'ERRORE' : 'ERRORI'}, I PIÙ RECENTI IN CIMA
          </div>
          <div style={riquadro}>
            {righe.map((r, i) => (
              <div key={r.id} style={{ padding: '12px 14px', borderTop: i ? '1px solid var(--sup-alta)' : 'none' }}>
                <div style={{ color: 'var(--testo-medio)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
                  {quandoCorto(r.quando).toUpperCase()}
                  {r.pagina && ` · ${(NOMI_PAGINE[r.pagina] || r.pagina).toUpperCase()}`}
                  {r.coach && ` · ${r.coach.toUpperCase()}`}
                </div>
                <div style={{ color: '#fff', fontSize: '15px', lineHeight: 1.4, marginTop: '3px', overflowWrap: 'anywhere' }}>
                  {r.tipo === 'schermata' && '💥 '}{r.messaggio}
                </div>
                <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', marginTop: '3px', overflowWrap: 'anywhere' }}>
                  {[r.dispositivo, r.versione && `versione ${r.versione}`].filter(Boolean).join(' · ')}
                </div>
                {r.dettaglio && (<>
                  <button type="button" onClick={() => apriChiudi(r.id)} aria-expanded={aperti.has(r.id)}
                    style={{ ...comePulsante, color: 'var(--accento)', fontSize: '13px', fontWeight: '700', minHeight: '36px', cursor: 'pointer' }}>
                    {aperti.has(r.id) ? 'Nascondi i dettagli ∧' : 'Dettagli ›'}
                  </button>
                  {aperti.has(r.id) && (
                    <pre style={dettaglio}>{r.dettaglio}</pre>
                  )}
                </>)}
              </div>
            ))}
          </div>
        </>)}
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const nota = { color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, margin: '0 0 14px' }
const titolo = { color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', marginBottom: '6px' }
const riquadro = { background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', overflow: 'hidden' }
const vuoto = { color: 'var(--testo-medio)', fontSize: '15px', textAlign: 'center', padding: '28px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '8px' }
const grande = { width: '100%', minHeight: '52px', background: 'var(--accento)', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const dettaglio = { margin: '4px 0 0', padding: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', color: 'var(--testo-chiaro)', fontSize: '11px', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '240px', overflowY: 'auto' }
