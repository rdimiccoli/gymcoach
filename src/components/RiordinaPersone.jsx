import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { numeraDaCapo, spostaDi, daSalvare } from '../lib/ordinePersone'
import { conOrdineDelTurno, salvaOrdine } from '../lib/ordineDb'

/**
 * L'ordine delle persone di un turno, in un foglio che si apre da sopra
 * qualsiasi schermata del turno.
 *
 * Sta in un componente suo e non dentro una pagina perché serve in tre posti:
 * in TURNI mentre si gestiscono i clienti, e nelle due viste del giorno —
 * dove il coach si accorge di volerlo cambiare, con le persone davanti.
 * Scriverlo tre volte avrebbe voluto dire tre comportamenti leggermente
 * diversi.
 *
 * `createPortal` su `document.body`: dentro la pagina questo foglio
 * finirebbe nel contenitore che scorre, e sui telefoni la barra in fondo
 * gli finisce sopra — è già successo con gli ospiti del giorno, e il
 * pulsante FATTO diventava impossibile da premere.
 */
export default function RiordinaPersone({ turnId, onChiuso }) {
  const [persone, setPersone] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [cambiato, setCambiato] = useState(false)

  useEffect(() => { carica() }, [turnId])

  async function carica() {
    const { data } = await run(
      await conOrdineDelTurno(
        supabase.from('clients').select('id, name, surname, sort_order')
          .eq('turn_id', turnId).eq('is_active', true)),
      'Impossibile caricare le persone del turno.'
    )
    setPersone(data || [])
    setCaricando(false)
  }

  async function sposta(indice, passo) {
    const prima = persone
    // Tutti ricevono un numero, non solo i due che si scambiano: la prima
    // volta nessuno ce l'ha, e numerarne solo due manderebbe tutti gli altri
    // in fondo all'elenco al prossimo accesso.
    const numerati = numeraDaCapo(persone)
    const dopo = spostaDi(numerati, indice, passo)
    if (dopo === numerati) return
    setPersone(dopo)
    setCambiato(true)
    if (!await salvaOrdine(daSalvare(prima, dopo))) setPersone(prima)
  }

  return createPortal(
    <div style={velo} onClick={() => onChiuso(cambiato)}>
      <div style={foglio} onClick={e => e.stopPropagation()}>
        <div style={titolo}>ORDINE DELLE PERSONE</div>
        <div style={spiegazione}>
          Mettili nell&apos;ordine in cui li segui. Chi lavora in coppia
          mettilo vicino: li ritrovi così in tutte le schermate del turno.
        </div>

        <div style={{ maxHeight: '46vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {caricando && <div style={{ color: 'var(--testo-fioco)', fontSize: '14px', padding: '12px 0' }}>Caricamento…</div>}
          {!caricando && persone.length === 0 && (
            <div style={{ color: 'var(--testo-fioco)', fontSize: '14px', padding: '12px 0' }}>
              Nessuna persona attiva in questo turno.
            </div>
          )}
          {persone.map((p, i) => (
            <div key={p.id} style={riga}>
              <div style={{ flex: 1, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {p.surname} {p.name}
              </div>
              <button onClick={() => sposta(i, -1)} disabled={i === 0} aria-label={`Sposta ${p.surname} più su`}
                style={{ ...freccia, opacity: i === 0 ? 0.25 : 1 }}>↑</button>
              <button onClick={() => sposta(i, +1)} disabled={i === persone.length - 1} aria-label={`Sposta ${p.surname} più giù`}
                style={{ ...freccia, opacity: i === persone.length - 1 ? 0.25 : 1 }}>↓</button>
            </div>
          ))}
        </div>

        <button onClick={() => onChiuso(cambiato)} style={fatto}>FATTO</button>
      </div>
    </div>,
    document.body
  )
}

const velo = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const foglio = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '22px 16px 32px', width: '100%', maxWidth: 'var(--colonna)' }
const titolo = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }
const spiegazione = { color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, marginBottom: '16px' }
const riga = { background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '6px', padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }
// Grandi come un pollice: si usano con le mani sudate.
const freccia = { background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: '#fff', fontSize: '20px', lineHeight: 1, width: '46px', height: '42px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }
const fatto = { width: '100%', background: 'var(--accento)', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer', marginTop: '14px' }
