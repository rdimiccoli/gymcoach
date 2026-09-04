/**
 * Tiene sveglio il progetto Supabase.
 *
 * Il piano gratuito mette in pausa i progetti dopo 7 giorni senza attività, e
 * riattivarli è manuale: se succede di venerdì, il lunedì mattina le coach
 * trovano l'app che non carica niente.
 *
 * Questa funzione fa una richiesta minima al database. Viene chiamata una volta
 * al giorno dal cron configurato in vercel.json.
 *
 * Deve arrivare da FUORI: un pg_cron interno al database non conta come
 * attività per la piattaforma, quindi il progetto si addormenterebbe lo stesso.
 *
 * La chiave usata è quella anon, la stessa che sta nel codice dell'app: è
 * pubblica per definizione e le RLS fanno il resto. Da utente non autenticato
 * la query non restituisce nessuna riga, ed è esattamente quello che serve —
 * conta la richiesta, non il risultato.
 */
export default async function handler(request, response) {
  const url = process.env.VITE_SUPABASE_URL
  const chiave = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !chiave) {
    return response.status(500).json({
      ok: false,
      errore: 'Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY fra le variabili d\'ambiente di Vercel.',
    })
  }

  try {
    // head=true: chiediamo solo gli header, nessun dato viaggia.
    const esito = await fetch(`${url}/rest/v1/exercises?select=id&limit=1`, {
      method: 'HEAD',
      headers: { apikey: chiave, Authorization: `Bearer ${chiave}` },
    })

    // Anche un 401 o un 403 vanno benissimo: il database ha risposto, quindi
    // è sveglio. Un fallimento vero è solo non riuscire a raggiungerlo.
    return response.status(200).json({
      ok: true,
      stato: esito.status,
      quando: new Date().toISOString(),
    })
  } catch (e) {
    return response.status(503).json({ ok: false, errore: String(e?.message || e) })
  }
}
