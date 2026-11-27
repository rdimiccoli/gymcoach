/**
 * Chi non si vede da un po', e chi non si è mai visto.
 *
 * «Visto» vuol dire: ha almeno un peso segnato. La data è quella dell'ultimo
 * peso (vista `ultimi_allenamenti`, vedi la migrazione del 27/11/2026).
 * Il 27/11/2026 erano 9 persone ferme da tre settimane, e 80 persone attive
 * su 335 senza nemmeno un peso.
 */

export const GIORNI_ASSENZA = 21

/** { idPersona: { ultimo: Date, pesi } } dalle righe della vista. */
export function mappaUltimi(righe) {
  const m = {}
  for (const r of righe || []) {
    const quando = new Date(r.ultimo)
    if (r.client_id && !Number.isNaN(quando.getTime())) m[r.client_id] = { ultimo: quando, pesi: Number(r.pesi) || 0 }
  }
  return m
}

/** Chi ha pesi segnati, ma nessuno negli ultimi `giorni`: dal più lontano. */
export function chiManca(persone, ultimi, adesso = new Date(), giorni = GIORNI_ASSENZA) {
  const soglia = adesso.getTime() - giorni * 86_400_000
  return (persone || [])
    .filter(p => ultimi[p.id] && ultimi[p.id].ultimo.getTime() < soglia)
    .map(p => ({ ...p, ultimo: ultimi[p.id].ultimo }))
    .sort((a, b) => a.ultimo - b.ultimo)
}

/** Chi è attivo ma non ha mai avuto un peso segnato. */
export function maiAllenati(persone, ultimi) {
  return (persone || []).filter(p => !ultimi[p.id])
}

/** «28 ott»: abbastanza per capire quanto tempo è passato. */
export function giornoCorto(data) {
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
}
