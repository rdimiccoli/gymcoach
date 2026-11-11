import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { capacita } from '../lib/capacita'
import { conOrdineDeiTurni, salvaOrdineTurni } from '../lib/ordineDb'
import { spostaPerId } from '../lib/ordinePersone'
import MenuPuntini from '../components/MenuPuntini'
import RiordinaTurni from '../components/RiordinaTurni'
import { personeDellaScheda, senzaScheda } from '../lib/assegnazioni'
import { caricaAssegnazioni } from '../lib/assegnazioniDb'
import { caricaOspitiDiOggi, turnoDOrigine } from '../lib/ospitiDb'
import { vistaTurni, PER_ATLETA } from '../lib/vista'
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
 * 6». Sotto il turno compaiono anche gli ospiti Silver di oggi, ciascuno con
 * la propria scheda.
 */
export default function Home({ navigate, goHome, session, coach }) {
  const [turni, setTurni] = useState([])
  const [schede, setSchede] = useState({})       // turnId → [scheda attive]
  const [atlete, setAtlete] = useState({})       // turnId → [{ id }], solo per contarle
  const [assegnazioni, setAssegnazioni] = useState({})  // schedaId → Set(atletaId)
  const [ospiti, setOspiti] = useState({})       // turnId → [{ scheda, persone }] di oggi
  const [loading, setLoading] = useState(true)
  // Riordinare i turni: dai ⋮ in alto, «Riordina i turni». Le card diventano
  // compatte, con una maniglia per trascinarle, e finché si riordina non si
  // aprono — un tocco sbagliato non deve portare dentro un turno. Solo se il
  // database ha la colonna.
  const [ordineAttivo, setOrdineAttivo] = useState(false)
  const [riordina, setRiordina] = useState(false)
  const [spostando, setSpostando] = useState(false)
  // Preferenza del singolo coach, dalle impostazioni. Chi non l'ha mai toccata
  // trova la Home identica a com'era. È del PROFILO, non dell'account: con la
  // credenziale unica Sandro e Manu condividono l'accesso ma non il modo di
  // aprire i turni.
  const perAtleta = vistaTurni(coach) === PER_ATLETA

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

  // Il profilo arriva già scelto da App: cambiandolo questa schermata si
  // ricarica da capo con i turni dell'altro coach.
  useEffect(() => { loadData() }, [coach.id])

  /**
   * Sposta un turno di `passo` posti (negativo = più su). Il nuovo ordine va
   * a schermo subito, e poi si salva: aspettare il wifi della palestra a ogni
   * spostamento sembrerebbe una lista che non risponde. Se il salvataggio non
   * passa, torna com'era (e un avviso lo dice). Finché si salva le maniglie
   * aspettano: due salvataggi incrociati potrebbero lasciare un ordine
   * diverso da quello a schermo.
   */
  async function muovi(id, passo) {
    const prima = turni
    const dopo = spostaPerId(prima, id, passo)
    if (dopo === prima) return
    setSpostando(true)
    setTurni(dopo)
    const ok = await salvaOrdineTurni(prima, dopo)
    if (!ok) setTurni(prima)
    setSpostando(false)
  }

  async function loadData() {
    setLoading(true)
    const { data: t } = await run(
      // Il filtro per coach qui è diventato l'UNICA cosa che tiene separati i
      // due coach: dalla credenziale unica in poi il database lascia passare
      // tutto a chi è entrato, perché è quello che i coach hanno chiesto.
      // Prima erano due barriere, ora è una sola — e sta qui.
      // L'ordine è quello scelto con ⇅ RIORDINA; finché non c'è, per orario.
      await conOrdineDeiTurni(supabase.from('turns').select('*').eq('coach_id', coach.id)),
      'Impossibile caricare i turni.'
    )
    setTurni(t || [])
    setOrdineAttivo((await capacita()).ordineTurni)

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

      // Solo se il database le conosce: prima della migrazione Home resta
      // identica, senza richieste che finirebbero in errore.
      const caps = await capacita()
      const [assegnate, diOggi] = await Promise.all([
        caps.assegnazioni ? caricaAssegnazioni((cicli || []).map(c => c.id)) : {},
        caps.silver ? caricaOspitiDiOggi(ids) : {},
      ])
      setAssegnazioni(assegnate)
      setOspiti(diOggi)
    }
    setLoading(false)
  }

  return (
    <div style={pagina}>
      <div style={scorrimento} data-scorre>

        <div style={testata}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <img src="/logo_OAD.png" alt="OAD" style={{ height: '30px', mixBlendMode: 'screen', marginBottom: '10px', display: 'block' }} />
            {/* I ⋮ in alto, come nelle schede: le azioni sulla Home stanno lì
                dentro, invece di pulsanti sempre in vista. */}
            {!loading && ordineAttivo && turni.length > 1 && !riordina && (
              <MenuPuntini etichetta="Altre azioni sui turni" voci={[
                { icona: '⇅', testo: 'Riordina i turni', azione: () => setRiordina(true) },
              ]} />
            )}
          </div>
          <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
            {giorno.toUpperCase()} · {data}
          </div>
          {/* Niente scheletro di caricamento: il profilo è già scelto prima di
              arrivare qui, e il nome di chi si è è la cosa che deve comparire
              per prima. Con una credenziale per due coach, sapere con quale
              dei due si sta lavorando viene prima dei turni. */}
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: '900', letterSpacing: '1px', lineHeight: 1, color: '#fff' }}>
            COACH <span style={{ color: 'var(--accento)' }}>{coach?.name?.toUpperCase()}</span>
          </div>
        </div>

        {invitoBio && !loading && <InvitoImpronta onAttiva={() => navigate('settings')} onNo={() => { rifiutaInvito(); setInvitoBio(false) }} />}

        {!riordina && <div style={etichetta}>I TUOI TURNI</div>}

        {/* In riordino il titolo dice cosa si sta facendo, e a destra c'è
            «Fine» — una parola, non un pulsante pieno. */}
        {riordina && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
              <div style={{ ...etichetta, marginBottom: 0, color: 'var(--accento)' }}>RIORDINA I TURNI</div>
              <button type="button" onClick={() => setRiordina(false)} style={{
                background: 'none', border: 'none', padding: '6px 0 6px 12px', color: 'var(--accento)',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1px', cursor: 'pointer',
              }}>Fine</button>
            </div>
            <div style={{ color: 'var(--testo-debole)', fontSize: '13px', lineHeight: 1.45, marginBottom: '12px' }}>
              Tieni premuto ≡ e trascina. L&apos;ordine si salva da solo e vale anche in TURNI e SCHEDE.
            </div>
          </>
        )}

        {loading && <ScheletroSchede righe={3} />}

        {!loading && turni.length === 0 && (
          <div style={vuoto}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>◷</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '19px', fontWeight: '700', color: 'var(--testo-forte)', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Non hai ancora nessun turno
            </div>
            <div style={{ color: 'var(--testo-debole)', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px' }}>
              Un turno è una fascia oraria con le persone che ci vengono — per esempio «09:00 — Femminile».
              Si comincia da lì.
            </div>
            <button onClick={() => navigate('turns')} style={pulsanteVuoto}>+ CREA IL PRIMO TURNO</button>
          </div>
        )}

        {!loading && riordina && (
          <RiordinaTurni turni={turni} schede={schede} occupato={spostando} onSposta={muovi} />
        )}

        {!loading && !riordina && turni.map((turno, i) => {
          const attive = schede[turno.id] || []
          const gruppo = atlete[turno.id] || []
          const fuori = senzaScheda(gruppo, attive, assegnazioni).length
          // Un ospite senza scheda attiva non ha niente da aprire: resta
          // visibile dentro il turno, fra gli ospiti di oggi, ma non qui.
          const ospitiQui = (ospiti[turno.id] || []).filter(g => g.scheda)
          // Vista per atleta: una card sola per turno, e dentro l'elenco delle
          // persone. Niente card «↳ ANCHE» né «↳ OSPITE»: schede e ospiti
          // stanno tutti in quell'elenco.
          if (perAtleta) return (
            <div key={turno.id} className={`fadeUp-${Math.min(i + 1, 3)}`}>
              <CardTurno
                turno={turno}
                scheda={attive[0] || null}
                altreSchede={attive.slice(1).map(s => s.name)}
                atlete={gruppo}
                senzaScheda={fuori}
                onApri={() => navigate('turn-atleti', { turn: turno })}
              />
            </div>
          )

          return (
            <div key={turno.id} className={`fadeUp-${Math.min(i + 1, 3)}`}>
              {(attive.length ? attive : [null]).map((scheda, k) => (
                <CardTurno
                  key={k}
                  turno={turno}
                  scheda={scheda}
                  atlete={scheda ? personeDellaScheda(scheda, gruppo, assegnazioni) : gruppo}
                  mostraOrario={k === 0}
                  // Sulle schede successive il conteggio sarebbe una ripetizione
                  // — a meno che la scheda sia per poche persone: allora è
                  // proprio l'informazione che distingue le due card.
                  mostraConteggio={k === 0 || assegnazioni[scheda?.id]?.size > 0}
                  senzaScheda={k === 0 ? fuori : 0}
                  onApri={() => navigate('turn', { turn: turno, cycle: scheda })}
                />
              ))}
              {ospitiQui.map(g => (
                <CardTurno
                  key={`ospiti-${g.scheda.id}`}
                  turno={turno}
                  scheda={g.scheda}
                  ospiti={g.persone.map(p => `${p.name} ${p.surname}`)}
                  provenienza={turnoDOrigine(g.persone[0])}
                  mostraOrario={false}
                  mostraConteggio={false}
                  onApri={() => navigate('turn', {
                    turn: turno, cycle: g.scheda,
                    soloAtleti: g.persone.map(p => p.id),
                    sottotitolo: `Ospite · ${g.scheda.name}`,
                  })}
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
        i dati di tutte le persone.
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

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
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
