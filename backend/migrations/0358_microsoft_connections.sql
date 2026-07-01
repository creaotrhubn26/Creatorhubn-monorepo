-- 0358_microsoft_connections.sql
-- Outlook/Microsoft 365 OAuth-tokens per bruker (motstykke til
-- role_room_google_connections). Brukes av kvittering-skann fra Outlook.
-- Tokens krypteres med samme AES-GCM-nøkkel som Google-tokens.

CREATE TABLE IF NOT EXISTS microsoft_connections (
  id                       uuid PRIMARY KEY,
  user_id                  varchar NOT NULL,
  ms_email                 varchar,
  ms_user_id               varchar,
  access_token_encrypted   text,
  refresh_token_encrypted  text,
  expiry_date              timestamptz,
  scopes                   jsonb,
  connection_state         varchar(32) DEFAULT 'connected',
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS microsoft_connections_user_uidx
  ON microsoft_connections (user_id);
