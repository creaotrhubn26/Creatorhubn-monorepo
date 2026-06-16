-- 285_role_room_profile_suggestions.sql
-- Agent «Profilforslag»: AI-genererte profil-optimaliseringer (bio, nøkkelord/
-- hashtags, CTA-knapp) per tilkoblet plattform-profil (Facebook-side, IG osv).
-- Soft-refs (TEXT owner/project, ingen hard FK) — samme mønster som
-- role_room_agent_recommendation (mig 284).

CREATE TABLE IF NOT EXISTS role_room_profile_suggestion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  project_id    TEXT,
  platform      TEXT NOT NULL DEFAULT 'facebook',
  page_id       TEXT,
  page_name     TEXT,
  bio           TEXT,
  hashtags      JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label     TEXT,
  status        TEXT NOT NULL DEFAULT 'new',   -- new | applied | dismissed
  source        TEXT,                          -- claude | template
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_room_profile_suggestion_scope
  ON role_room_profile_suggestion (owner_user_id, platform, created_at DESC);
