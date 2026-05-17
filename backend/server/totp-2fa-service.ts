/**
 * TOTP-basert 2FA via Google Authenticator / 1Password / Authy.
 *
 * Flow:
 *   1. Bruker velger "Aktiver 2FA" → GET /setup minter en secret +
 *      bygger otpauth-URL → frontend rendrer QR-kode via `qrcode`
 *   2. Bruker scanner med Authenticator-app → app genererer 6-sifret
 *      kode hvert 30. sek
 *   3. Bruker taster inn første kode i UI → POST /verify-and-enable
 *      bekrefter koden + lagrer kryptert secret + genererer 10 backup-koder
 *   4. Ved login: backend ser at user.totp_enabled → ber om kode → POST
 *      /login-verify sjekker mot lagret secret
 *
 * Backup-koder:
 *   - 10 stk genereres ved aktivering (8 tegn hver)
 *   - bcrypt-hashes i DB
 *   - Hver kan brukes ÉN gang (used_at-tracking)
 *   - Vises KUN én gang etter aktivering — etter det må bruker
 *     generere nye
 *
 * Encryption-key: gjenbruker ROLE_ROOM_TOKEN_ENCRYPTION_KEY-mønsteret.
 */

import bcrypt from "bcrypt";
import crypto from "node:crypto";
// speakeasy ships uten types — minimal shape så vi får TS-sjekk uten
// å trekke inn @types/speakeasy (community package, ekstra avhengighet)
// @ts-ignore — runtime module finnes, types ikke installert
import speakeasyModule from "speakeasy";
const speakeasy = speakeasyModule as unknown as {
  generateSecret: (opts: { name?: string; issuer?: string; length?: number }) => {
    ascii: string; base32: string; hex: string; otpauth_url?: string;
  };
  totp: {
    verify: (opts: { secret: string; encoding: string; token: string; window?: number }) => boolean;
  };
};
import qrcode from "qrcode";
import type { Pool } from "pg";

const TOTP_ISSUER = "Creatorhub";
const BACKUP_CODE_COUNT = 10;

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_totp_secrets (
      user_id TEXT PRIMARY KEY,
      secret_encrypted TEXT NOT NULL,
      enabled_at TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_totp_backup_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_totp_backup_codes_user
      ON user_totp_backup_codes(user_id, used_at);
  `);
  schemaReady = true;
}

// ── Crypto ─────────────────────────────────────────────────────────

function deriveKey(): Buffer | null {
  const raw =
    process.env.TOTP_SECRET_ENCRYPTION_KEY
    || process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(value: string): string {
  const key = deriveKey();
  if (!key) throw new Error("TOTP_SECRET_ENCRYPTION_KEY (eller ROLE_ROOM_TOKEN_ENCRYPTION_KEY) mangler");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

function decrypt(value: string): string | null {
  const key = deriveKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encPart) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(encPart, "base64url")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface TotpStatus {
  enabled: boolean;
  /** True = setup er startet men ikke fullført (bruker har secret i DB
   *  men har ikke verifisert første kode ennå). */
  pending: boolean;
}

export interface TotpSetupResult {
  /** Base32-secret som brukeren kan taste inn manuelt hvis QR ikke fungerer. */
  secret: string;
  /** otpauth://-URL — pek inn i `qrcode.toDataURL()` for QR-bilde. */
  otpauthUrl: string;
  /** Data-URL (image/png base64) klar til <img src=...>. */
  qrPngDataUrl: string;
}

export interface VerifyAndEnableResult {
  ok: boolean;
  reason?: "no_pending_setup" | "wrong_code";
  /** Backup-koder — vises ÉN gang. Etter dette kan brukeren bare regenerere. */
  backupCodes?: string[];
}

// ── Public API ──────────────────────────────────────────────────────

export async function getTotpStatus(pool: Pool, userId: string): Promise<TotpStatus> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT enabled_at FROM user_totp_secrets WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (r.rows.length === 0) return { enabled: false, pending: false };
  const enabled = r.rows[0].enabled_at !== null;
  return { enabled, pending: !enabled };
}

export async function startSetup(
  pool: Pool,
  input: { userId: string; userEmail: string },
): Promise<TotpSetupResult> {
  await ensureSchema(pool);
  const secret = speakeasy.generateSecret({
    name: `${TOTP_ISSUER}:${input.userEmail}`,
    issuer: TOTP_ISSUER,
    length: 20,
  });

  // Upsert — overskriv evt. tidligere uncompleted setup
  await pool.query(
    `INSERT INTO user_totp_secrets (user_id, secret_encrypted, enabled_at)
     VALUES ($1, $2, NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET secret_encrypted = EXCLUDED.secret_encrypted,
           enabled_at = NULL,
           updated_at = NOW()`,
    [input.userId, encrypt(secret.base32)],
  );

  // Slett evt. gamle backup-koder
  await pool.query(`DELETE FROM user_totp_backup_codes WHERE user_id = $1`, [input.userId]);

  const otpauthUrl = secret.otpauth_url || "";
  const qrPngDataUrl = await qrcode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
  return {
    secret: secret.base32,
    otpauthUrl,
    qrPngDataUrl,
  };
}

export async function verifyAndEnable(
  pool: Pool,
  input: { userId: string; token: string },
): Promise<VerifyAndEnableResult> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT secret_encrypted, enabled_at FROM user_totp_secrets WHERE user_id = $1 LIMIT 1`,
    [input.userId],
  );
  if (r.rows.length === 0) return { ok: false, reason: "no_pending_setup" };
  const secret = decrypt(r.rows[0].secret_encrypted);
  if (!secret) return { ok: false, reason: "no_pending_setup" };

  // window=1 → tillater +/-1 30-sek-vindu pga klokke-skew
  const valid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: input.token.replace(/\s/g, ""),
    window: 1,
  });
  if (!valid) return { ok: false, reason: "wrong_code" };

  await pool.query(
    `UPDATE user_totp_secrets
        SET enabled_at = COALESCE(enabled_at, NOW()),
            last_used_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1`,
    [input.userId],
  );

  // Generer + bcrypt-hash 10 backup-koder
  const backupCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    backupCodes.push(generateBackupCode());
  }
  // Insert i batch
  for (const code of backupCodes) {
    const hash = await bcrypt.hash(code, 10);
    await pool.query(
      `INSERT INTO user_totp_backup_codes (user_id, code_hash) VALUES ($1, $2)`,
      [input.userId, hash],
    );
  }

  return { ok: true, backupCodes };
}

export interface VerifyLoginResult {
  ok: boolean;
  usedBackupCode?: boolean;
  reason?: "not_enrolled" | "wrong_code";
}

export async function verifyLoginToken(
  pool: Pool,
  input: { userId: string; token: string },
): Promise<VerifyLoginResult> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT secret_encrypted, enabled_at FROM user_totp_secrets
      WHERE user_id = $1 LIMIT 1`,
    [input.userId],
  );
  if (r.rows.length === 0 || !r.rows[0].enabled_at) {
    return { ok: false, reason: "not_enrolled" };
  }
  const secret = decrypt(r.rows[0].secret_encrypted);
  if (!secret) return { ok: false, reason: "not_enrolled" };

  const cleaned = input.token.replace(/\s/g, "").trim();

  // Prøv TOTP først (vanlig case)
  const totpValid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: cleaned,
    window: 1,
  });
  if (totpValid) {
    await pool.query(`UPDATE user_totp_secrets SET last_used_at = NOW() WHERE user_id = $1`, [input.userId]);
    return { ok: true };
  }

  // Fallback: kanskje det er en backup-code
  if (/^[A-Z0-9]{8}$/i.test(cleaned)) {
    const backupRows = await pool.query(
      `SELECT id, code_hash FROM user_totp_backup_codes
        WHERE user_id = $1 AND used_at IS NULL`,
      [input.userId],
    );
    for (const row of backupRows.rows) {
      if (await bcrypt.compare(cleaned.toUpperCase(), row.code_hash)) {
        await pool.query(
          `UPDATE user_totp_backup_codes SET used_at = NOW() WHERE id = $1`,
          [row.id],
        );
        return { ok: true, usedBackupCode: true };
      }
    }
  }

  return { ok: false, reason: "wrong_code" };
}

export async function disableTotp(pool: Pool, userId: string): Promise<boolean> {
  await ensureSchema(pool);
  await pool.query(`DELETE FROM user_totp_secrets WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM user_totp_backup_codes WHERE user_id = $1`, [userId]);
  return true;
}

export async function countUnusedBackupCodes(pool: Pool, userId: string): Promise<number> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM user_totp_backup_codes
      WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
  return r.rows[0]?.n ?? 0;
}

function generateBackupCode(): string {
  // 8 chars, A-Z + 0-9. Crypto-strong rejection sampling.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ekskl. 0/O/1/I
  const len = chars.length;
  let out = "";
  while (out.length < 8) {
    const buf = crypto.randomBytes(1);
    const n = buf[0];
    // Reject hvis i over-buffer (256 ikke divisible by 32 → vil ha bias).
    // 256 / 32 = 8 — perfekt. Ingen bias. Bruker bare 0..255 modulo 32.
    out += chars[n % len];
  }
  return out;
}
