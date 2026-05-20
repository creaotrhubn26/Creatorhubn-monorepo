-- 0141 — NextRole e-post-drip-logg
--
-- Logger hvilken drip-e-post som har gått ut til hvilken bruker, slik
-- at cron-jobben kan kjøre idempotent uten å sende duplikater. En rad
-- per (user_id, email_kind).
--
-- email_kind-verdier:
--   'welcome'             — sendes ved trial-start (ikke drip, men logges for sporing)
--   'drip_day3_tips'      — dag 3: produkt-tips for å øke aktivering
--   'drip_day7_social'    — dag 7: case-studier og sosialt bevis
--   'trial_expiring_3d'   — 3 dager før trial utløper (allerede eksisterende email)
--   'drip_day13_lastcall' — 1 dag før utløp: siste advarsel
--   'post_trial_winback'  — 7 dager etter at trial utløp uten konvertering

CREATE TABLE IF NOT EXISTS nextrole_email_drip_log (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL,
  email_kind  VARCHAR(64)  NOT NULL,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  message_id  VARCHAR(255),
  metadata    JSONB,

  UNIQUE (user_id, email_kind)
);

CREATE INDEX IF NOT EXISTS nextrole_email_drip_log_user_idx
  ON nextrole_email_drip_log (user_id);
CREATE INDEX IF NOT EXISTS nextrole_email_drip_log_kind_idx
  ON nextrole_email_drip_log (email_kind);
