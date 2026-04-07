import type { Pool } from 'pg';

let ensureGoogleWorkspaceConnectionsSchemaPromise: Promise<void> | null = null;

export async function ensureGoogleWorkspaceConnectionsSchema(pool: Pool): Promise<void> {
  if (!ensureGoogleWorkspaceConnectionsSchemaPromise) {
    ensureGoogleWorkspaceConnectionsSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS role_room_google_connections (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role_room_email VARCHAR(255),
        google_email VARCHAR(255),
        google_subject VARCHAR(255),
        access_token_encrypted TEXT,
        refresh_token_encrypted TEXT,
        expiry_date TIMESTAMPTZ,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
        last_error TEXT,
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );
      ALTER TABLE role_room_google_connections
        ADD COLUMN IF NOT EXISTS oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room';
      UPDATE role_room_google_connections
         SET oauth_app = 'role_room'
       WHERE oauth_app IS NULL OR TRIM(oauth_app) = '';
      DROP INDEX IF EXISTS idx_rr_google_connections_user_id_unique;
      DROP INDEX IF EXISTS idx_rr_google_connections_subject_unique;
      CREATE INDEX IF NOT EXISTS idx_rr_google_connections_email ON role_room_google_connections(google_email);
      CREATE INDEX IF NOT EXISTS idx_rr_google_connections_user_id ON role_room_google_connections(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_user_app_unique
        ON role_room_google_connections(user_id, oauth_app);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_subject_app_unique
        ON role_room_google_connections(google_subject, oauth_app)
        WHERE google_subject IS NOT NULL;
    `).then(() => undefined).catch((error) => {
      ensureGoogleWorkspaceConnectionsSchemaPromise = null;
      throw error;
    });
  }

  return ensureGoogleWorkspaceConnectionsSchemaPromise;
}
