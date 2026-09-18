-- 0624_narrative_review_share_links.sql
-- Gjeste-reviewere for Story Graph-scener (Fase 7e-2): delingslenke per
-- review-runde (hash-token, aldri klartekst) + navngitt reviewer-sesjon.
-- Mønster: storyboard_review_share_links / _sessions (0592). Kommentarer
-- går i role_room_editor_comments med author_id = 'reviewer:<sesjon>'.

CREATE TABLE IF NOT EXISTS narrative_review_share_links (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES narrative_scenes(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES narrative_scene_reviews(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  access_mode TEXT NOT NULL DEFAULT 'comment'
    CONSTRAINT narrative_review_share_links_mode_chk CHECK (access_mode IN ('view', 'comment', 'approve')),
  require_identity BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS narrative_review_share_links_review_idx
  ON narrative_review_share_links (review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS narrative_review_share_links_active_idx
  ON narrative_review_share_links (token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS narrative_review_sessions (
  id TEXT PRIMARY KEY,
  share_link_id TEXT NOT NULL REFERENCES narrative_review_share_links(id) ON DELETE CASCADE,
  reviewer_token_hash CHAR(64) NOT NULL UNIQUE CHECK (reviewer_token_hash ~ '^[0-9a-f]{64}$'),
  display_name VARCHAR(180) NOT NULL,
  email VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS narrative_review_sessions_share_idx
  ON narrative_review_sessions (share_link_id, last_seen_at DESC);

COMMENT ON TABLE narrative_review_share_links IS
  'Gjeste-lenker til én review-runde på en Story Graph-scene. Token lagres kun som sha256; råtoken vises én gang ved opprettelse. Studio-plan (guest_reviewers).';
COMMENT ON TABLE narrative_review_sessions IS
  'Navngitt gjeste-reviewer bak en delingslenke; header x-narrative-reviewer bærer sesjonstoken (sha256 lagret).';
