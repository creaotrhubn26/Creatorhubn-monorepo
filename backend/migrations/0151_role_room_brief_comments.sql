-- 0151 — Creative Space Sync: inline-kommentarer + activity-feed
--
-- Brief-en (role_room_client_intake) er ikke lenger one-shot. Klient og
-- innholdsprodusent kan kommentere per felt og se hva som har skjedd
-- siden sist via en activity-feed. Det skaper levende samarbeid og
-- fjerner behovet for sideløpende e-post-kommunikasjon om briefen.
--
-- Tabeller:
--   role_room_brief_comments — kommentar-tråder per (project_id, field_key)
--   role_room_brief_activity — alle hendelser knyttet til briefen
--
-- field_key matcher field-navnene i briefStepDefinitions.ts
-- (projectGoal, targetAudience, deliverables, referenceLinks, etc.)
-- + 'general' for kommentarer som ikke hører til ett spesifikt felt.

CREATE TABLE IF NOT EXISTS role_room_brief_comments (
  id             VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id     VARCHAR(64)  NOT NULL,

  -- Hvilket brief-felt kommentaren gjelder
  field_key      VARCHAR(64)  NOT NULL,

  -- Hvem skrev — kan være enten klient (via magic-link-token) eller
  -- producer (via vanlig RoleRoom-konto). Vi lagrer både ID og rolle
  -- for raskt visning uten extra join.
  author_user_id VARCHAR(255),
  author_role    VARCHAR(32)  NOT NULL CHECK (author_role IN ('client', 'producer', 'system')),
  author_name    VARCHAR(255),

  body           TEXT         NOT NULL,

  -- Trådning: kommentar kan svare på en eldre kommentar
  parent_id      VARCHAR(64)  REFERENCES role_room_brief_comments(id) ON DELETE CASCADE,

  -- Tilstander
  resolved_at    TIMESTAMPTZ,
  resolved_by_role VARCHAR(32),

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS role_room_brief_comments_project_field_idx
  ON role_room_brief_comments (project_id, field_key, created_at);
CREATE INDEX IF NOT EXISTS role_room_brief_comments_unresolved_idx
  ON role_room_brief_comments (project_id)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS role_room_brief_activity (
  id             BIGSERIAL    PRIMARY KEY,
  project_id     VARCHAR(64)  NOT NULL,

  -- Hva skjedde: 'field_edited', 'comment_added', 'comment_resolved',
  -- 'brief_viewed', 'brief_sent_notification', 'reference_added',
  -- 'reference_removed', 'voice_memo_added'
  event_kind     VARCHAR(64)  NOT NULL,

  actor_user_id  VARCHAR(255),
  actor_role     VARCHAR(32),
  actor_name     VARCHAR(255),

  -- Feltet det gjelder (hvis relevant)
  field_key      VARCHAR(64),

  -- Fri JSONB for kontekst (gamle/nye verdier, kommentar-id, etc)
  metadata       JSONB        DEFAULT '{}'::jsonb,

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS role_room_brief_activity_project_idx
  ON role_room_brief_activity (project_id, created_at DESC);
