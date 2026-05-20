-- 0146 — Detaljert visning-logg for offentlige CV-er
--
-- public_view_count på resumes-tabellen er fortsatt løpende teller.
-- Denne tabellen logger hver visning med metadata for analytics:
--   - hvilken dag
--   - hvilket land (fra Cloudflare cf-ipcountry-headeren)
--   - referrer (hvor de kom fra)
--   - ip-hash (sha256, ikke selve IP-en — GDPR-vennlig)
--
-- For å unngå spam fra én bruker: vi grupperer view-events per
-- (resume_id, ip_hash, dag) på applikasjonsnivå (idempotent insert
-- via UNIQUE constraint).

CREATE TABLE IF NOT EXISTS nextrole_public_cv_views (
  id           BIGSERIAL    PRIMARY KEY,
  resume_id    VARCHAR(64)  NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,

  -- En "dag" per unik viewer per CV
  viewed_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
  viewed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  ip_hash      VARCHAR(64),                 -- sha256(ip + salt)
  country_code VARCHAR(8),                  -- ISO 3166-1, fra Cloudflare-header
  city         VARCHAR(128),                -- om vi får det (sjeldent på Render)
  referrer     VARCHAR(500),                -- hvor de kom fra (kortet til 500)
  user_agent_kind VARCHAR(32),              -- 'mobile' | 'desktop' | 'bot' | 'unknown'

  -- Unik per (cv, viewer, dag) — gjentatte visninger samme dag teller bare én gang
  UNIQUE (resume_id, ip_hash, viewed_date)
);

CREATE INDEX IF NOT EXISTS nextrole_public_cv_views_resume_idx
  ON nextrole_public_cv_views (resume_id, viewed_date DESC);
CREATE INDEX IF NOT EXISTS nextrole_public_cv_views_country_idx
  ON nextrole_public_cv_views (resume_id, country_code)
  WHERE country_code IS NOT NULL;
