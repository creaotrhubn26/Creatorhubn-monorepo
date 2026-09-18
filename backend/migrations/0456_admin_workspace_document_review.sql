-- 0456_admin_workspace_document_review.sql
-- Samarbeidsmerknader for tenant-eide arbeidsdokumenter.

CREATE TABLE IF NOT EXISTS admin_document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL,
  selected_text TEXT,
  anchor_from INTEGER,
  anchor_to INTEGER,
  suggested_text TEXT,
  assignee VARCHAR(240),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by VARCHAR NOT NULL,
  resolved_by VARCHAR,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_comments_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_comments_kind_check
    CHECK (kind IN ('comment', 'suggestion')),
  CONSTRAINT admin_document_comments_status_check
    CHECK (status IN ('open', 'resolved')),
  CONSTRAINT admin_document_comments_body_check
    CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT admin_document_comments_anchor_check
    CHECK (
      (anchor_from IS NULL AND anchor_to IS NULL)
      OR (
        anchor_from IS NOT NULL
        AND anchor_to IS NOT NULL
        AND anchor_from >= 0
        AND anchor_to >= anchor_from
      )
    ),
  CONSTRAINT admin_document_comments_suggestion_check
    CHECK (
      kind = 'comment'
      OR (suggested_text IS NOT NULL AND char_length(suggested_text) <= 20000)
    ),
  CONSTRAINT admin_document_comments_resolution_check
    CHECK (
      (status = 'open' AND resolved_at IS NULL AND resolved_by IS NULL)
      OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_document_comments_document_open
  ON admin_document_comments (document_id, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_admin_document_comments_assignee_open
  ON admin_document_comments (user_id, assignee, created_at DESC)
  WHERE status = 'open' AND assignee IS NOT NULL;

COMMENT ON TABLE admin_document_comments IS
  'Tenant-eide kommentarer og tekstforslag med valgfri tekstforankring og ansvarlig.';
