import { createClient } from '@supabase/supabase-js'
import { fetchConCopia, sessioneAncheSenzaRete, accessoSalvato } from './lib/copiaDati'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ogni lettura che va a buon fine lascia una copia sul telefono, e senza rete
// risponde la copia: così un turno si apre anche quando il wifi della
// palestra è caduto (vedi copiaDati.js). Le scritture passano come sempre.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetchConCopia((...a) => fetch(...a), {
      chiavePubblica: supabaseKey,
      // Letta solo al momento della richiesta, quando `supabase` c'è già.
      accessoPresente: () => !!accessoSalvato(supabase.auth.storageKey),
    }),
  },
})

// Senza rete l'accesso salvato vale anche se è scaduto da poco, invece di
// far aspettare 25 secondi di tentativi a ogni richiesta (vedi copiaDati.js).
sessioneAncheSenzaRete(supabase.auth, supabase.auth.storageKey)
