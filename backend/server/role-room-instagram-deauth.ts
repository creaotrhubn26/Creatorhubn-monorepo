/**
 * Meta Deauthorize Callback + Data Deletion Request callback.
 *
 * Both endpoints use Meta's `signed_request` format, which is distinct
 * from the Graph API webhook. Body is x-www-form-urlencoded with a
 * single field `signed_request = <base64url(signature)>.<base64url(json)>`.
 *
 *   signature = HMAC-SHA256(base64url_payload, appSecret)  // raw bytes
 *
 * The decoded JSON carries Meta's `user_id` (the FB user who triggered
 * the deauth / data deletion) plus `algorithm` and `issued_at`. We
 * treat `algorithm !== 'HMAC-SHA256'` as invalid so downgrade attacks
 * can't bypass the signature check.
 *
 * Deauthorize Callback URL: called when a user removes the app from
 *   Settings → Business Integrations. Expected response: 200. We mark
 *   every IG connection belonging to that fb_user_id as 'revoked' so
 *   the UI surfaces a re-connect prompt and the publisher stops trying.
 *
 * Data Deletion Request URL: called when a user files a data-deletion
 *   request in the same settings page. Expected response: JSON with
 *   `{url, confirmation_code}` so Meta can surface a status link to
 *   the user. We also mark the connections revoked (same effect as
 *   deauth) and log the request in role_room_meta_data_deletion_requests
 *   so follow-up status checks can answer honestly.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';

export interface SignedRequestPayload {
  algorithm?: string;
  issued_at?: number;
  user_id?: string;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): Buffer {
  // Meta's base64url omits padding; Node requires it for 'base64url'
  // decoding to work reliably on some inputs, but the simplest path is
  // to re-add padding and use 'base64' after normalising.
  const normalised = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Parse + verify a `signed_request` field. Returns the payload on
 * success or null if the signature is wrong, the algorithm is not
 * HMAC-SHA256, or the structure is malformed.
 */
export function parseSignedRequest(
  signedRequest: string | undefined | null,
  appSecret: string,
): SignedRequestPayload | null {
  if (typeof signedRequest !== 'string' || !signedRequest.includes('.')) return null;
  const [sigB64, payloadB64] = signedRequest.split('.', 2);
  if (!sigB64 || !payloadB64) return null;

  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  const expectedSig = crypto.createHmac('sha256', appSecret).update(payloadB64).digest();
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: SignedRequestPayload;
  try {
    const json = base64UrlDecode(payloadB64).toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  // Guard against algorithm-downgrade: Meta's docs mandate HMAC-SHA256
  // and anything else means a compromised or forged payload.
  if (payload.algorithm !== 'HMAC-SHA256') return null;
  return payload;
}

/**
 * Mark every connected IG connection with the given fb_user_id as
 * 'revoked'. Returns the number of rows updated. Idempotent — repeat
 * calls return 0 because the WHERE clause only matches 'connected'.
 */
export async function revokeConnectionsForFbUser(
  pool: Pool,
  fbUserId: string,
): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE role_room_instagram_connections
          SET connection_state = 'revoked',
              last_error = 'Meta callback: deauthorized by user',
              updated_at = now()
        WHERE fb_user_id = $1
          AND connection_state = 'connected'`,
      [fbUserId],
    );
    return result.rowCount ?? 0;
  } catch (error) {
    console.error('[ig-deauth] revoke failed', error);
    return 0;
  }
}

export interface DataDeletionRecord {
  confirmationCode: string;
  fbUserId: string;
  requestedAt: Date;
  status: 'received' | 'processing' | 'completed' | 'failed';
  connectionsRevoked: number;
  completedAt: Date | null;
  lastError: string | null;
}

function mapDeletionRow(row: Record<string, unknown>): DataDeletionRecord {
  return {
    confirmationCode: String(row.confirmation_code),
    fbUserId: String(row.fb_user_id),
    requestedAt: (row.requested_at as Date) ?? new Date(),
    status: (row.status as DataDeletionRecord['status']) ?? 'received',
    connectionsRevoked: Number(row.connections_revoked ?? 0),
    completedAt: (row.completed_at as Date | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
  };
}

/**
 * Record + process a data-deletion request. Generates a unique
 * confirmation_code, revokes matching connections, persists the
 * outcome, and returns the code for the callback response.
 */
export async function recordDataDeletionRequest(
  pool: Pool,
  fbUserId: string,
): Promise<{ confirmationCode: string; connectionsRevoked: number }> {
  const confirmationCode = crypto.randomBytes(16).toString('hex');
  const connectionsRevoked = await revokeConnectionsForFbUser(pool, fbUserId);
  try {
    await pool.query(
      `INSERT INTO role_room_meta_data_deletion_requests (
         confirmation_code, fb_user_id, status, connections_revoked,
         completed_at
       ) VALUES ($1, $2, 'completed', $3, now())`,
      [confirmationCode, fbUserId, connectionsRevoked],
    );
  } catch (error) {
    console.error('[ig-deauth] failed to log data deletion request', error);
    // Still return the code so Meta's response is intact; the revoke
    // already happened on the connections table.
  }
  return { confirmationCode, connectionsRevoked };
}

export async function fetchDataDeletionRequest(
  pool: Pool,
  confirmationCode: string,
): Promise<DataDeletionRecord | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_meta_data_deletion_requests WHERE confirmation_code = $1 LIMIT 1`,
      [confirmationCode],
    );
    return result.rows[0] ? mapDeletionRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[ig-deauth] fetch deletion request failed', error);
    return null;
  }
}
