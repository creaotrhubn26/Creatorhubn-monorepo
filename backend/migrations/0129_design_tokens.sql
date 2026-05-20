-- Slice 9X.72 — Admin-styrte design-tokens for dashboardet
--
-- Daniel kan endre accent-farger, border-radius, fonts og lignende
-- via Visual CMS. Frontend leser via /api/admin/design-tokens og
-- merger med hardkodede defaults i dashboard-design-tokens.ts.

CREATE TABLE IF NOT EXISTS design_tokens (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  accent_color    TEXT,
  accent_color_secondary TEXT,
  text_primary    TEXT,
  text_secondary  TEXT,
  radius_md       INTEGER,
  radius_lg       TEXT,
  font_display    TEXT,
  custom_overrides JSONB DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT
);
