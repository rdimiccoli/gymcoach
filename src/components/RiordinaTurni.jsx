import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { settimanaDaCalendario } from '../lib/schede'
import { settimaneDi } from '../lib/settimane'
import { riduciMovimento } from '../lib/movimento'
import { tocco } from '../lib/aptico'

/**
 * I turni da mettere in ordine, trascinandoli.
 *
 * Come le liste del telefono in modifica: card compatte, e a destra una
 * maniglia ≡. Si tiene premuta la maniglia e si trascina; le altre card si
 * fanno da parte mentre si passa, e lasciando il dito il turno resta lì.
 *
 * Prima c'erano due pulsantoni ▲ ▼ accanto a ogni card: funzionavano, ma
 * appesantivano la schermata più vista dell'app.
 *
 * Solo la maniglia trascina: il resto della card lascia scorrere la pagina
 * come sempre, anche con il pollice sopra.
 *
 * `onSposta(id, passo)`: passo negativo = più su. Viene chiamato dentro un
 * aggiornamento sincrono, così il nuovo ordine è già a schermo quando le
 * card tornano al loro posto, senza scatti.
 */
export default function RiordinaTurni({ turni, schede, occupato, onSposta }) {
  const righe = useRef({})
  const stato = useRef(null)
  const [preso, setPreso] = useState(null)

  const riga = id => righe.current[id]

  function prendi(e, id, da) {
    if (occupato || e.button > 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const el = riga(id)
    const r = el.getBoundingClientRect()
    // Sul tablet l'app è ingrandita con `zoom`: le misure lette dallo
    // schermo sono ingrandite, gli spostamenti da dare no.
    const scala = el.offsetHeight ? r.height / el.offsetHeight : 1
    const centri = turni.map(t => { const b = riga(t.id).getBoundingClientRect(); return b.top + b.height / 2 })
    const passo = centri.length > 1 ? centri[1] - centri[0] : r.height
    const contenitore = el.closest('[data-scorre]')
    stato.current = { id, da, a: da, y0: e.clientY, passo, scala, contenitore, scorso0: contenitore?.scrollTop ?? 0 }
    setPreso(id)
    tocco()
  }

  function trascina(e) {
    const s = stato.current
    if (!s) return
    // Vicino ai bordi la pagina scorre da sola, per i turni fuori schermo.
    const c = s.contenitore
    if (c) {
      const b = c.getBoundingClientRect()
      if (e.clientY < b.top + 60) c.scrollTop -= 10
      else if (e.clientY > b.bottom - 60) c.scrollTop += 10
    }
    const dy = e.clientY - s.y0 + ((c?.scrollTop ?? 0) - s.scorso0) * s.scala
    const a = Math.max(0, Math.min(turni.length - 1, Math.round(s.da + dy / s.passo)))
    riga(s.id).style.transform = `translateY(${dy / s.scala}px)`
    if (a === s.a) return
    s.a = a
    tocco()
    // Le altre si fanno da parte di un posto, verso dove era la presa.
    turni.forEach((t, j) => {
      if (t.id === s.id) return
      const fuori = s.da < a ? (j > s.da && j <= a ? -1 : 0) : (j >= a && j < s.da ? 1 : 0)
      riga(t.id).style.transform = fuori ? `translateY(${(fuori * s.passo) / s.scala}px)` : ''
    })
  }

  function lascia() {
    const s = stato.current
    if (!s) return
    stato.current = null
    const el = riga(s.id)
    const primaTop = el.getBoundingClientRect().top
    // Il nuovo ordine va a schermo nello stesso istante in cui le card
    // tornano senza spostamenti: così nessuna salta.
    flushSync(() => {
      setPreso(null)
      if (s.a !== s.da) onSposta(s.id, s.a - s.da)
    })
    turni.forEach(t => { const r = riga(t.id); if (r) { r.style.transition = 'none'; r.style.transform = '' } })
    // La card lasciata scivola dal punto dove era il dito al suo posto.
    const dopo = riga(s.id)
    const salto = (primaTop - dopo.getBoundingClientRect().top) / s.scala
    // Poi la transizione torna quella di sempre (React non la rimette da
    // solo: per lui non è cambiata).
    requestAnimationFrame(() => turni.forEach(t => { const r = riga(t.id); if (r) r.style.transition = SCIVOLA }))
    if (Math.abs(salto) > 1 && !riduciMovimento() && dopo.animate) {
      dopo.animate([{ transform: `translateY(${salto}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
    }
  }

  // Dalla tastiera (su un computer): frecce su e giù sulla maniglia.
  function tasto(e, id, i) {
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onSposta(id, -1) }
    if (e.key === 'ArrowDown' && i < turni.length - 1) { e.preventDefault(); onSposta(id, +1) }
  }

  return (
    <div>
      {turni.map((turno, i) => {
        const scheda = (schede[turno.id] || [])[0] || null
        const settimana = settimanaDaCalendario(scheda)
        const orario = turno.time || turno.name?.split('—')[0]?.trim() || ''
        const tipo = turno.type || turno.name?.split('—')[1]?.trim() || ''
        const lui = preso === turno.id
        return (
          <div key={turno.id} ref={el => { righe.current[turno.id] = el }}
            style={{
              ...card,
              position: 'relative', zIndex: lui ? 2 : 1,
              transition: lui ? 'box-shadow 150ms' : SCIVOLA,
              // Sollevata: ombra e un filo arancione intorno (con l'ombra, non
              // con il bordo, che ha già il suo colore a sinistra).
              ...(lui ? { boxShadow: '0 12px 28px rgba(0,0,0,.55), 0 0 0 1px var(--acc-bordo-forte)', background: '#1b1b1b' } : null),
            }}>
            <div style={{ flexShrink: 0, width: '62px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '24px', fontWeight: '900', color: 'var(--accento)', lineHeight: 1 }}>{orario}</div>
              <div style={{ color: 'var(--testo-debole)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginTop: '3px' }}>{tipo.toUpperCase()}</div>
            </div>
            <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--sup-alta)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: scheda ? '#fff' : 'var(--testo-medio)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {scheda ? scheda.name : 'Nessuna scheda attiva'}
              </div>
              {settimana && (
                <div style={{ color: 'var(--testo-debole)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px', marginTop: '2px' }}>
                  SETTIMANA {settimana} DI {settimaneDi(scheda)}
                </div>
              )}
            </div>
            <button type="button"
              aria-label={`Sposta il turno ${turno.name}: tieni premuto e trascina`}
              onPointerDown={e => prendi(e, turno.id, i)}
              onPointerMove={trascina}
              onPointerUp={lascia}
              onPointerCancel={lascia}
              onKeyDown={e => tasto(e, turno.id, i)}
              style={{
                flexShrink: 0, width: '44px', height: '44px', marginRight: '-6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                background: 'none', border: 'none', padding: 0,
                cursor: lui ? 'grabbing' : 'grab', touchAction: 'none',
                opacity: occupato && !lui ? 0.4 : 1,
              }}>
              {[0, 1, 2].map(k => (
                <span key={k} style={{ width: '18px', height: '2px', borderRadius: '1px', background: lui ? 'var(--accento)' : 'var(--testo-medio)' }} />
              ))}
            </button>
          </div>
        )
      })}
    </div>
  )
}

const SCIVOLA = 'transform 180ms cubic-bezier(.2,.8,.2,1)'

const card = {
  display: 'flex', alignItems: 'center', gap: '14px',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
  borderRadius: '8px', padding: '11px 14px', marginBottom: '8px',
  userSelect: 'none', WebkitUserSelect: 'none',
}
