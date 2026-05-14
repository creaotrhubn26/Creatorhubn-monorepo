-- Migration 147: role_room_tester_invites
--
-- Sprint 7.1: Admin sender direkte invitasjoner til prototype-testere med
-- one-time-token + NDA-versjon. Tester mottar e-post, klikker link,
-- signerer NDA, og aktiveres.
--
-- Forskjellen fra prototype_tester_requests (eksisterende tabell):
--   - tester_requests = pull-modell (tester søker)
--   - tester_invites = push-modell (admin inviterer direkte)

CREATE TABLE IF NOT EXISTS role_room_tester_invites (
  id              SERIAL PRIMARY KEY,
  token           TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  testing_areas   JSONB NOT NULL DEFAULT '[]'::jsonb,
  personal_message TEXT,
  nda_version     VARCHAR(16) NOT NULL DEFAULT '1.0',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked | expired
  invited_by      TEXT,                                    -- admin email
  accepted_at     TIMESTAMPTZ,
  accepted_nda_name TEXT,                                  -- juridisk navn fra signatur
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_room_tester_invites_email_idx
  ON role_room_tester_invites (LOWER(email));

CREATE INDEX IF NOT EXISTS role_room_tester_invites_status_idx
  ON role_room_tester_invites (status);

CREATE INDEX IF NOT EXISTS role_room_tester_invites_expires_at_idx
  ON role_room_tester_invites (expires_at);
