-- 0322_role_room_content_plan.sql
-- Content Planner: lett, PROSJEKT-scopet innholds-plan med dato (kalender).
-- Bevisst atskilt fra content_calendar_items (admin-global, ingen project_id)
-- og fra marketing_plan_posts (krever plan + AI-kvote). Dette er en enkel
-- «planlagt post»-modell som chat-Action («Legg i Content Planner») skriver til,
-- og som rendres som kalender/agenda + kan pushes til feed-planneren.

CREATE TABLE IF NOT EXISTS role_room_content_plan (
  id                 UUID PRIMARY KEY,
  project_id         VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title              VARCHAR(255) NOT NULL,
  caption            TEXT,
  platform           VARCHAR(40),                       -- instagram|tiktok|linkedin|youtube|facebook|other
  scheduled_at       TIMESTAMPTZ,                       -- kalender-dato (null = uplanlagt)
  status             VARCHAR(24) NOT NULL DEFAULT 'draft',   -- draft | scheduled | published
  source             VARCHAR(24) NOT NULL DEFAULT 'manual',  -- chat | manual
  feed_plan_pushed   BOOLEAN NOT NULL DEFAULT FALSE,    -- pushet til feed-planner?
  notes              TEXT,
  created_by_user_id VARCHAR(255),
  created_by_role    VARCHAR(80),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kalender/agenda sorterer på dato per prosjekt.
CREATE INDEX IF NOT EXISTS idx_rr_content_plan_project_date
  ON role_room_content_plan (project_id, scheduled_at NULLS LAST, created_at DESC);

COMMENT ON TABLE role_room_content_plan IS
  'Lett prosjekt-scopet content-plan (planlagte poster m/ dato). Chat-Action skriver hit; rendres som kalender; kan pushes til feed-planner.';
