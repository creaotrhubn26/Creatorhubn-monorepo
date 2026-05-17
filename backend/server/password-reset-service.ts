/**
 * Password-reset for alle bruker-typer (markedsfører, klient, vendor).
 *
 * Flow:
 *   1. Bruker ber om reset → POST /api/auth/request-password-reset { email }
 *   2. Service slår opp email, minter en 32-byte token, lagrer i
 *      `password_reset_tokens` med 60 min TTL, og sender e-post med
 *      lenke til /reset-passord/<token>
 *   3. Bruker klikker → frontend GET /api/auth/reset-password/<token>
 *      for å verifisere at tokenet er gyldig før form vises
 *   4. Bruker setter nytt passord → POST /api/auth/reset-password/<token>
 *      med { password } → service bcrypt-hasher, oppdaterer users,
 *      markerer token som brukt
 *
 * Security:
 *   - GET /request-password-reset returnerer ALLTID 204 (også for
 *     ukjent e-post) for å hindre user-enumeration
 *   - Token er 32-byte crypto.randomBytes (256-bit) → kan ikke gjettes
 *   - Hvert token er én-gangs (used_at settes ved bruk)
 *   - TTL 60 min — kort nok til at lekkasje fra e-post-logg er
 *     håndterlig, langt nok til at bruker rekker å sjekke e-post
 */

import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { Pool } from "pg";

const TOKEN_TTL_MINUTES = 60;

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      user_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
  `);
  schemaReady = true;
}

function readGmailConfig(): { user: string; password: string } | null {
  const user =
    (process.env.GMAIL_USER
      ?? process.env.GOOGLE_WORKSPACE_EMAIL
      ?? process.env.GOOGLE_ADMIN_EMAIL
      ?? "").trim();
  const password = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !password) return null;
  return { user, password };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function buildResetUrl(token: string): string {
  const base = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  const path = `/reset-passord/${token}`;
  return base ? `${base}${path}` : path;
}

export interface RequestPasswordResetResult {
  /** Sett alltid til true så caller kan returnere 204 uavhengig av
   *  om e-posten faktisk finnes (anti-enumeration). */
  ok: true;
  /** Brukes kun til debug-logging — eksponer ikke til klient. */
  debugReason?: "user_not_found" | "email_not_configured" | "email_send_failed" | "sent";
}

export async function requestPasswordReset(
  pool: Pool,
  input: { email: string; ipAddress?: string | null },
): Promise<RequestPasswordResetResult> {
  await ensureSchema(pool);
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: true, debugReason: "user_not_found" };
  }

  // Slå opp bruker — eksisterer ikke? Returner OK uten å gjøre noe
  let userId: string | null = null;
  try {
    const r = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email],
    );
    userId = r.rows[0]?.id ? String(r.rows[0].id) : null;
  } catch (error) {
    console.error("[password-reset] user lookup failed", error);
    return { ok: true, debugReason: "user_not_found" };
  }
  if (!userId) {
    // Logg silent — anti-enumeration: caller sender alltid 204
    return { ok: true, debugReason: "user_not_found" };
  }

  // Mint token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  try {
    await pool.query(
      `INSERT INTO password_reset_tokens (token, email, user_id, expires_at, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, email, userId, expiresAt, input.ipAddress ?? null],
    );
  } catch (error) {
    console.error("[password-reset] token persist failed", error);
    return { ok: true, debugReason: "email_send_failed" };
  }

  // Send e-post
  const cfg = readGmailConfig();
  if (!cfg) {
    return { ok: true, debugReason: "email_not_configured" };
  }
  const resetUrl = buildResetUrl(token);
  const subject = "Tilbakestill passord — Creatorhub";
  const text = [
    "Hei,",
    "",
    "Du har bedt om å tilbakestille passordet ditt. Klikk lenken under for å sette et nytt:",
    "",
    resetUrl,
    "",
    `Lenken er gyldig i ${TOKEN_TTL_MINUTES} minutter. Hvis du ikke ba om dette, kan du ignorere e-posten — passordet ditt forblir uendret.`,
    "",
    "Mvh,",
    "Creatorhub-teamet",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6">
      <p>Hei,</p>
      <p>Du har bedt om å tilbakestille passordet ditt. Klikk knappen under for å sette et nytt:</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#22d3ee;color:#0b1226;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:6px;display:inline-block">
          Tilbakestill passord
        </a>
      </p>
      <p style="font-size:12px;color:#666">Eller kopier denne lenken inn i nettleseren:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="font-size:12px;color:#666">Lenken er gyldig i ${TOKEN_TTL_MINUTES} minutter. Hvis du ikke ba om dette, kan du ignorere e-posten — passordet ditt forblir uendret.</p>
      <p>Mvh,<br>Creatorhub-teamet</p>
    </div>`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: cfg.user, pass: cfg.password },
    });
    await transporter.sendMail({
      from: cfg.user,
      to: email,
      subject,
      text,
      html,
    });
    return { ok: true, debugReason: "sent" };
  } catch (error) {
    console.error("[password-reset] email send failed", error);
    return { ok: true, debugReason: "email_send_failed" };
  }
}

export interface ResetTokenInfo {
  email: string;
  valid: boolean;
  reason?: "not_found" | "expired" | "already_used";
}

export async function verifyResetToken(
  pool: Pool,
  token: string,
): Promise<ResetTokenInfo> {
  await ensureSchema(pool);
  try {
    const r = await pool.query(
      `SELECT email, expires_at, used_at FROM password_reset_tokens WHERE token = $1 LIMIT 1`,
      [token],
    );
    if (r.rows.length === 0) return { email: "", valid: false, reason: "not_found" };
    const row = r.rows[0];
    if (row.used_at) return { email: row.email, valid: false, reason: "already_used" };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { email: row.email, valid: false, reason: "expired" };
    }
    return { email: row.email, valid: true };
  } catch (error) {
    console.error("[password-reset] verify failed", error);
    return { email: "", valid: false, reason: "not_found" };
  }
}

export interface ConsumeResetTokenResult {
  ok: boolean;
  error?: "invalid_token" | "expired" | "already_used" | "weak_password" | "user_missing" | "db_error";
  message?: string;
}

export async function consumeResetToken(
  pool: Pool,
  token: string,
  newPassword: string,
): Promise<ConsumeResetTokenResult> {
  await ensureSchema(pool);
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, error: "weak_password", message: "Passord må være minst 8 tegn." };
  }

  const info = await verifyResetToken(pool, token);
  if (!info.valid) {
    return {
      ok: false,
      error: info.reason === "expired" ? "expired"
           : info.reason === "already_used" ? "already_used"
           : "invalid_token",
    };
  }

  try {
    const bcrypt = await import("bcrypt");
    const hashed = await bcrypt.default.hash(newPassword, 10);
    // Bruk en transaksjon så ikke vi får half-state (passord oppdatert
    // men token ikke markert som brukt — ville latt tokenet brukes igjen)
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateResult = await client.query(
        `UPDATE users SET password = $1, updated_at = NOW()
          WHERE LOWER(email) = LOWER($2)
          RETURNING id`,
        [hashed, info.email],
      );
      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "user_missing" };
      }
      await client.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1`,
        [token],
      );
      // Invalider også eventuelle andre aktive auth-sessions så en
      // stjålet session-cookie ikke fortsetter å virke etter reset
      await client.query(
        `DELETE FROM auth_sessions WHERE user_id = $1`,
        [updateResult.rows[0].id],
      ).catch(() => { /* tabellen kan mangle i noen environments */ });
      await client.query("COMMIT");
      return { ok: true, message: "Passordet er oppdatert. Du kan nå logge inn med det nye passordet." };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[password-reset] consume failed", error);
    return { ok: false, error: "db_error", message: "Kunne ikke oppdatere passord. Prøv igjen om litt." };
  }
}
