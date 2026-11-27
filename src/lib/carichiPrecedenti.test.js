import { describe, it, expect, vi } from 'vitest'
import { ultimiCarichiPrima } from './carichiPrecedenti'

const riga = (client_id, exercise_id, cycle_id, start_date, week, kg, name = cycle_id, created_at = `${start_date}T08:00:00`) =>
  ({ client_id, week, kg, cycle_exercise_id: `${cycle_id}_${exercise_id}`, cycle_exercises: { exercise_id, cycle_id, cycles: { name, start_date, created_at } } })

const nuova = { id: 'nuova', start_date: '2026-11-09', created_at: '2026-11-09T10:00:00' }

describe('il carico della volta prima, da un altra scheda', () => {
  it('prende l ultima settimana della scheda più recente', () => {
    const u = ultimiCarichiPrima([
      riga('marco', 'squat', 'agosto', '2026-08-03', 6, 45, 'Scheda Agosto'),
      riga('marco', 'squat', 'forza', '2026-09-21', 3, 50, 'Forza I'),
      riga('marco', 'squat', 'forza', '2026-09-21', 8, 52.5, 'Forza I'),
      riga('marco', 'squat', 'forza', '2026-09-21', 5, 55, 'Forza I'),
    ], nuova)
    expect(u.marco_squat).toMatchObject({ kg: 52.5, settimana: 8, scheda: 'Forza I' })
  })

  it('dice da quale riga e scheda viene, per ritrovarne le ripetizioni', () => {
    const u = ultimiCarichiPrima([riga('marco', 'squat', 'forza', '2026-09-21', 8, 52.5)], nuova)
    expect(u.marco_squat).toMatchObject({ idScheda: 'forza', idRiga: 'forza_squat' })
  })

  it('persone ed esercizi restano separati', () => {
    const u = ultimiCarichiPrima([
      riga('marco', 'squat', 'forza', '2026-09-21', 8, 52.5),
      riga('luca', 'squat', 'forza', '2026-09-21', 8, 70),
      riga('marco', 'panca', 'forza', '2026-09-21', 8, 30),
    ], nuova)
    expect(u.marco_squat.kg).toBe(52.5)
    expect(u.luca_squat.kg).toBe(70)
    expect(u.marco_panca.kg).toBe(30)
  })

  it('mai dalla scheda aperta, che ha già i suoi', () => {
    const u = ultimiCarichiPrima([riga('marco', 'squat', 'nuova', '2026-11-09', 1, 60)], nuova)
    expect(u.marco_squat).toBeUndefined()
  })

  it('mai da una scheda iniziata dopo: guardando una scheda vecchia non è la volta prima', () => {
    const vecchia = { id: 'agosto', start_date: '2026-08-03' }
    const u = ultimiCarichiPrima([
      riga('marco', 'squat', 'luglio', '2026-07-01', 6, 40),
      riga('marco', 'squat', 'forza', '2026-09-21', 8, 52.5),
    ], vecchia)
    expect(u.marco_squat.kg).toBe(40)
  })

  it('una scheda partita lo stesso giorno conta solo se creata prima', () => {
    // Tre programmi nello stesso turno, partiti insieme il 9/11.
    const u = ultimiCarichiPrima([
      riga('marco', 'squat', 'agosto', '2026-08-03', 6, 45),
      riga('marco', 'squat', 'gemella', '2026-11-09', 2, 60, 'Programma B', '2026-11-09T11:00:00'),
    ], nuova)
    expect(u.marco_squat.kg).toBe(45)
    const v = ultimiCarichiPrima([
      riga('marco', 'squat', 'agosto', '2026-08-03', 6, 45),
      riga('marco', 'squat', 'vecchia', '2026-11-09', 1, 50, 'Programma A', '2026-11-09T09:00:00'),
    ], nuova)
    expect(v.marco_squat.kg).toBe(50)
  })

  it('senza data d\'inizio decide la creazione, e nel dubbio niente', () => {
    const senzaData = { id: 'x', start_date: null, created_at: '2026-11-01T10:00:00' }
    const u = ultimiCarichiPrima([
      riga('marco', 'squat', 'prima', '2026-10-01', 6, 45, 'Prima', '2026-10-01T08:00:00'),
      riga('marco', 'squat', 'dopo', '2026-11-20', 1, 70, 'Dopo', '2026-11-20T08:00:00'),
    ], senzaData)
    expect(u.marco_squat.kg).toBe(45)
    expect(ultimiCarichiPrima([riga('marco', 'squat', 'prima', '2026-10-01', 6, 45)], { id: 'y' }).marco_squat).toBeUndefined()
  })

  it('lo zero (corpo libero) è un carico vero, il vuoto no', () => {
    const u = ultimiCarichiPrima([
      riga('marco', 'trazioni', 'forza', '2026-09-21', 7, 0),
      riga('marco', 'trazioni', 'forza', '2026-09-21', 8, null),
    ], nuova)
    expect(u.marco_trazioni).toMatchObject({ kg: 0, settimana: 7 })
  })
})

// ── la lettura a pagine ──
vi.mock('./notify', () => ({
  run: async q => { const r = await q; return r.error ? { data: null, error: r.error } : r },
}))
const { tutteLeRighe, PAGINA } = await import('./tutteLeRighe')

describe('leggere più di mille righe', () => {
  const tabella = Array.from({ length: 2345 }, (_, i) => ({ i }))
  const crea = () => ({ range: (da, a) => Promise.resolve({ data: tabella.slice(da, a + 1), error: null }) })

  it('legge a pagine finché una non torna piena', async () => {
    const { data, error } = await tutteLeRighe(crea)
    expect(error).toBeNull()
    expect(data).toHaveLength(2345)
    expect(data[PAGINA]).toEqual({ i: PAGINA })
  })

  it('una pagina che fallisce non dà mezzo storico', async () => {
    let n = 0
    const rotta = () => ({ range: () => Promise.resolve(n++ === 1 ? { data: null, error: { message: 'rete' } } : { data: tabella.slice(0, PAGINA), error: null }) })
    expect(await tutteLeRighe(rotta)).toEqual({ data: null, error: { message: 'rete' } })
  })
})
