-- 0642_reiseguide_visits.sql
-- SenseAid Explore (lydguide-POC): personlig logg over besøkte steder på
-- serveren (Daniel 18.09.2026: «ja vil ha loggen på serveren … samtidig er
-- det viktig med GDPR»). Bygger på 0640/0641; leses av
-- backend/server/reiseguide-visits.ts.
--
-- Personvern (dataminimering, GDPR art. 5):
--   * Ingen konto, ingen navn, e-post eller IP. Nøkkelen er appens anonyme,
--     tilfeldige enhets-ID (samme som i guide_poi_ratings). Appen kan bytte
--     ID når brukeren sletter dataene sine, så koblingen brytes helt.
--   * Kun det loggen viser: sted, start/slutt-tid, stjerner og quiz-resultat.
--     Ingen posisjon (kun sted-id), ingen fritekst.
--   * Samtykke: appen sender bare når brukeren har slått på «Lagre loggen på
--     serveren» (av som standard).
--   * Innsyn, retting/sletting og dataportabilitet: /api/guide/device/data
--     (GET = alt vi har om enheten som JSON, DELETE = slett alt, også
--     vurderinger).
--   * Lagringsbegrensning: rader eldre enn SENSEAID_VISIT_RETENTION_DAYS
--     (standard 365) slettes automatisk (purge i reiseguide-visits.ts).
--   * Ingen kobling til andre CreatorHub-tabeller enn guide_pois.

CREATE TABLE IF NOT EXISTS guide_poi_visits (
  device_id TEXT NOT NULL
    CONSTRAINT guide_poi_visits_device_id_chk CHECK (device_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  -- Besøkets id lages i appen (UUID) så samme besøk kan sendes flere ganger uten dobbeltlagring.
  id TEXT NOT NULL
    CONSTRAINT guide_poi_visits_id_chk CHECK (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
    CONSTRAINT guide_poi_visits_completed_chk CHECK (completed_at IS NULL OR completed_at >= started_at),
  stars SMALLINT
    CONSTRAINT guide_poi_visits_stars_chk CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  quiz_correct SMALLINT
    CONSTRAINT guide_poi_visits_quiz_correct_chk CHECK (quiz_correct IS NULL OR quiz_correct >= 0),
  quiz_total SMALLINT
    CONSTRAINT guide_poi_visits_quiz_total_chk CHECK (quiz_total IS NULL OR quiz_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_visits_pkey PRIMARY KEY (device_id, id),
  CONSTRAINT guide_poi_visits_quiz_pair_chk CHECK (
    (quiz_correct IS NULL AND quiz_total IS NULL)
    OR (quiz_correct IS NOT NULL AND quiz_total IS NOT NULL AND quiz_correct <= quiz_total)
  )
);
-- Loggen hentes per enhet, nyeste først; purge går på started_at.
CREATE INDEX IF NOT EXISTS guide_poi_visits_device_started_idx
  ON guide_poi_visits (device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS guide_poi_visits_started_idx
  ON guide_poi_visits (started_at);

COMMENT ON TABLE guide_poi_visits IS
  'Lydguide-POC: personlig besøkslogg per anonym enhet (samtykke i appen). Kun sted, tid, stjerner og quiz-resultat; ingen posisjon eller identitet. Slettes ved DELETE /api/guide/device/data og automatisk etter SENSEAID_VISIT_RETENTION_DAYS.';
COMMENT ON COLUMN guide_poi_visits.device_id IS
  'Anonym, tilfeldig ID fra appen (UserDefaults). Byttes av appen når brukeren sletter dataene sine.';
COMMENT ON COLUMN guide_poi_visits.id IS
  'Besøkets id fra appen (UUID); PRIMARY KEY sammen med device_id så en enhet aldri kan overskrive en annens rad.';
