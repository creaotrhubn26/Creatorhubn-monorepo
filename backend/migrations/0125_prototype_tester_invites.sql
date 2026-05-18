-- 0125_prototype_tester_invites.sql
-- Slice 9X.53 — Prototype-tester-program for hele Creatorhubn-plattformen.
--
-- ADSKILT fra role_room_tester_invites (Sprint 7.1): det er kun for Role Room.
-- Denne dekker testere for resten av plattformen (wedding-flyt, klient-galleri,
-- fakturering osv.) og krever egen NDA + egne forpliktelses-vilkår
-- (12 uker, 2 t/uke, månedlig feedback, 12 mnd gratis Pro etterpå).

CREATE TABLE IF NOT EXISTS prototype_tester_invites (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Token + invitasjons-detaljer
  token                       TEXT NOT NULL UNIQUE,
  email                       TEXT NOT NULL,
  name                        TEXT NOT NULL,
  testing_areas               JSONB NOT NULL DEFAULT '[]'::jsonb,
  personal_message            TEXT,
  -- Hvilken invite_request denne ble generert fra (auto-bro fra admin-approval)
  invite_request_id           UUID,
  -- NDA + program-vilkår
  nda_version                 VARCHAR(16) NOT NULL DEFAULT '1.0',
  program_terms_version       VARCHAR(16) NOT NULL DEFAULT '1.0',
  -- Status: 'pending' | 'accepted' | 'revoked' | 'expired'
  status                      VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Signering
  accepted_at                 TIMESTAMPTZ,
  accepted_nda_name           TEXT,
  accepted_program_terms      BOOLEAN DEFAULT false,
  accepted_ip                 TEXT,
  -- Program-periode (settes ved accept)
  program_started_at          TIMESTAMPTZ,
  program_ends_at             TIMESTAMPTZ,
  program_duration_weeks      INTEGER NOT NULL DEFAULT 12,
  -- Belønnings-status
  benefit_granted             BOOLEAN DEFAULT false,
  benefit_granted_at          TIMESTAMPTZ,
  benefit_description         TEXT,
  -- Aktivitets-tracking (drives av cron + i-app feedback)
  feedback_count              INTEGER NOT NULL DEFAULT 0,
  last_feedback_at            TIMESTAMPTZ,
  last_login_at               TIMESTAMPTZ,
  last_digest_sent_at         TIMESTAMPTZ,
  -- Admin
  invited_by                  TEXT,
  expires_at                  TIMESTAMPTZ NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prototype_tester_invites_token
  ON prototype_tester_invites (token);

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_email
  ON prototype_tester_invites (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_status
  ON prototype_tester_invites (status, program_ends_at);

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_digest_queue
  ON prototype_tester_invites (last_digest_sent_at)
  WHERE status = 'accepted';

COMMENT ON TABLE prototype_tester_invites IS
  'Prototype-tester-program for hele Creatorhubn-plattformen (ekskl. Role Room). Egen NDA + egne forpliktelses-vilkår.';
COMMENT ON COLUMN prototype_tester_invites.program_terms_version IS
  'Versjon av forpliktelses-vilkårene testeren signerte på. Hvis vi endrer vilkårene må ny versjon utstedes.';
COMMENT ON COLUMN prototype_tester_invites.feedback_count IS
  'Antall feedback-items registrert i prototype_feedback-tabellen — drives av server-side cron, ikke trigger.';
