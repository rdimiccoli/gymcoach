import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { tutteLeRighe } from '../lib/tutteLeRighe'
import Andamento, { Linetta } from '../components/Andamento'
import { analizzaEsercizio, riassunto, numero } from '../lib/progressi'
import { ScheletroStorico } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

// La settimana esatta. Prima si scriveva «Sett. 1–2» sia per la prima sia
// per la seconda — le coppie di settimane delle ripetizioni — e due carichi
// diversi sembravano registrati nello stesso momento.
const WEEK_LABEL = w => `Sett. ${w}`

export default function AthleteProfile({ navigate, goBack, goHome, params }) {
  const { client } = params
  const [history, setHistory] = useState([]) // [{ exerciseName, entries: [{ cycleName, date, week, kg }] }]
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    // Get all loads for this client
    // A pagine: chi si allena da anni supera le mille righe che Supabase
    // manda in una volta, e i carichi più nuovi sparivano dal grafico.
    const { data: loads } = await tutteLeRighe(() => supabase
        .from('client_loads')
        .select('kg, week, cycle_exercise_id')
        .eq('client_id', client.id)
        .not('kg', 'is', null)
        .order('cycle_exercise_id').order('week'),
      'Impossibile caricare lo storico dei carichi.'
    )

    if (!loads?.length) { setLoading(false); return }

    // Get all cycle_exercises involved
    const exIds = [...new Set(loads.map(l => l.cycle_exercise_id))]
    const { data: cycleExercises } = await run(
      supabase
        .from('cycle_exercises')
        .select('id, cycle_id, exercises(name)')
        .in('id', exIds),
      'Impossibile caricare gli esercizi collegati.'
    )
    if (!cycleExercises?.length) { setLoading(false); return }

    // Get all cycles involved
    const cycleIds = [...new Set(cycleExercises.map(e => e.cycle_id))]
    const { data: cycles } = await run(
      supabase
        .from('cycles')
        .select('id, name, start_date')
        .in('id', cycleIds),
      'Impossibile caricare le schede collegate.'
    )
    if (!cycles?.length) { setLoading(false); return }

    // Build lookup maps
    const exMap = {}
    cycleExercises.forEach(e => { exMap[e.id] = { name: e?.exercises?.name, cycleId: e.cycle_id } })
    const cycleMap = {}
    cycles.forEach(c => { cycleMap[c.id] = c })

    // Group by exercise name
    const byExercise = {}
    loads.forEach(load => {
      const ex = exMap[load.cycle_exercise_id]
      if (!ex) return
      const cycle = cycleMap[ex.cycleId]
      if (!cycle) return
      if (!byExercise[ex.name]) byExercise[ex.name] = []
      byExercise[ex.name].push({
        cycleId: cycle.id,
        cycleName: cycle.name,
        date: cycle.start_date,
        week: load.week,
        kg: load.kg,
        // sort key: date + week
        sortKey: `${cycle.start_date || '0000'}_${String(load.week).padStart(2,'0')}`
      })
    })

    // Per ogni esercizio: le voci dalla più recente (per l'elenco) e l'analisi
    // fatta in ordine di tempo (per i progressi).
    const result = Object.entries(byExercise)
      .map(([name, entries]) => {
        const recenti = entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
        const inOrdine = [...recenti].reverse()
        const analisi = analizzaEsercizio(inOrdine)
        // il segno di record va sulle voci dell'elenco, che è al contrario
        recenti.forEach((voce, i) => { voce.record = analisi.sonoRecord[recenti.length - 1 - i] })
        return { name, entries: recenti, best: analisi.migliore, analisi }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    setHistory(result)
    setLoading(false)
  }

  const somma = riassunto(history.map(e => e.analisi))
  const schede = new Set(history.flatMap(ex => ex.entries.map(e => e.cycleId))).size
  const dataPrima = history.flatMap(ex => ex.entries.map(e => e.date)).filter(Boolean).sort()[0]
  const daQuando = dataPrima
    ? new Date(`${dataPrima}T00:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : null

  return (
    <div style={page}>
      <TopBar
        title={`${client.surname} ${client.name}`.toUpperCase()}
        subtitle="Progressi"
        onBack={goBack}
      />

      <div style={scroll}>
        {loading && <ScheletroStorico />}

        {!loading && history.length === 0 && (
          <div style={{ color: 'var(--bordo-forte)', textAlign: 'center', padding: '40px', fontSize: '14px', border: '1px dashed var(--sup-alta)', borderRadius: '8px' }}>
            Nessun carico registrato ancora.
          </div>
        )}

        {!loading && history.length > 0 && (
          <>
            {/* ── Il numero che si mostra al cliente ─────────────────────
                Uno solo, grande: quanto sono cresciuti in media i suoi
                carichi, ogni esercizio rispetto a sé stesso. Mai una somma
                di chili di esercizi diversi. */}
            <div style={hero}>
              {somma.crescitaMedia !== null ? (<>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span aria-hidden="true" style={{ fontSize: '28px', fontWeight: '900', color: somma.crescitaMedia > 0 ? 'var(--ok)' : somma.crescitaMedia < 0 ? 'var(--errore)' : 'var(--testo-medio)' }}>
                    {somma.crescitaMedia > 0 ? '↑' : somma.crescitaMedia < 0 ? '↓' : '='}
                  </span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '60px', fontWeight: '900', lineHeight: 0.95, color: '#fff' }}>
                    {somma.crescitaMedia > 0 ? '+' : ''}{somma.crescitaMedia}%
                  </span>
                </div>
                <div style={{ color: 'var(--testo-forte)', fontSize: '15px', marginTop: '6px' }}>
                  {somma.crescitaMedia > 0 ? 'di crescita media dei carichi' : somma.crescitaMedia < 0 ? 'di calo medio dei carichi' : 'carichi stabili, in media'}
                </div>
                <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '2px' }}>
                  su {somma.misurabili} {somma.misurabili === 1 ? 'esercizio' : 'esercizi'}{daQuando ? ` · da ${daQuando}` : ''}
                </div>
              </>) : (
                <div style={{ color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.45 }}>
                  Ancora pochi dati: i progressi compaiono quando un esercizio ha almeno due carichi segnati.
                </div>
              )}
            </div>

            {/* ── Tre numeri in fila ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '18px' }}>
              <Tessera etichetta="IN CRESCITA" valore={somma.misurabili ? `${somma.inCrescita}` : '—'} sotto={somma.misurabili ? `su ${somma.misurabili}` : 'esercizi'} />
              <Tessera etichetta="RECORD" valore={`${somma.record}`} sotto={somma.record === 1 ? 'battuto' : 'battuti'} />
              <Tessera etichetta="SCHEDE" valore={`${schede}`} sotto={schede === 1 ? 'seguita' : 'seguite'} />
            </div>

            <div style={{ color: 'var(--testo-debole)', fontSize: '12px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', marginBottom: '8px' }}>
              ESERCIZIO PER ESERCIZIO
            </div>

            {history.map(ex => {
              const isOpen = expanded[ex.name]
              const a = ex.analisi
              const inOrdine = [...ex.entries].reverse()
              return (
                <div key={ex.name} style={{ marginBottom: '8px' }}>
                  <button type="button" aria-expanded={Boolean(isOpen)}
                    onClick={() => setExpanded(e => ({ ...e, [ex.name]: !e[ex.name] }))}
                    style={{
                      ...comeRiga,
                      background: isOpen ? 'var(--acc-fondo)' : 'var(--sup)',
                      border: `1px solid ${isOpen ? 'var(--acc-bordo)' : 'var(--sup-alta)'}`,
                      borderRadius: isOpen ? '8px 8px 0 0' : '8px',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ex.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <Stato a={a} />
                        {a.alMassimo && (
                          <span style={{ color: 'var(--attenzione)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', letterSpacing: '0.5px' }}>🏆 AL SUO MASSIMO</span>
                        )}
                      </div>
                    </div>
                    <Linetta valori={inOrdine.map(e => Number(e.kg))} />
                    <div style={{ textAlign: 'right', minWidth: '58px' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>
                        {numero(a.ultimo)}<span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--testo-medio)' }}> kg</span>
                      </div>
                      <div style={{ color: 'var(--testo-debole)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px', marginTop: '2px' }}>
                        MAX {numero(a.migliore)}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--acc-riempimento)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                      {ex.entries.length > 1 && (
                        <div style={{ padding: '14px 14px 10px' }}>
                          <Andamento punti={inOrdine.map(e => ({
                            kg: Number(e.kg), etichetta: `S${e.week}`, record: e.record,
                            dettaglio: `Sett. ${e.week} · ${e.cycleName}`,
                          }))} />
                        </div>
                      )}
                      {/* L'elenco è la versione in tabella del grafico: ogni
                          valore si legge anche senza toccare niente. */}
                      {ex.entries.map((entry, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px',
                          borderTop: '1px solid var(--sup)',
                          background: i === 0 ? 'var(--acc-velo)' : 'transparent'
                        }}>
                          <div>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '600', color: i === 0 ? '#fff' : 'var(--testo-chiaro)', letterSpacing: '0.3px' }}>
                              {entry.cycleName}
                              {i === 0 && <span style={{ marginLeft: '6px', color: 'var(--accento)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>ULTIMO</span>}
                              {entry.record && <span style={{ marginLeft: '6px', color: 'var(--attenzione)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>🏆 RECORD</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                              <span style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                {WEEK_LABEL(entry.week)}
                              </span>
                              {entry.date && (
                                <span style={{ color: 'var(--bordo-forte)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                  {new Date(`${entry.date}T00:00:00`).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: i === 0 ? '#fff' : 'var(--testo-medio)', fontVariantNumeric: 'tabular-nums' }}>
                              {numero(entry.kg)}<span style={{ fontSize: '13px', fontWeight: '400' }}> kg</span>
                            </div>
                            {i < ex.entries.length - 1 && (() => {
                              const delta = parseFloat((entry.kg - ex.entries[i + 1].kg).toFixed(2))
                              return delta !== 0 ? (
                                <div style={{ color: 'var(--testo-medio)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                  <span style={{ color: delta > 0 ? 'var(--ok)' : 'var(--errore)' }}>{delta > 0 ? '↑' : '↓'}</span> {delta > 0 ? '+' : ''}{numero(delta)}
                                </div>
                              ) : null
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
        <div style={{ height: '24px' }} />
      </div>
      <BottomNav active="athletes" navigate={navigate} goHome={goHome} />
    </div>
  )
}

/**
 * Su o giù, sempre con la freccia e la parola: il verde e il rosso da soli
 * non bastano a chi non distingue i colori (lo dice il controllo della
 * skill dei grafici: per un daltonico i due sono quasi uguali).
 */
function Stato({ a }) {
  const base = { fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.4px', color: 'var(--testo-forte)' }
  if (a.stato === 'nuovo') return <span style={{ ...base, color: 'var(--testo-debole)' }}>PRIMO CARICO</span>
  if (a.stato === 'fermo') return <span style={base}><span style={{ color: 'var(--testo-medio)' }}>=</span> STABILE</span>
  const su = a.stato === 'su'
  return (
    <span style={base}>
      <span style={{ color: su ? 'var(--ok)' : 'var(--errore)' }}>{su ? '↑' : '↓'}</span>
      {' '}{su ? '+' : '−'}{numero(Math.abs(a.variazione))} kg
      {a.percentuale !== null && <span style={{ color: 'var(--testo-debole)' }}> · {su ? '+' : ''}{a.percentuale}%</span>}
      <span style={{ color: 'var(--testo-debole)' }}> {su ? 'IN CRESCITA' : 'IN CALO'}</span>
    </span>
  )
}

function Tessera({ etichetta, valore, sotto }) {
  return (
    <div style={{ background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', padding: '10px 12px' }}>
      <div style={{ color: 'var(--testo-debole)', fontSize: '11px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{etichetta}</div>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1.05, marginTop: '2px' }}>{valore}</div>
      <div style={{ color: 'var(--testo-debole)', fontSize: '12px' }}>{sotto}</div>
    </div>
  )
}

const hero = { background: 'linear-gradient(160deg, rgba(217,92,26,0.16), rgba(217,92,26,0.03) 60%)', border: '1px solid var(--acc-riempimento-forte)', borderRadius: '12px', padding: '18px 18px 16px', marginBottom: '10px' }
const comeRiga = { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 14px', cursor: 'pointer', font: 'inherit', color: 'inherit', WebkitAppearance: 'none' }
const page = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
