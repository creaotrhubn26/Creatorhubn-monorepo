-- 0149 — Eksplisitt PII-anerkjennelse for AI-funksjoner
--
-- Bruker må aktivt godkjenne at de forstår hvilke data som sendes til
-- AI-leverandører før de bruker AI-funksjoner i NextRole (Sigrid, Mock
-- Interview, Video-presentasjon).
--
-- Versjon brukes til å re-anerkjenne hvis vi senere utvider hva som
-- sendes — da bumper vi PII_DISCLOSURE_VERSION i koden og brukeren
-- må gjennomgå listen på nytt.

ALTER TABLE nextrole_user_prefs
  ADD COLUMN IF NOT EXISTS pii_acknowledged_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pii_acknowledged_version VARCHAR(16),
  -- Brukerens IP-hash på tidspunkt for anerkjennelse (audit-spor uten
  -- å lagre selve IP-en)
  ADD COLUMN IF NOT EXISTS pii_acknowledged_ip_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS nextrole_user_prefs_pii_acked_idx
  ON nextrole_user_prefs (pii_acknowledged_version)
  WHERE pii_acknowledged_at IS NOT NULL;
