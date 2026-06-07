-- Migration 242: tester_skill_ratings
--
-- Tracking-tabell for tester-ferdigheter og leaderboard. Lar admin
-- akkumulere poeng pr. (bruker, skill-kategori) basert på kvalitet og
-- volum av prototype-feedback og test-aktivitet.
--
-- NB: Spec'en (Task #123) refererte til "234", men 234..241 var allerede
-- tatt (selftape/talent + ads-comments + role-room + legal-documents +
-- parallell agency_leads-spor). Vi tar derfor neste ledige nummer (242).
--
-- En rad pr. (user_id, skill_category) — UNIQUE-constraint sikrer at
-- award-endepunktet kan upsert'e (ON CONFLICT DO UPDATE).
--
-- skill_category:           Én av 'bug-hunting' | 'ux-feedback' |
--                           'regression-testing' | 'integration-testing' |
--                           'edge-cases'. Validering skjer i app-laget.
-- score:                    Akkumulert poengsum (bumpes av award-endpoint).
-- total_submissions:        Antall test-submissions totalt.
-- high_quality_submissions: Antall submissions markert som høy kvalitet
--                           av reviewer (driver high-quality-rate).
-- last_active_at:           Sist gang denne brukeren leverte i kategorien.

CREATE TABLE IF NOT EXISTS tester_skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skill_category TEXT NOT NULL,
    -- 'bug-hunting' | 'ux-feedback' | 'regression-testing'
    -- | 'integration-testing' | 'edge-cases'
  score INTEGER NOT NULL DEFAULT 0,
    -- Akkumulert poeng
  total_submissions INTEGER NOT NULL DEFAULT 0,
  high_quality_submissions INTEGER NOT NULL DEFAULT 0,
    -- Submissions markert som high-quality av reviewer
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_category)
);

CREATE INDEX IF NOT EXISTS tester_skills_score_idx
  ON tester_skill_ratings (skill_category, score DESC);

CREATE INDEX IF NOT EXISTS tester_skills_user_idx
  ON tester_skill_ratings (user_id);
