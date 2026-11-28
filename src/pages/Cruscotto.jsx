import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { comePulsante } from '../lib/stile'
import { tutteLeRighe } from '../lib/tutteLeRighe'
import { caricaUltimi, personeAttive } from '../lib/assentiDb'
import { chiManca, maiAllenati } from '../lib/assenti'
import { lunediDi, settimanePrima, etichettaSettimana, ultimeSettimane, perCoach, contaPerCoach, numero } from '../lib/andamento'
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const SETTIMANE = 10

// Il grafico (vedi la skill dataviz): una serie sola, quindi niente legenda;
// la settimana in corso in arancione, le altre in grigio. Il grigio è il più
// scuro che resta sopra 3:1 sul fondo, l'arancione è quello dell'app.
const GRIGIO_BARRE = '#6e6e6e'
const ALTEZZA_GRAFICO = 120

/**
 * IL CRUSCOTTO — da IMPOSTAZIONI.
 *
 * La palestra in una schermata: quante persone si sono allenate questa
 * settimana e nelle ultime dieci, coach per coach, gli ospiti, e chi non si
 * vede da tre settimane. I numeri vengono dai pesi segnati: chi si allena
 * senza che nessuno segni un peso, qui non c'è.
 */
export default function Cruscotto({ navigate, goBack, goHome, coaches = [] }) {
  const [dati, setDati] = useState(null)
  const [scelta, setScelta] = useState(null) // la settimana toccata nel grafico
  const [tabella, setTabella] = useState(false)

  useEffect(() => {
    let vivo = true
    carica().then(d => { if (vivo) setDati(d) })
    return () => { vivo = false }
  }, [])

  async function carica() {
    const oggi = new Date()
    const questa = lunediDi(oggi)
    const da = settimanePrima(questa, SETTIMANE - 1)
    const [{ data: righe }, { data: turni }, { data: visite }] = await Promise.all([
      run(supabase.from('andamento_settimane').select('settimana, coach_id, tutti, pesi, persone')
        .gte('settimana', da).order('settimana'), 'Impossibile caricare il cruscotto.'),
      run(supabase.from('turns').select('id, coach_id'), 'Impossibile caricare i turni.'),
      tutteLeRighe(() => supabase.from('client_visits').select('id, turn_id, client_id')
        .gte('visit_date', questa).order('id'), 'Impossibile contare gli ospiti.'),
    ])
    const idTurni = (turni || []).map(t => t.id)
    const [ultimi, persone] = await Promise.all([caricaUltimi(), personeAttive(idTurni)])
    return {
      questa,
      settimane: ultimeSettimane(righe || [], oggi, SETTIMANE),
      coach: perCoach(righe || [], questa, coaches, contaPerCoach(persone, turni)),
      // Persone diverse: chi è venuto due volte da ospite conta una volta.
      ospiti: new Set((visite || []).map(v => v.client_id)).size,
      assenti: ultimi ? chiManca(persone, ultimi, oggi) : null,
      mai: ultimi ? maiAllenati(persone, ultimi).length : null,
      turni: turni || [],
    }
  }

  const settimane = dati?.settimane || []
  const ora = settimane[settimane.length - 1]
  const prima = settimane[settimane.length - 2]
  const vista = settimane.find(s => s.settimana === scelta) || ora
  const massimo = Math.max(1, ...settimane.map(s => s.persone))
  // Chi manca, coach per coach: «Manu 6 · Nicola 2».
  const coachDelTurno = new Map((dati?.turni || []).map(t => [t.id, t.coach_id]))
  const nomeCoach = new Map(coaches.map(c => [c.id, c.name]))
  const assentiPerCoach = {}
  for (const p of dati?.assenti || []) {
    const nome = nomeCoach.get(coachDelTurno.get(p.turn_id)) || 'Senza coach'
    assentiPerCoach[nome] = (assentiPerCoach[nome] || 0) + 1
  }
  const massimoCoach = Math.max(1, ...(dati?.coach || []).map(c => c.persone))

  return (
    <div style={pagina}>
      <TopBar title="CRUSCOTTO" subtitle="La palestra, settimana per settimana" onBack={goBack} />
      <div style={scorrimento}>
        {!dati && <ScheletroElenco righe={6} />}

        {dati && (<>
          {/* ── Questa settimana: i numeri, grandi ─────────────────────── */}
          <div style={titolo}>QUESTA SETTIMANA · DA LUNEDÌ {etichettaSettimana(dati.questa)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            <Riquadro numero={ora?.persone} etichetta="persone allenate" grande />
            <Riquadro numero={ora?.pesi} etichetta="pesi segnati" />
            <Riquadro numero={dati.ospiti} etichetta={dati.ospiti === 1 ? 'ospite' : 'ospiti'} />
          </div>
          {prima && (
            <div style={nota}>
              La settimana scorsa: {numero(prima.persone)} persone e {numero(prima.pesi)} pesi.
              {' '}Questa è ancora in corso.
            </div>
          )}

          {/* ── Le ultime dieci settimane ──────────────────────────────── */}
          <div style={{ ...titolo, marginTop: '22px' }}>PERSONE ALLENATE, ULTIME {SETTIMANE} SETTIMANE</div>
          <div style={riquadro}>
            {/* Il numero della colonna toccata: sul telefono non c'è il
                passaggio del mouse, si tocca. */}
            <div aria-live="polite" style={{ color: '#fff', fontSize: '15px', marginBottom: '10px', minHeight: '20px' }}>
              <strong style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px' }}>
                {vista === ora ? 'Questa settimana' : `Settimana del ${etichettaSettimana(vista.settimana)}`}
              </strong>
              {`: ${numero(vista.persone)} persone · ${numero(vista.pesi)} pesi`}
            </div>
            <div role="group" aria-label="Persone allenate per settimana" style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${ALTEZZA_GRAFICO + 22}px`, borderBottom: '1px solid var(--bordo-forte)' }}>
              {settimane.map(s => {
                const corrente = s === ora
                const toccata = s === vista
                const altezza = s.persone ? Math.max(3, Math.round((s.persone / massimo) * ALTEZZA_GRAFICO)) : 0
                return (
                  <button key={s.settimana} type="button" onClick={() => setScelta(s.settimana)}
                    aria-pressed={toccata}
                    aria-label={`Settimana del ${etichettaSettimana(s.settimana)}: ${s.persone} persone, ${s.pesi} pesi`}
                    style={{ ...comePulsante, flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer', borderRadius: '4px', background: toccata && !corrente ? 'var(--sup-alta)' : 'transparent' }}>
                    {(corrente || toccata) && (
                      <span style={{ color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', marginBottom: '3px' }}>{s.persone}</span>
                    )}
                    <span aria-hidden="true" style={{ width: '100%', maxWidth: '24px', height: `${altezza}px`, background: corrente ? 'var(--accento)' : GRIGIO_BARRE, borderRadius: '4px 4px 0 0' }} />
                  </button>
                )
              })}
            </div>
            <div aria-hidden="true" style={{ display: 'flex', gap: '2px', marginTop: '5px' }}>
              {settimane.map((s, i) => (
                <span key={s.settimana} style={{ flex: 1, minWidth: 0, textAlign: 'center', color: s === ora ? '#fff' : 'var(--testo-medio)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: s === ora ? '800' : '600', whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {/* Una data sì e una no, partendo da oggi: tutte e dieci non ci stanno su un telefono. */}
                  {(settimane.length - 1 - i) % 2 === 0 ? etichettaSettimana(s.settimana) : ''}
                </span>
              ))}
            </div>
            <button type="button" onClick={() => setTabella(t => !t)} aria-expanded={tabella}
              style={{ ...comePulsante, marginTop: '10px', minHeight: '40px', color: 'var(--accento)', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              {tabella ? 'Nascondi i numeri ∧' : 'Vedi i numeri ›'}
            </button>
            {tabella && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>{['Settimana', 'Persone', 'Pesi'].map(t => <th key={t} style={cellaTitolo}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {[...settimane].reverse().map(s => (
                    <tr key={s.settimana}>
                      <td style={cella}>{s === ora ? `${etichettaSettimana(s.settimana)} (in corso)` : etichettaSettimana(s.settimana)}</td>
                      <td style={{ ...cella, textAlign: 'right' }}>{numero(s.persone)}</td>
                      <td style={{ ...cella, textAlign: 'right' }}>{numero(s.pesi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Coach per coach ────────────────────────────────────────── */}
          <div style={{ ...titolo, marginTop: '22px' }}>QUESTA SETTIMANA, COACH PER COACH</div>
          <div style={riquadro}>
            {dati.coach.map(({ coach, persone, pesi, attive }, i) => (
              <div key={coach.id} style={{ paddingTop: i ? '12px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '800', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coach.name}</span>
                  <span style={{ color: 'var(--testo-chiaro)', fontSize: '14px', flexShrink: 0 }}>
                    <strong style={{ color: '#fff', fontSize: '16px' }}>{numero(persone)}</strong>
                    {attive ? ` su ${numero(attive)}` : ''} · {numero(pesi)} pesi
                  </span>
                </div>
                <div aria-hidden="true" style={{ height: '8px', borderRadius: '4px', background: 'var(--sup-alta)', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((persone / massimoCoach) * 100)}%`, height: '100%', background: 'var(--accento)', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
            <div style={{ ...nota, marginTop: '12px', marginBottom: 0 }}>
              Il numero dopo «su» sono le persone attive nei turni di quel coach.
              Un ospite conta per il coach del turno in cui si è allenato.
            </div>
          </div>

          {/* ── Chi manca ─────────────────────────────────────────────── */}
          {dati.assenti && (<>
            <div style={{ ...titolo, marginTop: '22px' }}>DA RICHIAMARE</div>
            <div style={riquadro}>
              <div style={{ color: '#fff', fontSize: '16px', lineHeight: 1.45 }}>
                <strong>{numero(dati.assenti.length)}</strong> {dati.assenti.length === 1 ? 'persona non si vede' : 'persone non si vedono'} da 3 settimane
                {dati.assenti.length > 0 && (
                  <span style={{ color: 'var(--testo-chiaro)' }}>
                    {': '}{Object.entries(assentiPerCoach).sort((a, b) => b[1] - a[1]).map(([nome, n]) => `${nome} ${n}`).join(' · ')}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginTop: '4px' }}>
                I nomi sono in Home, nel riquadro «Non si vedono da 3 settimane».
              </div>
              {dati.mai > 0 && (
                <button type="button" onClick={() => navigate('pulizia')} style={rigaAzione}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{numero(dati.mai)}</strong> attive senza nemmeno un peso segnato
                  </span>
                  <span style={{ color: 'var(--accento)', fontWeight: '700', flexShrink: 0 }}>METTI IN ORDINE ›</span>
                </button>
              )}
            </div>
          </>)}

          <div style={{ ...nota, marginTop: '18px' }}>
            Si conta chi ha almeno un peso segnato nella settimana. Un peso
            corretto dopo resta nella settimana in cui era stato segnato.
          </div>
        </>)}
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function Riquadro({ numero: n, etichetta, grande = false }) {
  return (
    <div style={{ background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', padding: '12px 10px', minWidth: 0 }}>
      <div style={{ color: grande ? 'var(--accento)' : '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: grande ? '40px' : '32px', fontWeight: '900', lineHeight: 1 }}>
        {numero(n)}
      </div>
      <div style={{ color: 'var(--testo-chiaro)', fontSize: '13px', lineHeight: 1.25, marginTop: '4px' }}>{etichetta}</div>
    </div>
  )
}

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const titolo = { color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', marginBottom: '8px' }
const nota = { color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, margin: '8px 0 0' }
const riquadro = { background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', padding: '14px' }
const cellaTitolo = { color: 'var(--testo-medio)', fontSize: '12px', fontWeight: '700', textAlign: 'left', padding: '6px 4px', borderBottom: '1px solid var(--bordo)', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' }
const cella = { color: 'var(--testo-forte)', fontSize: '14px', padding: '6px 4px', borderBottom: '1px solid var(--sup-alta)' }
const rigaAzione = { ...comePulsante, display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: '48px', marginTop: '12px', padding: '10px 12px', borderRadius: '6px', background: 'var(--sup-alta)', color: '#fff', fontSize: '15px', textAlign: 'left', cursor: 'pointer' }
