-- 286_role_room_lead_nurture.sql
-- Agent «Nurture-sekvens»: Claude-genererte, kontekstuelle 4-stegs e-post-
-- sekvenser per lead (Velkomst → Verdi → Case → Tilbud). Lagrer hele
-- sekvensen som JSONB. Sending kobles på senere (gjenbruk av eksisterende
-- follow-up-send). Soft-refs (TEXT owner/lead, ingen hard FK).

CREATE TABLE IF NOT EXISTS role_room_lead_nurture_sequence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    TEXT NOT NULL,
  connection_id    TEXT,
  lead_external_id TEXT,
  lead_name        TEXT,
  lead_email       TEXT,
  segment          TEXT,                          -- varm | lunken | kald | tapt
  steps            JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'draft', -- draft | queued | sent
  source           TEXT,                          -- claude | template
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_room_lead_nurture_scope
  ON role_room_lead_nurture_sequence (owner_user_id, lead_external_id, created_at DESC);
