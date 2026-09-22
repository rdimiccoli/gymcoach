import { useState, useEffect } from 'react'
import { capacita } from '../lib/capacita'
import { comePulsante } from '../lib/stile'
import { tocco } from '../lib/aptico'
import { settimanaDaCalendario } from '../lib/schede'
import { caricaOspitiDiOggi, silverDisponibili, segnaOspite, turnoDOrigine } from '../lib/ospitiDb'

/**
 * Gli ospiti Silver di oggi, dentro la schermata del turno.
 *
 * Sta qui e non in Home perché è qui che il coach si trova quando una
 * persona di un altro turno entra in sala.
 *
 * Aggiungere e togliere passano dallo stesso elenco: chi è già ospite oggi
 * ha la spunta, e toccarlo di nuovo lo toglie. È l'annulla, senza un pulsante
 * in più da cercare.
 */
export default function OspitiDelGiorno({ turn, navigate }) {
  const [attivo, setAttivo] = useState(false)
  const [gruppi, setGruppi] = useState([])
  const [elencoAperto, setElencoAperto] = useState(false)
  const [disponibili, setDisponibili] = useState(null)
  const [ospitiOggi, setOspitiOggi] = useState(() => new Set())

  useEffect(() => {
    capacita().then(c => { setAttivo(c.silver); if (c.silver) carica() })
  }, [turn.id])

  async function carica() {
    const g = (await caricaOspitiDiOggi([turn.id]))[turn.id] || []
    setGruppi(g)
    setOspitiOggi(new Set(g.flatMap(x => x.persone.map(p => p.id))))
  }

  async function apriElenco() {
    setElencoAperto(true)
    setDisponibili(null)
    setDisponibili(await silverDisponibili(turn.id))
  }

  async function chiudiElenco() {
    setElencoAperto(false)
    await carica()
  }

  // La spunta si muove subito e torna indietro se il server rifiuta: toccare
  // un nome e non vedere niente per mezzo secondo fa toccare due volte.
  async function alterna(persona) {
    tocco()
    const era = ospitiOggi.has(persona.id)
    const cambia = aggiungi => setOspitiOggi(prev => {
      const n = new Set(prev)
      if (aggiungi) n.add(persona.id); else n.delete(persona.id)
      return n
    })
    cambia(!era)
    const { error } = await segnaOspite(turn.id, persona.id, !era)
    if (error) cambia(era)
  }

  if (!attivo) return null

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={etichetta}>OSPITI DI OGGI</div>

      {gruppi.map((g, i) => {
        const nomi = g.persone.map(p => `${p.name} ${p.surname}`).join(', ')
        const settimana = settimanaDaCalendario(g.scheda)
        const contenuto = (
          <>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px' }}>
              {nomi}
            </div>
            <div style={{ color: 'var(--testo-medio)', fontSize: '13px', marginTop: '2px' }}>
              dal turno {turnoDOrigine(g.persone[0])}
              {g.scheda
                ? <> · {g.scheda.name}{settimana ? ` · settimana ${settimana}` : ''}</>
                : ' · nessuna scheda attiva'}
            </div>
          </>
        )
        // Senza scheda non c'è niente da aprire: la riga resta, per dire che
        // la persona c'è, ma non finge di essere un pulsante.
        return g.scheda ? (
          <button key={i} type="button" style={riga}
            onClick={() => navigate('turn', { turn, cycle: g.scheda, ospiti: g.persone.map(p => p.id) })}>
            <div style={{ flex: 1, minWidth: 0 }}>{contenuto}</div>
            <span style={{ color: 'var(--testo-fioco)', fontSize: '18px', flexShrink: 0 }}>›</span>
          </button>
        ) : (
          <div key={i} style={{ ...riga, cursor: 'default', opacity: 0.7 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{contenuto}</div>
          </div>
        )
      })}

      <button type="button" onClick={apriElenco} style={pulsanteAggiungi}>
        + OSPITE SILVER
      </button>

      {elencoAperto && (
        <div style={sfondo} onClick={chiudiElenco}>
          <div style={foglio} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }}>
              CHI VIENE OGGI DA UN ALTRO TURNO?
            </div>
            <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, marginBottom: '14px' }}>
              Tocca chi è venuto: si allena sulla sua scheda e i carichi restano suoi.
              Vale solo per oggi.
            </div>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {disponibili === null && (
                <div style={{ color: 'var(--testo-fioco)', fontSize: '14px', padding: '12px 0' }}>Carico…</div>
              )}
              {disponibili?.length === 0 && (
                <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.5, padding: '8px 0' }}>
                  Negli altri turni non c’è nessun atleta Silver.
                  Si segna da TURNI, toccando la matita accanto al nome.
                </div>
              )}
              {disponibili?.map(p => {
                const qui = ospitiOggi.has(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => alterna(p)} style={{
                    ...comePulsante,
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '13px 12px', marginBottom: '6px', borderRadius: '8px',
                    background: qui ? 'var(--acc-riempimento)' : 'var(--sup)',
                    border: `1px solid ${qui ? 'var(--acc-bordo-forte)' : 'transparent'}`,
                    textAlign: 'left', cursor: 'pointer',
                  }}>
                    <span style={{
                      flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: qui ? 'var(--accento)' : 'transparent',
                      border: qui ? 'none' : '1px solid var(--bordo-forte)',
                      color: '#fff', fontSize: '15px', lineHeight: 1,
                    }}>{qui ? '✓' : ''}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', letterSpacing: '0.5px', color: qui ? '#fff' : 'var(--testo-forte)' }}>
                        {p.surname} {p.name}
                      </span>
                      <span style={{ display: 'block', color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '1px' }}>
                        dal turno {turnoDOrigine(p)}
                      </span>
                    </span>
                    {qui && <span style={{ flexShrink: 0, color: 'var(--accento)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px' }}>OGGI QUI</span>}
                  </button>
                )
              })}
            </div>

            <button type="button" onClick={chiudiElenco} style={pulsanteFatto}>FATTO</button>
          </div>
        </div>
      )}
    </div>
  )
}

const etichetta = {
  color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px',
  fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px',
}

const riga = {
  ...comePulsante,
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '12px 14px', marginBottom: '7px', borderRadius: '8px', textAlign: 'left',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)', cursor: 'pointer',
}

const pulsanteAggiungi = {
  ...comePulsante,
  width: '100%', padding: '13px', borderRadius: '8px', cursor: 'pointer',
  background: 'transparent', border: '1px dashed var(--acc-bordo-forte)',
  color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '15px', fontWeight: '800', letterSpacing: '1.5px', textAlign: 'center',
}

const sfondo = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 60,
  display: 'flex', alignItems: 'flex-end',
}

const foglio = {
  background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)',
  borderRadius: '16px 16px 0 0', padding: '24px 16px 30px', width: '100%',
  maxHeight: '88dvh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
}

const pulsanteFatto = {
  ...comePulsante,
  width: '100%', marginTop: '14px', padding: '15px', borderRadius: '6px', cursor: 'pointer',
  background: 'var(--accento)', color: '#fff', textAlign: 'center',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '2px',
}
