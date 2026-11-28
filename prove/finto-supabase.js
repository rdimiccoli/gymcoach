/**
 * Un Supabase finto, in memoria, per le prove automatiche.
 *
 * Risponde come quello vero alle domande che l'app fa (select con filtri,
 * ordine e pagine, insert, upsert, update, delete, storage), ma con dati
 * inventati: un turno alle 13:30 con una scheda finita da due settimane,
 * persone doppie, un esercizio scritto in due modi, chi non si vede da un
 * mese. Ogni pagina ricaricata riparte da qui.
 *
 * Le prove fermano l'orologio al 27/11/2026 alle 13:35 (vedi app.spec.js).
 */

let contatore = 0
const nuovoId = p => `${p}${++contatore}`

const db = {
  coaches: [
    { id: 'c1', name: 'Sandro', emoji: '🏋️', vista: 'esercizi', foto: null, nascosto: false },
    { id: 'c2', name: 'Manu', emoji: '💪', vista: null, foto: null, nascosto: false },
  ],
  turns: [
    { id: 't2', name: '13:30 — Maschile', time: '13:30', type: 'Maschile', coach_id: 'c1', sort_order: null },
    { id: 't3', name: '09:00 — Misto', time: '09:00', type: 'Misto', coach_id: 'c2', sort_order: null },
    { id: 't4', name: '19:00 — Donne', time: '19:00', type: 'Donne', coach_id: 'c1', sort_order: null },
  ],
  clients: [
    { id: 'p1', name: 'Marco', surname: 'Bianchi', turn_id: 't2', is_active: true, sort_order: null, created_at: '2026-08-01' },
    { id: 'p2', name: 'Luca', surname: 'Spira', turn_id: 't2', is_active: true, sort_order: null, nota: 'arriva tardi', created_at: '2026-08-01' },
    { id: 'dup', name: 'MARIA', surname: 'ROSSI', turn_id: 't2', is_active: true, nota: 'nuova', created_at: '2026-11-20' },
    { id: 'm1', name: 'Alessia', surname: 'Conte', turn_id: 't3', is_active: true, silver: true, created_at: '2026-09-01' },
    { id: 'm3', name: 'Greta', surname: 'Ferri', turn_id: 't4', is_active: true, created_at: '2026-09-01' },
    { id: 'm4', name: 'Maria', surname: 'Rossi', turn_id: 't4', is_active: true, silver: true, created_at: '2026-09-01' },
    { id: 'm5', name: 'Paola', surname: 'Esposito', turn_id: 't3', is_active: false, created_at: '2026-09-01' },
  ],
  cycles: [
    { id: 'old', turn_id: 't2', name: 'Scheda Agosto', start_date: '2026-08-03', is_active: false, settimane: null, giorni: null, created_at: '2026-08-03' },
    { id: 's2', turn_id: 't2', name: 'Scheda Forza I', start_date: '2026-09-21', is_active: true, settimane: 8, giorni: 2, created_at: '2026-09-21' },
    { id: 's3', turn_id: 't3', name: 'Scheda Manu', start_date: '2026-10-19', is_active: true, settimane: 8, giorni: 2, created_at: '2026-10-19' },
  ],
  exercises: [
    { id: 'e1', name: 'Squat' }, { id: 'e2', name: 'Panca piana' }, { id: 'e3', name: 'Rematore manubrio' },
    { id: 'e4', name: 'Lat machine' }, { id: 'e5', name: 'Burpees' }, { id: 'e6', name: 'Kettlebell swing' },
    { id: 'e7', name: 'Military press' }, { id: 'av1', name: 'Alzate a V' }, { id: 'av2', name: 'Alzate AV' },
  ],
  cycle_exercises: [], client_loads: [], client_notes: [], cycle_clients: [], client_visits: [], giorni_persona: [],
  errori_app: [],
  segnalazioni: [],
  ultimi_allenamenti: [
    { client_id: 'p1', ultimo: '2026-11-25T18:00:00Z', pesi: 17 },
    { client_id: 'p2', ultimo: '2026-10-28T18:00:00Z', pesi: 1 },
    { client_id: 'm4', ultimo: '2026-11-24T09:00:00Z', pesi: 22 },
    { client_id: 'dup', ultimo: '2026-11-21T13:30:00Z', pesi: 2 },
  ],
  andamento_settimane: [
    { settimana: '2026-10-26', coach_id: 'c1', tutti: false, persone: 12, pesi: 60 },
    { settimana: '2026-11-02', coach_id: 'c1', tutti: false, persone: 30, pesi: 150 },
    { settimana: '2026-11-09', coach_id: 'c1', tutti: false, persone: 52, pesi: 300 },
    { settimana: '2026-11-16', coach_id: 'c1', tutti: false, persone: 61, pesi: 320 },
    { settimana: '2026-11-23', coach_id: 'c1', tutti: false, persone: 58, pesi: 280 },
    { settimana: '2026-11-09', coach_id: 'c2', tutti: false, persone: 40, pesi: 210 },
    { settimana: '2026-11-16', coach_id: 'c2', tutti: false, persone: 44, pesi: 230 },
    { settimana: '2026-11-23', coach_id: 'c2', tutti: false, persone: 41, pesi: 190 },
    // I totali della palestra: chi si allena con due coach conta una volta.
    { settimana: '2026-10-26', coach_id: null, tutti: true, persone: 12, pesi: 60 },
    { settimana: '2026-11-02', coach_id: null, tutti: true, persone: 30, pesi: 150 },
    { settimana: '2026-11-09', coach_id: null, tutti: true, persone: 90, pesi: 510 },
    { settimana: '2026-11-16', coach_id: null, tutti: true, persone: 103, pesi: 550 },
    { settimana: '2026-11-23', coach_id: null, tutti: true, persone: 97, pesi: 470 },
  ],
}

// Le due schede del turno delle 13:30: giorno 1 squat, panca, superserie; giorno 2 military e un circuito.
const piano = [[1, 'e1'], [1, 'e2'], [1, 'e3', 'SS-A'], [1, 'e4', 'SS-A'], [2, 'e7'], [2, 'e5', 'CIR-A'], [2, 'e6', 'CIR-A']]
for (const s of ['old', 's2', 's3']) piano.forEach(([day, ex, g], i) => {
  const circuito = g?.startsWith('CIR')
  db.cycle_exercises.push({
    id: `${s}_${ex}`, cycle_id: s, exercise_id: ex, day, sort_order: i, superset_group: g || null,
    reps_a: circuito ? '40s' : '4x10', reps_b: circuito ? '20s' : '4x8', reps_c: circuito ? '3' : '5x5',
  })
})
// Lo storico di Marco: lo squat sale (a salti di 2,5), la panca resta ferma.
const storico = {
  e1: [['old', [40, 42.5, 45, 45, 47.5, 47.5]], ['s2', [47.5, 50, 47.5, 52.5]]],
  e2: [['old', [30, 30, 30]], ['s2', [30, 30]]],
  e3: [['old', [20, 22.5]], ['s2', [22.5, 20]]],
  e7: [['s2', [25]]],
}
for (const [ex, parti] of Object.entries(storico)) {
  for (const [s, pesi] of parti) pesi.forEach((kg, w) => db.client_loads.push({
    id: nuovoId('l'), client_id: 'p1', cycle_exercise_id: `${s}_${ex}`, week: w + 1, kg, updated_at: '2026-11-20T13:40:00Z',
  }))
}
db.client_loads.push({ id: 'lp2', client_id: 'p2', cycle_exercise_id: 'old_e1', week: 3, kg: 70, updated_at: '2026-10-28T18:00:00Z' })
// La panca di Marco la settimana scorsa (la 9, extra): oggi si propone 30 + un ottavo → 35.
db.client_loads.push({ id: 'lpanca9', client_id: 'p1', cycle_exercise_id: 's2_e2', week: 9, kg: 30, updated_at: '2026-11-20T13:40:00Z' })

// ── I valori che il database mette da solo ───────────────────────────────
const predefiniti = {
  segnalazioni: () => ({ creata: new Date().toISOString(), stato: 'nuova', risposta: null, aggiornata: null, anche_io: [] }),
  errori_app: () => ({ quando: new Date().toISOString() }),
}

// ── Le relazioni che l'app chiede insieme alle righe ─────────────────────
function conRelazioni(riga, tabella) {
  const r = { ...riga }
  if (tabella === 'cycle_exercises') r.exercises = { name: db.exercises.find(e => e.id === riga.exercise_id)?.name }
  if (tabella === 'client_loads') {
    const ce = db.cycle_exercises.find(z => z.id === riga.cycle_exercise_id)
    r.cycle_exercises = ce && { exercise_id: ce.exercise_id, cycle_id: ce.cycle_id }
  }
  if (tabella === 'clients') {
    const t = db.turns.find(z => z.id === riga.turn_id)
    r.turns = t && { name: t.name, time: t.time, coaches: { name: db.coaches.find(c => c.id === t.coach_id)?.name } }
  }
  return r
}

function domanda(tabella, operazione, dati) {
  const filtri = []
  const ordine = []
  let uno = false
  let soloConteggio = false
  let pagina = null
  const q = {
    select(_c, o) { if (o?.head) soloConteggio = true; return q },
    eq(k, v) { filtri.push(r => r[k] === v); return q },
    neq(k, v) { filtri.push(r => r[k] !== v); return q },
    // Un filtro sulle righe collegate («cycle_exercises.exercise_id») qui non serve: passa.
    in(k, v) { filtri.push(r => k.includes('.') || v.includes(r[k])); return q },
    not(k) { filtri.push(r => r[k] != null); return q },
    gte(k, v) { filtri.push(r => r[k] == null || r[k] >= v); return q },
    lte(k, v) { filtri.push(r => r[k] == null || r[k] <= v); return q },
    is() { return q }, ilike() { return q }, or() { return q }, limit() { return q }, setHeader() { return q },
    range(a, z) { pagina = [a, z]; return q },
    order(k, o) { ordine.push([k, o?.ascending !== false]); return q },
    maybeSingle() { uno = true; return q }, single() { uno = true; return q },
    then(ok, ko) {
      const tab = db[tabella] || (db[tabella] = [])
      let righe = tab.filter(r => filtri.every(f => f(r)))
      let risposta = { data: [], error: null }
      if (operazione === 'select') {
        for (const [k, cresce] of [...ordine].reverse()) {
          righe = [...righe].sort((a, b) => (a[k] == null) - (b[k] == null) || (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (cresce ? 1 : -1))
        }
        const tutte = righe.length
        if (pagina) righe = righe.slice(pagina[0], pagina[1] + 1)
        const data = righe.map(r => conRelazioni(r, tabella))
        risposta = { data: soloConteggio ? null : uno ? (data[0] ?? null) : data, count: tutte, error: null }
      } else if (operazione === 'insert' || operazione === 'upsert') {
        const nuove = (Array.isArray(dati) ? dati : [dati]).map(x => ({ id: nuovoId('n'), ...(predefiniti[tabella]?.() || {}), ...x }))
        tab.push(...nuove)
        risposta = { data: nuove, error: null }
      } else if (operazione === 'update') {
        // Come il trigger della migrazione: stato o risposta cambiati → l'ora la mette il database.
        const ora = tabella === 'segnalazioni' && ('stato' in dati || 'risposta' in dati) ? { aggiornata: new Date().toISOString() } : {}
        righe.forEach(r => Object.assign(r, dati, ora))
        risposta = { data: righe, error: null }
      } else if (operazione === 'delete') {
        db[tabella] = tab.filter(r => !filtri.every(f => f(r)))
      }
      return Promise.resolve(risposta).then(ok, ko)
    },
  }
  return q
}

// ── Lo storage: i file delle copie di sicurezza ──────────────────────────
const cartelle = {}
const storage = {
  from: secchio => ({
    upload: async (percorso, corpo) => {
      (cartelle[secchio] ||= {})[percorso] = { corpo, quando: new Date().toISOString() }
      return { data: { path: percorso }, error: null }
    },
    list: async () => ({
      data: Object.entries(cartelle[secchio] || {}).map(([name, f]) => ({ name, created_at: f.quando })),
      error: null,
    }),
    download: async percorso => {
      const f = cartelle[secchio]?.[percorso]
      return f ? { data: new Blob([f.corpo]), error: null } : { data: null, error: { message: 'Object not found' } }
    },
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    createSignedUrl: async percorso => {
      const f = cartelle[secchio]?.[percorso]
      return f ? { data: { signedUrl: URL.createObjectURL(f.corpo) }, error: null } : { data: null, error: { message: 'Object not found' } }
    },
  }),
}

const sessione = { user: { id: 'u1', email: 'palestra@esempio.it' } }

export const supabase = {
  from: t => ({
    select: (...a) => domanda(t, 'select').select(...a),
    insert: d => domanda(t, 'insert', d),
    upsert: d => domanda(t, 'upsert', d),
    update: d => domanda(t, 'update', d),
    delete: () => domanda(t, 'delete'),
  }),
  auth: {
    getSession: async () => ({ data: { session: sessione } }),
    getUser: async () => ({ data: { user: sessione.user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({}),
  },
  storage,
  // Le funzioni del database: per ora solo «✋ anche io».
  rpc: async (nome, a) => {
    if (nome !== 'segnalazione_anche_io') return { data: null, error: { message: `funzione ${nome} sconosciuta` } }
    const s = db.segnalazioni.find(x => x.id === a.segnalazione)
    if (!s) return { data: null, error: null }
    const senza = (s.anche_io || []).filter(id => id !== a.chi)
    s.anche_io = a.voglio ? [...senza, a.chi] : senza
    return { data: s.anche_io, error: null }
  },
}

// Per le prove: guardare dentro il database finto dalla pagina.
if (typeof window !== 'undefined') window.__dbFinto = db

// Per le prove con il collegamento vero (rete.spec.js): gli stessi dati,
// serviti come li servirebbe Supabase.
export { db as datiFinti, conRelazioni }
