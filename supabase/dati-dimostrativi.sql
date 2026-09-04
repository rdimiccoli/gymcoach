-- ═══════════════════════════════════════════════════════════════════════════
--  DATI DIMOSTRATIVI PER GYMCOACH
--
--  ⚠️  QUESTO SCRIPT CANCELLA TUTTI I TUOI TURNI E TUTTO CIÒ CHE VI STA DENTRO:
--      clienti, schede, esercizi delle schede, carichi e note.
--      Le foreign key sono ON DELETE CASCADE, quindi basta cancellare i turni.
--
--      PRIMA DI ESEGUIRLO: Supabase → Database → Backups.
--      Non è annullabile.
--
--  Cancella SOLO i dati del coach indicato qui sotto. Le altre coach non
--  vengono toccate. Il catalogo `exercises` è condiviso: non viene mai
--  cancellato, solo arricchito con i nomi mancanti.
--
--  Ogni dato qui dentro esiste per mostrare una funzione precisa dell'app:
--  vedi PRESENTAZIONE.md per la traccia da seguire.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ─── cambia qui se vuoi popolare un altro account ───────────────────────
  v_email  text := 'r.dimiccoli93@gmail.com';

  v_coach  uuid;
  t_mat    uuid;  t_pom  uuid;  t_ser uuid;
  s_att    uuid;  s_vec  uuid;  s_forza uuid;  s_metab uuid;
begin
  select id into v_coach from coaches where lower(email) = lower(v_email);
  if v_coach is null then
    raise exception 'Nessun coach con email %. Controlla la tabella coaches.', v_email;
  end if;

  -- ═══ 1. PULIZIA ═══════════════════════════════════════════════════════
  -- Un solo delete: la cascata porta via clienti, schede, esercizi delle
  -- schede, carichi e note. (Verificato: tutte le FK sono ON DELETE CASCADE.)
  delete from turns where coach_id = v_coach;

  -- ═══ 2. CATALOGO ESERCIZI ═════════════════════════════════════════════
  -- Condiviso fra tutte le coach: si aggiunge soltanto ciò che manca.
  insert into exercises (name) values
    ('Squat sumo'), ('Panca obliqua'), ('Spinte oblique'), ('Rematore T-bar'),
    ('Alzate dorso al cavo'), ('Croci ai cavi'), ('Stacco rumeno'),
    ('Curl in piedi'), ('Curl panca 45°'), ('Plank'), ('Leg press'),
    ('Panca stretta'), ('Croci 30'), ('Spinte declinate'),
    ('Thruster bilanciere'), ('Barchetta'), ('Balzi step piccolo alternati'),
    ('Military press'), ('Swing'), ('Burpees con ostacolo'),
    ('Affondi camminati'), ('Mountain climber'), ('Jumping jack'),
    ('Lat machine presa inversa'), ('Leg curl'), ('Alzate laterali 45°')
  on conflict (name) do nothing;

  -- ═══ 3. TURNI ═════════════════════════════════════════════════════════
  insert into turns (coach_id, name, time, type) values
    (v_coach, '09:00 — Femminile', '09:00', 'Femminile') returning id into t_mat;
  insert into turns (coach_id, name, time, type) values
    (v_coach, '13:30 — Misto', '13:30', 'Misto') returning id into t_pom;
  -- Terzo turno lasciato SENZA scheda: mostra lo stato «Nessuna scheda attiva».
  insert into turns (coach_id, name, time, type) values
    (v_coach, '18:30 — Femminile', '18:30', 'Femminile') returning id into t_ser;

  -- ═══ 4. SCHEDE ════════════════════════════════════════════════════════
  -- Iniziata 25 giorni fa ⇒ da calendario siamo alla SETTIMANA 4.
  -- Serve a far comparire «5 indietro» nel pannello di avanzamento.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_mat, 'Scheda Autunno 2026', current_date - 25, true) returning id into s_att;

  -- Scheda vecchia e completata: dà profondità allo storico e ai grafici.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_mat, 'Scheda Estate 2026', current_date - 130, false) returning id into s_vec;

  -- DUE schede attive sullo stesso turno: l'app lo permette, e va mostrato.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_pom, 'Forza Base', current_date - 11, true) returning id into s_forza;
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_pom, 'Richiamo Metabolico', current_date - 4, true) returning id into s_metab;

  -- ═══ 5. ESERCIZI DELLE SCHEDE ═════════════════════════════════════════
  -- Ogni riga qui sotto esiste per mostrare qualcosa di preciso.

  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_att, e.id, d.day, d.a, d.b, d.c, d.ord, d.gruppo
  from (values
    -- ── GIORNO 1 ────────────────────────────────────────────────────────
    ('Squat sumo',            1, '3x6',   '4x5',   '3x4',    0, null),
    -- notazione complessa: si legge, ma non è una durata
    ('Panca obliqua',         1, '3x6+ max', '4x5+ max', '4x6+max', 1, null),
    -- notazione che NESSUN parser può interpretare: il timer non si offre
    ('Spinte oblique',        1, '2xMAX + 15" + MAX + DROP', '2xMAX + 15" + MAX + DROP', '2xMAX + 15" + MAX + DROP', 2, null),
    -- SUPERSERIE con ripetizioni DIVERSE fra i due esercizi:
    -- mostra la correzione dei badge (prima mostravano quelle del primo per tutti)
    ('Rematore T-bar',        1, '3x8',   '3x10',  '3x12',   3, 'SS-A'),
    ('Alzate dorso al cavo',  1, '3x12',  '3x15',  '3x20',   4, 'SS-A'),
    -- GRUPPO CON UN SOLO ESERCIZIO ⇒ avviso «⚠ DA SOLO» nella scheda
    ('Croci ai cavi',         1, 'Max',   'Max',   'Max',    5, 'SS-B'),

    -- ── GIORNO 2 ────────────────────────────────────────────────────────
    ('Stacco rumeno',         2, '3x8',   '3x10',  '3x12',   0, null),
    ('Curl in piedi',         2, '3x8',   '3x10',  '3x12',   1, 'SS-C'),
    ('Curl panca 45°',        2, '3x8',   '3x10',  '3x12',   2, 'SS-C'),
    -- CIRCUITO da 6 esercizi, 50s lavoro / 10s riposo × 3 giri ⇒ ▶ TIMER
    ('Thruster bilanciere',   2, '50s',   '10s',   '3',      3, 'CIR-A'),
    ('Barchetta',             2, '50s',   '10s',   '3',      4, 'CIR-A'),
    ('Balzi step piccolo alternati', 2, '50s', '10s', '3',   5, 'CIR-A'),
    ('Military press',        2, '50s',   '10s',   '3',      6, 'CIR-A'),
    ('Swing',                 2, '50s',   '10s',   '3',      7, 'CIR-A'),
    ('Burpees con ostacolo',  2, '50s',   '10s',   '3',      8, 'CIR-A'),
    -- corpo libero: il carico sarà 0 kg, che è un dato vero e non un buco
    ('Plank',                 2, '3x45s', '3x60s', '3x75s',  9, null),

    -- ── GIORNO 3 ────────────────────────────────────────────────────────
    ('Leg press',             3, '3x10',  '3x12',  '3x15',   0, null),
    -- TRISERIE, come nei dati reali della palestra
    ('Panca stretta',         3, '1x5',   '2x5',   '2x6',    1, 'SS-D'),
    ('Croci 30',              3, '1x10',  '2x10',  '2x12',   2, 'SS-D'),
    ('Spinte declinate',      3, '1x15',  '2x15',  '2x24',   3, 'SS-D'),
    ('Leg curl',              3, '3x12',  '3x15',  '3x15',   4, null),
    -- SECONDO CIRCUITO con tempi diversi: 30s / 15s × 4 giri
    ('Affondi camminati',     3, '30s',   '15s',   '4',      5, 'CIR-B'),
    ('Mountain climber',      3, '30s',   '15s',   '4',      6, 'CIR-B'),
    ('Jumping jack',          3, '30s',   '15s',   '4',      7, 'CIR-B')
  ) as d(nome, day, a, b, c, ord, gruppo)
  join exercises e on e.name = d.nome;

  -- Scheda vecchia: pochi esercizi, servono solo a dare storico ai grafici.
  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_vec, e.id, 1, '3x8', '3x10', '3x12', d.ord, null
  from (values ('Panca obliqua', 0), ('Squat sumo', 1), ('Leg press', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  -- Le due schede attive del turno delle 13:30.
  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_forza, e.id, 1, '5x5', '5x4', '5x3', d.ord, null
  from (values ('Squat sumo', 0), ('Panca obliqua', 1), ('Stacco rumeno', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_metab, e.id, 1, '40s', '20s', '5', d.ord, 'CIR-A'
  from (values ('Swing', 0), ('Burpees con ostacolo', 1), ('Mountain climber', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  -- ═══ 6. ATLETE ════════════════════════════════════════════════════════
  -- Da calendario la scheda del mattino è alla settimana 4: chi sta sotto
  -- compare come «in ritardo».
  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_mat, 'Sara',      'Bianchi',   4, true),   -- in pari, storico ricco
    (t_mat, 'Giulia',    'Colombo',   4, true),   -- in pari
    (t_mat, 'Martina',   'De Luca',   2, true),   -- ⚠ indietro
    (t_mat, 'Chiara',    'Esposito',  5, true),   -- avanti
    (t_mat, 'Alice',     'Ferrari',   1, true),   -- ⚠ indietro, e SENZA carichi
    (t_mat, 'Elena',     'Gallo',     6, true),   -- completa: «COMPLETO»
    (t_mat, 'Valentina', 'Rossi',     3, false);  -- ARCHIVIATA

  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_pom, 'Marco',   'Ricci',    2, true),
    (t_pom, 'Luca',    'Marino',   2, true),
    (t_pom, 'Federica','Greco',    3, true),
    (t_pom, 'Davide',  'Conti',    1, true);

  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_ser, 'Anna',    'Lombardi', 1, true),
    (t_ser, 'Silvia',  'Barbieri', 1, true),
    (t_ser, 'Paola',   'Fontana',  1, true);
end $$;


-- ═══ 7. CARICHI ═════════════════════════════════════════════════════════
-- Una riga per ogni settimana già svolta da ciascuna atleta, con una
-- progressione di 2,5 kg a settimana. La base cambia per atleta ed esercizio,
-- così i numeri non sembrano generati da una macchina.
-- Alice Ferrari è esclusa apposta: serve a mostrare lo stato «nessun carico».
insert into client_loads (client_id, cycle_exercise_id, week, kg)
select
  c.id, ce.id, w,
  round(12 + abs(mod(hashtext(c.surname || ce.id::text), 34)) + (w - 1) * 2.5, 1)
from clients c
join turns t          on t.id = c.turn_id
join coaches co       on co.id = t.coach_id and lower(co.email) = lower('r.dimiccoli93@gmail.com')
join cycles cy        on cy.turn_id = t.id
join cycle_exercises ce on ce.cycle_id = cy.id
cross join lateral generate_series(1, c.current_week) as w
where c.is_active
  and c.surname <> 'Ferrari'
on conflict (client_id, cycle_exercise_id, week) do nothing;

-- La scheda completata dell'estate: sei settimane piene per tutte, così i
-- grafici dello storico hanno una linea lunga da mostrare.
insert into client_loads (client_id, cycle_exercise_id, week, kg)
select
  c.id, ce.id, w,
  round(10 + abs(mod(hashtext(c.surname || ce.id::text), 28)) + (w - 1) * 2.5, 1)
from clients c
join turns t          on t.id = c.turn_id
join coaches co       on co.id = t.coach_id and lower(co.email) = lower('r.dimiccoli93@gmail.com')
join cycles cy        on cy.turn_id = t.id and cy.name = 'Scheda Estate 2026'
join cycle_exercises ce on ce.cycle_id = cy.id
cross join lateral generate_series(1, 6) as w
where c.is_active and c.surname <> 'Ferrari'
on conflict (client_id, cycle_exercise_id, week) do nothing;

-- Il plank è a corpo libero: 0 kg è un dato vero, non un buco.
-- Prima l'app lo scartava come se il carico mancasse.
update client_loads set kg = 0
where cycle_exercise_id in (
  select ce.id from cycle_exercises ce
  join exercises e on e.id = ce.exercise_id and e.name = 'Plank'
);


-- ═══ 8. NOTE ════════════════════════════════════════════════════════════
-- Compaiono con l'icona 📝 sotto i carichi, senza dover aprire nulla.
insert into client_notes (client_id, cycle_exercise_id, note)
select c.id, ce.id, n.testo
from (values
  ('De Luca',  'Panca obliqua',  'Sente la spalla destra: ridurre il ROM e non scendere sotto il petto.'),
  ('Bianchi',  'Squat sumo',     'Ginocchia che cedono verso l''interno sulle ultime due ripetizioni.'),
  ('Esposito', 'Stacco rumeno',  'Ottima tecnica. Si può salire di 5 kg la prossima settimana.'),
  ('Gallo',    'Croci ai cavi',  'Preferisce i manubri: valutare la sostituzione nella prossima scheda.')
) as n(cognome, esercizio, testo)
join clients c   on c.surname = n.cognome
join turns t     on t.id = c.turn_id
join coaches co  on co.id = t.coach_id and lower(co.email) = lower('r.dimiccoli93@gmail.com')
join cycles cy   on cy.turn_id = t.id and cy.is_active
join cycle_exercises ce on ce.cycle_id = cy.id
join exercises e on e.id = ce.exercise_id and e.name = n.esercizio
on conflict (client_id, cycle_exercise_id) do nothing;


-- ═══ VERIFICA ═══════════════════════════════════════════════════════════
select 'turni'    as cosa, count(*) from turns    t  join coaches co on co.id = t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com'
union all select 'atlete',  count(*) from clients c  join turns t on t.id=c.turn_id join coaches co on co.id=t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com'
union all select 'schede',  count(*) from cycles cy join turns t on t.id=cy.turn_id join coaches co on co.id=t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com'
union all select 'esercizi in scheda', count(*) from cycle_exercises ce join cycles cy on cy.id=ce.cycle_id join turns t on t.id=cy.turn_id join coaches co on co.id=t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com'
union all select 'carichi', count(*) from client_loads cl join clients c on c.id=cl.client_id join turns t on t.id=c.turn_id join coaches co on co.id=t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com'
union all select 'note',    count(*) from client_notes cn join clients c on c.id=cn.client_id join turns t on t.id=c.turn_id join coaches co on co.id=t.coach_id and lower(co.email)='r.dimiccoli93@gmail.com';
