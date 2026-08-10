-- 0445_role_room_structured_role_demographics.sql
--
-- Del A punkt 17 (strukturert aldersspenn/kjønn) og punkt 11 (prosjekttype
-- påkrevd). Begge er datamodell-endringer der migreringskostnaden vokser for
-- hver måned de utsettes — derfor tidlig.
--
-- ── Punkt 17 ──
-- casting_roles.age_range er fritekst ('25-35'). Det gjør at rollen ikke kan
-- matches maskinelt mot talents.playing_age_min/max, som ER strukturert.
-- Uten dette kan ikke Talents-matchingen (167–168) bygges.
--
-- Kolonnene her speiler talents-navnene bevisst: en match er da et rett
-- sammenlignbart intervall, og det er vanskeligere å koble feil felt.
--
-- Fritekstkolonnene beholdes som visningsverdi og backfilles ikke bort —
-- 'ca. 40' og 'voksen' bærer nyanser strukturen ikke fanger.
--
-- ── Punkt 11 ──
-- casting_projects.project_type er nullable uten validering. NULL-verdier
-- backfilles til 'video' (den nøytrale hovedtypen) og kolonnen settes NOT
-- NULL, slik at nye prosjekter må ta stilling.

-- ── Punkt 17: strukturert spillealder ────────────────────────────────────

ALTER TABLE casting_roles
  ADD COLUMN IF NOT EXISTS playing_age_min INTEGER,
  ADD COLUMN IF NOT EXISTS playing_age_max INTEGER;

COMMENT ON COLUMN casting_roles.playing_age_min IS
  'Nedre spillealder rollen krever. Speiler talents.playing_age_min for matching.';
COMMENT ON COLUMN casting_roles.playing_age_max IS
  'Øvre spillealder rollen krever. Speiler talents.playing_age_max for matching.';
COMMENT ON COLUMN casting_roles.age_range IS
  'Fritekst-visning ("ca. 40", "voksen"). Strukturen ligger i playing_age_min/max.';

-- ── Punkt 17: strukturert kjønn ──────────────────────────────────────────
-- En rolle kan være åpen for flere kjønn («kvinne eller ikke-binær»), så
-- dette er en liste og ikke ett felt. Tom liste = åpen for alle.
--
-- text[] framfor JSONB nettopp fordi CHECK da kan håndheve vokabularet:
-- Postgres tillater ikke subqueries i CHECK, så en JSONB-array måtte vært
-- validert med trigger. `<@` gjør det i én operator.

ALTER TABLE casting_roles
  ADD COLUMN IF NOT EXISTS gender_options TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'casting_roles_gender_options_vocab'
  ) THEN
    ALTER TABLE casting_roles
      ADD CONSTRAINT casting_roles_gender_options_vocab
      CHECK (gender_options <@ ARRAY['female','male','non_binary','any']::text[]);
  END IF;
END $$;

COMMENT ON COLUMN casting_roles.gender_options IS
  'Kjønn rollen er åpen for. Tom liste = åpen for alle. Vokabular håndheves av CHECK.';

-- Intervallet må være sammenhengende.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'casting_roles_playing_age_order'
  ) THEN
    ALTER TABLE casting_roles
      ADD CONSTRAINT casting_roles_playing_age_order
      CHECK (
        playing_age_min IS NULL OR playing_age_max IS NULL
        OR playing_age_max >= playing_age_min
      );
  END IF;
END $$;

-- ── Backfill: parse fritekst der formen er entydig ───────────────────────
-- Dekker 'NN-NN' med bindestrek, tankestrek eller ' til ', samt 'NN+'.
-- Alt annet ('voksen', 'barn') står igjen som NULL framfor å gjettes —
-- en feil strukturert alder er verre enn ingen.

-- 1) Intervall: 25-35 / 25–35 / 25 til 35
--    Kun når intervallet går riktig vei. Et omvendt spenn ('35-25') er en
--    inntastingsfeil vi ikke kan tolke — den står igjen som NULL framfor å
--    bli snudd, siden vi ikke vet hvilket av tallene som er feil.
UPDATE casting_roles
   SET playing_age_min = (regexp_match(age_range, '(\d{1,3})\s*(?:-|–|—|til)\s*(\d{1,3})'))[1]::int,
       playing_age_max = (regexp_match(age_range, '(\d{1,3})\s*(?:-|–|—|til)\s*(\d{1,3})'))[2]::int
 WHERE playing_age_min IS NULL
   AND age_range ~ '(\d{1,3})\s*(?:-|–|—|til)\s*(\d{1,3})'
   AND (regexp_match(age_range, '(\d{1,3})\s*(?:-|–|—|til)\s*(\d{1,3})'))[2]::int
       >= (regexp_match(age_range, '(\d{1,3})\s*(?:-|–|—|til)\s*(\d{1,3})'))[1]::int;

-- 2) Åpen øvre grense: 40+
UPDATE casting_roles
   SET playing_age_min = (regexp_match(age_range, '(\d{1,3})\s*\+'))[1]::int
 WHERE playing_age_min IS NULL
   AND age_range ~ '^\s*\d{1,3}\s*\+\s*$';

-- 3) Ett tall alene: 30 / ca. 30 → tolkes som eksakt spillealder
UPDATE casting_roles
   SET playing_age_min = (regexp_match(age_range, '(\d{1,3})'))[1]::int,
       playing_age_max = (regexp_match(age_range, '(\d{1,3})'))[1]::int
 WHERE playing_age_min IS NULL
   AND age_range ~ '^\s*(?:ca\.?\s*)?\d{1,3}\s*(?:år)?\s*$';

-- Kjønn: kartlegg kjente skrivemåter, norsk og engelsk.
UPDATE casting_roles
   SET gender_options = ARRAY['female']::text[]
 WHERE gender_options = '{}'
   AND lower(trim(coalesce(gender, ''))) IN ('female','kvinne','kvinnelig','dame','f','k');

UPDATE casting_roles
   SET gender_options = ARRAY['male']::text[]
 WHERE gender_options = '{}'
   AND lower(trim(coalesce(gender, ''))) IN ('male','mann','mannlig','herre','m');

UPDATE casting_roles
   SET gender_options = ARRAY['non_binary']::text[]
 WHERE gender_options = '{}'
   AND lower(trim(coalesce(gender, ''))) IN ('non_binary','non-binary','nonbinary','ikke-binær','ikke binær');

UPDATE casting_roles
   SET gender_options = ARRAY['any']::text[]
 WHERE gender_options = '{}'
   AND lower(trim(coalesce(gender, ''))) IN ('any','alle','uspesifisert','begge','alle kjønn');

-- Matching (167–168) slår opp på intervall + kjønn.
CREATE INDEX IF NOT EXISTS idx_casting_roles_playing_age
  ON casting_roles (playing_age_min, playing_age_max)
  WHERE playing_age_min IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_casting_roles_gender_options
  ON casting_roles USING GIN (gender_options);

-- ── Punkt 11: prosjekttype påkrevd ───────────────────────────────────────
-- 'video' er den nøytrale hovedtypen i PROJECT_TYPES og brukes som
-- backfill-verdi. Merkes i metadata slik at UI kan be brukeren bekrefte
-- typen framfor å la en gjettet verdi se ut som et aktivt valg.

UPDATE casting_projects
   SET project_type = 'video',
       metadata = coalesce(metadata, '{}'::jsonb)
                  || '{"projectTypeBackfilled":true}'::jsonb
 WHERE project_type IS NULL OR trim(project_type) = '';

ALTER TABLE casting_projects
  ALTER COLUMN project_type SET DEFAULT 'video';

-- Seks kodesteder oppretter prosjekter, og flere sender project_type
-- eksplisitt. En eksplisitt NULL overstyrer kolonnens DEFAULT, så NOT NULL
-- alene ville brutt de kallstedene. Trigger framfor å rette hvert enkelt:
-- den dekker også kallsteder som kommer til senere, og holder markeringen
-- av gjettede verdier på ett sted.
CREATE OR REPLACE FUNCTION rr_default_project_type() RETURNS trigger AS $$
BEGIN
  IF NEW.project_type IS NULL OR trim(NEW.project_type) = '' THEN
    NEW.project_type := 'video';
    -- Merk at typen ikke er et aktivt valg, slik at UI kan be om bekreftelse
    -- framfor å vise en gjettet verdi som om brukeren hadde satt den.
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb)
                    || '{"projectTypeBackfilled":true}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rr_default_project_type ON casting_projects;
CREATE TRIGGER trg_rr_default_project_type
  BEFORE INSERT OR UPDATE OF project_type ON casting_projects
  FOR EACH ROW EXECUTE FUNCTION rr_default_project_type();

ALTER TABLE casting_projects
  ALTER COLUMN project_type SET NOT NULL;

COMMENT ON COLUMN casting_projects.project_type IS
  'Påkrevd. NULL normaliseres til ''video'' av trigger. metadata->>''projectTypeBackfilled'' = true betyr at verdien er gjettet og bør bekreftes i UI.';
