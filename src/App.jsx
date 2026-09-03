import { useState, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Login from './pages/Login'
import Home from './pages/Home'
import TurnDetail from './pages/TurnDetail'
import CyclesList from './pages/CyclesList'
import CycleForm from './pages/CycleForm'
import CycleShare from './pages/CycleShare'
import Settings from './pages/Settings'
import Turns from './pages/Turns'
import ChangePassword from './pages/ChangePassword'
import AthleteProfile from './pages/AthleteProfile'
import Athletes from './pages/Athletes'
import Notifier from './components/Notifier'
import IndicatoreCoda from './components/IndicatoreCoda'
import BloccoBiometrico from './components/BloccoBiometrico'
import { bloccoAttivo, disattivaBlocco, MINUTI_RIBLOCCO } from './lib/biometria'
import { avviaSincronizzazioneAutomatica } from './lib/coda'
import { supabase } from './supabaseClient'

// Da app installata non c'è nessuna pagina precedente a cui tornare: la
// cronologia ha solo la voce di caricamento più la nostra sentinella.
const puoUscire = () =>
  !window.matchMedia('(display-mode: standalone)').matches &&
  !window.navigator.standalone &&
  window.history.length > 2

// Ripristino della posizione dopo un ricaricamento.
//
// Non è routing con URL veri: quello richiederebbe di far ricaricare a ogni
// pagina i propri dati partendo dai soli id presenti nell'indirizzo, cioè una
// ristrutturazione di quattro pagine. Qui salviamo lo stack di navigazione, che
// risolve il sintomo che si sente davvero — ricarico e mi ritrovo in home — con
// una frazione del rischio. Restano fuori solo segnalibri e link diretti, che su
// una PWA riservata alle coach non servono a nessuno.
//
// sessionStorage e non localStorage: la posizione deve sopravvivere a un
// ricaricamento, non a una riapertura dell'app il giorno dopo.
const CHIAVE_NAVIGAZIONE = 'gymcoach.navigazione'
const HOME = [{ page: 'home', params: {} }]

function leggiNavigazione() {
  try {
    const grezzo = sessionStorage.getItem(CHIAVE_NAVIGAZIONE)
    if (!grezzo) return null
    const dati = JSON.parse(grezzo)
    // Se il formato salvato non è quello atteso (versione vecchia, dato
    // corrotto) si riparte da capo invece di far esplodere l'app all'avvio.
    if (!Array.isArray(dati) || !dati.length) return null
    if (!dati.every(v => v && typeof v.page === 'string' && typeof v.params === 'object')) return null
    return dati
  } catch { return null }
}

function scriviNavigazione(stack) {
  try { sessionStorage.setItem(CHIAVE_NAVIGAZIONE, JSON.stringify(stack)) } catch { /* modalità privata */ }
}

function dimenticaNavigazione() {
  try { sessionStorage.removeItem(CHIAVE_NAVIGAZIONE) } catch { /* niente da fare */ }
}

const INITIAL_IS_RECOVERY = window.location.hash.includes('type=recovery')
if (INITIAL_IS_RECOVERY) {
  window.history.replaceState(null, '', window.location.pathname)
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(INITIAL_IS_RECOVERY)
  const [stack, setStack] = useState(() => leggiNavigazione() || HOME)
  const [showExitModal, setShowExitModal] = useState(false)
  const [sbloccato, setSbloccato] = useState(false)
  const stackRef = useRef(stack)
  const nascostaDa = useRef(null)

  // PWA update — safe destructuring with fallback
  const {
    needRefresh: [needRefresh = false] = [],
    updateServiceWorker = () => {},
  } = useRegisterSW({
    onRegistered() { console.log('SW ok') },
    onRegisterError() {},
  }) || {}

  useEffect(() => {
    stackRef.current = stack
    scriviNavigazione(stack)
  }, [stack])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        window.history.replaceState(null, '', window.location.pathname)
      }
      setSession(session)
      if (!session) {
        // La posizione salvata va dimenticata all'uscita, altrimenti chi entra
        // dopo si ritroverebbe dentro la schermata dell'account precedente.
        dimenticaNavigazione()
        setStack(HOME)
        setIsRecovery(false)
        setSbloccato(false) // al prossimo accesso il lucchetto torna attivo
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (INITIAL_IS_RECOVERY) return
    window.history.pushState({ gymcoach: true }, '')
    const handlePopState = () => {
      const current = stackRef.current
      if (current.length > 1) {
        setStack(prev => prev.slice(0, -1))
        window.history.pushState({ gymcoach: true }, '')
      } else {
        window.history.pushState({ gymcoach: true }, '')
        setShowExitModal(true)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Riblocco automatico: se l'app resta in secondo piano più di qualche minuto,
  // alla riapertura richiede di nuovo l'impronta. Senza questo il lucchetto
  // varrebbe solo al primo avvio e poi mai più.
  useEffect(() => {
    const onVisibilita = () => {
      if (document.visibilityState === 'hidden') {
        nascostaDa.current = Date.now()
        return
      }
      if (nascostaDa.current && Date.now() - nascostaDa.current > MINUTI_RIBLOCCO * 60_000) {
        setSbloccato(false)
      }
      nascostaDa.current = null
    }
    document.addEventListener('visibilitychange', onVisibilita)
    return () => document.removeEventListener('visibilitychange', onVisibilita)
  }, [])

  // I carichi rimasti in coda partono da soli: al ritorno della rete, alla
  // riapertura dell'app e comunque ogni minuto.
  useEffect(() => avviaSincronizzazioneAutomatica(session?.user?.id), [session?.user?.id])

  const navigate = (page, params = {}) => setStack(prev => [...prev, { page, params }])
  const goBack = () => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  const goHome = () => setStack(HOME)

  if (loading) return <Splash />

  if (isRecovery && session) {
    return <><ChangePassword onDone={() => setIsRecovery(false)} /><Notifier /></>
  }

  if (!session) return <><Login /><Notifier /></>

  // Lucchetto biometrico. Sta dopo il controllo del recupero password: chi
  // arriva dal link via email non deve trovarsi sbarrato da un sensore che
  // magari ha registrato su un altro dispositivo.
  if (!sbloccato && bloccoAttivo(session.user.id)) {
    return (
      <>
        <BloccoBiometrico
          nomeCoach={session.user.email}
          onSbloccato={() => setSbloccato(true)}
          onEsci={() => {
            // Uscire toglie anche il lucchetto da questo dispositivo, altrimenti
            // chi ha un sensore che non lo riconosce più resta in un ciclo chiuso:
            // esce, rientra con la password e ritrova il blocco.
            // Non indebolisce niente — per rientrare serve comunque la password,
            // che è una prova d'identità più forte dell'impronta — e il lucchetto
            // si riattiva dalle impostazioni in un tocco.
            disattivaBlocco()
            supabase.auth.signOut()
          }}
        />
        <Notifier />
      </>
    )
  }

  const current = stack[stack.length - 1]
  const props = { navigate, goBack, goHome, params: current.params, session }

  const pages = {
    home: Home,
    turn: TurnDetail,
    cycles: CyclesList,
    'cycle-form': CycleForm,
    'cycle-share': CycleShare,
    settings: Settings,
    turns: Turns,
    athletes: Athletes,
    'athlete-profile': AthleteProfile,
  }

  const Page = pages[current.page] || Home

  return (
    <>
      <Page {...props} />
      <Notifier />
      <IndicatoreCoda userId={session.user.id} />

      {/* PWA update banner */}
      {needRefresh && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '16px', right: '16px',
          background: '#1a1a1a', border: '1px solid rgba(217,92,26,0.5)',
          borderRadius: '12px', padding: '14px 16px', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)'
        }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
              🆕 Aggiornamento disponibile
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>
              Tocca AGGIORNA per installare la nuova versione
            </div>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{ background: '#D95C1A', border: 'none', borderRadius: '6px', padding: '10px 16px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', flexShrink: 0, cursor: 'pointer' }}>
            AGGIORNA
          </button>
        </div>
      )}

      {/* Exit modal */}
      {showExitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '28px 24px', width: '100%', maxWidth: '320px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }}>USCIRE DA GYMCOACH?</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px' }}>
              {puoUscire()
                ? "Sei sicura di voler uscire dall'app?"
                : 'Sei già alla schermata iniziale. Per chiudere GymCoach usa il gesto o il tasto del telefono.'}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowExitModal(false)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '13px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                {puoUscire() ? 'RESTA' : 'OK'}
              </button>
              {/* Il pulsante compariva sempre, ma nella PWA installata (o in una
                  scheda nuova) history.go(-2) è fuori range e non succedeva nulla. */}
              {puoUscire() && (
                <button onClick={() => { setShowExitModal(false); window.history.go(-2) }}
                  style={{ flex: 1, background: 'rgba(217,92,26,0.15)', border: '1px solid rgba(217,92,26,0.4)', borderRadius: '6px', padding: '13px', color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                  ESCI
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Splash() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a' }}>
      <img src="/icon-512.png" alt="GymCoach" style={{ width: '160px', borderRadius: '28px' }} />
    </div>
  )
}
