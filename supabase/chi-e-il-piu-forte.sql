-- ═══════════════════════════════════════════════════════════════════════════
--  CHI È IL PIÙ FORTE
--
--  Prima una premessa, perché cambia la risposta: i chili di esercizi
--  diversi non si sommano e non si confrontano. 120 alla pressa e 30 alla
--  panca non dicono chi è più forte: dicono solo che sono due esercizi
--  diversi. Una classifica fatta sommando i chili premierebbe chi fa più
--  esercizi di gamba, e basta.
--
--  Quindi qui ci sono due classifiche, tutte e due oneste:
--
--  A · il record di ogni esercizio, con chi lo tiene
--  B · una classifica generale, dove ognuno vale quanto si avvicina al
--      record di CIASCUN esercizio che fa, e poi si fa la media
--
--  La B è una misura inventata da noi, non uno standard: dice «quanto sei
--  vicino al migliore, in media, negli esercizi che fai». 100 vuol dire che
--  tieni il record ovunque.
--
--  Nessuna delle due tocca niente: sono solo letture.
--
--  Si escludono i carichi a 0 kg — corpo libero e macchine assistite — che
--  nel confronto non vogliono dire niente.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ A · IL RECORD DI OGNI ESERCIZIO ══════════════════════════════════════
with massimi as (
  select
    e.name                          as esercizio,
    c.id                            as persona_id,
    c.surname || ' ' || c.name      as persona,
    max(l.kg)                       as kg
  from client_loads l
  join clients         c  on c.id  = l.client_id
  join cycle_exercises ce on ce.id = l.cycle_exercise_id
  join exercises       e  on e.id  = ce.exercise_id
  where l.kg is not null
    and l.kg > 0
    and c.is_active                 -- togli questa riga per contare anche gli archiviati
  group by e.name, c.id, c.surname, c.name
)
select distinct on (esercizio)
  esercizio,
  persona   as detiene_il_record,
  kg
from massimi
order by esercizio, kg desc, persona;


-- ═══ B · LA CLASSIFICA GENERALE ═══════════════════════════════════════════
-- Lanciala da sola (seleziona da «with» fino al punto e virgola).
with massimi as (
  select
    e.name                          as esercizio,
    c.id                            as persona_id,
    c.surname || ' ' || c.name      as persona,
    max(l.kg)                       as kg
  from client_loads l
  join clients         c  on c.id  = l.client_id
  join cycle_exercises ce on ce.id = l.cycle_exercise_id
  join exercises       e  on e.id  = ce.exercise_id
  where l.kg is not null
    and l.kg > 0
    and c.is_active
  group by e.name, c.id, c.surname, c.name
),
record as (
  -- Il record dell'esercizio, e quante persone lo fanno. Un esercizio fatto
  -- da una persona sola darebbe a quella persona un 100 gratis: si tengono
  -- solo quelli fatti da almeno tre.
  select esercizio, max(kg) as kg_record, count(*) as quante_persone
  from massimi
  group by esercizio
)
select
  m.persona,
  round(avg(m.kg::numeric / r.kg_record) * 100)  as punteggio,
  count(*)                                       as esercizi_contati
from massimi m
join record  r on r.esercizio = m.esercizio
where r.quante_persone >= 3
group by m.persona
-- Chi ha due esercizi contati e un punteggio altissimo non è il più forte:
-- è solo quello con pochi dati. Si chiede un minimo di cinque.
having count(*) >= 5
order by punteggio desc, m.persona;
