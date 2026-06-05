-- Self-Tape Submissions — 3 target-typer + audit-log
--
-- Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md § 3.4–3.5

CREATE TABLE IF NOT EXISTS talent_selftape_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES talent_selftape_projects(id) ON DELETE CASCADE,
  take_id         UUID NOT NULL REFERENCES talent_selftape_takes(id),

  target_type     VARCHAR(40) NOT NULL
                   CHECK (target_type IN ('agency_direct','private_link','role_specific')),

  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','ready','submitted','viewed','shortlisted','passed')),
  deadline_at     TIMESTAMPTZ,

  -- agency_direct
  agency_org_id   UUID REFERENCES agency_orgs(id) ON DELETE SET NULL,
  agency_preferred BOOLEAN DEFAULT FALSE,

  -- private_link
  private_token   VARCHAR(64),
  private_expires_at TIMESTAMPTZ,
  private_password_hash TEXT,                 -- valgfritt (åpent spørsmål til Daniel)

  -- role_specific
  casting_project_id VARCHAR(255),
  casting_role_id    VARCHAR(255),

  submitted_at    TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,

  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Én target av samme type per prosjekt+agency+role (NULL teller som distinct)
  CONSTRAINT talent_selftape_submissions_unique
    UNIQUE (project_id, target_type, agency_org_id, casting_role_id)
);

CREATE INDEX IF NOT EXISTS talent_selftape_submissions_project_idx
  ON talent_selftape_submissions(project_id, status);
CREATE INDEX IF NOT EXISTS talent_selftape_submissions_private_token_idx
  ON talent_selftape_submissions(private_token) WHERE private_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS talent_selftape_submissions_demo_idx
  ON talent_selftape_submissions(is_demo) WHERE is_demo = TRUE;


CREATE TABLE IF NOT EXISTS talent_selftape_submission_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES talent_selftape_submissions(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
                   -- 'viewed','downloaded','shortlisted','passed','commented','status_changed'
  actor_user_id   VARCHAR(255),
  actor_label     VARCHAR(120),
  ip_address      INET,
  user_agent      TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_selftape_submission_events_submission_idx
  ON talent_selftape_submission_events(submission_id, created_at DESC);


DROP TRIGGER IF EXISTS tss_set_updated_at ON talent_selftape_submissions;
CREATE TRIGGER tss_set_updated_at
  BEFORE UPDATE ON talent_selftape_submissions
  FOR EACH ROW EXECUTE FUNCTION talent_selftape_set_updated_at();
