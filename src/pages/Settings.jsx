import { useState, useEffect } from 'react'
import { IconaOcchio } from '../components/Icone'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { biometriaDisponibile, bloccoAttivo, attivaBlocco, disattivaBlocco, MINUTI_RIBLOCCO } from '../lib/biometria'
import { vistaTurni, impostaVistaTurni, PER_ATLETA, PER_ESERCIZIO } from '../lib/vista'
import { capacita } from '../lib/capacita'
import { EMOJI_COACH } from '../lib/avatarCoach'
import { caricaFoto, togliFoto } from '../lib/foto'
import AvatarCoach from '../components/AvatarCoach'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session, coach, cambiaCoach, aggiornaCoach, ricaricaProfili }) {
  const [stats, setStats] = useState({ turns: 0, clients: 0 })
  const [view, setView] = useState('main')
  const [coachName, setCoachName] = useState(coach.name || '')
  // La vista e del PROFILO: Sandro la vuole per atleta, Manu no, e dalla
  // credenziale unica in poi i due condividono l'accesso ma non questa scelta.
  const [vista, setVista] = useState(() => vistaTurni(coach))
  // La scelta dell'emoji compare solo se la colonna esiste davvero: prima
  // della migrazione resta nascosta e ognuno vede la propria iniziale.
  const [emojiDisponibile, setEmojiDisponibile] = useState(false)
  const [salvoEmoji, setSalvoEmoji] = useState(false)
  const [vistaSuProfilo, setVistaSuProfilo] = useState(false)
  const [fotoDisponibile, setFotoDisponibile] = useState(false)
  const [salvoFoto, setSalvoFoto] = useState(false)
  const [nuovoCoach, setNuovoCoach] = useState('')
  const [coachAggiunto, setCoachAggiunto] = useState('')

  async function cambiaVista(valore) {
    // Sul profilo quando si puo: cosi la scelta segue il coach su telefono,
    // tablet e computer invece di doverla riaccendere su ognuno. Finche la
    // colonna non c'e, resta nel telefono come prima.
    if (vistaSuProfilo) {
      const { error } = await run(
        supabase.from('coaches').update({ vista: valore }).eq('id', coach.id),
        'Scelta non salvata.')
      if (error) return
      aggiornaCoach({ vista: valore })
    } else {
      impostaVistaTurni(coach.id, valore)
    }
    setVista(valore)
    notifyOk(valore === PER_ATLETA
      ? 'I turni si apriranno con l\'elenco delle persone'
      : 'I turni si apriranno per esercizio')
  }
  const [saving, setSaving] = useState(false)

  // Password change
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  // Sblocco biometrico (per dispositivo, non per account)
  const [bioDisponibile, setBioDisponibile] = useState(false)
  const [bioAttivo, setBioAttivo] = useState(() => bloccoAttivo(session.user.id))
  const [bioInCorso, setBioInCorso] = useState(false)

  useEffect(() => { loadData() }, [coach.id])
  // Cambiando profilo cambia anche la sua vista.
  useEffect(() => { setVista(vistaTurni(coach)) }, [coach])
  useEffect(() => { biometriaDisponibile().then(setBioDisponibile) }, [])
  useEffect(() => {
    capacita().then(c => {
      setEmojiDisponibile(!!c.emojiCoach)
      setVistaSuProfilo(!!c.vistaCoach)
      setFotoDisponibile(!!c.fotoCoach)
    })
  }, [])

  /** Tocca la stessa emoji per toglierla: niente pulsante in piu da cercare. */
  async function scegliEmoji(emoji) {
    const nuova = coach.emoji === emoji ? null : emoji
    setSalvoEmoji(true)
    const { error } = await run(
      supabase.from('coaches').update({ emoji: nuova }).eq('id', coach.id),
      'Immagine non salvata.')
    setSalvoEmoji(false)
    if (error) return
    aggiornaCoach({ emoji: nuova })
    notifyOk(nuova ? 'Immagine aggiornata' : 'Sei tornato alla tua iniziale')
  }

  async function toggleBiometria() {
    if (bioAttivo) {
      disattivaBlocco()
      setBioAttivo(false)
      notifyOk('Sblocco biometrico disattivato su questo dispositivo')
      return
    }
    setBioInCorso(true)
    const esito = await attivaBlocco(session.user.id, session.user.email, coach?.name)
    setBioInCorso(false)
    if (!esito.ok) { notifyError(esito.errore); return }
    setBioAttivo(true)
    notifyOk('Sblocco biometrico attivato su questo dispositivo')
  }

  async function loadData() {
    // Il profilo arriva gia scelto da App: qui restano solo i conteggi.
    const { data: t } = await run(
      supabase.from('turns').select('*').eq('coach_id', coach.id).order('time'),
      'Impossibile caricare i turni.')

    const allC = []
    if (t?.length) {
      // Qui c'era un for sequenziale: una query per turno, una dopo l'altra.
      // Ora è una sola per tutti i turni.
      const nomiTurni = Object.fromEntries(t.map(turn => [turn.id, turn.name]))
      const { data: clients } = await run(
        supabase.from('clients').select('*').in('turn_id', t.map(x => x.id)).eq('is_active', true),
        'Impossibile caricare gli atleti.'
      )
      ;(clients || []).forEach(cl => allC.push({ ...cl, turnName: nomiTurni[cl.turn_id] || '' }))
    }
    // Sort alphabetically by surname
    allC.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''))
    setStats({ turns: t?.length || 0, clients: allC.length })
  }

  async function saveCoachName() {
    if (!coachName.trim()) return
    setSaving(true)
    const { error } = await run(
      supabase.from('coaches').update({ name: coachName.trim() }).eq('id', coach.id),
      'Nome non salvato.'
    )
    setSaving(false)
    if (error) return
    // Il nome vive in App, che lo passa a tutte le schermate: va aggiornato
    // li, o la Home continuerebbe a salutare col nome vecchio.
    aggiornaCoach({ name: coachName.trim() })
    setView('main')
  }

  /**
   * Aggiunge un COLLEGA, cioè un profilo — non un accesso.
   *
   * La credenziale resta una sola: il coach nuovo entra con quella e tocca il
   * suo nome in CHI SEI?. Prima un profilo si creava solo dal pannello di
   * Supabase, e ogni collega nuovo passava da chi gestisce l'app.
   *
   * L'identificativo lo genera il database. L'email non si chiede: con un
   * accesso solo non vuole più dire niente, e chiederla sarebbe una domanda
   * senza risposta giusta.
   */
  async function scegliFoto(file) {
    if (!file) return
    setSalvoFoto(true)
    const { percorso, errore } = await caricaFoto(file, coach.id, coach.foto)
    if (errore) { setSalvoFoto(false); notifyError(errore); return }
    const { error } = await run(
      supabase.from('coaches').update({ foto: percorso }).eq('id', coach.id),
      'Foto caricata ma non collegata al profilo.')
    setSalvoFoto(false)
    if (error) return
    aggiornaCoach({ foto: percorso })
    notifyOk('Foto aggiornata')
  }

  async function rimuoviFoto() {
    setSalvoFoto(true)
    const { errore } = await togliFoto(coach.foto)
    if (errore) { setSalvoFoto(false); notifyError(errore); return }
    const { error } = await run(
      supabase.from('coaches').update({ foto: null }).eq('id', coach.id),
      'Foto tolta ma il profilo non si è aggiornato.')
    setSalvoFoto(false)
    if (error) return
    aggiornaCoach({ foto: null })
    notifyOk('Foto tolta')
  }

  async function salvaNuovoCoach() {
    const nome = nuovoCoach.trim()
    if (!nome) return
    setSaving(true)
    const { data, error } = await run(
      supabase.from('coaches').insert({ name: nome }).select().single(),
      'Profilo non creato. Se il problema resta, va lanciata la migrazione «aggiungi coach».'
    )
    setSaving(false)
    if (error || !data) return
    await ricaricaProfili?.()
    setNuovoCoach('')
    setCoachAggiunto(nome)
    notifyOk(`${nome} può entrare: trova il suo nome all'accesso`)
  }

  async function savePassword() {
    setPwdError('')
    if (newPwd.length < 6) { setPwdError('La password deve essere di almeno 6 caratteri.'); return }
    if (newPwd !== confirmPwd) { setPwdError('Le due password non coincidono.'); return }
    setSaving(true)
    // Re-authenticate first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email, password: currentPwd
    })
    if (signInError) { setPwdError('Password attuale errata.'); setSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) { setPwdError('Errore nel salvataggio. Riprova.'); setSaving(false); return }
    setSaving(false)
    setPwdSuccess(true)
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    setTimeout(() => { setPwdSuccess(false); setView('main') }, 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ── EDIT NAME ─────────────────────────────────────────────────────────────
  if (view === 'editName') return (
    <div style={page}>
      <TopBar title="MODIFICA NOME" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>NOME VISUALIZZATO</div>
        <input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Il tuo nome" style={inp} />
        <button onClick={saveCoachName} disabled={saving || !coachName.trim()} style={{ ...bigBtn, marginTop: '20px' }}>
          {saving ? 'SALVATAGGIO...' : '✓ SALVA'}
        </button>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── LA TUA IMMAGINE ───────────────────────────────────────────────────────
  // Foto ed emoji stanno insieme perché sono la stessa domanda — «cosa si
  // vede accanto al mio nome» — e tenerle in due posti diversi obbligherebbe
  // a ricordare dove sta quale.
  if (view === 'immagine') return (
    <div style={page}>
      <TopBar title="LA TUA IMMAGINE" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <AvatarCoach coach={coach} size={110} />
          <div style={{ color: 'var(--testo-debole)', fontSize: '13px' }}>
            Compare accanto al tuo nome quando si sceglie il coach.
          </div>
        </div>

        {fotoDisponibile && (
          <>
            <div style={fieldLabel}>UNA TUA FOTO</div>
            <label style={{ ...bigBtn, display: 'block', textAlign: 'center', opacity: salvoFoto ? 0.5 : 1, marginBottom: '10px' }}>
              {salvoFoto ? 'CARICO...' : coach.foto ? '📷 CAMBIA LA FOTO' : '📷 SCEGLI UNA FOTO'}
              <input type="file" accept="image/*" disabled={salvoFoto}
                onChange={e => { scegliFoto(e.target.files?.[0]); e.target.value = '' }}
                style={{ display: 'none' }} />
            </label>
            {coach.foto && (
              <button onClick={rimuoviFoto} disabled={salvoFoto} style={{
                width: '100%', background: 'transparent', border: '1px solid var(--bordo)',
                borderRadius: '4px', padding: '13px', color: 'var(--testo-medio)',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px',
                fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
              }}>TOGLI LA FOTO</button>
            )}
            <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', lineHeight: 1.4, marginTop: '8px' }}>
              La foto viene rimpicciolita sul telefono prima di partire: resta leggera
              anche col wifi della palestra.
            </div>
          </>
        )}

        {emojiDisponibile && (
          <>
            <div style={{ ...fieldLabel, marginTop: '26px' }}>
              {coach.foto ? 'OPPURE UN\'EMOJI, SE TOGLI LA FOTO' : 'OPPURE UN\'EMOJI'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EMOJI_COACH.map(e => {
                const scelta = coach.emoji === e
                return (
                  <button key={e} type="button" disabled={salvoEmoji}
                    onClick={() => scegliEmoji(e)}
                    aria-label={scelta ? `${e}, scelta` : e}
                    style={{
                      width: '46px', height: '46px', borderRadius: '50%', fontSize: '24px', lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: scelta ? 'var(--acc-riempimento-forte)' : 'var(--sup-alta)',
                      border: `1px solid ${scelta ? 'var(--accento)' : 'transparent'}`,
                      opacity: salvoEmoji ? 0.5 : 1, cursor: 'pointer', padding: 0,
                    }}>{e}</button>
                )
              })}
            </div>
            <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', lineHeight: 1.4, marginTop: '10px' }}>
              Tocca quella che hai già per toglierla e tornare alla tua iniziale.
            </div>
          </>
        )}
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── COME SI APRONO I TURNI ────────────────────────────────────────────────
  if (view === 'vista') return (
    <div style={page}>
      <TopBar title="COME SI APRONO I TURNI" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[[PER_ESERCIZIO, 'PER ESERCIZIO'], [PER_ATLETA, 'PER ATLETA']].map(([valore, etichetta]) => {
            const attiva = vista === valore
            return (
              <button key={valore} type="button" onClick={() => cambiaVista(valore)} style={{
                flex: 1, padding: '14px 8px', borderRadius: '6px', cursor: 'pointer',
                background: attiva ? 'var(--accento)' : 'var(--sup-alta)',
                border: `1px solid ${attiva ? 'var(--accento)' : 'var(--bordo)'}`,
                color: attiva ? '#fff' : 'var(--testo-medio)',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px',
                fontWeight: '800', letterSpacing: '1px',
              }}>{etichetta}</button>
            )
          })}
        </div>
        <div style={{ color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.55 }}>
          {vista === PER_ATLETA
            ? 'Tocchi il turno e vedi l\'elenco delle persone. Tocchi una persona e si apre la sua scheda. Comodo se nello stesso turno seguono schede diverse.'
            : 'Tocchi il turno e vedi un esercizio alla volta, con sotto tutte le persone che lo fanno. Comodo se seguono tutti la stessa scheda.'}
        </div>
        <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', lineHeight: 1.45, marginTop: '16px' }}>
          {vistaSuProfilo
            ? 'Vale solo per te, su tutti i tuoi dispositivi.'
            : 'Vale solo per te, e solo su questo dispositivo.'}
        </div>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── AGGIUNGI COACH ────────────────────────────────────────────────────────
  if (view === 'addCoach') return (
    <div style={page}>
      <TopBar title="AGGIUNGI COACH" onBack={() => { setView('main'); setCoachAggiunto(''); setNuovoCoach('') }} />
      <div style={scroll}>
        <div style={{ color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.5, marginBottom: '20px' }}>
          Il coach nuovo entra con <strong>la stessa password</strong> che usate voi,
          e all'accesso tocca il suo nome. Non serve creargli niente altro.
        </div>

        <div style={fieldLabel}>NOME DEL COACH</div>
        <input value={nuovoCoach} onChange={e => setNuovoCoach(e.target.value)}
          placeholder="es. Giulia" style={inp} autoFocus />
        <button onClick={salvaNuovoCoach} disabled={saving || !nuovoCoach.trim()}
          style={{ ...bigBtn, marginTop: '20px', opacity: !nuovoCoach.trim() ? 0.3 : 1 }}>
          {saving ? 'CREO IL PROFILO...' : '✓ AGGIUNGI'}
        </button>

        {coachAggiunto && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'var(--acc-fondo)', border: '1px solid var(--acc-riempimento-forte)' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', color: 'var(--accento)', letterSpacing: '1px', marginBottom: '6px' }}>
              ORA {coachAggiunto.toUpperCase()} PUÒ ENTRARE
            </div>
            <div style={{ color: 'var(--testo-forte)', fontSize: '14px', lineHeight: 1.5 }}>
              Basta che apra l'app, entri con la password della palestra e tocchi
              il suo nome. Parte senza turni: li crea da TURNI.
            </div>
          </div>
        )}

        <div style={{ color: 'var(--testo-debole)', fontSize: '13px', lineHeight: 1.5, marginTop: '22px' }}>
          Un nome sbagliato si corregge entrando in quel profilo e usando MODIFICA.
          Un profilo non si può eliminare da qui: dietro ci sono turni e atlete,
          e non deve poterli staccare un tocco di troppo.
        </div>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  if (view === 'changePassword') return (
    <div style={page}>
      <TopBar title="MODIFICA PASSWORD" onBack={() => { setView('main'); setPwdError(''); setPwdSuccess(false) }} />
      <div style={scroll}>
        {pwdSuccess ? (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ color: 'var(--ok)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>PASSWORD AGGIORNATA!</div>
          </div>
        ) : (
          <>
            <div style={fieldLabel}>PASSWORD ATTUALE</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input type={showPwd ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                placeholder="Password attuale" style={{ ...inp, paddingRight: '48px' }} />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtn}><IconaOcchio barrato={!showPwd} /></button>
            </div>

            <div style={fieldLabel}>NUOVA PASSWORD</div>
            <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="Minimo 6 caratteri" style={{ ...inp, marginBottom: '16px' }} />

            <div style={fieldLabel}>CONFERMA NUOVA PASSWORD</div>
            <input type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Ripeti la nuova password" style={{ ...inp, marginBottom: '8px' }} />

            {pwdError && <div style={{ color: 'var(--errore)', fontSize: '13px', marginBottom: '12px', paddingLeft: '2px' }}>{pwdError}</div>}

            <button onClick={savePassword} disabled={saving || !currentPwd || !newPwd || !confirmPwd}
              style={{ ...bigBtn, marginTop: '16px', opacity: !currentPwd || !newPwd || !confirmPwd ? 0.3 : 1 }}>
              {saving ? 'SALVATAGGIO...' : '✓ AGGIORNA PASSWORD'}
            </button>
          </>
        )}
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── MAIN SETTINGS ─────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <TopBar title="IMPOSTAZIONI" />
      <div style={scroll}>

        {/* Profile card */}
        <div style={{ background: 'var(--acc-fondo)', border: '1px solid var(--acc-riempimento-forte)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <AvatarCoach coach={coach} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>{coach?.name?.toUpperCase()}</div>
                <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.email}</div>
              </div>
            </div>
            <button onClick={() => setView('editName')} style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: 'var(--testo-chiaro)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '7px 12px', borderRadius: '3px' }}>
              MODIFICA
            </button>
          </div>

          {/* Stats — clickable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={() => navigate('turns')}
              style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px', border: '1px solid var(--sup-alta)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>TURNI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.turns}</div>
              <div style={{ color: 'var(--accento)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '1px' }}>VEDI TURNI →</div>
            </button>
            <button onClick={() => navigate('athletes')}
              style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px', border: '1px solid var(--sup-alta)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>ATLETI ATTIVI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.clients}</div>
              <div style={{ color: 'var(--accento)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '1px' }}>VEDI LISTA →</div>
            </button>
          </div>
        </div>

        {/* ── Le righe ─────────────────────────────────────────────────
            Prima qui c'era una pila di scatole, una per funzione, ognuna con
            il suo titolo, la sua spiegazione e i suoi pulsanti: cresciuta
            aggiungendone una alla volta, era diventata illeggibile.

            Adesso sono righe tutte uguali sotto tre titoletti, e ogni riga
            dice a destra come sta messa adesso. Le cose ingombranti — la
            griglia delle emoji, la scelta della vista — sono andate ognuna
            nella sua schermata, dove hanno lo spazio per spiegarsi. */}

        <div style={titoloSezione}>IL TUO PROFILO</div>
        {(emojiDisponibile || fotoDisponibile) && (
          <Riga etichetta="La tua immagine"
            valore={coach.foto ? 'Foto' : coach.emoji ? coach.emoji : 'Iniziale'}
            onClick={() => setView('immagine')} />
        )}
        <Riga etichetta="Nome visualizzato" valore={coach.name}
          onClick={() => setView('editName')} />
        <Riga etichetta="Come si aprono i turni"
          valore={vista === PER_ATLETA ? 'Per atleta' : 'Per esercizio'}
          onClick={() => setView('vista')} />

        <div style={titoloSezione}>LA PALESTRA</div>
        {cambiaCoach && (
          <Riga etichetta="Cambia coach" valore={coach.name} onClick={cambiaCoach} />
        )}
        <Riga etichetta="Aggiungi coach" onClick={() => setView('addCoach')} />

        {bioDisponibile && (
          <>
            <div style={titoloSezione}>QUESTO DISPOSITIVO</div>
            <div style={{ ...riga, cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={etichettaRiga}>Sblocco con l'impronta</div>
                <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', marginTop: '3px', lineHeight: 1.35 }}>
                  {bioAttivo
                    ? `Si riblocca dopo ${MINUTI_RIBLOCCO} minuti in secondo piano.`
                    : 'Vale solo qui: va attivato su ogni telefono che usi.'}
                </div>
              </div>
              <button onClick={toggleBiometria} disabled={bioInCorso} style={{
                flexShrink: 0,
                background: bioAttivo ? 'rgba(239,68,68,0.12)' : 'var(--accento)',
                border: bioAttivo ? '1px solid rgba(239,68,68,0.35)' : 'none',
                borderRadius: '4px', padding: '9px 14px',
                color: bioAttivo ? 'rgba(239,68,68,0.9)' : '#fff',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                fontWeight: '700', letterSpacing: '1px',
                opacity: bioInCorso ? 0.5 : 1, cursor: 'pointer',
              }}>
                {bioInCorso ? '...' : bioAttivo ? 'DISATTIVA' : 'ATTIVA'}
              </button>
            </div>
          </>
        )}

        <div style={titoloSezione}>ACCOUNT</div>
        <Riga etichetta="Modifica password" onClick={() => setView('changePassword')} />

        {/* Logout */}
        <button onClick={signOut} style={{ ...bigBtn, background: 'transparent', border: '1px solid var(--acc-bordo)', color: 'var(--acc-testo-tenue)', marginTop: '8px' }}>
          ESCI DALL'ACCOUNT
        </button>
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

/** Una riga delle impostazioni: cosa è, com'è messa adesso, e si apre. */
function Riga({ etichetta, valore, onClick }) {
  return (
    <button type="button" onClick={onClick} style={riga}>
      <span style={{ ...etichettaRiga, flex: 1, minWidth: 0 }}>{etichetta}</span>
      {valore && (
        <span style={{
          color: 'var(--testo-medio)', fontSize: '14px', flexShrink: 0,
          maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{valore}</span>
      )}
      <span style={{ color: 'var(--testo-fioco)', fontSize: '17px', flexShrink: 0 }}>›</span>
    </button>
  )
}

const titoloSezione = {
  color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px',
  fontFamily: 'Barlow Condensed, sans-serif', margin: '22px 0 8px 2px',
}

const riga = {
  width: '100%', background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderRadius: '8px', padding: '15px 16px', marginBottom: '7px',
  display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', cursor: 'pointer',
}

const etichettaRiga = {
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700',
  color: '#fff', letterSpacing: '0.5px',
}

const page = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const fieldLabel = { color: 'var(--testo-debole)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: 'var(--accento)', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
const eyeBtn = { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--testo-debole)', fontSize: '18px', lineHeight: 1, padding: '4px' }
