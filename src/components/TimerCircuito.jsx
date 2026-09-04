import { useState, useEffect, useRef } from 'react'
import { secondiDaTesto, numeroDaTesto } from '../lib/schede'

/**
 * Timer a schermo intero per i circuiti.
 *
 * Durata, riposo e numero di giri sono già nel database (reps_a, reps_b,
 * reps_c di un gruppo CIR-): finora venivano solo stampati. Un circuito da sei
 * esercizi × 50s / 10s × 3 giri si cronometrava a mano, contando.
 *
 * Il conto alla rovescia usa una scadenza assoluta e non un contatore che
 * scende: un setInterval su un telefono che va in secondo piano perde colpi, e
 * dopo tre giri il timer sarebbe indietro di parecchio.
 */
export default function TimerCircuito({ group, onClose }) {
  const durata = secondiDaTesto(group.exercises[0]?.reps_a)
  const riposo = secondiDaTesto(group.exercises[0]?.reps_b) ?? 0
  const giri = numeroDaTesto(group.exercises[0]?.reps_c) ?? 1
  const esercizi = group.exercises

  const [indice, setIndice] = useState(0)
  const [giro, setGiro] = useState(1)
  const [fase, setFase] = useState('pronti') // pronti | lavoro | riposo | fine
  const [rimasti, setRimasti] = useState(durata ?? 0)
  const [inPausa, setInPausa] = useState(false)

  const scadenza = useRef(null)
  const audio = useRef(null)
  const wakeLock = useRef(null)

  // ── suono ─────────────────────────────────────────────────────────────────
  // Generato al volo: nessun file da scaricare, funziona anche offline.
  function bip(frequenza, durataMs) {
    try {
      audio.current ||= new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audio.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = frequenza
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durataMs / 1000)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + durataMs / 1000)
    } catch { /* audio non disponibile: il timer funziona lo stesso */ }
  }

  // ── schermo sempre acceso ─────────────────────────────────────────────────
  useEffect(() => {
    let annullato = false
    ;(async () => {
      try {
        const l = await navigator.wakeLock?.request('screen')
        if (annullato) l?.release()
        else wakeLock.current = l
      } catch { /* non supportato: pazienza */ }
    })()
    return () => { annullato = true; wakeLock.current?.release().catch(() => {}) }
  }, [])

  // ── motore ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase === 'pronti' || fase === 'fine' || inPausa) return
    const tick = setInterval(() => {
      const secondi = Math.ceil((scadenza.current - Date.now()) / 1000)
      setRimasti(prev => {
        if (secondi <= 3 && secondi > 0 && secondi !== prev) bip(880, 90)
        return Math.max(0, secondi)
      })
      if (secondi <= 0) avanza()
    }, 200)
    return () => clearInterval(tick)
  }, [fase, inPausa, indice, giro])

  function partiFase(nuovaFase, secondi) {
    setFase(nuovaFase)
    setRimasti(secondi)
    scadenza.current = Date.now() + secondi * 1000
  }

  function avanza() {
    bip(1320, 260)
    if (fase === 'lavoro') {
      const ultimoEsercizio = indice === esercizi.length - 1
      const ultimoGiro = giro === giri
      if (ultimoEsercizio && ultimoGiro) { setFase('fine'); return }
      if (riposo > 0) { partiFase('riposo', riposo); return }
      passaAlProssimo()
      return
    }
    passaAlProssimo()
  }

  function passaAlProssimo() {
    if (indice < esercizi.length - 1) setIndice(i => i + 1)
    else { setIndice(0); setGiro(g => g + 1) }
    partiFase('lavoro', durata)
  }

  function avvia() {
    bip(1320, 260)
    partiFase('lavoro', durata)
  }

  if (!durata) return null

  const esercizio = esercizi[indice]
  const prossimo = indice < esercizi.length - 1
    ? esercizi[indice + 1]
    : (giro < giri ? esercizi[0] : null)

  const totale = fase === 'riposo' ? riposo : durata
  const percentuale = fase === 'pronti' || fase === 'fine' ? 0 : ((totale - rimasti) / totale) * 100
  const colore = fase === 'riposo' ? 'var(--circuito)' : fase === 'fine' ? 'var(--ok)' : 'var(--accento)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2500, background: 'var(--fondo)',
      display: 'flex', flexDirection: 'column', padding: '20px', textAlign: 'center',
    }}>
      {/* barra di avanzamento del tempo */}
      <div style={{ height: '4px', background: 'var(--sup-alta)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${percentuale}%`, background: colore, transition: 'width 0.2s linear' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexShrink: 0 }}>
        <span style={{ color: 'var(--testo-debole)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1.5px' }}>
          GIRO {Math.min(giro, giri)} / {giri}
        </span>
        <span style={{ color: 'var(--testo-debole)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1.5px' }}>
          {indice + 1} / {esercizi.length}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {fase === 'fine' ? (
          <>
            <div style={{ fontSize: '64px' }}>🎉</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: '900', color: 'var(--ok)', letterSpacing: '2px' }}>
              CIRCUITO COMPLETATO
            </div>
          </>
        ) : (
          <>
            <div style={{ color: colore, fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '3px' }}>
              {fase === 'riposo' ? 'RIPOSO' : fase === 'pronti' ? 'PRONTI?' : 'LAVORO'}
            </div>
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif', fontSize: '110px', fontWeight: '900',
              color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {fase === 'pronti' ? durata : rimasti}
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '700', color: fase === 'riposo' ? 'var(--testo-medio)' : '#fff', letterSpacing: '1px', padding: '0 10px' }}>
              {fase === 'riposo' ? (prossimo?.exercises?.name ?? '') : (esercizio?.exercises?.name ?? '')}
            </div>
            {fase !== 'riposo' && prossimo && (
              <div style={{ color: 'var(--testo-fioco)', fontSize: '14px', marginTop: '4px' }}>
                poi · {prossimo?.exercises?.name}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        {fase === 'pronti' && (
          <button onClick={avvia} style={{ ...tasto, flex: 2, background: 'var(--accento)', color: '#fff', border: 'none' }}>▶ VIA</button>
        )}
        {(fase === 'lavoro' || fase === 'riposo') && (
          <button
            onClick={() => {
              if (inPausa) { scadenza.current = Date.now() + rimasti * 1000; setInPausa(false) }
              else setInPausa(true)
            }}
            style={{ ...tasto, flex: 2, background: inPausa ? 'var(--accento)' : 'var(--sup-alta)', color: inPausa ? '#fff' : 'var(--testo-forte)', border: inPausa ? 'none' : '1px solid var(--bordo-forte)' }}>
            {inPausa ? '▶ RIPRENDI' : '⏸ PAUSA'}
          </button>
        )}
        <button onClick={onClose} style={{ ...tasto, flex: 1, background: 'transparent', border: '1px solid var(--bordo-forte)', color: 'var(--testo-chiaro)' }}>
          {fase === 'fine' ? 'CHIUDI' : 'ESCI'}
        </button>
      </div>
    </div>
  )
}

const tasto = {
  padding: '18px', borderRadius: '8px',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px',
  fontWeight: '800', letterSpacing: '2px', cursor: 'pointer',
}
