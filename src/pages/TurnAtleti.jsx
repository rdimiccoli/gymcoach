import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { comePulsante } from '../lib/stile'
import { settimanaDaCalendario } from '../lib/schede'
import { capacita } from '../lib/capacita'
import { schedeSeguite } from '../lib/assegnazioni'
import { caricaAssegnazioni } from '../lib/assegnazioniDb'
import { caricaOspitiDiOggi, turnoDOrigine } from '../lib/ospitiDb'
import { useSchermoLargo } from '../lib/schermo'
import { ScheletroElenco } from '../components/Scheletro'
import TurnDetail from './TurnDetail'
import OspitiDelGiorno from '../components/OspitiDelGiorno'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const GIORNI = [1, 2, 3]

/**
 * Il turno visto per persona invece che per esercizio.
 *
 * Con tredici persone divise su tre schede, «un esercizio e sotto chi lo fa»
 * obbliga a ricordare chi segue cosa e ad aprire tre schermate diverse. Qui
 * c'è l'elenco di chi c'è, e si tocca la persona che si ha davanti.
 *
 * Una riga per coppia persona-scheda, non per persona: chi segue due schede
 * attive compare due volte, una per scheda. Sembra strano scritto, ma è
 * l'unico modo per non dover indovinare quale delle due si apre toccando.
 *
 * Ci si arriva solo se il coach ha scelto questa vista in IMPOSTAZIONI.
 */
export default function TurnAtleti({ navigate, goBack, goHome, params }) {
  const { turn } = params
  const [day, setDay] = useState(1)
  const [righe, setRighe] = useState([])
  const [schede, setSchede] = useState([])
  const [loading, setLoading] = useState(true)
  // Sul tablet sdraiato le due cose stanno una accanto all'altra invece che
  // una dentro l'altra: si tocca un nome a sinistra e a destra compare la sua
  // seduta, senza perdere di vista l'elenco e senza scorrere su e giù.
  const affiancato = useSchermoLargo()
  const [aperta, setAperta] = useState(null)

  useEffect(() => { carica() }, [turn.id])

  async function carica() {
    setLoading(true)
    const [{ data: atleti }, { data: attive }] = await Promise.all([
      run(supabase.from('clients').select('*')
        .eq('turn_id', turn.id).eq('is_active', true).order('surname'),
        'Impossibile caricare le persone del turno.'),
      run(supabase.from('cycles').select('*').eq('turn_id', turn.id).eq('is_active', true),
        'Impossibile caricare le schede del turno.'),
    ])
    const schedeAttive = attive || []
    setSchede(schedeAttive)

    const caps = await capacita()
    const assegnazioni = caps.assegnazioni
      ? await caricaAssegnazioni(schedeAttive.map(s => s.id))
      : {}

    // Chi oggi è venuto da un altro turno si allena qui: va in elenco come
    // tutti gli altri, con la SUA scheda. Prima era una card a parte in Home.
    const gruppiOspiti = caps.silver ? (await caricaOspitiDiOggi([turn.id]))[turn.id] || [] : []

    const elenco = []
    for (const persona of atleti || []) {
      const sue = schedeSeguite(persona, schedeAttive, assegnazioni)
      if (sue.length) sue.forEach(s => elenco.push({ persona, scheda: s }))
      else elenco.push({ persona, scheda: null })
    }
    for (const g of gruppiOspiti) {
      g.persone.forEach(persona => elenco.push({ persona, scheda: g.scheda, ospite: true }))
    }
    setRighe(elenco)
    // Se la persona aperta a destra non c'è più — turno cambiato, ospite
    // tolto — il pannello va chiuso, o mostrerebbe una seduta di nessuno.
    setAperta(prec => prec && elenco.find(r =>
      r.persona.id === prec.persona.id && r.scheda?.id === prec.scheda?.id) || null)
    setLoading(false)
  }

  function apri(riga) {
    if (!riga.scheda) return
    if (affiancato) { setAperta(riga); return }
    navigate('turn', {
      turn,
      cycle: riga.scheda,
      soloAtleti: [riga.persona.id],
      // Il giorno scelto qui si porta dietro: averlo scelto sul turno e
      // ritrovare il Giorno 1 aprendo una persona sarebbe un passo indietro.
      giorno: day,
      sottotitolo: `${riga.persona.name} ${riga.persona.surname} · ${riga.scheda.name}`,
    })
  }

  const piuDiUnaScheda = schede.length > 1

  return (
    <div style={affiancato ? { ...page, maxWidth: 'var(--colonna-larga)' } : page}>
      <TopBar title={turn.name} subtitle={`${righe.length} ${righe.length === 1 ? 'persona' : 'persone'}`} onBack={goBack} />

      {/* Il giorno si sceglie qui, sul turno: in un corso di gruppo è lo
          stesso per tutti, non una cosa da ripetere persona per persona. */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        {GIORNI.map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? 'var(--accento)' : 'var(--sup)',
            color: day === d ? '#fff' : 'var(--testo-debole)',
          }}>GIORNO {d}</button>
        ))}
      </div>

      <div style={affiancato ? affiancamento : { display: 'contents' }}>
      <div style={affiancato ? colonnaElenco : scroll}>
        {loading && <ScheletroElenco righe={6} />}

        {!loading && righe.length === 0 && (
          <div style={{ color: 'var(--bordo-forte)', fontSize: '14px', textAlign: 'center', padding: '32px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
            Nessuna persona in questo turno.
          </div>
        )}

        {righe.map((riga, i) => {
          const settimana = settimanaDaCalendario(riga.scheda)
          const apribile = Boolean(riga.scheda)
          return (
            <button
              key={`${riga.persona.id}-${riga.scheda?.id || 'niente'}-${i}`}
              type="button"
              onClick={() => apri(riga)}
              style={{
                ...rigaPersona,
                cursor: apribile ? 'pointer' : 'default',
                opacity: apribile ? 1 : 0.6,
                // Affiancato, la riga aperta a destra resta accesa a sinistra:
                // è l'unico modo di sapere di chi sono i carichi che si stanno
                // segnando senza rileggere il nome ogni volta.
                // Il bordo si accende con un'ombra interna invece di
                // riscrivere `border`: mescolare la forma breve e quella
                // lunga della stessa proprieta fa inciampare React a ogni
                // ridisegno, e lo dice nei messaggi.
                ...(aperta && aperta.persona.id === riga.persona.id && aperta.scheda?.id === riga.scheda?.id
                  ? { background: 'var(--acc-riempimento)', boxShadow: 'inset 0 0 0 1px var(--acc-bordo-forte)' }
                  : null),
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                  {riga.persona.surname} {riga.persona.name}
                  {riga.ospite && <span style={distintivoOspite}>OSPITE · {turnoDOrigine(riga.persona)}</span>}
                </div>
                <div style={{ color: 'var(--testo-medio)', fontSize: '13px', marginTop: '2px' }}>
                  {!riga.scheda
                    ? 'Nessuna scheda attiva'
                    // Con una scheda sola per tutto il turno ripetere il nome
                    // sotto ogni persona sarebbe rumore: si dice la settimana.
                    : piuDiUnaScheda || riga.ospite
                      ? `${riga.scheda.name}${settimana ? ` · sett. ${settimana}` : ''}`
                      : settimana ? `Settimana ${settimana} di 6` : riga.scheda.name}
                </div>
              </div>
              {apribile && <span style={{ color: 'var(--testo-fioco)', fontSize: '18px', flexShrink: 0 }}>›</span>}
            </button>
          )
        })}

        {/* L'altra strada, per chi la vuole: la schermata per esercizio, una
            per scheda attiva. È quella che si apriva prima da Home. */}
        {!loading && schede.length > 0 && (
          <div style={{ marginTop: '22px' }}>
            <div style={etichetta}>OPPURE APRI PER ESERCIZIO</div>
            {schede.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate('turn', { turn, cycle: s, giorno: day })}
                style={rigaScheda}
              >
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', letterSpacing: '0.5px', color: 'var(--testo-forte)' }}>
                  {s.name}
                </span>
                <span style={{ color: 'var(--testo-fioco)', fontSize: '16px', flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Solo il pulsante per aggiungere: gli ospiti di oggi stanno già
            nell'elenco qui sopra, insieme a tutti gli altri. */}
        {!loading && <OspitiDelGiorno turn={turn} navigate={navigate} mostraElenco={false} onCambiato={carica} />}
        <div style={{ height: '20px' }} />
      </div>

      {/* Il pannello di destra. La `key` è la persona: senza, aprendo un'altra
          riga React riuserebbe la stessa schermata e si vedrebbero i carichi
          di prima finché i nuovi non arrivano. */}
      {affiancato && (
        <div style={colonnaScheda}>
          {aperta ? (
            <TurnDetail
              key={`${aperta.persona.id}-${aperta.scheda.id}`}
              incorporato
              navigate={navigate} goBack={() => setAperta(null)} goHome={goHome}
              params={{ turn, cycle: aperta.scheda, soloAtleti: [aperta.persona.id], giorno: day }}
            />
          ) : (
            <div style={invito}>
              Tocca una persona a sinistra<br />
              <span style={{ fontSize: '14px', color: 'var(--testo-debole)' }}>
                qui compare la sua seduta di oggi
              </span>
            </div>
          )}
        </div>
      )}
      </div>

      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }

// ── Affiancato ────────────────────────────────────────────────────────────
// Due colonne che si dividono l'altezza rimasta. `minHeight: 0` su entrambe,
// altrimenti un figlio che scorre fa crescere la colonna invece di scorrere
// dentro di sé, e la pagina diventa più alta dello schermo.
const affiancamento = { flex: 1, display: 'flex', minHeight: 0 }

const colonnaElenco = {
  width: '38%', minWidth: '260px', maxWidth: '360px', flexShrink: 0,
  overflowY: 'auto', padding: '10px 14px', minHeight: 0,
  borderRight: '1px solid var(--sup-alta)',
  WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
}

const colonnaScheda = { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }

const invito = {
  margin: 'auto', textAlign: 'center', color: 'var(--testo-forte)',
  fontSize: '17px', lineHeight: 1.6, padding: '24px',
  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px',
}

const rigaPersona = {
  ...comePulsante,
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '14px', marginBottom: '7px', borderRadius: '8px', textAlign: 'left',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
}

const rigaScheda = {
  ...comePulsante,
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '12px 14px', marginBottom: '6px', borderRadius: '8px', textAlign: 'left',
  background: 'transparent', border: '1px solid var(--bordo)', cursor: 'pointer',
}

const etichetta = {
  color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px',
  fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px',
}

const distintivoOspite = {
  marginLeft: '8px', padding: '1px 6px', borderRadius: '3px', verticalAlign: 'middle',
  fontSize: '11px', fontWeight: '800', letterSpacing: '1px',
  color: 'var(--accento)', border: '1px solid var(--acc-bordo-forte)',
}
