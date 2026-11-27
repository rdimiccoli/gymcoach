/**
 * Di quanto sale il + di un esercizio.
 *
 * Fino a novembre 2026 + e − cambiavano sempre di 1 kg. Ma i pesi veri della
 * palestra dicevano altro: solo 5 cambi su 100 da una settimana all'altra
 * erano di 1 kg, e 74 pesi su 100 erano multipli di 2,5. Per passare da 50 a
 * 55 servivano cinque tocchi.
 *
 * Il passo si capisce dai pesi già segnati su quell'esercizio:
 *  - quasi tutti multipli di 2,5 (dischi, bilancieri, macchine) → 2,5;
 *  - quasi tutti pari, ma non da 2,5 (manubri: 8, 10, 12) → 2;
 *  - altrimenti, o con troppi pochi pesi per dirlo → 1, come sempre.
 *
 * Il mezzo chilo resta nei DETTAGLI, per le correzioni fini.
 */

/** Quanti pesi servono, almeno, per fidarsi. */
export const PESI_MINIMI = 5
/** La parte che deve rispettare il passo: 8 pesi su 10. */
export const QUOTA = 0.8

const multiplo = (kg, passo) => Math.abs(kg / passo - Math.round(kg / passo)) < 1e-6

export function passoDaiPesi(pesi) {
  const validi = (pesi || []).map(Number).filter(kg => Number.isFinite(kg) && kg > 0)
  if (validi.length < PESI_MINIMI) return 1
  const quota = passo => validi.filter(kg => multiplo(kg, passo)).length / validi.length
  if (quota(2.5) >= QUOTA) return 2.5
  if (quota(2) >= QUOTA) return 2
  return 1
}

/** { idEsercizio: passo } dallo storico: righe con kg e cycle_exercises.exercise_id. */
export function passiDalloStorico(righe) {
  const perEsercizio = {}
  for (const r of righe || []) {
    const id = r.cycle_exercises?.exercise_id
    if (id) (perEsercizio[id] ||= []).push(r.kg)
  }
  return Object.fromEntries(Object.entries(perEsercizio).map(([id, pesi]) => [id, passoDaiPesi(pesi)]))
}

/** «2,5», «2», «1»: con la virgola, come si scrive in Italia. */
export const scriviPasso = passo => String(passo).replace('.', ',')
