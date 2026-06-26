-- =====================================================================
-- 0345_prototype_feedback_messages.sql
--
-- Trådet feedback-SAMTALE. prototype_feedback fanger åpningen; denne tabellen
-- gjør hver tilbakemelding til en toveis-dialog: vendor og Creatorhub (admin
-- eller en varm system-kvittering) svarer fram og tilbake i samme tråd.
--
-- sender_role:
--   vendor  — prototype-testeren (eier av feedback-raden)
--   admin   — et menneske fra Creatorhub-teamet
--   system  — automatisk varm kvittering (AI når tilgjengelig, ellers mal)
--
-- feedback_id er VARCHAR (løs kobling, ingen FK) for å unngå type-clash med
-- ulike id-varianter. Backend oppretter tabellen lazily (ensureTable) i tillegg,
-- siden start-scriptet (`node server.js`) ikke kjører migrate.sh på hver deploy.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS prototype_feedback_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id    VARCHAR(64) NOT NULL,
  sender_role    VARCHAR(16) NOT NULL,   -- vendor | admin | system
  sender_user_id VARCHAR(255),
  sender_name    VARCHAR(255),
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_messages_feedback
  ON prototype_feedback_messages (feedback_id, created_at);

COMMIT;
