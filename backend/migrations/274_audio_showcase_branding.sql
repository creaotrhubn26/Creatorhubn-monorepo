-- 274_audio_showcase_branding.sql
--
-- Per-produsent branding for Audio Showcase-dokumenter (avtale-PDF m.m.):
-- egen logo + studionavn + aksentfarge. Settes én gang, gjenbrukes på alle
-- avtaler. Faller tilbake til CreatorHub-branding hvis ikke satt.

CREATE TABLE IF NOT EXISTS audio_showcase_branding (
  user_id      TEXT PRIMARY KEY,
  brand_name   TEXT,
  logo_url     TEXT,           -- B2/https eller data-URL
  accent_color TEXT,           -- hex, f.eks. #FF6B35
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
