import { useState, useEffect, useRef } from 'react'
import {
  TIPI, tipoDi, STATI, ORDINE_STATI, aperta, ordina, novitaPer, testoSegnalazioni,
  TESTO_MINIMO, TESTO_MASSIMO, RISPOSTA_MASSIMA,
  sonoGestore, impostaGestore, ultimaVisita, segnaVisita, leggiBozza, salvaBozza, dimenticaBozza,
  caricaSegnalazioni, inviaSegnalazione, aggiornaSegnalazione, ancheIo, indirizzoFotoSegnalazione,
} from '../lib/segnalazioni'
import { quandoCorto } from '../lib/registroErrori'
import { copiaNegliAppunti } from '../lib/appunti'
import { notifyOk, notifyError } from '../lib/notify'
import { comePulsante } from '../lib/stile'
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

/**
 * SEGNALAZIONI — da IMPOSTAZIONI e dal fondo della Home.
 *
 * Il posto dove i coach dicono cosa non va, cosa vorrebbero e cosa
 * cambierebbero, invece di un audio su WhatsApp (vedi segnalazioni.js).
 * Tre schermate: l'elenco, «scrivi», e il foglio di una segnalazione.
 * Sul telefono del gestore il foglio ha anche i tasti per rispondere.
 */

// I colori degli stati: arancione per chi deve ancora guardarla, giallo
// mentre ci si lavora, verde quando è fatta, grigio quando non si fa.
const COLORE_STATO = {
  nuova: { sfondo: 'var(--acc-riempimento)', bordo: 'var(--acc-bordo-forte)', testo: 'var(--accento)' },
  letta: { sfondo: 'var(--sup-alta)', bordo: 'var(--bordo-forte)', testo: 'var(--testo-forte)' },
  in_corso: { sfondo: 'rgba(234,179,8,0.12)', bordo: 'rgba(234,179,8,0.45)', testo: 'var(--attenzione)' },
  fatta: { sfondo: 'rgba(34,197,94,0.12)', bordo: 'rgba(34,197,94,0.45)', testo: 'var(--ok)' },
  no: { sfondo: 'var(--sup)', bordo: 'var(--bordo)', testo: 'var(--testo-medio)' },
}

export default function Segnalazioni({ navigate, goBack, goHome, coach, coaches = [] }) {
  const [vista, setVista] = useState('elenco') // 'elenco' | 'scrivi' | 'grazie'
  const [righe, setRighe] = useState(null)
  const [problema, setProblema] = useState(false)
  const [chiuseAperte, setChiuseAperte] = useState(false)
  const [aperta_, setAperta] = useState(null) // la segnalazione nel foglio
  const [gestore, setGestore] = useState(sonoGestore)
  const [confermaGestore, setConfermaGestore] = useState(false)
  // Le novità di prima di questa visita: si evidenziano, poi la visita si segna.
  const [evidenziate, setEvidenziate] = useState(() => new Set())

  // ── scrivere ──
  const bozza = useRef(leggiBozza())
  const [tipo, setTipo] = useState(bozza.current?.tipo || null)
  const [testo, setTesto] = useState(bozza.current?.testo || '')
  const [foto, setFoto] = useState(null)        // il file scelto
  const [anteprima, setAnteprima] = useState(null)
  const [invio, setInvio] = useState(false)

  useEffect(() => { ricarica(true) }, [])
  useEffect(() => { salvaBozza({ tipo, testo }) }, [tipo, testo])
  useEffect(() => () => { if (anteprima) URL.revokeObjectURL(anteprima) }, [anteprima])

  async function ricarica(primaVolta = false) {
    const { righe: r, errore } = await caricaSegnalazioni()
    setProblema(!!errore)
    setRighe(r)
    if (primaVolta && !errore) {
      const nuove = new Set(novitaPer(r, { coachId: coach?.id, gestore: sonoGestore(), visita: ultimaVisita() }).map(s => s.id))
      setEvidenziate(nuove)
      // Una risposta su una segnalazione chiusa non deve restare nascosta
      // dentro «CHIUSE»: l'elenco si apre da solo.
      if (r.some(s => !aperta(s) && nuove.has(s.id))) setChiuseAperte(true)
      segnaVisita()
    }
  }

  function scegliFoto(file) {
    if (anteprima) URL.revokeObjectURL(anteprima)
    setFoto(file || null)
    setAnteprima(file ? URL.createObjectURL(file) : null)
  }

  async function invia() {
    if (!tipo || testo.trim().length < TESTO_MINIMO || invio) return
    setInvio(true)
    const { riga, errore } = await inviaSegnalazione({ tipo, testo, coach, foto })
    setInvio(false)
    if (errore) { notifyError(errore); return }
    dimenticaBozza()
    bozza.current = null
    setTipo(null); setTesto(''); scegliFoto(null)
    if (riga) setRighe(prima => [riga, ...(prima || []).filter(s => s.id !== riga.id)])
    setVista('grazie')
    ricarica()
  }

  /** Il gestore apre una segnalazione nuova: diventa «letta» da sola. */
  async function apri(s) {
    setAperta(s)
    if (gestore && s.stato === 'nuova') {
      const { errore } = await aggiornaSegnalazione(s.id, { stato: 'letta' })
      if (!errore) aggiornaQui(s.id, { stato: 'letta' })
    }
  }

  function aggiornaQui(id, modifiche) {
    const conOra = 'stato' in modifiche || 'risposta' in modifiche ? { ...modifiche, aggiornata: new Date().toISOString() } : modifiche
    setRighe(prima => (prima || []).map(s => (s.id === id ? { ...s, ...conOra } : s)))
    setAperta(prima => (prima?.id === id ? { ...prima, ...conOra } : prima))
  }

  async function copiaAperte() {
    const nomi = Object.fromEntries(coaches.map(c => [c.id, c.name]))
    const fatto = await copiaNegliAppunti(testoSegnalazioni(righe, nomi))
    if (fatto) notifyOk('Copiate: incollale dove vuoi')
    else notifyError('Non sono riuscito a copiarle.')
  }

  // ── SCRIVI ────────────────────────────────────────────────────────────────
  if (vista === 'scrivi') {
    const scelto = tipo ? tipoDi(tipo) : null
    const pronto = !!tipo && testo.trim().length >= TESTO_MINIMO
    return (
      <div style={pagina}>
        <TopBar title="NUOVA SEGNALAZIONE" onBack={() => setVista('elenco')} />
        <div style={scorrimento}>
          <div style={titolo}>DI COSA SI TRATTA?</div>
          <div role="radiogroup" aria-label="Di cosa si tratta" style={{ display: 'grid', gap: '8px' }}>
            {TIPI.map(t => {
              const acceso = tipo === t.id
              return (
                <button key={t.id} type="button" role="radio" aria-checked={acceso} onClick={() => setTipo(t.id)} style={{
                  ...comePulsante, display: 'flex', alignItems: 'center', gap: '14px', minHeight: '60px', padding: '10px 16px',
                  borderRadius: '8px', cursor: 'pointer',
                  background: acceso ? 'var(--acc-riempimento)' : 'var(--sup)',
                  border: `1px solid ${acceso ? 'var(--accento)' : 'var(--sup-alta)'}`,
                }}>
                  <span aria-hidden="true" style={{ fontSize: '28px', lineHeight: 1 }}>{t.icona}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '800', letterSpacing: '0.5px', color: acceso ? 'var(--accento)' : '#fff' }}>
                    {t.nome.toUpperCase()}
                  </span>
                  {acceso && <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--accento)', fontSize: '20px' }}>✓</span>}
                </button>
              )
            })}
          </div>

          {scelto && (<>
            <label htmlFor="testo-segnalazione" style={{ ...titolo, display: 'block', marginTop: '22px' }}>
              {scelto.domanda.toUpperCase()}
            </label>
            <textarea id="testo-segnalazione" value={testo} maxLength={TESTO_MASSIMO} rows={6}
              onChange={e => setTesto(e.target.value)} placeholder={scelto.esempio}
              style={campo} />
            <div style={{ ...nota, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ fontSize: '18px' }}>🎤</span>
              <span>Non hai voglia di scrivere? Tocca il <strong>microfono della tastiera</strong> e parla: il testo si scrive da solo.</span>
            </div>

            <div style={{ ...titolo, marginTop: '20px' }}>UNA FOTO DELLO SCHERMO (SE SERVE)</div>
            {!anteprima && (
              <label style={pulsanteFoto}>
                📷 AGGIUNGI UNA FOTO
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { scegliFoto(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            )}
            {anteprima && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={anteprima} alt="La foto che stai mandando" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--bordo)' }} />
                <button type="button" onClick={() => scegliFoto(null)} style={{ ...comePulsante, minHeight: '44px', color: 'var(--testo-medio)', fontSize: '15px', cursor: 'pointer' }}>
                  Non mandarla
                </button>
              </div>
            )}
            <div style={nota}>Per fare la foto dello schermo: i due tasti del telefono insieme. Poi la scegli da qui.</div>

            <button type="button" onClick={invia} disabled={!pronto || invio}
              style={{ ...grande, marginTop: '22px', opacity: pronto && !invio ? 1 : 0.35 }}>
              {invio ? 'INVIO…' : '✓ INVIA'}
            </button>
            {!pronto && <div style={{ ...nota, textAlign: 'center' }}>Scrivi almeno qualche parola.</div>}
          </>)}
        </div>
        <BottomNav active="settings" navigate={navigate} goHome={goHome} />
      </div>
    )
  }

  // ── GRAZIE ────────────────────────────────────────────────────────────────
  if (vista === 'grazie') return (
    <div style={pagina}>
      <TopBar title="SEGNALAZIONI" onBack={() => setVista('elenco')} />
      <div style={{ ...scorrimento, textAlign: 'center', paddingTop: '48px' }}>
        <div aria-hidden="true" style={{ fontSize: '52px' }}>📮</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginTop: '10px' }}>
          INVIATA, GRAZIE!
        </div>
        <p style={{ color: 'var(--testo-forte)', fontSize: '16px', lineHeight: 1.5, margin: '12px auto 0', maxWidth: '320px' }}>
          L'ha ricevuta chi sistema l'app. Quando risponde lo vedi qui, in
          SEGNALAZIONI, e in Home.
        </p>
        <button type="button" onClick={() => setVista('elenco')} style={{ ...grande, marginTop: '28px' }}>VEDI LE SEGNALAZIONI</button>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── ELENCO ────────────────────────────────────────────────────────────────
  const { aperte, chiuse } = ordina(righe)
  const nomeDi = id => coaches.find(c => c.id === id)?.name
  return (
    <div style={pagina}>
      <TopBar title="SEGNALAZIONI" subtitle="Cosa non va, idee, cosa cambiare" onBack={goBack} />
      <div style={scorrimento}>
        <button type="button" onClick={() => setVista('scrivi')} style={grande}>＋ SCRIVI UNA SEGNALAZIONE</button>
        <p style={{ ...nota, marginTop: '8px' }}>
          La legge chi sistema l'app, e qui vedi a che punto è. Al posto degli audio su WhatsApp.
        </p>

        {gestore && righe?.some(aperta) && (
          <button type="button" onClick={copiaAperte} style={{ ...secondario, marginTop: '4px' }}>📋 COPIA LE APERTE</button>
        )}

        {righe === null && <div style={{ marginTop: '18px' }}><ScheletroElenco righe={4} /></div>}
        {righe !== null && problema && (
          <div style={{ ...vuoto, marginTop: '18px' }}>Non riesco a leggere le segnalazioni adesso. Riprova fra poco.</div>
        )}
        {righe !== null && !problema && !righe.length && (
          <div style={{ ...vuoto, marginTop: '18px' }}>Ancora nessuna segnalazione. La prima la scrivi tu?</div>
        )}

        {aperte.length > 0 && (<>
          <div style={{ ...titolo, marginTop: '22px' }}>APERTE · {aperte.length}</div>
          {aperte.map(s => <Scheda key={s.id} s={s} evidenziata={evidenziate.has(s.id)} coachId={coach?.id} onApri={() => apri(s)} />)}
        </>)}

        {chiuse.length > 0 && (<>
          <button type="button" onClick={() => setChiuseAperte(v => !v)} aria-expanded={chiuseAperte}
            style={{ ...comePulsante, ...titolo, display: 'block', marginTop: '22px', minHeight: '40px', cursor: 'pointer' }}>
            {chiuseAperte ? '∨' : '›'} CHIUSE · {chiuse.length}
          </button>
          {chiuseAperte && chiuse.map(s => <Scheda key={s.id} s={s} evidenziata={evidenziate.has(s.id)} coachId={coach?.id} onApri={() => apri(s)} />)}
        </>)}

        {/* In fondo, piccolo: riguarda una persona sola. */}
        <div style={{ borderTop: '1px solid var(--sup-alta)', marginTop: '30px', paddingTop: '14px' }}>
          {gestore ? (
            <button type="button" onClick={() => { impostaGestore(false); setGestore(false) }} style={piccolo}>
              🛠️ Su questo telefono rispondi tu alle segnalazioni. <u>Smetti</u>
            </button>
          ) : (
            <button type="button" onClick={() => setConfermaGestore(true)} style={piccolo}>
              🛠️ Sei tu che sistemi l'app? Rispondi da questo telefono
            </button>
          )}
        </div>
      </div>

      {aperta_ && (
        <Foglio s={aperta_} gestore={gestore} coach={coach} nomeDi={nomeDi}
          onChiudi={() => setAperta(null)} onCambia={m => aggiornaQui(aperta_.id, m)} />
      )}

      {confermaGestore && (
        <div style={velo} onClick={() => setConfermaGestore(false)}>
          <div style={foglio} onClick={e => e.stopPropagation()}>
            <div style={titoloFoglio}>RISPONDI DA QUESTO TELEFONO?</div>
            <p style={testoFoglio}>
              Su questo telefono compariranno i tasti per dire a che punto è ogni
              segnalazione e per rispondere. Serve solo a chi sistema l'app: i coach
              non ne hanno bisogno.
            </p>
            <button type="button" style={grande} onClick={() => { impostaGestore(true); setGestore(true); setConfermaGestore(false) }}>
              🛠️ SÌ, SONO IO
            </button>
            <button type="button" style={annulla} onClick={() => setConfermaGestore(false)}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

/** Una segnalazione nell'elenco. */
function Scheda({ s, evidenziata, coachId, onApri }) {
  const tipo = tipoDi(s.tipo)
  const mia = s.coach_id === coachId
  const quanti = (s.anche_io || []).length
  const ioAnche = (s.anche_io || []).includes(coachId)
  const anche = !quanti ? '' : ioAnche
    ? (quanti === 1 ? '✋ anche tu' : `✋ anche tu e altri ${quanti - 1}`)
    : (quanti === 1 ? '✋ anche un altro coach' : `✋ anche altri ${quanti}`)
  return (
    <button type="button" onClick={onApri} style={{
      ...comePulsante, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'var(--sup)', border: `1px solid ${evidenziata ? 'var(--accento)' : 'var(--sup-alta)'}`,
      borderRadius: '8px', padding: '12px 14px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ fontSize: '18px' }}>{tipo.icona}</span>
        <span style={{ color: 'var(--testo-medio)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
          {tipo.nome.toUpperCase()} · {mia ? 'TU' : (s.coach || '?').toUpperCase()} · {quandoCorto(s.creata).toUpperCase()}
        </span>
        <Stato stato={s.stato} />
        {evidenziata && <span style={{ color: 'var(--accento)', fontSize: '12px', fontWeight: '800', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px' }}>● NOVITÀ</span>}
      </div>
      <div style={{ color: '#fff', fontSize: '16px', lineHeight: 1.4, marginTop: '6px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
        {s.testo}
      </div>
      {s.risposta && (
        <div style={{ marginTop: '8px', padding: '8px 10px', borderLeft: '3px solid var(--accento)', background: 'rgba(0,0,0,0.25)', borderRadius: '0 6px 6px 0', color: 'var(--testo-forte)', fontSize: '14px', lineHeight: 1.4 }}>
          ↳ {s.risposta}
        </div>
      )}
      {(quanti > 0 || s.foto) && (
        <div style={{ color: 'var(--testo-medio)', fontSize: '13px', marginTop: '6px' }}>
          {anche}
          {quanti > 0 && s.foto && ' · '}
          {s.foto && '📷 con foto'}
        </div>
      )}
    </button>
  )
}

function Stato({ stato }) {
  const c = COLORE_STATO[stato] || COLORE_STATO.letta
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: c.sfondo, border: `1px solid ${c.bordo}`,
      color: c.testo, fontSize: '12px', fontWeight: '800', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px',
    }}>
      {stato === 'fatta' ? '✓ ' : ''}{(STATI[stato]?.nome || stato).toUpperCase()}
    </span>
  )
}

/** Il foglio di una segnalazione: tutto il testo, la foto, «anche io» e, per il gestore, la risposta. */
function Foglio({ s, gestore, coach, nomeDi, onChiudi, onCambia }) {
  const tipo = tipoDi(s.tipo)
  const [indirizzo, setIndirizzo] = useState(null)
  const [stato, setStato] = useState(s.stato)
  const [risposta, setRisposta] = useState(s.risposta || '')
  const [salvo, setSalvo] = useState(false)
  const [voto, setVoto] = useState(false)
  const mia = s.coach_id === coach?.id
  const anche = s.anche_io || []
  const ioAnche = anche.includes(coach?.id)

  useEffect(() => {
    let vivo = true
    if (s.foto) indirizzoFotoSegnalazione(s.foto).then(u => { if (vivo) setIndirizzo(u) })
    return () => { vivo = false }
  }, [s.foto])

  async function salva() {
    setSalvo(true)
    const { errore } = await aggiornaSegnalazione(s.id, { stato, risposta })
    setSalvo(false)
    if (errore) { notifyError('Risposta non salvata. Riprova.'); return }
    onCambia({ stato, risposta: risposta.trim() || null })
    notifyOk('Salvato: chi l\'ha scritta lo vede')
    onChiudi()
  }

  async function cambiaVoto() {
    if (!coach?.id || voto) return
    setVoto(true)
    const { elenco, errore } = await ancheIo(s.id, coach.id, !ioAnche)
    setVoto(false)
    if (errore || !elenco) { notifyError('Non sono riuscito a salvarlo. Riprova.'); return }
    onCambia({ anche_io: elenco })
  }

  const cambiato = stato !== s.stato || (risposta.trim() || null) !== (s.risposta || null)
  return (
    <div style={velo} onClick={onChiudi}>
      <div role="dialog" aria-label="Segnalazione" style={foglio} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span aria-hidden="true" style={{ fontSize: '22px' }}>{tipo.icona}</span>
          <span style={{ ...titoloFoglio, marginBottom: 0 }}>{tipo.nome.toUpperCase()}</span>
          <Stato stato={s.stato} />
        </div>
        <div style={{ color: 'var(--testo-medio)', fontSize: '13px', marginBottom: '10px' }}>
          {mia ? 'Scritta da te' : `Scritta da ${s.coach || '?'}`} · {quandoCorto(s.creata)}
        </div>
        <div style={{ color: '#fff', fontSize: '16px', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.testo}</div>

        {s.foto && (
          indirizzo
            ? <a href={indirizzo} target="_blank" rel="noreferrer"><img src={indirizzo} alt="Foto dello schermo allegata" style={{ display: 'block', maxWidth: '100%', maxHeight: '320px', marginTop: '12px', borderRadius: '6px', border: '1px solid var(--bordo)' }} /></a>
            : <div style={{ ...nota, marginTop: '12px' }}>📷 Carico la foto…</div>
        )}

        {s.risposta && !gestore && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderLeft: '3px solid var(--accento)', background: 'rgba(0,0,0,0.3)', borderRadius: '0 6px 6px 0' }}>
            <div style={{ color: 'var(--accento)', fontSize: '12px', fontWeight: '800', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginBottom: '3px' }}>LA RISPOSTA</div>
            <div style={{ color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{s.risposta}</div>
          </div>
        )}

        {anche.length > 0 && (
          <div style={{ ...nota, marginTop: '12px' }}>
            ✋ Anche: {anche.map(id => (id === coach?.id ? 'tu' : nomeDi(id) || 'un coach')).join(', ')}
          </div>
        )}
        {!mia && coach?.id && aperta(s) && (
          <button type="button" onClick={cambiaVoto} disabled={voto} aria-pressed={ioAnche}
            style={{ ...secondario, marginTop: '12px', opacity: voto ? 0.5 : 1, ...(ioAnche && { borderColor: 'var(--accento)', color: 'var(--accento)' }) }}>
            {ioAnche ? '✋ ANCHE IO ✓ · TOCCA PER TOGLIERLO' : '✋ ANCHE IO'}
          </button>
        )}

        {/* Quello che l'app ha aggiunto da sola: serve a chi sistema l'app. */}
        {gestore && (s.dispositivo || s.versione || s.errori) && (
          <div style={{ ...nota, marginTop: '14px', fontSize: '12px', overflowWrap: 'anywhere' }}>
            {[s.dispositivo, s.versione && `versione ${s.versione}`].filter(Boolean).join(' · ')}
            {s.errori && <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--testo-chiaro)' }}>{s.errori}</pre>}
          </div>
        )}

        {gestore && (<>
          <div style={{ ...titolo, marginTop: '20px' }}>A CHE PUNTO È</div>
          <div role="radiogroup" aria-label="A che punto è" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ORDINE_STATI.filter(x => x !== 'nuova').map(x => (
              <button key={x} type="button" role="radio" aria-checked={stato === x} onClick={() => setStato(x)} style={{
                ...comePulsante, minHeight: '44px', padding: '0 14px', borderRadius: '6px', cursor: 'pointer',
                background: stato === x ? COLORE_STATO[x].sfondo : 'var(--sup)',
                border: `1px solid ${stato === x ? COLORE_STATO[x].bordo : 'var(--bordo)'}`,
                color: stato === x ? COLORE_STATO[x].testo : 'var(--testo-chiaro)',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800',
              }}>{STATI[x].nome.toUpperCase()}</button>
            ))}
          </div>
          <label htmlFor="risposta-segnalazione" style={{ ...titolo, display: 'block', marginTop: '16px' }}>LA TUA RISPOSTA (LA VEDE CHI L'HA SCRITTA)</label>
          <textarea id="risposta-segnalazione" value={risposta} maxLength={RISPOSTA_MASSIMA} rows={3}
            onChange={e => setRisposta(e.target.value)} placeholder="Es. «Fatto: ora il + salva subito»" style={campo} />
          <button type="button" onClick={salva} disabled={!cambiato || salvo}
            style={{ ...grande, marginTop: '12px', opacity: cambiato && !salvo ? 1 : 0.35 }}>
            {salvo ? 'SALVO…' : '✓ SALVA'}
          </button>
        </>)}

        <button type="button" style={annulla} onClick={onChiudi}>Chiudi</button>
      </div>
    </div>
  )
}

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const titolo = { color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', marginBottom: '8px' }
const nota = { color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, margin: '8px 0 0' }
const vuoto = { color: 'var(--testo-medio)', fontSize: '15px', textAlign: 'center', padding: '28px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '8px' }
const campo = { width: '100%', boxSizing: 'border-box', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '6px', padding: '12px 14px', color: '#fff', fontSize: '17px', lineHeight: 1.45, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }
const grande = { width: '100%', minHeight: '54px', background: 'var(--accento)', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const secondario = { ...comePulsante, width: '100%', minHeight: '48px', borderRadius: '6px', border: '1px solid var(--bordo-forte)', background: 'var(--sup-alta)', color: 'var(--testo-forte)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1px', textAlign: 'center', cursor: 'pointer' }
const pulsanteFoto = { ...secondario, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const piccolo = { ...comePulsante, width: '100%', minHeight: '44px', color: 'var(--testo-medio)', fontSize: '14px', textAlign: 'left', cursor: 'pointer' }
const annulla = { ...comePulsante, width: '100%', minHeight: '44px', marginTop: '8px', color: 'var(--testo-medio)', fontSize: '15px', textAlign: 'center', cursor: 'pointer' }
const velo = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const foglio = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '22px 16px 28px', width: '100%', maxWidth: 'var(--colonna)', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }
const titoloFoglio = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }
const testoFoglio = { color: 'var(--testo-medio)', fontSize: '15px', lineHeight: 1.45, margin: '0 0 14px' }
