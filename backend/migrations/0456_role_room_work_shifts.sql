-- 0456_role_room_work_shifts.sql
--
-- Del A punkt 74 (overtidsvarsel norsk regelverk) og 80 (barnearbeid-
-- regelsjekk). Backloggen kaller dette en differensiator: «internasjonale kan
-- ikke AML».
--
-- For å kunne si noe om arbeidstid må vi vite når folk faktisk er på jobb.
-- Call sheet-generatoren har innkallingstider, men de lever i HTML-en som
-- sendes ut — ikke som data noen kan regne på. Denne tabellen er grunnlaget.
--
-- Fødselsdato legges på kandidater og crew fordi aldersgrensene i AML kap. 11
-- avhenger av alderen PÅ OPPTAKSDAGEN, ikke i dag. En 14-åring som fyller 15
-- midt i innspillingen bytter regelsett underveis.

-- ── Fødselsdato ──────────────────────────────────────────────────────────
-- Personopplysning: omfattes av retention-feiingen (migrering 0443) på lik
-- linje med resten av kandidatdataene.

ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE casting_crew
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN casting_candidates.birth_date IS
  'Brukes til aldersgrenser i AML kap. 11. Alderen regnes på opptaksdagen, ikke i dag.';

-- Skolestatus avgjør hvilket regelsett som gjelder for de under 18:
-- grunnskolepliktige har vesentlig strengere grenser enn 15–18-åringer som
-- er ferdige med grunnskolen.
ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS in_compulsory_schooling BOOLEAN;

COMMENT ON COLUMN casting_candidates.in_compulsory_schooling IS
  'AML § 11-2: grunnskolepliktige har strengere grenser enn 15–18 utenfor grunnskolen. NULL = ukjent.';

-- Arbeidstilsynet må gi tillatelse for barn under 15 i kulturelt/kunstnerisk
-- arbeid (AML § 11-1 tredje ledd). Uten den er selve arbeidet ulovlig, ikke
-- bare arbeidstiden.
ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS labour_authority_permit_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS labour_authority_permit_at  DATE;

COMMENT ON COLUMN casting_candidates.labour_authority_permit_ref IS
  'Referanse til Arbeidstilsynets tillatelse (AML § 11-1 tredje ledd) for barn under 15.';

-- ── Vakter ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_work_shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  production_day_id VARCHAR(255) REFERENCES casting_production_days(id) ON DELETE SET NULL,

  -- Kandidat eller crew. Ingen fremmednøkkel, fordi de ligger i hver sin
  -- tabell og en vakt kan gjelde begge.
  person_type       VARCHAR(20) NOT NULL CHECK (person_type IN ('candidate','crew')),
  person_id         VARCHAR(255) NOT NULL,
  -- Kopi for visning; personen kan bli anonymisert av retention-feiingen.
  person_name       VARCHAR(255),

  -- Innkalling og forventet slutt. Faktisk slutt fylles inn etterpå, slik at
  -- planlagt og reell arbeidstid kan sammenlignes.
  call_time         TIMESTAMPTZ NOT NULL,
  wrap_time         TIMESTAMPTZ NOT NULL,
  actual_wrap_time  TIMESTAMPTZ,

  -- Samlet pause i minutter. AML § 10-9 krever pause ved over 5,5 time.
  break_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rr_work_shift_time_order CHECK (wrap_time > call_time),
  CONSTRAINT rr_work_shift_actual_order CHECK (actual_wrap_time IS NULL OR actual_wrap_time > call_time)
);

CREATE INDEX IF NOT EXISTS idx_rr_work_shifts_project_person
  ON role_room_work_shifts (project_id, person_type, person_id, call_time);
CREATE INDEX IF NOT EXISTS idx_rr_work_shifts_day
  ON role_room_work_shifts (production_day_id);

COMMENT ON TABLE role_room_work_shifts IS
  'Arbeidstid per person per opptaksdag (Del A punkt 74/80). Grunnlaget for AML-sjekken.';
COMMENT ON COLUMN role_room_work_shifts.actual_wrap_time IS
  'Faktisk slutt. Planlagt vs. reell arbeidstid er selve poenget med overtidsvarselet.';
