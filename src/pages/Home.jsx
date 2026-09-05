import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { biometriaDisponibile, bloccoAttivo, invitoRifiutato, rifiutaInvito } from '../lib/biometria'
import { ScheletroSchede } from '../components/Scheletro'
import CardTurno from '../components/CardTurno'
import BottomNav from '../components/BottomNav'

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

/**
 * Schermata iniziale: i turni, e basta.
 *
 * Prima si apriva su tre card FASE 1 / 2 / 3 da scegliere prima di vedere i
 * turni. Quella scelta serviva a una cosa sola — sapere a che punto della
 * scheda si è — che ora l'app ricava da sola dalla data di inizio, e in modo
 * più preciso. Restava un tocco in più a ogni apertura, un concetto in più da
 * spiegare, un'impostazione in più e tre foto da Unsplash che offline non
 * arrivavano.
 *
 * Quello che le fasi dicevano, ora lo dice la card del turno: «settimana 4 di
 * 6, due indietro».
 */
export default function Home({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [turni, setTurni] = useState([])
  const [schede, setSchede] = useState({})       // turnId → [scheda attive]
  const [atlete, setAtlete] = useState({})       // turnId → [{ id }], solo per contarle
  const [loading, setLoading] = useState(true)

  const oggi = new Date()
  const giorno = GIORNI[oggi.getDay()]
  const data = `${String(oggi.getDate()).padStart(2, '0')}·${String(oggi.getMonth() + 1).padStart(2, '0')}·${oggi.getFullYear()}`

  // Invito una tantum allo sblocco biometrico: senza, l'interruttore nelle
  // impostazioni non lo troverebbe nessuno.
  const [invitoBio, setInvitoBio] = useState(false)
  useEffect(() => {
    if (invitoRifiutato() || bloccoAttivo(session.user.id)) return
    biometriaDisponibile().then(setInvitoBio)
  }, [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // .single() dava errore quando la riga non esisteva ancora (primo accesso):
    // .maybeSingle() restituisce null, che è il caso previsto.
    let { data: c } = await run(
      supabase.from('coaches').select('*').eq('id', session.user.id).maybeSingle(),
      'Impossibile caricare il profilo coach.'
    )
    if (!c) {
      // La riga viene creata al primo accesso con id = auth.uid(), quindi
      // nessuno può crearne una per conto di altri. Tiene però solo se su
      // Supabase la registrazione pubblica è disattivata — vedi SICUREZZA.md.
      const nome = session.user.email.split('@')[0]
      const { data: nuovo } = await run(
        supabase.from('coaches')
          .insert({ id: session.user.id, email: session.user.email, name: nome })
          .select().single(),
        'Profilo coach non creato. Contatta l\'amministratore.'
      )
      c = nuovo
    }
    setCoach(c)

    const { data: t } = await run(
      // Niente filtro sul coach: decide la policy del database, che è l'unico
      // posto dove quella regola può stare senza poter essere aggirata.
      // Filtrare anche qui escluderebbe i turni che un collega ha condiviso.
      supabase.from('turns').select('*').order('time'),
      'Impossibile caricare i turni.'
    )
    setTurni(t || [])

    if (t?.length) {
      const ids = t.map(x => x.id)
      // Due query in tutto, non due per turno.
      const [{ data: cicli }, { data: clienti }] = await Promise.all([
        run(supabase.from('cycles').select('*').in('turn_id', ids)
          .eq('is_active', true).order('created_at', { ascending: false }),
          'Impossibile caricare le schede attive.'),
        // Serve solo a contarle sulla card: la settimana non è più una loro
        // proprietà, viene dalla data d'inizio della scheda.
        run(supabase.from('clients').select('id, turn_id').in('turn_id', ids)
          .eq('is_active', true),
          'Impossibile caricare gli atleti.'),
      ])

      const perTurnoSchede = {}, perTurnoAtlete = {}
      ids.forEach(id => { perTurnoSchede[id] = []; perTurnoAtlete[id] = [] })
      ;(cicli || []).forEach(x => perTurnoSchede[x.turn_id]?.push(x))
      ;(clienti || []).forEach(x => perTurnoAtlete[x.turn_id]?.push(x))
      setSchede(perTurnoSchede)
      setAtlete(perTurnoAtlete)
    }
    setLoading(false)
  }

  return (
    <div style={pagina}>
      <div style={scorrimento}>

        <div style={testata}>
          <img src="/logo_OAD.png" alt="OAD" style={{ height: '30px', mixBlendMode: 'screen', marginBottom: '10px', display: 'block' }} />
          <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
            {giorno.toUpperCase()} · {data}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: '900', letterSpacing: '1px', lineHeight: 1, color: '#fff' }}>
            {loading
              ? <span className="osso" style={{ display: 'inline-block', width: '58%', height: '30px', borderRadius: '3px' }} />
              : <>COACH <span style={{ color: 'var(--accento)' }}>{coach?.name?.toUpperCase()}</span></>}
          </div>
        </div>

        {invitoBio && !loading && <InvitoImpronta onAttiva={() => navigate('settings')} onNo={() => { rifiutaInvito(); setInvitoBio(false) }} />}

        <div style={etichetta}>I TUOI TURNI</div>

        {loading && <ScheletroSchede righe={3} />}

        {!loading && turni.length === 0 && (
          <div style={vuoto}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>◷</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '19px', fontWeight: '700', color: 'var(--testo-forte)', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Non hai ancora nessun turno
            </div>
            <div style={{ color: 'var(--testo-debole)', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px' }}>
              Un turno è una fascia oraria con le sue atlete — per esempio «09:00 — Femminile».
              Si comincia da lì.
            </div>
            <button onClick={() => navigate('turns')} style={pulsanteVuoto}>+ CREA IL PRIMO TURNO</button>
          </div>
        )}

        {!loading && turni.map((turno, i) => {
          const attive = schede[turno.id] || []
          const gruppo = atlete[turno.id] || []
          return (
            <div key={turno.id} className={`fadeUp-${Math.min(i + 1, 3)}`}>
              {(attive.length ? attive : [null]).map((scheda, k) => (
                <CardTurno
                  key={k}
                  turno={turno}
                  scheda={scheda}
                  atlete={k === 0 ? gruppo : []}
                  mostraOrario={k === 0}
                  onApri={() => navigate('turn', { turn: turno, cycle: scheda })}
                />
              ))}
            </div>
          )
        })}

        <div style={{ height: '14px' }} />
      </div>
      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function InvitoImpronta({ onAttiva, onNo }) {
  return (
    <div style={{
      background: 'var(--acc-velo)', border: '1px solid var(--acc-bordo-tenue)',
      borderRadius: '6px', padding: '14px 15px', marginBottom: '18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '19px' }}>👆</span>
        <div style={{ color: 'var(--accento)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px' }}>
          PROTEGGI L'APP CON L'IMPRONTA
        </div>
      </div>
      <div style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, marginBottom: '12px' }}>
        Adesso chiunque prenda in mano questo dispositivo sbloccato vede e modifica
        i dati di tutte le atlete.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onAttiva} style={{
          flex: 1, background: 'var(--accento)', border: 'none', borderRadius: '4px', padding: '11px',
          color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
        }}>ATTIVA</button>
        <button onClick={onNo} style={{
          flex: 1, background: 'transparent', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '11px',
          color: 'var(--testo-debole)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
        }}>NON ORA</button>
      </div>
    </div>
  )
}

const pagina = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden' }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '18px 16px', WebkitOverflowScrolling: 'touch' }
const testata = { paddingBottom: '18px', borderBottom: '1px solid var(--sup)', marginBottom: '20px' }
const etichetta = { color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', marginBottom: '11px' }
const card = {
  width: '100%', textAlign: 'left', cursor: 'pointer',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
  borderRadius: '8px', padding: '15px 14px', marginBottom: '9px',
  font: 'inherit', color: 'inherit', WebkitAppearance: 'none',
}
const vuoto = {
  border: '1px dashed var(--bordo)', borderRadius: '8px',
  padding: '30px 22px', textAlign: 'center',
}
const pulsanteVuoto = {
  background: 'var(--accento)', border: 'none', borderRadius: '5px', padding: '13px 20px',
  color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px',
  fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer',
}
