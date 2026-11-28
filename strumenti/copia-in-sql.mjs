#!/usr/bin/env node
/**
 * Trasforma una copia di GymCoach (il file .json delle copie di sicurezza)
 * in un file .sql da lanciare nel SQL Editor di Supabase.
 *
 *   node strumenti/copia-in-sql.mjs gymcoach-copia-2026-11-28-0835.json
 *
 * Scrive accanto alla copia un file con lo stesso nome e la fine .sql.
 *
 * Il file .sql AGGIUNGE soltanto le righe che mancano (`on conflict do
 * nothing`): non cancella e non cambia niente di quello che c'è già. Rimette
 * a posto una persona archiviata per sbaglio, i pesi di un turno cancellato,
 * o tutto, in un database vuoto con le stesse tabelle.
 *
 * Istruzioni complete: supabase/come-rimettere-una-copia.md
 */
import { readFileSync, writeFileSync } from 'node:fs'

// L'ordine in cui si rimettono: prima le tabelle a cui le altre si appoggiano.
const ORDINE = ['coaches', 'turns', 'clients', 'exercises', 'cycles', 'cycle_exercises', 'client_loads',
  'client_notes', 'cycle_clients', 'giorni_persona', 'client_visits', 'client_attendance', 'turn_coaches', 'frasi_record']
const PER_VOLTA = 500

export function valoreSql(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (Array.isArray(v)) {
    // Un elenco (ripetizioni delle fasi, giorni): si scrive come elenco di
    // Postgres, '{"4x10","4x8"}', e il database lo legge nel tipo della colonna.
    const dentro = v.map(x => (x === null ? 'NULL' : `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)).join(',')
    return `'${`{${dentro}}`.replace(/'/g, "''")}'`
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

const nomeSql = n => `"${String(n).replace(/"/g, '""')}"`

export function copiaInSql(copia) {
  if (copia?.app !== 'GymCoach' || !copia.tabelle) throw new Error('Questo file non è una copia di GymCoach.')
  const righe = [
    `-- Copia di GymCoach del ${copia.fatta}${copia.da ? `, fatta da ${copia.da}` : ''} (versione ${copia.versione || '?'})`,
    '-- Aggiunge solo le righe che mancano: non cancella e non cambia niente.',
    'begin;',
  ]
  const tabelle = [...ORDINE.filter(t => copia.tabelle[t]), ...Object.keys(copia.tabelle).filter(t => !ORDINE.includes(t))]
  for (const tabella of tabelle) {
    const elenco = copia.tabelle[tabella] || []
    if (!elenco.length) continue
    const colonne = [...new Set(elenco.flatMap(r => Object.keys(r)))]
    righe.push('', `-- ${tabella}: ${elenco.length} righe`)
    for (let i = 0; i < elenco.length; i += PER_VOLTA) {
      const pezzo = elenco.slice(i, i + PER_VOLTA)
      righe.push(`insert into ${nomeSql(tabella)} (${colonne.map(nomeSql).join(', ')}) values`)
      righe.push(pezzo.map(r => `  (${colonne.map(c => valoreSql(r[c])).join(', ')})`).join(',\n'))
      righe.push('on conflict do nothing;')
    }
  }
  righe.push('', 'commit;', '')
  return righe.join('\n')
}

// Lanciato da riga di comando (non importato dai test).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const file = process.argv[2]
  if (!file) {
    console.error('Uso: node strumenti/copia-in-sql.mjs <copia.json>')
    process.exit(1)
  }
  const copia = JSON.parse(readFileSync(file, 'utf8'))
  const uscita = file.replace(/\.json$/i, '') + '.sql'
  writeFileSync(uscita, copiaInSql(copia))
  const totale = Object.values(copia.tabelle).reduce((a, t) => a + t.length, 0)
  console.log(`Fatto: ${uscita} (${totale} righe in ${Object.keys(copia.tabelle).length} tabelle)`)
}
