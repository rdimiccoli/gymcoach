-- ═══════════════════════════════════════════════════════════════════════════
--  GYMCOACH · PULIZIA TOTALE E DATI DIMOSTRATIVI
--
--  Svuota il database e lo ripopola con uno scenario completo intestato a un
--  solo coach. Ogni dato inserito serve a mostrare una funzione precisa
--  dell'app: la traccia della presentazione li richiama uno per uno.
--
--  ⚠️  CANCELLA I DATI DI TUTTI I COACH, NON SOLO DI UNO.
--      Turni, atlete, schede, esercizi, carichi, note e il catalogo esercizi.
--      Non è annullabile.
--      PRIMA: Supabase → Database → Backups.
--
--  Da eseguire in quest'ordine. Il PASSO 0 non tocca niente: leggilo prima.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ PASSO 0 · GUARDA COSA C'È ADESSO ═════════════════════════════════════
-- Sola lettura. Serve a sapere cosa stai per cancellare e a copiare l'email
-- esatta dell'account di Sandro. Eseguila da sola, prima di tutto il resto.

select
  u.email,
  u.created_at::date                              as creato_il,
  coalesce(c.name, '— nessun profilo coach —')    as nome,
  (select count(*) from turns t where t.coach_id = c.id)                          as turni,
  (select count(*) from clients cl join turns t on t.id = cl.turn_id
    where t.coach_id = c.id)                                                       as atlete
from auth.users u
left join coaches c on c.id = u.id
order by u.created_at;


-- ═══ PASSO 1 · CREA L'ACCOUNT DI SANDRO ═══════════════════════════════════
-- Questo NON è SQL: fallo dall'interfaccia.
--
--   Supabase → Authentication → Users → Add user
--     Email:            quella che userà Sandro
--     Password:         sceglila tu, gliela dai a voce
--     Auto Confirm User: ✅ acceso (altrimenti deve confermare via email)
--
-- Poi torna qui e scrivi la stessa email nella riga v_email del PASSO 2.


-- ═══ PASSO 2 · PULIZIA E DATI DIMOSTRATIVI ════════════════════════════════
do $$
declare
  -- ─────────────────────────────────────────────────────────────────────
  --  METTI QUI L'EMAIL DELL'ACCOUNT CREATO AL PASSO 1
  v_email text := 'sandro@esempio.it';
  -- ─────────────────────────────────────────────────────────────────────

  v_coach  uuid;
  t_mat    uuid;  t_pom  uuid;  t_ser uuid;
  s_att    uuid;  s_vec  uuid;  s_forza uuid;  s_metab uuid;
begin
  select id into v_coach from auth.users where lower(email) = lower(v_email);
  if v_coach is null then
    raise exception
      'Nessun account di accesso con email "%". Crealo prima dal PASSO 1 (Authentication → Users → Add user), poi rilancia.',
      v_email;
  end if;

  -- ═══ PULIZIA ══════════════════════════════════════════════════════════
  -- Un solo delete sui turni porta via atlete, schede, esercizi delle schede,
  -- carichi e note: le foreign key sono tutte ON DELETE CASCADE.
  delete from turns;

  -- Il catalogo esercizi non ha cascata dai turni: va svuotato a parte, ed è
  -- possibile solo ora che nessuna scheda lo referenzia più.
  delete from exercises;

  -- Via i profili degli altri coach. Gli ACCOUNT DI ACCESSO restano: si tolgono
  -- al PASSO 3, che è separato apposta perché è l'unico irreversibile davvero.
  delete from coaches where id <> v_coach;

  -- Il profilo di Sandro: se non c'è lo creiamo, se c'è lo sistemiamo.
  -- Senza questa riga l'app lo creerebbe da sola al primo accesso, ma a noi
  -- serve adesso per potergli intestare i turni.
  insert into coaches (id, email, name, home_type)
  values (v_coach, v_email, 'Sandro', 'phases')
  on conflict (id) do update set name = 'Sandro', email = excluded.email;

  -- ═══ CATALOGO ESERCIZI ════════════════════════════════════════════════
  insert into exercises (name) values
    ('Squat sumo'), ('Panca obliqua'), ('Spinte oblique'), ('Rematore T-bar'),
    ('Alzate dorso al cavo'), ('Croci ai cavi'), ('Stacco rumeno'),
    ('Curl in piedi'), ('Curl panca 45°'), ('Plank'), ('Leg press'),
    ('Panca stretta'), ('Croci 30'), ('Spinte declinate'),
    ('Thruster bilanciere'), ('Barchetta'), ('Balzi step piccolo alternati'),
    ('Military press'), ('Swing'), ('Burpees con ostacolo'),
    ('Affondi camminati'), ('Mountain climber'), ('Jumping jack'),
    ('Lat machine presa inversa'), ('Leg curl'), ('Alzate laterali 45°');

  -- ═══ TURNI ════════════════════════════════════════════════════════════
  insert into turns (coach_id, name, time, type) values
    (v_coach, '09:00 — Femminile', '09:00', 'Femminile') returning id into t_mat;
  insert into turns (coach_id, name, time, type) values
    (v_coach, '13:30 — Misto', '13:30', 'Misto') returning id into t_pom;
  -- Terzo turno volutamente SENZA scheda: mostra «Nessuna scheda attiva».
  insert into turns (coach_id, name, time, type) values
    (v_coach, '18:30 — Femminile', '18:30', 'Femminile') returning id into t_ser;

  -- ═══ SCHEDE ═══════════════════════════════════════════════════════════
  -- Iniziata 25 giorni fa ⇒ da calendario siamo alla SETTIMANA 4.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_mat, 'Scheda Autunno 2026', current_date - 25, true) returning id into s_att;

  -- Conclusa: dà profondità allo storico e una linea lunga ai grafici.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_mat, 'Scheda Estate 2026', current_date - 130, false) returning id into s_vec;

  -- DUE schede attive sullo stesso turno: l'app lo permette, va mostrato.
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_pom, 'Forza Base', current_date - 11, true) returning id into s_forza;
  insert into cycles (turn_id, name, start_date, is_active) values
    (t_pom, 'Richiamo Metabolico', current_date - 4, true) returning id into s_metab;

  -- ═══ ESERCIZI DELLE SCHEDE ════════════════════════════════════════════
  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_att, e.id, d.day, d.a, d.b, d.c, d.ord, d.gruppo
  from (values
    -- ── GIORNO 1 ──────────────────────────────────────────────────────
    ('Squat sumo',            1, '3x6',   '4x5',   '3x4',    0, null),
    ('Panca obliqua',         1, '3x6+ max', '4x5+ max', '4x6+max', 1, null),
    -- notazione che nessun parser può interpretare ⇒ niente pulsante TIMER
    ('Spinte oblique',        1, '2xMAX + 15" + MAX + DROP', '2xMAX + 15" + MAX + DROP', '2xMAX + 15" + MAX + DROP', 2, null),
    -- superserie con ripetizioni DIVERSE fra i due esercizi
    ('Rematore T-bar',        1, '3x8',   '3x10',  '3x12',   3, 'SS-A'),
    ('Alzate dorso al cavo',  1, '3x12',  '3x15',  '3x20',   4, 'SS-A'),
    -- gruppo con UN SOLO esercizio ⇒ avviso «⚠ DA SOLO»
    ('Croci ai cavi',         1, 'Max',   'Max',   'Max',    5, 'SS-B'),

    -- ── GIORNO 2 ──────────────────────────────────────────────────────
    ('Stacco rumeno',         2, '3x8',   '3x10',  '3x12',   0, null),
    ('Curl in piedi',         2, '3x8',   '3x10',  '3x12',   1, 'SS-C'),
    ('Curl panca 45°',        2, '3x8',   '3x10',  '3x12',   2, 'SS-C'),
    -- circuito 50s / 10s × 3 giri ⇒ ▶ TIMER
    ('Thruster bilanciere',   2, '50s',   '10s',   '3',      3, 'CIR-A'),
    ('Barchetta',             2, '50s',   '10s',   '3',      4, 'CIR-A'),
    ('Balzi step piccolo alternati', 2, '50s', '10s', '3',   5, 'CIR-A'),
    ('Military press',        2, '50s',   '10s',   '3',      6, 'CIR-A'),
    ('Swing',                 2, '50s',   '10s',   '3',      7, 'CIR-A'),
    ('Burpees con ostacolo',  2, '50s',   '10s',   '3',      8, 'CIR-A'),
    -- corpo libero: il carico sarà 0 kg, dato vero e non un buco
    ('Plank',                 2, '3x45s', '3x60s', '3x75s',  9, null),

    -- ── GIORNO 3 ──────────────────────────────────────────────────────
    ('Leg press',             3, '3x10',  '3x12',  '3x15',   0, null),
    ('Panca stretta',         3, '1x5',   '2x5',   '2x6',    1, 'SS-D'),
    ('Croci 30',              3, '1x10',  '2x10',  '2x12',   2, 'SS-D'),
    ('Spinte declinate',      3, '1x15',  '2x15',  '2x24',   3, 'SS-D'),
    ('Leg curl',              3, '3x12',  '3x15',  '3x15',   4, null),
    -- secondo circuito, tempi diversi: 30s / 15s × 4 giri
    ('Affondi camminati',     3, '30s',   '15s',   '4',      5, 'CIR-B'),
    ('Mountain climber',      3, '30s',   '15s',   '4',      6, 'CIR-B'),
    ('Jumping jack',          3, '30s',   '15s',   '4',      7, 'CIR-B')
  ) as d(nome, day, a, b, c, ord, gruppo)
  join exercises e on e.name = d.nome;

  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_vec, e.id, 1, '3x8', '3x10', '3x12', d.ord, null
  from (values ('Panca obliqua', 0), ('Squat sumo', 1), ('Leg press', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_forza, e.id, 1, '5x5', '5x4', '5x3', d.ord, null
  from (values ('Squat sumo', 0), ('Panca obliqua', 1), ('Stacco rumeno', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  insert into cycle_exercises (cycle_id, exercise_id, day, reps_a, reps_b, reps_c, sort_order, superset_group)
  select s_metab, e.id, 1, '40s', '20s', '5', d.ord, 'CIR-A'
  from (values ('Swing', 0), ('Burpees con ostacolo', 1), ('Mountain climber', 2)) as d(nome, ord)
  join exercises e on e.name = d.nome;

  -- ═══ ATLETE ═══════════════════════════════════════════════════════════
  -- Il turno del mattino è alla settimana 4 da calendario: chi sta sotto
  -- compare come «in ritardo».
  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_mat, 'Sara',      'Bianchi',   4, true),   -- in pari, storico ricco
    (t_mat, 'Giulia',    'Colombo',   4, true),   -- in pari
    (t_mat, 'Martina',   'De Luca',   2, true),   -- ⚠ indietro, ha una nota
    (t_mat, 'Chiara',    'Esposito',  5, true),   -- avanti
    (t_mat, 'Alice',     'Ferrari',   1, true),   -- ⚠ indietro, e SENZA carichi
    (t_mat, 'Elena',     'Gallo',     6, true),   -- ha finito le sei settimane
    (t_mat, 'Valentina', 'Rossi',     3, false);  -- ARCHIVIATA

  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_pom, 'Marco',    'Ricci',   2, true),
    (t_pom, 'Luca',     'Marino',  2, true),
    (t_pom, 'Federica', 'Greco',   3, true),
    (t_pom, 'Davide',   'Conti',   1, true);

  insert into clients (turn_id, name, surname, current_week, is_active) values
    (t_ser, 'Anna',   'Lombardi', 1, true),
    (t_ser, 'Silvia', 'Barbieri', 1, true),
    (t_ser, 'Paola',  'Fontana',  1, true);

  -- ═══ CARICHI ══════════════════════════════════════════════════════════
  -- Una riga per ogni settimana già svolta, con +2,5 kg a settimana. La base
  -- cambia per atleta ed esercizio: i numeri non sembrano usciti da una
  -- macchina. Alice Ferrari è esclusa apposta ⇒ stato «nessun carico».
  insert into client_loads (client_id, cycle_exercise_id, week, kg)
  select c.id, ce.id, w,
         round(12 + abs(mod(hashtext(c.surname || ce.id::text), 34)) + (w - 1) * 2.5, 1)
  from clients c
  join turns t            on t.id = c.turn_id and t.coach_id = v_coach
  join cycles cy          on cy.turn_id = t.id
  join cycle_exercises ce on ce.cycle_id = cy.id
  cross join lateral generate_series(1, c.current_week) as w
  where c.is_active and c.surname <> 'Ferrari'
  on conflict (client_id, cycle_exercise_id, week) do nothing;

  -- La scheda conclusa: sei settimane piene, così i grafici hanno una linea.
  insert into client_loads (client_id, cycle_exercise_id, week, kg)
  select c.id, ce.id, w,
         round(10 + abs(mod(hashtext(c.surname || ce.id::text), 28)) + (w - 1) * 2.5, 1)
  from clients c
  join turns t            on t.id = c.turn_id and t.coach_id = v_coach
  join cycles cy          on cy.turn_id = t.id and cy.id = s_vec
  join cycle_exercises ce on ce.cycle_id = cy.id
  cross join lateral generate_series(1, 6) as w
  where c.is_active and c.surname <> 'Ferrari'
  on conflict (client_id, cycle_exercise_id, week) do nothing;

  -- Il plank è a corpo libero: zero è un carico registrato, non un buco.
  update client_loads set kg = 0
  where cycle_exercise_id in (
    select ce.id from cycle_exercises ce
    join exercises e on e.id = ce.exercise_id and e.name = 'Plank'
  );

  -- ═══ NOTE ═════════════════════════════════════════════════════════════
  -- Compaiono con l'icona 📝 sotto i carichi, senza dover aprire niente.
  insert into client_notes (client_id, cycle_exercise_id, note)
  select c.id, ce.id, n.testo
  from (values
    ('De Luca',  'Panca obliqua', 'Sente la spalla destra: ridurre il ROM e non scendere sotto il petto.'),
    ('Bianchi',  'Squat sumo',    'Ginocchia che cedono verso l''interno sulle ultime due ripetizioni.'),
    ('Esposito', 'Stacco rumeno', 'Ottima tecnica. Si può salire di 5 kg la prossima settimana.'),
    ('Gallo',    'Croci ai cavi', 'Preferisce i manubri: valutare la sostituzione nella prossima scheda.')
  ) as n(cognome, esercizio, testo)
  join clients c          on c.surname = n.cognome
  join turns t            on t.id = c.turn_id and t.coach_id = v_coach
  join cycles cy          on cy.turn_id = t.id and cy.is_active
  join cycle_exercises ce on ce.cycle_id = cy.id
  join exercises e        on e.id = ce.exercise_id and e.name = n.esercizio
  on conflict (client_id, cycle_exercise_id) do nothing;

  raise notice 'Fatto. Tutto intestato a Sandro (%).', v_email;
end $$;


-- ═══ VERIFICA ═════════════════════════════════════════════════════════════
select 'coach'              as cosa, count(*) from coaches
union all select 'turni',    count(*) from turns
union all select 'atlete',   count(*) from clients
union all select 'schede',   count(*) from cycles
union all select 'esercizi in scheda', count(*) from cycle_exercises
union all select 'carichi',  count(*) from client_loads
union all select 'note',     count(*) from client_notes;

-- Atteso: 1 coach · 3 turni · 14 atlete · 4 schede · 33 esercizi in scheda
--         (carichi e note dipendono dalle settimane, non serve contarli a mano)


-- ═══ PASSO 3 · FACOLTATIVO, E L'UNICO IRREVERSIBILE ═══════════════════════
-- Il PASSO 2 ha tolto i PROFILI degli altri coach, ma i loro ACCOUNT DI
-- ACCESSO esistono ancora. Non fanno danni: senza profilo l'app ne creerebbe
-- uno vuoto al primo accesso, senza vedere niente di Sandro (le policy legano
-- ogni atleta al turno e ogni turno alla sua coach).
--
-- Se li vuoi eliminare davvero, togli il commento ed esegui.
--
-- ⚠️  Elimina anche IL TUO account, se non lo escludi. Non ti chiude fuori da
--     Supabase — solo dall'app, e puoi ricrearti quando vuoi. Ma pensaci.
--
-- delete from auth.users
-- where lower(email) not in (
--   lower('sandro@esempio.it')        -- ← l'account di Sandro, da tenere
--   -- , lower('r.dimiccoli93@gmail.com')  -- ← togli il commento per tenere anche il tuo
-- );
