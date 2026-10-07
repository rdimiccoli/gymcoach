/**
 * Chi sono adesso.
 *
 * Fino a ottobre 2026 il profilo del coach ERA l'account: `coaches.id` era
 * l'identificativo dell'accesso, e il database teneva separati i due coach da
 * solo. Poi Sandro e Manu si sono accordati per avere una credenziale sola, e
 * di poter guardare i turni dell'altro quando serve.
 *
 * Da lì in poi account e profilo sono due cose diverse: si entra con la
 * credenziale comune, e dentro si sceglie per chi si sta lavorando.
 *
 * ⚠️ Questa scelta NON è una barriera di riservatezza, ed è giusto saperlo.
 *    Chi ha la password può passare da un profilo all'altro quando vuole:
 *    è esattamente quello che i due coach hanno chiesto. Serve a sapere di
 *    chi sono i turni che si stanno aprendo, non a impedire di vedere gli
 *    altri.
 *
 * La scelta sta nel telefono, non nel database, per due motivi: ogni coach
 * usa il suo telefono e quindi in pratica ognuno resta sul suo profilo senza
 * fare niente; e se stesse nel database, due coach collegati insieme si
 * cambierebbero il profilo a vicenda.
 *
 * La chiave porta dentro l'identificativo dell'account: se un giorno si
 * rientrasse con una credenziale diversa, quella non si porta dietro la
 * scelta fatta con l'altra.
 */

const chiave = idAccount => `gymcoach.coach-attivo.${idAccount}`

/** L'id del coach scelto su questo telefono, o null se non è stato scelto. */
export function coachScelto(idAccount) {
  if (!idAccount) return null
  try {
    return localStorage.getItem(chiave(idAccount)) || null
  } catch {
    // Modalità privata, spazio pieno, cookie bloccati: si chiede di nuovo chi
    // sei. Fastidioso, ma mai sbagliato.
    return null
  }
}

export function scegliCoach(idAccount, idCoach) {
  if (!idAccount || !idCoach) return
  try { localStorage.setItem(chiave(idAccount), idCoach) } catch { /* vale per questa sessione */ }
}

/** Fa ricomparire la domanda «chi sei?» al prossimo giro. */
export function dimenticaCoach(idAccount) {
  if (!idAccount) return
  try { localStorage.removeItem(chiave(idAccount)) } catch { /* niente da fare */ }
}

/**
 * Il profilo da usare, dato quello che c'è nel database e quello che il
 * telefono si ricorda. Ritorna { coach, deveScegliere }.
 *
 * Un profilo solo si prende senza chiedere niente: la domanda «chi sei?» con
 * una risposta sola è un tocco buttato. È anche ciò che tiene l'app identica
 * a prima per chi entra ancora con le vecchie credenziali, dove il database
 * continua a far vedere un profilo soltanto.
 */
export function decidiCoach(elenco, idRicordato) {
  const visibili = (elenco || []).filter(c => c && c.nascosto !== true)
  if (!visibili.length) return { coach: null, deveScegliere: false }

  const ricordato = visibili.find(c => c.id === idRicordato)
  if (ricordato) return { coach: ricordato, deveScegliere: false }

  if (visibili.length === 1) return { coach: visibili[0], deveScegliere: false }

  // Più profili e nessuno scelto (o quello scelto non c'è più): si chiede.
  return { coach: null, deveScegliere: true }
}
