-- 0082_role_room_whatsapp_config.sql
-- Multi-tenant WhatsApp Business-config for The Role Room.
--
-- Hver bedrift kobler sin egen Meta Business-konto + telefonnummer.
-- Per-prosjekt produksjonsteam-gruppe lagres separat (én bedrift kan ha
-- flere prosjekter, hver med egen WhatsApp-gruppe administrert av team-
-- leder for det aktuelle prosjektet).

-- ── Per-bedrift WhatsApp-config ─────────────────────────────
-- ID-feltet er bedrifts-identifikator (organization_number eller team-key
-- avhengig av eksisterende org-modell — vi bruker fritekst slug for å være
-- kompatibel med både invite_request-baserte teams og fremtidige
-- formelle organizations).

CREATE TABLE IF NOT EXISTS role_room_org_whatsapp_config (
  org_key                  VARCHAR(255) PRIMARY KEY NOT NULL,
  business_account_id      TEXT NOT NULL,
  phone_number_id          TEXT NOT NULL,
  access_token_encrypted   TEXT NOT NULL,
  display_name             VARCHAR(255) NOT NULL,
  template_language        VARCHAR(10) DEFAULT 'nb_NO',
  template_24h_name        VARCHAR(255) DEFAULT 'audition_reminder_24h_no',
  template_1h_name         VARCHAR(255) DEFAULT 'audition_reminder_1h_no',
  configured_by_user_id    VARCHAR(255),
  last_validated_at        TIMESTAMPTZ,
  last_validation_error    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS role_room_org_whatsapp_config_phone_idx
  ON role_room_org_whatsapp_config (phone_number_id);

COMMENT ON TABLE role_room_org_whatsapp_config IS
  'Per-bedrift WhatsApp Cloud API-config. Audition-reminders bruker kanalen for outbound. Access token er kryptert med ROLE_ROOM_TOKEN_ENCRYPTION_KEY (samme nøkkel som Instagram-OAuth-tokens).';

COMMENT ON COLUMN role_room_org_whatsapp_config.org_key IS
  'Identifier for bedriften — kan være organisasjonsnummer, team-leader-email, eller annen unik nøkkel som identifiserer bedrifts-roten.';

COMMENT ON COLUMN role_room_org_whatsapp_config.last_validated_at IS
  'Tidspunkt for siste vellykkede ping mot Meta API. Brukes til å vise health-status i settings-UI.';

-- ── Per-prosjekt produksjonsteam-gruppe ─────────────────────
-- Team-leder for et casting-prosjekt lager WhatsApp-gruppen i sin egen
-- WhatsApp-app (~30 sek), kopierer chat.whatsapp.com-lenken og limer inn
-- her. Når Role Room legger til en ny crew-medlem, sender vi automatisk
-- en invitasjon via bedriftens Cloud API med denne lenken.

CREATE TABLE IF NOT EXISTS casting_project_whatsapp_group (
  project_id            VARCHAR(255) PRIMARY KEY NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  group_invite_link     TEXT NOT NULL,
  group_name            VARCHAR(255),
  admin_user_id         VARCHAR(255),
  admin_email           VARCHAR(255),
  org_key               VARCHAR(255) REFERENCES role_room_org_whatsapp_config(org_key) ON DELETE SET NULL,
  auto_invite_enabled   BOOLEAN DEFAULT TRUE NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_project_whatsapp_group_org_idx
  ON casting_project_whatsapp_group (org_key)
  WHERE org_key IS NOT NULL;

COMMENT ON TABLE casting_project_whatsapp_group IS
  'WhatsApp-produksjonsteam-gruppe per prosjekt. Team-leder administrerer i sin egen WhatsApp; The Role Room distribuerer invite-link automatisk når crew-medlem legges til.';

COMMENT ON COLUMN casting_project_whatsapp_group.group_invite_link IS
  'Format: https://chat.whatsapp.com/<inviteCode>. Team-leder genererer i WhatsApp-appen og limer inn her.';

COMMENT ON COLUMN casting_project_whatsapp_group.auto_invite_enabled IS
  'Når true: nye crew-medlemmer får automatisk WhatsApp-invitasjon ved tillegg. Sett false for å deaktivere uten å slette gruppe-lenken.';

-- ── Per-crew-medlem invite-status ──────────────────────────
-- Audit-trail som speiler casting_sms_usage / casting_whatsapp_usage
-- (audition-reminders) men for produksjonsteam-invitasjoner. Idempotens:
-- crew-medlem får invitasjon én gang per prosjekt.

CREATE TABLE IF NOT EXISTS casting_team_whatsapp_invites (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  crew_id                VARCHAR(255) NOT NULL REFERENCES casting_crew(id) ON DELETE CASCADE,
  recipient_phone_e164   VARCHAR(20),
  recipient_email        VARCHAR(255),
  invited_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  whatsapp_message_id    TEXT,
  delivery_status        VARCHAR(32) NOT NULL DEFAULT 'pending',
  delivery_error         TEXT,
  retry_count            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, crew_id)
);

CREATE INDEX IF NOT EXISTS casting_team_whatsapp_invites_project_idx
  ON casting_team_whatsapp_invites (project_id);

CREATE INDEX IF NOT EXISTS casting_team_whatsapp_invites_pending_idx
  ON casting_team_whatsapp_invites (project_id, retry_count)
  WHERE delivery_status IN ('pending', 'failed');

COMMENT ON TABLE casting_team_whatsapp_invites IS
  'Sporings-tabell for WhatsApp-invitasjoner sendt til crew-medlemmer. Idempotent via UNIQUE(project, crew). Cron-runner reattempter rader med status=pending eller failed (max 3 retries).';
