/**
 * Lagring + gjenbruk av ID-porten-tokens per org. Callback lagrer tokenene;
 * senere kall (validering/innsending) henter et gyldig access-token, og fornyer
 * via refresh_token når det nærmer seg utløp. Ingen ny BankID-innlogging trengs
 * før refresh-tokenet også utløper.
 */
import type { Db } from '../db/pool.js';
import type { IdPortenClient, IdPortenTokens } from './idporten.js';

export interface IdPortenStatus {
  loggedIn: boolean;
  expiresAt: string | null;
  scope: string | null;
  subject: string | null;
}

export async function saveLoginState(db: Db, params: { state: string; organizationId: string; codeVerifier: string; nonce: string; userId: string }): Promise<void> {
  await db.query(
    `INSERT INTO idporten_login_state (state, organization_id, code_verifier, nonce, created_by) VALUES ($1,$2,$3,$4,$5)`,
    [params.state, params.organizationId, params.codeVerifier, params.nonce, params.userId],
  );
  // Rydd bort gamle (>15 min) for å ikke lekke state-rader.
  await db.query(`DELETE FROM idporten_login_state WHERE created_at < now() - interval '15 minutes'`);
}

/** Konsumerer login-state (engangsbruk). Returnerer null hvis ukjent/utløpt. */
export async function takeLoginState(db: Db, state: string): Promise<{ organizationId: string; codeVerifier: string; nonce: string } | null> {
  const row = (await db.query(
    `DELETE FROM idporten_login_state WHERE state=$1 AND created_at > now() - interval '15 minutes'
     RETURNING organization_id, code_verifier, nonce`,
    [state],
  )).rows[0];
  return row ? { organizationId: row.organization_id, codeVerifier: row.code_verifier, nonce: row.nonce } : null;
}

export async function saveSession(db: Db, organizationId: string, tokens: IdPortenTokens): Promise<void> {
  await db.query(
    `INSERT INTO idporten_sessions (organization_id, access_token, refresh_token, scope, subject, expires_at, updated_at)
     VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' seconds')::interval, now())
     ON CONFLICT (organization_id) DO UPDATE SET
       access_token=EXCLUDED.access_token, refresh_token=COALESCE(EXCLUDED.refresh_token, idporten_sessions.refresh_token),
       scope=EXCLUDED.scope, subject=EXCLUDED.subject, expires_at=EXCLUDED.expires_at, updated_at=now()`,
    [organizationId, tokens.accessToken, tokens.refreshToken, tokens.scope, tokens.subject, String(tokens.expiresInSeconds)],
  );
}

export async function getStatus(db: Db, organizationId: string): Promise<IdPortenStatus> {
  const row = (await db.query(
    `SELECT scope, subject, expires_at, expires_at > now() AS live FROM idporten_sessions WHERE organization_id=$1`,
    [organizationId],
  )).rows[0];
  if (!row) return { loggedIn: false, expiresAt: null, scope: null, subject: null };
  return { loggedIn: Boolean(row.live) || true, expiresAt: new Date(row.expires_at).toISOString(), scope: row.scope, subject: row.subject };
}

/**
 * Henter et gyldig access-token for org-en; fornyer via refresh_token hvis <60s
 * igjen. Returnerer null hvis ingen sesjon, eller hvis fornying feiler (da må
 * brukeren logge inn med BankID på nytt).
 */
export async function getValidAccessToken(db: Db, client: IdPortenClient, organizationId: string): Promise<string | null> {
  const row = (await db.query(
    `SELECT access_token, refresh_token, EXTRACT(EPOCH FROM (expires_at - now())) AS secs_left FROM idporten_sessions WHERE organization_id=$1`,
    [organizationId],
  )).rows[0];
  if (!row) return null;
  const secsLeft = Number(row.secs_left);
  if (secsLeft > 60) return row.access_token as string;
  if (!row.refresh_token) return null;
  try {
    const fresh = await client.refresh(row.refresh_token);
    await saveSession(db, organizationId, fresh);
    return fresh.accessToken;
  } catch {
    return null;
  }
}
