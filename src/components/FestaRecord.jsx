import { useEffect, useRef } from 'react'
import { riduciMovimento } from '../lib/movimento'
import { componiFrase, scriviKg, EMOJI_DI_SERIE, TITOLO_DI_SERIE } from '../lib/frasiRecord'

/**
 * La festa per un record: coriandoli su tutta la schermata, un bagliore
 * arancione e, al centro, «NUOVO RECORD!» con una frase divertente.
 *
 * Dura poco più di tre secondi e poi sparisce da sola. Non ferma niente:
 * i tocchi passano attraverso (pointer-events: none), così il coach che sta
 * già segnando il carico di un altro cliente non perde il tocco.
 *
 * I coriandoli si disegnano su un <canvas>, senza librerie: un centinaio di
 * pezzetti che partono dagli angoli in basso e ricadono, più qualcuno che
 * piove dall'alto. Chi sul telefono ha chiesto meno movimento vede solo la
 * scritta, ferma.
 *
 * `festa`: { nome, kg, esercizio, prima, emoji, titolo, frase }. Emoji e
 * titolo vuoti valgono 🏆 e «NUOVO RECORD!»; una frase vuota non si mostra.
 */
const DURATA = 3300
const COLORI = ['#D95C1A', '#F5B82E', '#FFFFFF', '#FF8A4C', '#22C55E', '#FFD27A']

export default function FestaRecord({ festa, onFine }) {
  const tela = useRef(null)
  const fine = useRef(onFine)
  useEffect(() => { fine.current = onFine })

  useEffect(() => {
    const t = setTimeout(() => fine.current?.(), DURATA)
    return () => clearTimeout(t)
  }, [festa])

  useEffect(() => {
    const canvas = tela.current
    if (!canvas || riduciMovimento()) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scala = window.devicePixelRatio || 1
    const largo = canvas.clientWidth
    const alto = canvas.clientHeight
    canvas.width = largo * scala
    canvas.height = alto * scala
    ctx.scale(scala, scala)

    const pezzi = []
    const lancia = (x, y, verso, quanti) => {
      for (let i = 0; i < quanti; i++) {
        const angolo = (-Math.PI / 2) + verso * (0.15 + Math.random() * 0.55)
        const forza = alto * (0.018 + Math.random() * 0.014)
        pezzi.push(nuovo(x, y, Math.cos(angolo) * forza, Math.sin(angolo) * forza))
      }
    }
    const nuovo = (x, y, vx, vy) => ({
      x, y, vx, vy,
      colore: COLORI[Math.floor(Math.random() * COLORI.length)],
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      giro: Math.random() * Math.PI, vGiro: (Math.random() - 0.5) * 0.35,
      tondo: Math.random() < 0.25,
      ondeggia: Math.random() * Math.PI * 2,
    })
    // Due cannoni dagli angoli in basso, e una pioggia dall'alto.
    lancia(0, alto, 1, 55)
    lancia(largo, alto, -1, 55)
    for (let i = 0; i < 40; i++) pezzi.push(nuovo(Math.random() * largo, -20 - Math.random() * alto * 0.4, 0, 1 + Math.random() * 2))

    let ultimo = performance.now()
    const inizio = ultimo
    let id
    const disegna = ora => {
      const dt = Math.min(2, (ora - ultimo) / 16.7)
      ultimo = ora
      const trascorso = ora - inizio
      ctx.clearRect(0, 0, largo, alto)
      // Negli ultimi 600 ms i coriandoli svaniscono, invece di sparire di colpo.
      ctx.globalAlpha = Math.max(0, Math.min(1, (DURATA - 200 - trascorso) / 600))
      for (const p of pezzi) {
        p.vy += 0.32 * dt                    // gravità
        p.vx *= 0.985; p.vy *= 0.985         // aria
        p.ondeggia += 0.08 * dt
        p.x += (p.vx + Math.sin(p.ondeggia) * 0.6) * dt
        p.y += p.vy * dt
        p.giro += p.vGiro * dt
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.giro)
        ctx.fillStyle = p.colore
        if (p.tondo) {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill()
        } else {
          // Il coriandolo che gira mostra il fianco: si stringe e si allarga.
          ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.giro)), p.w, p.h * Math.abs(Math.cos(p.giro)) + 1)
        }
        ctx.restore()
      }
      if (trascorso < DURATA) id = requestAnimationFrame(disegna)
    }
    id = requestAnimationFrame(disegna)
    return () => cancelAnimationFrame(id)
  }, [festa])

  const frase = componiFrase(festa.frase, festa).trim()
  const titolo = componiFrase(festa.titolo, festa).trim() || TITOLO_DI_SERIE
  const emoji = (festa.emoji || '').trim() || EMOJI_DI_SERIE
  return (
    <div className="festa-velo" aria-live="assertive" role="status" style={{
      position: 'fixed', inset: 0, zIndex: 2700, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <canvas ref={tela} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div className="festa-scritta" style={{
        position: 'relative', textAlign: 'center', maxWidth: '420px', width: '100%',
        background: 'rgba(12,12,12,0.88)', border: '1px solid var(--acc-bordo-forte)',
        borderRadius: '18px', padding: '22px 20px 20px',
        boxShadow: '0 20px 60px rgba(0,0,0,.6), 0 0 80px rgba(217,92,26,.35)',
      }}>
        <div className="festa-coppa" style={{ fontSize: '56px', lineHeight: 1 }} aria-hidden="true">{emoji}</div>
        {/* Un titolo lungo scende di misura invece di andare su tre righe. */}
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: titolo.length > 18 ? '32px' : '40px', fontWeight: '900', color: 'var(--accento)', letterSpacing: '1px', lineHeight: 1.05, marginTop: '8px', overflowWrap: 'anywhere' }}>
          {titolo}
        </div>
        {frase && (
          <div style={{ color: '#fff', fontSize: '21px', fontWeight: '700', lineHeight: 1.3, marginTop: '12px', overflowWrap: 'anywhere' }}>
            {frase}
          </div>
        )}
        <div style={{ color: 'var(--testo-forte)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', letterSpacing: '0.5px', marginTop: '12px' }}>
          {festa.nome?.toUpperCase()} · {scriviKg(festa.kg)} · {festa.esercizio}
        </div>
        {festa.prima != null && (
          <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginTop: '3px' }}>
            prima: {scriviKg(festa.prima)}
          </div>
        )}
      </div>
    </div>
  )
}
