-- Casting-team -> agency requests for a specific consented talent and role.
--
-- A request is deliberately separate from partnership_talent_proposals:
-- the production team may ask, but only the agency can turn the request into
-- a proposal. Candidate creation still happens only after production accepts
-- that proposal.

CREATE TABLE IF NOT EXISTS partnership_talent_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id         UUID NOT NULL
                          REFERENCES partnership_project_invitations(id) ON DELETE CASCADE,
  talent_id             UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  casting_role_id       VARCHAR(255) NOT NULL
                          REFERENCES casting_roles(id) ON DELETE CASCADE,
  requested_by_user_id  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  brief                 TEXT NOT NULL,
  response_deadline     TIMESTAMPTZ NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending', 'acknowledged', 'fulfilled',
                            'declined', 'cancelled', 'expired'
                          )),
  response_note         TEXT,
  acknowledged_at       TIMESTAMPTZ,
  responded_at          TIMESTAMPTZ,
  responded_by_user_id  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_proposal_id UUID
                          REFERENCES partnership_talent_proposals(id) ON DELETE SET NULL,
  is_demo               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT partnership_talent_requests_brief_length
    CHECK (char_length(btrim(brief)) BETWEEN 1 AND 2000),
  CONSTRAINT partnership_talent_requests_response_note_length
    CHECK (response_note IS NULL OR char_length(response_note) <= 2000)
);

-- Prevent duplicate active requests while preserving the full request history.
CREATE UNIQUE INDEX IF NOT EXISTS ptr_unique_active_request
  ON partnership_talent_requests (invitation_id, talent_id, casting_role_id)
  WHERE status IN ('pending', 'acknowledged');

CREATE INDEX IF NOT EXISTS ptr_invitation_status_deadline_idx
  ON partnership_talent_requests (invitation_id, status, response_deadline);

CREATE INDEX IF NOT EXISTS ptr_role_status_idx
  ON partnership_talent_requests (casting_role_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ptr_talent_status_idx
  ON partnership_talent_requests (talent_id, status, created_at DESC);

DROP TRIGGER IF EXISTS ptr_set_updated_at ON partnership_talent_requests;
CREATE TRIGGER ptr_set_updated_at
  BEFORE UPDATE ON partnership_talent_requests
  FOR EACH ROW EXECUTE FUNCTION agency_production_partnerships_set_updated_at();

COMMENT ON TABLE partnership_talent_requests IS
  'Auditable project-scoped requests from casting teams to partner agencies; fulfillment creates a proposal, never a candidate directly.';

-- Durable, cross-instance-safe delivery ledger for request deadlines and
-- cancellation notices. One row per logical notification means a cron retry
-- or a second backend instance cannot intentionally enqueue the same notice
-- twice. A short lease lets a later run recover work interrupted by a deploy.
CREATE TABLE IF NOT EXISTS partnership_talent_request_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_request_id UUID NOT NULL
                      REFERENCES partnership_talent_requests(id) ON DELETE CASCADE,
  notification_kind VARCHAR(20) NOT NULL
                      CHECK (notification_kind IN (
                        'deadline_48h', 'deadline_24h', 'deadline_overdue',
                        'cancelled'
                      )),
  status            VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending', 'processing', 'sent', 'failed', 'cancelled'
                      )),
  attempts          INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_token       UUID,
  claimed_at        TIMESTAMPTZ,
  lease_until       TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ptrd_request_kind_unique
    UNIQUE (talent_request_id, notification_kind),
  CONSTRAINT ptrd_processing_claim_check
    CHECK (
      status <> 'processing'
      OR (claim_token IS NOT NULL AND claimed_at IS NOT NULL AND lease_until IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ptrd_claim_idx
  ON partnership_talent_request_deliveries (available_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing') AND attempts < 5;

CREATE INDEX IF NOT EXISTS ptrd_request_status_idx
  ON partnership_talent_request_deliveries (talent_request_id, status);

DROP TRIGGER IF EXISTS ptrd_set_updated_at ON partnership_talent_request_deliveries;
CREATE TRIGGER ptrd_set_updated_at
  BEFORE UPDATE ON partnership_talent_request_deliveries
  FOR EACH ROW EXECUTE FUNCTION agency_production_partnerships_set_updated_at();

COMMENT ON TABLE partnership_talent_request_deliveries IS
  'Idempotent delivery ledger for agency talent-request deadline and cancellation email notifications.';
