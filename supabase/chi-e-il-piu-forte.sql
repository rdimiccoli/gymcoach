-- ═══════════════════════════════════════════════════════════════════════════
--  PER OGNI ESERCIZIO, CHI CARICA DI PIÙ
--
--  Una riga per esercizio: il nome di chi ha il carico più alto, e quanti
--  chili. Si guarda il massimo che ogni persona ha mai messo su quell'
--  esercizio, in qualsiasi scheda e qualsiasi settimana.
--
--  È solo una lettura: non tocca niente.
-- ═══════════════════════════════════════════════════════════════════════════

with massimi as (
  select
    e.name                      as esercizio,
    c.surname || ' ' || c.name  as persona,
    max(l.kg)                   as kg
  from client_loads l
  join clients         c  on c.id  = l.client_id
  join cycle_exercises ce on ce.id = l.cycle_exercise_id
  join exercises       e  on e.id  = ce.exercise_id
  where l.kg is not null
    and l.kg > 0        -- lo 0 è corpo libero o macchina assistita
    and c.is_active     -- togli questa riga per contare anche gli archiviati
  group by e.name, c.id, c.surname, c.name
)
select distinct on (esercizio)
  esercizio,
  persona,
  kg
from massimi
order by esercizio, kg desc, persona;


-- ───────────────────────────────────────────────────────────────────────────
-- Se invece di un nome solo vuoi la classifica completa di un esercizio,
-- togli il `distinct on` e filtra: lancia questa al posto di quella sopra.
-- ───────────────────────────────────────────────────────────────────────────
-- select
--   c.surname || ' ' || c.name as persona,
--   max(l.kg)                  as kg
-- from client_loads l
-- join clients         c  on c.id  = l.client_id
-- join cycle_exercises ce on ce.id = l.cycle_exercise_id
-- join exercises       e  on e.id  = ce.exercise_id
-- where l.kg > 0
--   and e.name ilike '%panca%'     -- il nome dell'esercizio che ti interessa
-- group by c.id, c.surname, c.name
-- order by kg desc;
