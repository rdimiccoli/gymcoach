import { useState, useEffect } from 'react'
import { tipoDi, STATI, ORDINE_STATI, RISPOSTA_MASSIMA, leggiDaRispondere, rispondi, indirizzoFotoSegnalazione } from '../lib/segnalazioni'
import { comePulsante } from '../lib/stile'
import Stato, { COLORE_STATO } from '../components/StatoSegnalazione'

/**
 * RISPONDI — la pagina del pulsante nell'email di una segnalazione.
 *
 * Si apre dall'indirizzo «?rispondi=…&chiave=…», anche senza essere entrati
 * nell'app: chi sistema l'app legge l'email sul telefono, tocca RISPONDI e
 * qui sceglie a che punto è e scrive la risposta, che il coach vede nell'app.
 * Il codice nell'indirizzo vale solo per QUELLA segnalazione (vedi la
 * migrazione delle segnalazioni). Aprirla la segna come letta.
 */
export default function RispondiSegnalazione({ parametri, onFine }) {
  const [s, setS] = useState(undefined) // undefined: carico · null: non trovata
  const [stato, setStato] = useState(null)
  const [risposta, setRisposta] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [esito, setEsito] = useState(null) // 'salvato' | 'errore'

  useEffect(() => {
    let vivo = true
    leggiDaRispondere(parametri).then(({ segnalazione, errore }) => {
      if (!vivo) return
      if (errore || !segnalazione) { setS(null); return }
      setS(segnalazione)
      setStato(segnalazione.stato === 'nuova' ? 'letta' : segnalazione.stato)
      setRisposta(segnalazione.risposta || '')
    })
    return () => { vivo = false }
  }, [parametri])

  async function salva() {
    setSalvo(true)
    const { fatto } = await rispondi(parametri, { stato, risposta })
    setSalvo(false)
    if (!fatto) { setEsito('errore'); return }
    setS(prima => ({ ...prima, stato, risposta: risposta.trim() || null }))
    setEsito('salvato')
  }

  const tipo = s ? tipoDi(s.tipo) : null
  const foto = s?.foto ? indirizzoFotoSegnalazione(s.foto) : null
  const cambiato = s && (stato !== s.stato || (risposta.trim() || null) !== (s.risposta || null))

  return (
    <div style={pagina}>
      <div style={testata}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>📮 RISPONDI A UNA SEGNALAZIONE</div>
      </div>
      <div style={scorrimento}>
        {s === undefined && <div style={nota}>Carico la segnalazione…</div>}

        {s === null && (<>
          <div style={vuoto}>
            Questo collegamento non funziona: forse è stato copiato a metà. Riaprilo dall'email,
            oppure guarda le segnalazioni nell'app (Impostazioni → Segnalazioni).
          </div>
          <button type="button" onClick={onFine} style={{ ...grande, marginTop: '18px' }}>APRI GYMCOACH</button>
        </>)}

        {s && esito === 'salvato' && (
          <div style={{ textAlign: 'center', paddingTop: '28px' }}>
            <div aria-hidden="true" style={{ fontSize: '48px' }}>✅</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff', marginTop: '8px' }}>SALVATO</div>
            <p style={{ ...nota, fontSize: '16px', maxWidth: '340px', margin: '10px auto 0' }}>
              {s.coach || 'Chi l\'ha scritta'} vede «{STATI[s.stato]?.nome}»{s.risposta ? ' e la tua risposta' : ''} nell'app, in Home e in Segnalazioni.
            </p>
            <button type="button" onClick={() => setEsito(null)} style={{ ...secondario, marginTop: '22px' }}>CAMBIA ANCORA</button>
            <button type="button" onClick={onFine} style={{ ...grande, marginTop: '10px' }}>APRI GYMCOACH</button>
          </div>
        )}

        {s && esito !== 'salvato' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span aria-hidden="true" style={{ fontSize: '22px' }}>{tipo.icona}</span>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff' }}>{tipo.nome.toUpperCase()}</span>
            <Stato stato={s.stato} />
          </div>
          <div style={{ color: 'var(--testo-medio)', fontSize: '13px', margin: '4px 0 10px' }}>
            Da {s.coach || '?'} · {new Date(s.creata).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {s.anche_io > 0 && ` · ✋ anche ${s.anche_io === 1 ? 'un altro coach' : `altri ${s.anche_io}`}`}
          </div>
          <div style={{ color: '#fff', fontSize: '17px', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.testo}</div>
          {foto && (
            <a href={foto} target="_blank" rel="noreferrer">
              <img src={foto} alt="Foto dello schermo allegata" style={{ display: 'block', maxWidth: '100%', maxHeight: '360px', marginTop: '12px', borderRadius: '6px', border: '1px solid var(--bordo)' }} />
            </a>
          )}
          {(s.dispositivo || s.versione || s.errori) && (
            <div style={{ ...nota, fontSize: '12px', overflowWrap: 'anywhere' }}>
              {[s.dispositivo, s.versione && `versione ${s.versione}`].filter(Boolean).join(' · ')}
              {s.errori && <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '11px', color: 'var(--testo-chiaro)' }}>{s.errori}</pre>}
            </div>
          )}

          <div style={{ ...titolo, marginTop: '22px' }}>A CHE PUNTO È</div>
          <div role="radiogroup" aria-label="A che punto è" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ORDINE_STATI.filter(x => x !== 'nuova').map(x => (
              <button key={x} type="button" role="radio" aria-checked={stato === x} onClick={() => setStato(x)} style={{
                ...comePulsante, minHeight: '48px', padding: '0 16px', borderRadius: '6px', cursor: 'pointer',
                background: stato === x ? COLORE_STATO[x].sfondo : 'var(--sup)',
                border: `1px solid ${stato === x ? COLORE_STATO[x].bordo : 'var(--bordo)'}`,
                color: stato === x ? COLORE_STATO[x].testo : 'var(--testo-chiaro)',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800',
              }}>{STATI[x].nome.toUpperCase()}</button>
            ))}
          </div>

          <label htmlFor="risposta" style={{ ...titolo, display: 'block', marginTop: '18px' }}>LA TUA RISPOSTA (LA VEDE {(s.coach || 'chi l\'ha scritta').toUpperCase()})</label>
          <textarea id="risposta" value={risposta} maxLength={RISPOSTA_MASSIMA} rows={4}
            onChange={e => setRisposta(e.target.value)} placeholder="Es. «Fatto: ora il + salva subito»" style={campo} />

          {esito === 'errore' && (
            <div role="alert" style={{ color: 'var(--errore)', fontSize: '14px', marginTop: '10px' }}>
              Non è stato salvato. Controlla la rete e riprova.
            </div>
          )}
          <button type="button" onClick={salva} disabled={!cambiato || salvo}
            style={{ ...grande, marginTop: '14px', opacity: cambiato && !salvo ? 1 : 0.35 }}>
            {salvo ? 'SALVO…' : '✓ SALVA'}
          </button>
          <button type="button" onClick={onFine} style={annulla}>Apri GymCoach senza salvare</button>
        </>)}
      </div>
    </div>
  )
}

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
const testata = { padding: '16px 18px 12px', borderBottom: '1px solid var(--sup-alta)', flexShrink: 0 }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const titolo = { color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', marginBottom: '8px' }
const nota = { color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, margin: '10px 0 0' }
const vuoto = { color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.5, textAlign: 'center', padding: '24px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '8px' }
const campo = { width: '100%', boxSizing: 'border-box', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '6px', padding: '12px 14px', color: '#fff', fontSize: '17px', lineHeight: 1.45, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }
const grande = { width: '100%', minHeight: '54px', background: 'var(--accento)', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const secondario = { ...comePulsante, width: '100%', minHeight: '48px', borderRadius: '6px', border: '1px solid var(--bordo-forte)', background: 'var(--sup-alta)', color: 'var(--testo-forte)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1px', textAlign: 'center', cursor: 'pointer' }
const annulla = { ...comePulsante, width: '100%', minHeight: '44px', marginTop: '8px', color: 'var(--testo-medio)', fontSize: '15px', textAlign: 'center', cursor: 'pointer' }
