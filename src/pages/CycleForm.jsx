import { comePulsante } from '../lib/stile.js'
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyError } from '../lib/notify'
import { raggruppaEsercizi } from '../lib/schede'
// Con il parser CSV dietro: pesa solo per chi importa davvero.
const ImportaCsv = lazy(() => import('../components/ImportaCsv'))
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

// I giorni validi sono 1-3. Una riga con day nullo o fuori range faceva
// crashare l'app (map[e.day] undefined) invece di essere semplicemente ignorata.
const GIORNI = [1, 2, 3]
const giornoValido = d => GIORNI.includes(Number(d))


export default function CycleForm({ navigate, goBack, goHome, params }) {
  const { turnId, cycleId, cloneFromId, readOnly } = params
  const [step, setStep] = useState('info')
  const [cycleName, setCycleName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [day, setDay] = useState(1)
  const [exList, setExList] = useState({ 1: [], 2: [], 3: [] })
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [activeGroup, setActiveGroup] = useState(null)
  const [currentCycleId, setCurrentCycleId] = useState(cycleId || null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!cycleId)
  const [cloneInfo, setCloneInfo] = useState(null)
  const [editExerciseModal, setEditExerciseModal] = useState(null)
  const [editExerciseName, setEditExerciseName] = useState('')
  const [deleteExConfirm, setDeleteExConfirm] = useState(null)
  const [mostraImport, setMostraImport] = useState(false)
  const [usoEsercizio, setUsoEsercizio] = useState(null) // in quante schede è usato
  const [collapsedGroups, setCollapsedGroups] = useState({}) // label → bool

  // Drag state
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [gruppoSotto, setGruppoSotto] = useState(null) // etichetta del gruppo sotto il dito
  const rowRefs = useRef({})
  const scrollRef = useRef(null)
  const autoScrollRef = useRef(null)
  const repsTimers = useRef({})
  const repsPending = useRef({})
  const ultimoTocco = useRef({ x: 0, y: 0 })

  useEffect(() => {
    loadExercises()
    if (cycleId) loadExistingCycle()
    if (cloneFromId) loadClonePreview()
  }, [])

  // Se il coach esce dalla pagina subito dopo aver digitato, la scrittura
  // in attesa parte comunque invece di perdersi.
  useEffect(() => () => { Object.keys(repsPending.current).forEach(scriviReps) }, [])

  async function loadExercises() {
    const { data } = await run(
      supabase.from('exercises').select('*').order('name'),
      'Impossibile caricare il catalogo esercizi.'
    )
    setAllExercises((data || []).filter(e => e?.name))
  }

  async function loadClonePreview() {
    const { data } = await run(
      supabase.from('cycles').select('name').eq('id', cloneFromId).single(),
      'Impossibile leggere la scheda da clonare.'
    )
    setCloneInfo(data)
  }

  async function loadExistingCycle() {
    const { data: cycle } = await run(
      supabase.from('cycles').select('*').eq('id', cycleId).single(),
      'Impossibile caricare la scheda.'
    )
    if (cycle) { setCycleName(cycle.name); setStartDate(cycle.start_date || new Date().toISOString().split('T')[0]) }
    const { data: exData } = await run(
      supabase.from('cycle_exercises').select('*, exercises(name)').eq('cycle_id', cycleId).order('sort_order'),
      'Impossibile caricare gli esercizi della scheda.'
    )
    if (exData) {
      const map = { 1: [], 2: [], 3: [] }
      exData.forEach(e => {
        if (!e.exercises?.name || !giornoValido(e.day)) return
        map[e.day].push({ id: e.id, exerciseId: e.exercise_id, name: e.exercises.name, repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c, supersetGroup: e.superset_group || null })
      })
      setExList(map)
    }
    setLoading(false)
    setStep('exercises')
  }

  async function cloneExercises(newCycleId, sourceCycleId) {
    const { data: srcEx } = await run(
      supabase.from('cycle_exercises').select('*, exercises(name)').eq('cycle_id', sourceCycleId).order('sort_order'),
      'Impossibile leggere la scheda da clonare.'
    )
    if (!srcEx?.length) return
    const map = { 1: [], 2: [], 3: [] }
    const inserts = srcEx.filter(e => e.exercises?.name && giornoValido(e.day)).map((e, i) => ({
      cycle_id: newCycleId, exercise_id: e.exercise_id, day: e.day,
      reps_a: e.reps_a, reps_b: e.reps_b, reps_c: e.reps_c,
      sort_order: e.sort_order ?? i, superset_group: e.superset_group || null
    }))
    if (!inserts.length) return
    const { data: inserted } = await run(
      supabase.from('cycle_exercises').insert(inserts).select('*, exercises(name)'),
      'Clonazione non riuscita: gli esercizi non sono stati copiati.'
    )
    inserted?.forEach(e => {
      if (!e.exercises?.name || !giornoValido(e.day)) return
      map[e.day].push({ id: e.id, exerciseId: e.exercise_id, name: e.exercises.name, repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c, supersetGroup: e.superset_group || null })
    })
    setExList(map)
  }

  async function createCycle() {
    if (!cycleName.trim()) return
    setSaving(true)
    const { data } = await run(
      supabase.from('cycles').insert({ turn_id: turnId, name: cycleName, start_date: startDate, is_active: true }).select().single(),
      'Scheda non creata. Controlla la connessione e riprova.'
    )
    // Senza questo controllo data era null e `data.id` faceva schermata bianca.
    if (!data) { setSaving(false); return }
    setCurrentCycleId(data.id)
    if (cloneFromId) await cloneExercises(data.id, cloneFromId)
    setSaving(false)
    setStep('exercises')
  }

  function generateLabel(prefix) {
    const existing = new Set(Object.values(exList).flat().map(e => e.supersetGroup).filter(Boolean))
    for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      if (!existing.has(`${prefix}-${l}`)) return `${prefix}-${l}`
    }
    return `${prefix}-${Date.now()}`
  }

  async function addExercise(ex) {
    if (!ex?.id) return
    const supersetGroup = activeGroup?.label || null
    const isCircuit = activeGroup?.type === 'circuit'
    const newEx = { exerciseId: ex.id, name: ex.name, repsA: isCircuit ? '30s' : '3x8', repsB: isCircuit ? '15s' : '3x10', repsC: isCircuit ? '3' : '3x12', supersetGroup }
    if (currentCycleId) {
      const { data } = await run(
        supabase.from('cycle_exercises').insert({
          cycle_id: currentCycleId, exercise_id: ex.id, day,
          reps_a: newEx.repsA, reps_b: newEx.repsB, reps_c: newEx.repsC,
          sort_order: exList[day].length, superset_group: supersetGroup
        }).select().single(),
        `Impossibile aggiungere "${ex.name}" alla scheda.`
      )
      // Prima qui si leggeva data.id senza controlli: se l'insert falliva
      // l'app crashava invece di segnalare l'errore.
      if (!data) return
      newEx.id = data.id
    }
    setExList(prev => ({ ...prev, [day]: [...prev[day], newEx] }))
    setShowSearch(false); setSearch('')
  }

  async function addNewExercise(name) {
    const pulito = name.trim()
    if (!pulito) return

    // Se l'esercizio esiste già (anche scritto con maiuscole diverse) riusiamo
    // quello: evita i doppioni nel catalogo e l'insert che falliva sul vincolo
    // di unicità facendo crashare l'app.
    const { data: esistente } = await run(
      supabase.from('exercises').select('*').ilike('name', pulito).limit(1).maybeSingle(),
      'Impossibile consultare il catalogo esercizi.'
    )
    if (esistente) { await addExercise(esistente); return }

    const { data } = await run(
      supabase.from('exercises').insert({ name: pulito }).select().single(),
      `Impossibile creare l'esercizio "${pulito}".`
    )
    if (!data) return
    setAllExercises(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    await addExercise(data)
  }

  // Scrittura delle ripetizioni: prima partiva un UPDATE a ogni tasto premuto
  // ("3x10" = 5 richieste) e una risposta in ritardo poteva sovrascrivere il
  // valore finale. Ora si accumula e si scrive una volta sola.
  function scriviReps(exId) {
    const dati = repsPending.current[exId]
    if (!dati) return
    delete repsPending.current[exId]
    clearTimeout(repsTimers.current[exId])
    run(
      supabase.from('cycle_exercises')
        .update({ reps_a: dati.repsA, reps_b: dati.repsB, reps_c: dati.repsC }).eq('id', exId),
      `Ripetizioni di "${dati.nome}" non salvate.`
    )
  }

  function updateReps(d, idx, field, val) {
    const ex = exList[d][idx]
    const updated = { ...ex, [field]: val }
    setExList(prev => ({ ...prev, [d]: prev[d].map((e, i) => i === idx ? updated : e) }))
    if (!ex.id) return
    repsPending.current[ex.id] = { repsA: updated.repsA, repsB: updated.repsB, repsC: updated.repsC, nome: ex.name }
    clearTimeout(repsTimers.current[ex.id])
    repsTimers.current[ex.id] = setTimeout(() => scriviReps(ex.id), 600)
  }

  async function moveToDay(fromDay, idx, toDay) {
    const ex = exList[fromDay][idx]
    if (ex.id) {
      const { error } = await run(
        supabase.from('cycle_exercises').update({ day: toDay, sort_order: exList[toDay].length }).eq('id', ex.id),
        `Impossibile spostare "${ex.name}" al Giorno ${toDay}.`
      )
      if (error) return
    }
    setExList(prev => {
      const fromList = prev[fromDay].filter((_, i) => i !== idx)
      const toList = [...prev[toDay], { ...ex }]
      return { ...prev, [fromDay]: fromList, [toDay]: toList }
    })
  }

  async function moveExToGroup(fromIdx, targetGroupLabel) {
    const ex = exList[day][fromIdx]
    setDraggingIdx(null)
    setDragOverIdx(null)
    if (ex.id) {
      const { error } = await run(
        supabase.from('cycle_exercises').update({ superset_group: targetGroupLabel }).eq('id', ex.id),
        `Impossibile spostare "${ex.name}" nel gruppo.`
      )
      if (error) return
    }
    setExList(prev => ({ ...prev, [day]: prev[day].map((e, i) => i === fromIdx ? { ...e, supersetGroup: targetGroupLabel } : e) }))
  }

  function removeExercise(d, idx) {
    const ex = exList[d][idx]
    setDeleteExConfirm({ d, idx, name: ex.name })
  }

  async function executeRemoveExercise() {
    const { d, idx } = deleteExConfirm
    const ex = exList[d][idx]
    if (ex.id) {
      // client_loads ha ON DELETE CASCADE su cycle_exercises: i carichi
      // registrati per questo esercizio se ne vanno da soli.
      const { error } = await run(
        supabase.from('cycle_exercises').delete().eq('id', ex.id),
        `Impossibile eliminare "${ex.name}".`
      )
      if (error) { setDeleteExConfirm(null); return }
    }
    setExList(prev => ({ ...prev, [d]: prev[d].filter((_, i) => i !== idx) }))
    setDeleteExConfirm(null)
  }

  // `exercises` è un catalogo condiviso: rinominare una riga cambia il nome in
  // tutte le schede di tutti i turni, comprese quelle già completate, e riscrive
  // lo storico dell'atleta (che è raggruppato per nome). Prima succedeva in
  // silenzio; ora almeno diciamo quante schede ne saranno toccate.
  useEffect(() => {
    if (!editExerciseModal?.id) { setUsoEsercizio(null); return }
    let annullato = false
    ;(async () => {
      const { count } = await supabase
        .from('cycle_exercises')
        .select('id', { count: 'exact', head: true })
        .eq('exercise_id', editExerciseModal.id)
      if (!annullato) setUsoEsercizio(count ?? 0)
    })()
    return () => { annullato = true }
  }, [editExerciseModal])

  /**
   * Rinomina solo dentro questa scheda: invece di cambiare il nome nella riga
   * condivisa del catalogo, riusa (o crea) un esercizio con il nuovo nome e ci
   * ripunta le righe di QUESTA scheda soltanto. Le altre schede, comprese
   * quelle completate e quelle delle altre coach, restano intatte.
   * Non richiede alcuna modifica allo schema.
   */
  async function rinominaSoloQui() {
    const nuovo = editExerciseName.trim()
    if (!nuovo || !editExerciseModal || !currentCycleId) return
    const vecchioId = editExerciseModal.id

    const { data: esistente } = await run(
      supabase.from('exercises').select('*').ilike('name', nuovo).limit(1).maybeSingle(),
      'Impossibile consultare il catalogo esercizi.'
    )
    let destinazione = esistente
    if (!destinazione) {
      const { data } = await run(
        supabase.from('exercises').insert({ name: nuovo }).select().single(),
        `Impossibile creare l'esercizio "${nuovo}".`
      )
      if (!data) return
      destinazione = data
      setAllExercises(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }

    if (destinazione.id !== vecchioId) {
      const { error } = await run(
        supabase.from('cycle_exercises').update({ exercise_id: destinazione.id })
          .eq('cycle_id', currentCycleId).eq('exercise_id', vecchioId),
        'Rinomina non riuscita.'
      )
      if (error) return
    }

    setExList(prev => {
      const aggiornato = {}
      for (const d of [1, 2, 3]) {
        aggiornato[d] = prev[d].map(ex => ex.exerciseId === vecchioId
          ? { ...ex, exerciseId: destinazione.id, name: destinazione.name }
          : ex)
      }
      return aggiornato
    })
    setEditExerciseModal(null)
  }

  async function saveEditExercise() {
    if (!editExerciseName.trim() || !editExerciseModal) return
    const { error } = await run(
      supabase.from('exercises').update({ name: editExerciseName.trim() }).eq('id', editExerciseModal.id),
      'Nome dell\'esercizio non salvato.'
    )
    if (error) return
    setExList(prev => {
      const updated = {}
      for (const d of [1, 2, 3]) {
        updated[d] = prev[d].map(ex => ex.exerciseId === editExerciseModal.id ? { ...ex, name: editExerciseName.trim() } : ex)
      }
      return updated
    })
    setAllExercises(prev => prev.map(e => e.id === editExerciseModal.id ? { ...e, name: editExerciseName.trim() } : e))
    setEditExerciseModal(null)
  }

  // ── Drag & Drop with auto-scroll ──────────────────────────────────────────
  const getIndexFromY = useCallback((y) => {
    const list = exList[day]
    for (let i = 0; i < list.length; i++) {
      const el = rowRefs.current[i]
      if (!el) continue
      if (y < el.getBoundingClientRect().bottom) return i
    }
    return list.length - 1
  }, [exList, day])

  function startAutoScroll(clientY) {
    stopAutoScroll()
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const threshold = 80
    let speed = 0
    if (clientY < rect.top + threshold) speed = -6
    else if (clientY > rect.bottom - threshold) speed = 6
    if (speed !== 0) {
      autoScrollRef.current = setInterval(() => {
        el.scrollTop += speed
        setDragOverIdx(getIndexFromY(clientY))
      }, 16)
    }
  }

  function stopAutoScroll() {
    if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null }
  }

  /**
   * Sposta un esercizio di una posizione, con un tocco.
   *
   * Il trascinamento resta, ma richiede precisione e pazienza: su una lista
   * lunga, con il telefono in mano, è faticoso per chiunque. Due frecce sono
   * noiose e infallibili, e chi ha fretta continua a trascinare.
   */
  async function spostaDi(idx, verso) {
    const destinazione = idx + verso
    const lista = exList[day]
    if (destinazione < 0 || destinazione >= lista.length) return

    const nuova = [...lista]
    ;[nuova[idx], nuova[destinazione]] = [nuova[destinazione], nuova[idx]]
    setExList(prev => ({ ...prev, [day]: nuova }))

    // Solo le due righe scambiate cambiano posizione: due scritture, non N.
    const esiti = await Promise.all(
      [idx, destinazione]
        .filter(i => nuova[i]?.id)
        .map(i => supabase.from('cycle_exercises').update({ sort_order: i }).eq('id', nuova[i].id))
    )
    if (esiti.some(r => r.error)) {
      console.error('spostamento', esiti.filter(r => r.error).map(r => r.error))
      notifyError('Nuovo ordine non salvato. Ricarica la scheda per verificare.')
    }
  }

  function onDragStart(e, idx) {
    e.stopPropagation()
    setDraggingIdx(idx); setDragOverIdx(idx)
  }

  /**
   * Che gruppo c'è sotto il dito, se ce n'è uno.
   *
   * Qui prima c'era un onTouchEnd sull'intestazione del gruppo, e non è MAI
   * stato eseguito: gli eventi touch scattano sull'elemento dove il dito è
   * partito — la maniglia ⠿ — non dove è arrivato. Trascinare un esercizio
   * dentro una superserie sembrava funzionare e non faceva niente.
   * L'unico modo corretto è guardare cosa c'è alle coordinate del dito.
   */
  function gruppoSottoAl(x, y) {
    const el = document.elementFromPoint(x, y)
    return el?.closest?.('[data-gruppo]')?.dataset.gruppo ?? null
  }

  function onDragMove(e) {
    e.preventDefault()
    const t = e.touches[0]
    ultimoTocco.current = { x: t.clientX, y: t.clientY }
    const sopraGruppo = gruppoSottoAl(t.clientX, t.clientY)
    setGruppoSotto(sopraGruppo)
    // Sopra un'intestazione di gruppo non si riordina: si sta scegliendo dove
    // far entrare l'esercizio, e vedere la lista che si riorganizza confonde.
    if (!sopraGruppo) setDragOverIdx(getIndexFromY(t.clientY))
    startAutoScroll(t.clientY)
  }

  async function onDragEnd() {
    stopAutoScroll()
    const { x, y } = ultimoTocco.current
    const gruppo = gruppoSottoAl(x, y)
    setGruppoSotto(null)

    // Rilasciato su un'intestazione di gruppo: l'esercizio ci entra.
    if (gruppo !== null && draggingIdx !== null) {
      const ex = exList[day][draggingIdx]
      if (ex && ex.supersetGroup !== gruppo) {
        await moveExToGroup(draggingIdx, gruppo)
        return
      }
      setDraggingIdx(null); setDragOverIdx(null); return
    }

    if (draggingIdx === null || dragOverIdx === null || draggingIdx === dragOverIdx) {
      setDraggingIdx(null); setDragOverIdx(null); return
    }
    const precedente = exList[day]
    const newList = [...precedente]
    const [moved] = newList.splice(draggingIdx, 1)
    newList.splice(dragOverIdx, 0, moved)
    setExList(prev => ({ ...prev, [day]: newList }))
    setDraggingIdx(null); setDragOverIdx(null)

    // Prima partiva un UPDATE per ogni esercizio della lista, anche per quelli
    // rimasti al loro posto, e nessuno controllava l'esito.
    const daAggiornare = newList
      .map((ex, i) => ({ ex, i }))
      .filter(({ ex, i }) => ex.id && precedente[i]?.id !== ex.id)
    if (!daAggiornare.length) return
    const esiti = await Promise.all(daAggiornare.map(({ ex, i }) =>
      supabase.from('cycle_exercises').update({ sort_order: i }).eq('id', ex.id)
    ))
    const falliti = esiti.filter(r => r.error)
    if (falliti.length) {
      console.error('riordino esercizi', falliti.map(r => r.error))
      notifyError('Nuovo ordine non salvato del tutto. Ricarica la scheda per verificare.')
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const getGroups = () => raggruppaEsercizi(exList[day], { indice: true })

  const filtered = allExercises.filter(e => e?.name && e.name.toLowerCase().includes(search.toLowerCase()))

  // "Solo in questa scheda" ha senso soltanto se l'esercizio è davvero usato qui:
  // dal catalogo di ricerca si può rinominare solo globalmente.
  const usatoInQuestaScheda = Boolean(
    currentCycleId && editExerciseModal &&
    Object.values(exList).flat().some(e => e.exerciseId === editExerciseModal.id)
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--fondo)' }}>
      <div style={{ color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', letterSpacing: '2px' }}>CARICAMENTO...</div>
    </div>
  )

  if (step === 'info') return (
    <div style={page}>
      <TopBar title="NUOVA SCHEDA" subtitle="Informazioni base" onBack={goBack} />
      <div style={scroll}>
        {cloneInfo && (
          <div style={{ background: 'var(--acc-fondo)', border: '1px solid var(--acc-bordo-tenue)', borderRadius: '6px', padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📋</span>
            <div>
              <div style={{ color: 'var(--accento)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>CLONANDO DA</div>
              <div style={{ color: 'var(--testo-forte)', fontSize: '14px', marginTop: '1px' }}>{cloneInfo?.name}</div>
            </div>
          </div>
        )}
        <div style={fieldLabel}>NOME SCHEDA</div>
        <input value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="es. 4a Scheda Maggio 2026" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '16px' }}>DATA DI INIZIO</div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
        <button onClick={createCycle} disabled={!cycleName.trim() || saving}
          style={{ ...bigBtn, marginTop: '28px', opacity: !cycleName.trim() ? 0.3 : 1 }}>
          {saving ? (cloneFromId ? 'CLONO...' : 'CREAZIONE...') : (cloneFromId ? '📋 CLONA E INIZIA' : 'AVANTI → INSERISCI ESERCIZI')}
        </button>
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )

  const groups = getGroups()

  return (
    <div style={{ ...page, position: 'relative' }}>
      <TopBar title={cycleName.toUpperCase()} subtitle={readOnly ? 'Sola lettura' : 'Gestione esercizi'} onBack={goBack} />

      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => { setDay(d); setActiveGroup(null) }} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? 'var(--accento)' : 'var(--sup)',
            color: day === d ? '#fff' : 'var(--testo-debole)'
          }}>GIORNO {d}</button>
        ))}
      </div>

      {!readOnly && exList[day].length > 1 && (
        <div style={{ padding: '5px 16px', background: 'var(--sup-velo)', borderBottom: '1px solid var(--sup)' }}>
          <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', textAlign: 'center' }}>
            ⠿ TIENI PREMUTO E TRASCINA — SCORRE AUTOMATICAMENTE
          </div>
        </div>
      )}

      <div ref={scrollRef} style={scroll}>
        {groups.length === 0 && (
          <div style={{ color: 'var(--bordo-forte)', fontSize: '14px', textAlign: 'center', padding: '32px', border: '1px dashed var(--sup-alta)', borderRadius: '6px', marginBottom: '12px' }}>
            Nessun esercizio per il Giorno {day}
          </div>
        )}

        {groups.map((group, gi) => {
          const isCircuit = group.type === 'circuit'
          const isSuperSet = group.type === 'superset'
          const isGroup = isCircuit || isSuperSet
          const accent = isCircuit ? 'var(--circuito)' : 'var(--accento)'
          const bgColor = isCircuit ? 'rgba(59,130,246,0.06)' : isSuperSet ? 'var(--acc-velo)' : 'var(--sup)'
          const borderColor = isCircuit ? 'rgba(59,130,246,0.2)' : isSuperSet ? 'var(--acc-riempimento-forte)' : 'var(--sup-alta)'
          const isCollapsed = collapsedGroups[group.label]

          return (
            <div key={gi} style={{ marginBottom: '10px' }}>
              {isGroup && (
                <div
                  onClick={() => draggingIdx === null && setCollapsedGroups(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                  data-gruppo={group.label}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isCollapsed ? '0' : '6px', cursor: 'pointer',
                    background: gruppoSotto === group.label ? `rgba(${isCircuit?'59,130,246':'217,92,26'},0.28)`
                      : draggingIdx !== null ? `rgba(${isCircuit?'59,130,246':'217,92,26'},0.10)` : 'transparent',
                    borderRadius: '4px', padding: draggingIdx !== null ? '4px 6px' : '0',
                    border: draggingIdx !== null ? `${gruppoSotto === group.label ? '2px solid' : '1px dashed'} ${accent}` : 'none',
                  }}>
                  <div style={{ color: accent, fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {isCircuit ? '🔄 CIRCUITO' : '⚡ SUPERSERIE'} {group.label.replace('SS-','').replace('CIR-','')}
                  </div>
                  {/* Un gruppo con un esercizio solo è quasi sempre il residuo di
                      una cancellazione: l'etichetta resta attaccata al superstite
                      e nessuno se ne accorge finché non si guarda il database. */}
                  {group.exercises.length === 1 && (
                    <div style={{ color: 'var(--attenzione)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '3px', padding: '2px 6px' }}>
                      ⚠ DA SOLO
                    </div>
                  )}
                  <div style={{ flex: 1, height: '1px', background: `${accent}44` }} />
                  <div style={{ color: accent, fontSize: '14px' }}>{isCollapsed ? '▶' : '▼'}</div>
                </div>
              )}

              {!isCollapsed && group.exercises.map((ex) => {
                const isDragging = draggingIdx === ex.idx
                const isOver = dragOverIdx === ex.idx && draggingIdx !== ex.idx
                return (
                  <div key={ex.idx} ref={el => rowRefs.current[ex.idx] = el}
                    style={{
                      background: isDragging ? `rgba(${isCircuit?'59,130,246':'217,92,26'},0.15)` : bgColor,
                      border: isOver ? `2px dashed ${accent}` : `1px solid ${borderColor}`,
                      borderLeft: !isOver && isGroup ? `2px solid ${accent}` : undefined,
                      borderRadius: '6px', padding: '12px 14px', marginBottom: '6px',
                      opacity: isDragging ? 0.5 : 1, transition: 'border 0.1s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: readOnly ? 0 : '10px' }}>
                      {!readOnly && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                          {/* Frecce: noiose e infallibili. Chi ha fretta trascina la maniglia. */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <button type="button" aria-label={`Sposta ${ex.name} in su`}
                              onPointerUp={e => { e.stopPropagation(); spostaDi(ex.idx, -1) }}
                              disabled={ex.idx === 0}
                              style={{ ...freccia, opacity: ex.idx === 0 ? 0.2 : 1 }}>▲</button>
                            <button type="button" aria-label={`Sposta ${ex.name} in giù`}
                              onPointerUp={e => { e.stopPropagation(); spostaDi(ex.idx, 1) }}
                              disabled={ex.idx === exList[day].length - 1}
                              style={{ ...freccia, opacity: ex.idx === exList[day].length - 1 ? 0.2 : 1 }}>▼</button>
                          </div>
                          <div onTouchStart={e => onDragStart(e, ex.idx)} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
                            style={{ fontSize: '20px', color: 'var(--testo-fioco)', cursor: 'grab', padding: '4px 6px', userSelect: 'none', touchAction: 'none' }}>⠿</div>
                        </div>
                      )}
                      <div style={{ flex: 1, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{ex.name}</div>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button onPointerUp={e => { e.stopPropagation(); setEditExerciseModal({ id: ex.exerciseId, name: ex.name }); setEditExerciseName(ex.name) }}
                            style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '3px', padding: '4px 8px', color: 'var(--testo-medio)', fontSize: '14px', touchAction: 'manipulation' }}>✏️</button>
                          {[1,2,3].filter(d => d !== day).map(targetDay => (
                            <button key={targetDay} onPointerUp={e => { e.stopPropagation(); moveToDay(day, ex.idx, targetDay) }}
                              style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '3px', padding: '3px 7px', color: 'var(--testo-debole)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', lineHeight: 1, touchAction: 'manipulation' }}>
                              G{targetDay}
                            </button>
                          ))}
                          <button onPointerUp={e => { e.stopPropagation(); removeExercise(day, ex.idx) }}
                            style={{ background: 'none', border: 'none', color: 'var(--acc-bordo-marcato)', fontSize: '18px', padding: '4px 6px', touchAction: 'manipulation' }}>✕</button>
                        </div>
                      )}
                    </div>
                    {!readOnly && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        {isCircuit
                          ? [['repsA','DURATA'],['repsB','RIPOSO'],['repsC','GIRI']].map(([field, label]) => (
                            <div key={field}>
                              <div style={{ color: 'rgba(59,130,246,0.7)', fontSize: '12px', letterSpacing: '1px', marginBottom: '3px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</div>
                              <input value={ex[field]} onChange={e => updateReps(day, ex.idx, field, e.target.value)} onBlur={() => scriviReps(ex.id)} style={{ ...repsInp, borderColor: 'rgba(59,130,246,0.2)' }} />
                            </div>
                          ))
                          : [['repsA','SETT.1-2'],['repsB','SETT.3-4'],['repsC','SETT.5-6']].map(([field, label]) => (
                            <div key={field}>
                              <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', letterSpacing: '1px', marginBottom: '3px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</div>
                              <input value={ex[field]} onChange={e => updateReps(day, ex.idx, field, e.target.value)} onBlur={() => scriviReps(ex.id)} style={repsInp} />
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )
              })}

              {!readOnly && isGroup && !isCollapsed && (
                <button onClick={() => { setActiveGroup({ label: group.label, type: group.type }); setShowSearch(true) }}
                  style={{ width: '100%', borderRadius: '6px', padding: '9px', marginBottom: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1.5px', background: isCircuit ? 'rgba(59,130,246,0.08)' : 'var(--acc-fondo)', border: `1px dashed ${isCircuit ? 'rgba(59,130,246,0.35)' : 'var(--acc-bordo)'}`, color: accent }}>
                  {isCircuit ? '🔄' : '⚡'} + AGGIUNGI A {group.label.replace('SS-','').replace('CIR-','')}
                </button>
              )}
            </div>
          )
        })}

        {!readOnly && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginTop: '8px' }}>
            <button onClick={() => { setActiveGroup(null); setShowSearch(true) }} style={{ ...bigBtn, fontSize: '13px', padding: '11px 6px', letterSpacing: '0.5px' }}>+ ESERCIZIO</button>
            <button onClick={() => { setActiveGroup({ label: generateLabel('SS'), type: 'superset' }); setShowSearch(true) }}
              style={{ ...bigBtn, fontSize: '13px', padding: '11px 6px', letterSpacing: '0.5px', background: 'var(--acc-fondo-forte)', border: '1px solid var(--acc-bordo)', color: 'var(--accento)' }}>⚡ SUPERSERIE</button>
            <button onClick={() => { setActiveGroup({ label: generateLabel('CIR'), type: 'circuit' }); setShowSearch(true) }}
              style={{ ...bigBtn, fontSize: '13px', padding: '11px 6px', letterSpacing: '0.5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.35)', color: 'var(--circuito)' }}>🔄 CIRCUITO</button>
          </div>
        )}

        {!readOnly && currentCycleId && (
          <button onClick={() => setMostraImport(true)}
            style={{ ...bigBtn, marginTop: '10px', background: 'transparent', border: '1px solid var(--bordo-forte)', color: 'var(--testo-chiaro)', fontSize: '13px', letterSpacing: '1px' }}>
            ⬆ IMPORTA DA CSV
          </button>
        )}

        {!readOnly && exList[day].length > 0 && (
          <button onClick={goBack} style={{ ...bigBtn, marginTop: '10px' }}>✓ SALVA E TORNA</button>
        )}
        <div style={{ height: '24px' }} />
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--fondo)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sup-alta)' }}>
            {activeGroup && (
              <div style={{ color: activeGroup.type === 'circuit' ? 'var(--circuito)' : 'var(--accento)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700' }}>
                {activeGroup.type === 'circuit' ? '🔄 CIRCUITO' : '⚡ SUPERSERIE'} {activeGroup.label.replace('SS-','').replace('CIR-','')}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca esercizio..." style={{ ...inp, flex: 1 }} />
              <button onClick={() => { setShowSearch(false); setSearch(''); setActiveGroup(null) }}
                style={{ color: 'var(--testo-medio)', background: 'none', border: 'none', fontSize: '14px', whiteSpace: 'nowrap' }}>Annulla</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
            {search.length > 1 && filtered.length === 0 && (
              <button onClick={() => addNewExercise(search)} style={{ ...bigBtn, background: 'var(--sup)', border: '1px solid var(--acc-bordo-forte)', color: 'var(--accento)', marginBottom: '8px' }}>
                + AGGIUNGI "{search.toUpperCase()}"
              </button>
            )}
            {filtered.map(ex => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <button type="button" onClick={() => addExercise(ex)} style={{ ...comePulsante,  flex: 1, padding: '14px 16px', background: 'var(--sup)', borderRadius: '6px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '600', color: '#fff', cursor: 'pointer', border: '1px solid var(--sup-alta)' }}>{ex.name}</button>
                <button onClick={() => { setEditExerciseModal(ex); setEditExerciseName(ex.name) }}
                  style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '10px 12px', color: 'var(--testo-medio)', fontSize: '14px', flexShrink: 0 }}>✏️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostraImport && (
        <Suspense fallback={null}><ImportaCsv
          cycleId={currentCycleId}
          esistentiPerGiorno={{ 1: exList[1].length, 2: exList[2].length, 3: exList[3].length }}
          onFatto={() => { setMostraImport(false); loadExistingCycle() }}
          onClose={() => setMostraImport(false)}
        /></Suspense>
      )}

      {/* Delete confirm modal */}
      {deleteExConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }}>ELIMINA ESERCIZIO</div>
            <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginBottom: '4px' }}>Confermi di voler eliminare</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '20px' }}>{deleteExConfirm?.name}?</div>
            <button onClick={executeRemoveExercise} style={{ width: '100%', background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '4px', padding: '14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', marginBottom: '10px' }}>
              🗑 SÌ, ELIMINA
            </button>
            <button onClick={() => setDeleteExConfirm(null)} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '8px', fontSize: '14px' }}>Annulla</button>
          </div>
        </div>
      )}

      {/* Edit exercise modal */}
      {editExerciseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '16px' }}>MODIFICA ESERCIZIO</div>
            <input value={editExerciseName} onChange={e => setEditExerciseName(e.target.value)} placeholder="Nome esercizio" autoFocus
              style={{ width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
            {usoEsercizio !== null && usoEsercizio > 1 && (
              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                <div style={{ color: 'var(--attenzione)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', marginBottom: '3px' }}>
                  ⚠ USATO IN {usoEsercizio} SCHEDE
                </div>
                <div style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.4 }}>
                  Il catalogo esercizi è condiviso fra tutte le coach.
                  {usatoInQuestaScheda
                    ? ' Rinominare in tutte le schede cambia il nome anche in quelle già completate e nello storico degli atleti.'
                    : ' Il nuovo nome comparirà ovunque, anche nelle schede già completate.'}
                </div>
              </div>
            )}
            {/* Due strade, perché sono due intenzioni diverse: correggere un
                refuso nel catalogo (ovunque) o chiamare diversamente un
                esercizio in questa scheda (solo qui). Prima esisteva solo la
                prima, applicata in silenzio. */}
            {usatoInQuestaScheda && (
              <button onClick={rinominaSoloQui} disabled={!editExerciseName.trim()}
                style={{ width: '100%', background: 'var(--accento)', border: 'none', borderRadius: '4px', padding: '14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1px', marginBottom: '8px', opacity: !editExerciseName.trim() ? 0.3 : 1 }}>
                ✓ SOLO IN QUESTA SCHEDA
              </button>
            )}
            <button onClick={saveEditExercise} disabled={!editExerciseName.trim()}
              style={{
                width: '100%',
                background: usatoInQuestaScheda ? 'transparent' : 'var(--accento)',
                border: usatoInQuestaScheda ? '1px solid var(--testo-fioco)' : 'none',
                borderRadius: '4px', padding: '14px',
                color: usatoInQuestaScheda ? 'var(--testo-forte)' : '#fff',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1px', marginBottom: '10px',
                opacity: !editExerciseName.trim() ? 0.3 : 1,
              }}>
              {usatoInQuestaScheda ? 'RINOMINA IN TUTTE LE SCHEDE' : '✓ SALVA'}
            </button>
            <button onClick={() => setEditExerciseModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '8px', fontSize: '14px' }}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const fieldLabel = { color: 'var(--testo-debole)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '14px 16px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }
// 26x22: piccole ma raggiungibili col pollice, e non rubano spazio al nome.
const freccia = {
  width: '26px', height: '22px', flexShrink: 0,
  background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '3px',
  color: 'var(--testo-medio)', fontSize: '12px', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, touchAction: 'manipulation', cursor: 'pointer',
}
const repsInp = { width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '9px 4px', color: '#fff', fontSize: '16px', outline: 'none', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '600', minHeight: '42px' }
const bigBtn = { width: '100%', background: 'var(--accento)', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
