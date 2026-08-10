-- 0450_role_room_role_status_pipeline.sql
--
-- Del A punkt 14: status-pipeline for roller (utlyst → signert).
-- «Ryggraden i casting-flyten.»
--
-- casting_roles.status var en bar VARCHAR(50) med default 'open' — ingen
-- vokabular, ingen overganger, ingen historikk. To konsekvenser:
--   1. «Hvor langt har vi kommet på denne rollen» kunne ikke besvares
--      maskinelt, og dermed heller ikke aggregeres på prosjektnivå.
--   2. Ingen visste NÅR en rolle ble utlyst eller signert, som er det
--      gjennomløpstid måles på.
--
-- Kandidat-pipelinen finnes allerede (role-room-candidate-status-routes.ts,
-- 11 statuser). Dette er motstykket på rollenivå: kandidaten beveger seg
-- gjennom sin trakt, rollen gjennom sin.

-- ── Vokabular ────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Normaliser eksisterende verdier før constraint settes på. 'open' er
  -- default fra før og trenger ingen konvertering.
  UPDATE casting_roles SET status = 'open'
   WHERE status IS NULL OR trim(status) = '' OR lower(status) IN ('open','åpen','utlyst');
  UPDATE casting_roles SET status = 'signed'
   WHERE lower(status) IN ('signed','signert','filled','besatt');
  UPDATE casting_roles SET status = 'cancelled'
   WHERE lower(status) IN ('cancelled','canceled','avlyst','kansellert');
  UPDATE casting_roles SET status = 'draft'
   WHERE lower(status) IN ('draft','kladd');

  -- Alt annet er ukjent og settes til 'open' framfor å blokkere migreringen.
  UPDATE casting_roles SET status = 'open'
   WHERE status NOT IN ('draft','open','auditioning','shortlisted','offered','signed','on_hold','cancelled');
END $$;

ALTER TABLE casting_roles
  ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'casting_roles_status_vocab') THEN
    ALTER TABLE casting_roles
      ADD CONSTRAINT casting_roles_status_vocab
      CHECK (status IN ('draft','open','auditioning','shortlisted','offered','signed','on_hold','cancelled'));
  END IF;
END $$;

COMMENT ON COLUMN casting_roles.status IS
  'Pipeline: draft → open (utlyst) → auditioning → shortlisted → offered → signed. on_hold/cancelled er sidespor.';

-- ── Tidsstempler for gjennomløpstid ──────────────────────────────────────
-- Uten disse kan man se hvor en rolle ER, men ikke hvor lang tid den brukte.

ALTER TABLE casting_roles
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at         TIMESTAMPTZ;

UPDATE casting_roles SET status_changed_at = COALESCE(status_changed_at, updated_at, created_at)
 WHERE status_changed_at IS NULL;

-- Roller som allerede står forbi utlysning har passert 'open' en gang, selv om
-- overgangen aldri ble logget. Uten et anslag her ville gjennomløpstid vært
-- umålbar for alt som fantes før pipelinen. created_at er det nærmeste vi har.
UPDATE casting_roles
   SET opened_at = COALESCE(opened_at, created_at)
 WHERE opened_at IS NULL
   AND status IN ('open','auditioning','shortlisted','offered','signed');

UPDATE casting_roles
   SET signed_at = COALESCE(signed_at, status_changed_at, updated_at)
 WHERE signed_at IS NULL AND status = 'signed';

-- ── Historikk ────────────────────────────────────────────────────────────
-- Én rad per overgang. Bærer «hvor lenge sto rollen i hvert steg», som er
-- det man trenger for å finne flaskehalsen i castingen.

CREATE TABLE IF NOT EXISTS role_room_role_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       VARCHAR(255) NOT NULL REFERENCES casting_roles(id) ON DELETE CASCADE,
  project_id    VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- NULL ved opprettelse.
  from_status   VARCHAR(30),
  to_status     VARCHAR(30) NOT NULL,
  note          TEXT,
  changed_by_user_id VARCHAR(255),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_role_status_history_role
  ON role_room_role_status_history (role_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_role_status_history_project
  ON role_room_role_status_history (project_id, changed_at DESC);

COMMENT ON TABLE role_room_role_status_history IS
  'Overgangslogg for rolle-status (Del A punkt 14). Grunnlag for gjennomløpstid per steg.';

-- Statusfiltrering på prosjektnivå driver oversiktsbildet.
CREATE INDEX IF NOT EXISTS idx_casting_roles_project_status
  ON casting_roles (project_id, status);
