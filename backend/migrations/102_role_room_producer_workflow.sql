-- Role Room Producer Workflow persistence
-- Adds timeline, economy, client review and review comments tables.

CREATE TABLE IF NOT EXISTS role_room_phase_timeline_items (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  phase VARCHAR(32) NOT NULL CHECK (phase IN ('preproduction', 'production', 'postproduction')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id VARCHAR(255),
  due_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'planned',
  linked_entity_type VARCHAR(100),
  linked_entity_id VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_project ON role_room_phase_timeline_items(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_phase ON role_room_phase_timeline_items(phase);
CREATE INDEX IF NOT EXISTS idx_rr_phase_timeline_status ON role_room_phase_timeline_items(status);

CREATE TABLE IF NOT EXISTS role_room_budget_items (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  phase VARCHAR(32) NOT NULL CHECK (phase IN ('preproduction', 'production', 'postproduction')),
  category VARCHAR(120) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  estimate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  approved NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'NOK',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  linked_entity_type VARCHAR(100),
  linked_entity_id VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_budget_project ON role_room_budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_budget_phase ON role_room_budget_items(phase);
CREATE INDEX IF NOT EXISTS idx_rr_budget_status ON role_room_budget_items(status);

CREATE TABLE IF NOT EXISTS role_room_client_reviews (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  review_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_entity_type VARCHAR(100),
  target_entity_id VARCHAR(255),
  requested_by_user_id VARCHAR(255),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  decision_by_user_id VARCHAR(255),
  decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_project ON role_room_client_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_status ON role_room_client_reviews(status);
CREATE INDEX IF NOT EXISTS idx_rr_client_reviews_type ON role_room_client_reviews(review_type);

CREATE TABLE IF NOT EXISTS role_room_client_review_comments (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES role_room_client_reviews(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  author_user_id VARCHAR(255),
  author_role VARCHAR(80),
  comment_text TEXT NOT NULL,
  timestamp_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_review_comments_project ON role_room_client_review_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_review_comments_review ON role_room_client_review_comments(review_id);
