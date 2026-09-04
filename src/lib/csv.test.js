import { describe, it, expect } from 'vitest'
import { analizzaCsv, eserciziDaCsv, csvDaEsercizi } from './csv'

// Righe prese pari pari dai file reali "giorno 2.csv" e "giorno 3.csv".
// Sono il motivo per cui qui non basta uno split(','): contengono virgole e
// virgolette dentro i campi.
const INTESTAZIONE = 'id,sort_order,day,reps_a,reps_b,reps_c,superset_group,exercise_name'
const CSV_REALE = [
  INTESTAZIONE,
  'b86ca77e-598c-449d-80e1-0257779fb955,0,2,3x6+ max,"4x5+ max ",4x6+max,null,Panca obliqua',
  '59aeeac0-37aa-4ba4-8583-921d68cdbe9c,1,2,"2xMAX + 15"" + MAX + DROP","2xMAX + 15"" + MAX + DROP","2xMAX + 15"" + MAX + DROP",null,Spinte oblique',
  '867454b1-4234-470f-a8a4-135b0458fc0a,2,2,1x5,2x5,2x6,SS-L,Panca stretta',
  '7fbd529c-a5e5-448a-b2b2-32b4f1fcd5f8,4,3,50s,10s,3,CIR-A,Thruster bilanciere',
].join('\n')

describe('analizzaCsv', () => {
  it('non spezza i campi sulle virgole interne alle virgolette', () => {
    const righe = analizzaCsv(CSV_REALE)
    expect(righe).toHaveLength(5)
    expect(righe.every(r => r.length === 8)).toBe(true)
  })

  it('scioglie le virgolette raddoppiate', () => {
    const righe = analizzaCsv(CSV_REALE)
    // "2xMAX + 15"" + MAX + DROP"  →  2xMAX + 15" + MAX + DROP
    expect(righe[2][3]).toBe('2xMAX + 15" + MAX + DROP')
  })

  it('ignora le righe vuote, compresa quella dell_a capo finale', () => {
    expect(analizzaCsv(CSV_REALE + '\n')).toHaveLength(5)
    expect(analizzaCsv(CSV_REALE + '\n\n\n')).toHaveLength(5)
  })

  it('accetta anche i fine riga di Windows', () => {
    expect(analizzaCsv(CSV_REALE.replace(/\n/g, '\r\n'))).toHaveLength(5)
  })
})

describe('eserciziDaCsv', () => {
  it('legge i file reali senza segnalare problemi', () => {
    const { esercizi, problemi } = eserciziDaCsv(CSV_REALE)
    expect(problemi).toEqual([])
    expect(esercizi).toHaveLength(4)
    expect(esercizi[0]).toMatchObject({ nome: 'Panca obliqua', giorno: 2, gruppo: null, ordine: 0 })
    expect(esercizi[2]).toMatchObject({ nome: 'Panca stretta', gruppo: 'SS-L' })
    expect(esercizi[3]).toMatchObject({ nome: 'Thruster bilanciere', giorno: 3, gruppo: 'CIR-A', repsA: '50s' })
  })

  it('tratta "null" come assenza di gruppo, non come etichetta', () => {
    expect(eserciziDaCsv(CSV_REALE).esercizi[0].gruppo).toBeNull()
  })

  it('toglie gli spazi in coda lasciati dalle virgolette', () => {
    // nel file reale: "4x5+ max " con lo spazio finale
    expect(eserciziDaCsv(CSV_REALE).esercizi[0].repsB).toBe('4x5+ max')
  })

  it('scarta le righe con un giorno non valido, spiegando quale', () => {
    const { esercizi, problemi } = eserciziDaCsv([
      INTESTAZIONE,
      'x,0,7,3x8,3x10,3x12,null,Giorno inesistente',
      'y,1,2,3x8,3x10,3x12,null,Buona',
    ].join('\n'))
    expect(esercizi).toHaveLength(1)
    expect(esercizi[0].nome).toBe('Buona')
    expect(problemi).toHaveLength(1)
    expect(problemi[0]).toContain('Giorno inesistente')
    expect(problemi[0]).toContain('7')
  })

  it('rifiuta un testo senza le colonne necessarie invece di indovinare', () => {
    expect(eserciziDaCsv('a,b,c\n1,2,3').problemi[0]).toContain('exercise_name')
    expect(eserciziDaCsv('exercise_name\nPanca').problemi[0]).toContain('day')
    expect(eserciziDaCsv('').problemi[0]).toContain('intestazione')
  })
})

describe('csvDaEsercizi', () => {
  it('rimette le virgolette dove servono, e solo lì', () => {
    const csv = csvDaEsercizi([
      { id: 'x', sort_order: 0, day: 2, reps_a: '3x8', reps_b: '2xMAX + 15" + MAX', reps_c: 'a,b', superset_group: null, exercises: { name: 'Panca' } },
    ])
    const righe = csv.split('\n')
    expect(righe[0]).toBe(INTESTAZIONE)
    expect(righe[1]).toContain('"2xMAX + 15"" + MAX"')
    expect(righe[1]).toContain('"a,b"')
    expect(righe[1]).toContain(',null,')  // gruppo assente scritto come null
    expect(righe[1]).toContain('3x8')     // niente virgolette dove non servono
  })

  it('sopravvive al giro completo: esportare e reimportare non cambia i dati', () => {
    const { esercizi } = eserciziDaCsv(CSV_REALE)
    const rigenerato = csvDaEsercizi(esercizi.map(e => ({
      id: '', sort_order: e.ordine, day: e.giorno,
      reps_a: e.repsA, reps_b: e.repsB, reps_c: e.repsC,
      superset_group: e.gruppo, exercise_name: e.nome,
    })))
    const riletti = eserciziDaCsv(rigenerato).esercizi
    expect(riletti.map(e => e.nome)).toEqual(esercizi.map(e => e.nome))
    expect(riletti.map(e => e.repsA)).toEqual(esercizi.map(e => e.repsA))
    expect(riletti.map(e => e.gruppo)).toEqual(esercizi.map(e => e.gruppo))
  })
})

describe('separatore', () => {
  // Excel in italiano esporta con il punto e virgola; chi copia celle da un
  // foglio e le incolla ottiene tabulazioni. Accettare solo la virgola voleva
  // dire fallire nei due casi più probabili.
  it('legge il punto e virgola di Excel italiano', () => {
    const { esercizi, problemi } = eserciziDaCsv('exercise_name;day;reps_a\nSquat sumo;1;3x8')
    expect(problemi).toEqual([])
    expect(esercizi[0]).toMatchObject({ nome: 'Squat sumo', giorno: 1, repsA: '3x8' })
  })

  it('legge le tabulazioni di celle incollate da un foglio di calcolo', () => {
    const { esercizi } = eserciziDaCsv('exercise_name\tday\treps_a\nPanca obliqua\t2\t3x10')
    expect(esercizi[0]).toMatchObject({ nome: 'Panca obliqua', giorno: 2, repsA: '3x10' })
  })

  it('non si confonde con le virgole dentro i campi quando il separatore è ;', () => {
    const { esercizi } = eserciziDaCsv('exercise_name;day;reps_a\n"Panca, obliqua";1;"3x8, poi max"')
    expect(esercizi[0].nome).toBe('Panca, obliqua')
    expect(esercizi[0].repsA).toBe('3x8, poi max')
  })

  it('a parità sceglie la virgola, che è il formato che esportiamo noi', () => {
    const { esercizi } = eserciziDaCsv('exercise_name,day\nSquat,1')
    expect(esercizi).toHaveLength(1)
  })
})

describe('messaggi quando il file non va', () => {
  it('dice quali colonne ha letto, non solo quale manca', () => {
    const { problemi } = eserciziDaCsv('nome,giorno\nSquat,1')
    expect(problemi[0]).toContain('exercise_name')
    expect(problemi[0]).toContain('nome, giorno')  // cosa ha letto davvero
  })

  it('riconosce il caso in cui le colonne non sono state separate', () => {
    const { problemi } = eserciziDaCsv('exercise_name|day\nSquat|1')
    expect(problemi[1]).toContain('non siano state separate')
  })
})
