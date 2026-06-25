-- =====================================================================
-- 0344_prototype_activity_signals.sql
--
-- Improvement C — implisitte/atferdssignaler for prototype-testere.
-- Eksplisitt feedback (prototype_feedback) fanger det testeren VELGER å si;
-- denne fanger hva de FAKTISK gjør: når de er inne, hvilke flater de bruker,
-- hvor de møter friksjon (feil), om de leverer. Gir admin et engasjement-bilde
-- fra dag 1 — selv før testeren har skrevet en eneste tilbakemelding.
--
-- Skrives best-effort fra et lett frontend-beacon (kun aktive prototype-testere).
-- Backend oppretter tabellen lazily (ensureTable) i tillegg til denne migrasjonen,
-- siden start-scriptet (`node server.js`) ikke kjører migrate.sh på hver deploy.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS prototype_activity_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(255) NOT NULL,
  user_email  VARCHAR(320),
  event_type  VARCHAR(64) NOT NULL,   -- workspace_open | tab_view | job_delivered | feedback_opened | feedback_submitted | error_seen | welcome_seen
  surface     VARCHAR(64),            -- jobs | compliance | catalog | communication | ...
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prototype_activity_user
  ON prototype_activity_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prototype_activity_created
  ON prototype_activity_signals (created_at DESC);

COMMIT;
