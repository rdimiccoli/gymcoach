import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk } from '../lib/notify'
import { quantoEUsato, rinominaEsercizio, eliminaEsercizio, unisciEsercizi } from '../lib/eserciziDb'
import { ScheletroElenco } from './Scheletro'

/**
 * Il catalogo degli esercizi, tutto in un posto. Sta in SCHEDE, sotto la
 * linguetta ESERCIZI: gli esercizi sono il materiale delle schede, e lì un
 * coach li va a cercare.
 *
 * Fino a qui un esercizio si rinominava solo da dentro una scheda, e non si
 * eliminava da nessuna parte: un coach che ne creava uno con un errore di
 * battitura se lo ritrovava per sempre nella ricerca, e non sapeva dove
 * andare a correggerlo.
 *
 * Toccando un esercizio si apre un foglio con il nome da correggere e, più
 * in basso e in rosso, ELIMINA. Eliminare un esercizio usato nelle schede
 * cancella anche i carichi dei clienti: prima di farlo il foglio lo dice con
 * i numeri veri, e il pulsante li ripete.
 */
export default function CatalogoEsercizi() {
  const [esercizi, setEsercizi] = useState([])
  const [cerca, setCerca] = useState('')
  const [loading, setLoading] = useState(true)

  // Il foglio aperto: l'esercizio, il nome che si sta scrivendo, quanto è
  // usato e se si è passati alla conferma. `uso` vale undefined mentre si
  // conta, null se non si è riusciti a contare: in quel caso eliminare non
  // si propone, perché il banner non saprebbe dire cosa si perde.
  const [aperto, setAperto] = useState(null)
  const [nome, setNome] = useState('')
  const [uso, setUso] = useState(undefined)
  const ultimoAperto = useRef(null)
  const [conferma, setConferma] = useState(false)
  const [lavoro, setLavoro] = useState(false)

  useEffect(() => { carica() }, [])

  async function carica() {
    const { data } = await run(
      supabase.from('exercises').select('id, name').order('name'),
      'Impossibile caricare gli esercizi.')
    setEsercizi((data || []).filter(e => e?.name))
    setLoading(false)
  }

  async function apri(es) {
    setAperto(es); setNome(es.name); setUso(undefined); setConferma(false)
    ultimoAperto.current = es.id
    const u = await quantoEUsato(es.id)
    // Se nel frattempo se n'è aperto un altro, questo conto non è suo.
    if (ultimoAperto.current === es.id) setUso(u)
  }

  function chiudi() {
    if (lavoro) return
    setAperto(null); setConferma(false)
  }

  const pulito = nome.trim()
  // Un altro esercizio con lo stesso nome, maiuscole a parte: rinominare
  // creerebbe un doppione, quindi si propone di unirli.
  const gemello = aperto && pulito
    ? esercizi.find(e => e.id !== aperto.id && e.name.trim().toLowerCase() === pulito.toLowerCase())
    : null
  const nomeCambiato = aperto && pulito && pulito !== aperto.name

  async function salvaNome() {
    setLavoro(true)
    const ok = await rinominaEsercizio(aperto.id, pulito)
    setLavoro(false)
    if (!ok) return
    notifyOk('Nome cambiato in tutte le schede.')
    setEsercizi(prec => prec.map(e => e.id === aperto.id ? { ...e, name: pulito } : e)
      .sort((a, b) => a.name.localeCompare(b.name)))
    setAperto(null)
  }

  async function unisci() {
    setLavoro(true)
    const ok = await unisciEsercizi(aperto.id, gemello.id)
    setLavoro(false)
    if (ok) notifyOk(`Unito a «${gemello.name}». I carichi sono rimasti.`)
    setAperto(null)
    await carica()
  }

  async function elimina() {
    setLavoro(true)
    const ok = await eliminaEsercizio(aperto.id)
    setLavoro(false)
    if (ok) notifyOk(`«${aperto.name}» eliminato.`)
    setAperto(null); setConferma(false)
    await carica()
  }

  const testo = cerca.trim().toLowerCase()
  const visibili = esercizi.filter(e => !testo || e.name.toLowerCase().includes(testo))
  const usato = uso && uso.righe > 0

  return (
    <div style={contenitore}>
      <div style={{ padding: '12px 16px 8px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca esercizio..." style={inp} />
        <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '8px' }}>
          {loading ? ' ' : `${esercizi.length} esercizi. Tocca un esercizio per cambiargli nome o eliminarlo: vale per tutte le schede.`}
        </div>
      </div>

      <div style={scroll}>
        {loading && <ScheletroElenco righe={6} />}
        {!loading && visibili.length === 0 && (
          <div style={vuoto}>
            {testo ? `Nessun esercizio trovato per "${cerca.trim()}".` : 'Nessun esercizio nel catalogo.'}
          </div>
        )}
        {visibili.map(es => (
          <button key={es.id} type="button" onClick={() => apri(es)} style={riga}>
            <span style={{ flex: 1, minWidth: 0 }}>{es.name}</span>
            <span style={{ color: 'var(--testo-fioco)', fontSize: '18px', flexShrink: 0 }}>›</span>
          </button>
        ))}
        <div style={{ height: '20px' }} />
      </div>

      {aperto && (
        <div style={velo}>
          <div style={foglio}>
            {!conferma && (<>
              <div style={titolo}>MODIFICA ESERCIZIO</div>
              <div style={{ color: 'var(--testo-medio)', fontSize: '13px', marginBottom: '14px' }}>
                {uso === undefined ? 'Controllo dove è usato…'
                  : uso === null ? 'Non sono riuscito a sapere dove è usato.'
                  : usato ? `Usato in ${uso.schede} ${uso.schede === 1 ? 'scheda' : 'schede'}.`
                  : 'Non è usato in nessuna scheda.'}
              </div>

              <div style={etichetta}>NOME</div>
              <input value={nome} onChange={e => setNome(e.target.value)} style={{ ...inp, marginBottom: '12px' }} />

              {gemello ? (
                // Rinominarlo così creerebbe due esercizi con lo stesso nome:
                // si propone di unirli, che è quello che si vuole davvero
                // quando si corregge un doppione.
                <div style={{ ...riquadro, borderColor: 'rgba(234,179,8,0.35)', background: 'rgba(234,179,8,0.08)' }}>
                  <div style={{ color: 'var(--attenzione)', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', letterSpacing: '1px', fontSize: '14px', marginBottom: '4px' }}>
                    ESISTE GIÀ «{gemello.name}»
                  </div>
                  <div style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, marginBottom: '12px' }}>
                    Puoi unirli: le schede che usano «{aperto.name}» passano a «{gemello.name}»,
                    con tutti i carichi dei clienti. Poi «{aperto.name}» sparisce dal catalogo.
                  </div>
                  <button onClick={unisci} disabled={lavoro} style={{ ...pulsante, opacity: lavoro ? 0.4 : 1 }}>
                    {lavoro ? 'UNISCO…' : `UNISCI A «${gemello.name}»`}
                  </button>
                </div>
              ) : (
                <button onClick={salvaNome} disabled={!nomeCambiato || lavoro}
                  style={{ ...pulsante, opacity: !nomeCambiato || lavoro ? 0.3 : 1 }}>
                  {lavoro ? 'SALVO…' : '✓ SALVA IL NUOVO NOME'}
                </button>
              )}
              {nomeCambiato && !gemello && (
                <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', marginTop: '6px', lineHeight: 1.4 }}>
                  Il nome cambia in tutte le schede, anche in quelle già finite.
                </div>
              )}

              <button onClick={() => setConferma(true)} disabled={!uso || lavoro}
                style={{ ...pulsanteElimina, opacity: !uso || lavoro ? 0.4 : 1 }}>
                🗑 ELIMINA ESERCIZIO
              </button>
              <button onClick={chiudi} style={annulla}>Annulla</button>
            </>)}

            {conferma && (<>
              <div style={titolo}>ELIMINA «{aperto.name}»</div>

              {usato ? (
                // Il banner rosso: dice cosa si perde, con i numeri veri.
                <div style={{ ...riquadro, borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.10)' }}>
                  <div style={{ color: '#f87171', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '900', letterSpacing: '1px', fontSize: '17px', marginBottom: '6px' }}>
                    ⚠ ATTENZIONE
                  </div>
                  <div style={{ color: '#fff', fontSize: '14px', lineHeight: 1.5 }}>
                    Questo esercizio è usato in <b>{uso.schede} {uso.schede === 1 ? 'scheda' : 'schede'}</b>.
                    Eliminandolo sparisce da {uso.schede === 1 ? 'quella scheda' : 'tutte quelle schede'} e
                    {uso.carichi > 0
                      ? <> si cancellano per sempre <b>{uso.carichi} {uso.carichi === 1 ? 'carico registrato' : 'carichi registrati'}</b> dei clienti</>
                      : <> si cancellano i carichi dei clienti (al momento non ce ne sono)</>}
                    , con le loro note.
                  </div>
                  <div style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700', marginTop: '8px' }}>
                    Non si può tornare indietro.
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
                  Non è usato in nessuna scheda: eliminandolo non si perde nessun carico.
                </div>
              )}

              {usato && (
                <div style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, marginBottom: '14px' }}>
                  Se è un doppione creato per sbaglio, torna indietro e scrivigli il nome
                  dell&apos;esercizio giusto: ti verrà proposto di unirli, e i carichi restano.
                </div>
              )}

              <button onClick={elimina} disabled={lavoro}
                style={{ ...pulsante, background: 'rgba(239,68,68,0.92)', opacity: lavoro ? 0.4 : 1 }}>
                {lavoro ? 'ELIMINO…'
                  : usato && uso.carichi > 0 ? `SÌ, ELIMINA E CANCELLA ${uso.carichi} ${uso.carichi === 1 ? 'CARICO' : 'CARICHI'}`
                  : 'SÌ, ELIMINA'}
              </button>
              <button onClick={() => setConferma(false)} disabled={lavoro} style={annulla}>Torna indietro</button>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}

// Riempie lo spazio che SCHEDE gli lascia fra le linguette e la barra in fondo.
const contenitore = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
const scroll = { flex: 1, overflowY: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }
const inp = { width: '100%', boxSizing: 'border-box', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '6px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none' }
const vuoto = { color: 'var(--testo-fioco)', fontSize: '14px', textAlign: 'center', padding: '40px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }
const riga = { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '6px', padding: '14px', marginBottom: '7px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }
const velo = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const foglio = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '22px 16px 32px', width: '100%', maxWidth: 'var(--colonna)', maxHeight: '90%', overflowY: 'auto' }
const titolo = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '19px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }
const etichetta = { color: 'var(--testo-debole)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }
const riquadro = { border: '1px solid', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }
const pulsante = { width: '100%', background: 'var(--accento)', border: 'none', borderRadius: '4px', padding: '14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const pulsanteElimina = { width: '100%', marginTop: '22px', background: 'transparent', border: '1px solid rgba(239,68,68,0.45)', borderRadius: '4px', padding: '12px', color: '#f87171', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const annulla = { background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '12px 8px 4px', fontSize: '14px', cursor: 'pointer' }
