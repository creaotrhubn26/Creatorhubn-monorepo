-- 0132 — ResumeBuilder: språk + sub-rolle-grupper på erfaring
--
-- En referanse-CV avslørte tre strukturelle gap mot 0131:
--
--   1. Språk var hardkodet i to templates ("Norsk → Morsmål, Engelsk →
--      Flytende"). Ingen DB-tabell. Nå: egen resume_languages-tabell
--      med proficiency-nivå + native-flag.
--
--   2. En jobb kan ha flere sub-roller (CV-eksempel: "Daglig leder,
--      Norwedfilm" → Produsent / Regissør / Fotograf, hver med egne
--      bullet-points). Den flate `achievements text[]` kan ikke
--      representere dette. Vi legger til `experience_groups jsonb` som
--      Array<{category: string, items: string[]}>. Hvis tom: fall
--      tilbake på achievements (backwards-compat).
--
--   3. Vitnemålsportalen/utdanning trenger ikke endring — `achievements`
--      brukes som kursplan/emner.
--
-- Idempotent: IF NOT EXISTS overalt.

-- ── resume_languages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_languages (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  name              VARCHAR(100) NOT NULL,            -- 'Norsk', 'Engelsk', 'Spansk'
  proficiency_level INT          NOT NULL DEFAULT 80, -- 0-100 for progress-bar
  level_label       VARCHAR(50),                      -- 'Morsmål', 'Flytende', 'God', 'Grunnleggende'
  is_native         BOOLEAN      DEFAULT FALSE,

  display_order     INT     DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_languages_prof_chk
    CHECK (proficiency_level BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS resume_languages_resume_id_idx ON resume_languages (resume_id);


-- ── experience_groups på resume_experiences ─────────────────────────
-- Array<{category: string, items: string[]}> — hvis tom/null brukes
-- `achievements text[]` som før (backwards-compat). Templates/eksport
-- velger riktig render-strategi basert på dette feltet.
DO $$ BEGIN
  ALTER TABLE resume_experiences
    ADD COLUMN IF NOT EXISTS experience_groups JSONB;
END $$;
