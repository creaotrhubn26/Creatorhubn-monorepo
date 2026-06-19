/**
 * editing-partner-portal-service.ts
 *
 * Magic-link portal-tokens for Creatorhub Partner Program. Lagrer KUN sha256(raw);
 * rå-tokenet sendes på e-post én gang. Innløsning er ATOMISK engangs (én vinner)
 * via betinget UPDATE — ingen race der to klikk begge logger inn.
 */

import crypto from "crypto";
import type { Pool } from "pg";

export interface MintedPortalToken {
  jti: string;
  rawToken: string;
}

/** Lag et nytt portal-token. Returnerer {jti, rawToken} — rawToken e-postes én gang. */
export async function mintPortalToken(
  pool: Pool,
  args: { vendorUserId: string; email: string; createdBy?: string | null; ttlDays?: number },
): Promise<MintedPortalToken> {
  const jti = crypto.randomBytes(12).toString("hex"); // 24 tegn, offentlig id i URL
  const rawToken = crypto.randomBytes(32).toString("base64url"); // hemmelig
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const ttlDays = args.ttlDays ?? 14;
  await pool.query(
    `INSERT INTO editing_partner_portal_tokens
       (jti, token_hash, vendor_user_id, email, purpose, expires_at, created_by)
     VALUES ($1, $2, $3, $4, 'portal_access', now() + ($5::int * INTERVAL '1 day'), $6)`,
    [jti, tokenHash, args.vendorUserId, args.email, ttlDays, args.createdBy ?? null],
  );
  return { jti, rawToken };
}

/**
 * Løs inn et portal-token. ATOMISK: den betingede UPDATE-en gjør at kun ÉN
 * samtidig forespørsel kan konsumere tokenet (consumed_at settes i samme spørring).
 * Returnerer {vendorUserId, email} eller null (ugyldig/utløpt/brukt/tilbakekalt).
 */
export async function redeemPortalToken(
  pool: Pool,
  args: { jti: string; rawToken: string; ip?: string | null; userAgent?: string | null },
): Promise<{ vendorUserId: string; email: string } | null> {
  if (!args.jti || !args.rawToken) return null;
  const tokenHash = crypto.createHash("sha256").update(args.rawToken).digest("hex");
  const r = await pool.query<{ vendor_user_id: string; email: string }>(
    `UPDATE editing_partner_portal_tokens
        SET consumed_at = now(), redeemed_ip = $3, redeemed_user_agent = $4
      WHERE jti = $1 AND token_hash = $2
        AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      RETURNING vendor_user_id, email`,
    [args.jti, tokenHash, args.ip ?? null, args.userAgent ?? null],
  );
  const row = r.rows[0];
  return row ? { vendorUserId: row.vendor_user_id, email: row.email } : null;
}

/** Tilbakekall alle ubrukte tokens for en vendor (kalles før resend + ved revoke). */
export async function revokeVendorPortalTokens(pool: Pool, vendorUserId: string): Promise<void> {
  await pool.query(
    `UPDATE editing_partner_portal_tokens SET revoked_at = now()
      WHERE vendor_user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
    [vendorUserId],
  );
}
