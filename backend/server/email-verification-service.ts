/**
 * Generisk e-post-kode-verifisering (6-sifret).
 *
 * Brukes til:
 *   1. Verifisere at klient eier e-posten FØR registrering i client-portal
 *   2. Step-up auth ved sensitive operasjoner (passord-endring, slett konto)
 *   3. Login-2FA hvis brukeren har valgt e-post som 2. faktor
 *
 * Modell:
 *   - Bcrypt-hashes koden i DB (aldri lagre klartekst)
 *   - 10 min TTL
 *   - Max 5 attempts før kode invalideres
 *   - Per-(email, purpose) rate-limit: kun én aktiv kode om gangen,
 *     ny kode invalidere forrige (forhindrer "spam send"-knapp-misbruk)
 *
 * Purpose-strings:
 *   - "client_portal_register"    — verifisere klient-e-post før register
 *   - "password_change"           — step-up når innlogget bruker endrer pwd
 *   - "login_2fa_email"           — hvis bruker har valgt e-post som 2FA
 *   - "account_delete"            — step-up ved sletting
 */

import bcrypt from "bcrypt";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { Pool } from "pg";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;

export type VerificationPurpose =
  | "client_portal_register"
  | "password_change"
  | "login_2fa_email"
  | "account_delete"
  // Step-up auth ved reveal av vault-secrets (fallback hvis bruker
  // ikke har TOTP aktivert).
  | "vault_reveal";

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_email_verif_codes_email_purpose
      ON email_verification_codes(LOWER(email), purpose, used_at);
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

function generateCode(): string {
  // 6 sifre, crypto-strong. Bruker rejection-sampling for å unngå
  // modulo-bias.
  let code = "";
  while (code.length < CODE_LENGTH) {
    const buf = crypto.randomBytes(2);
    const n = buf.readUInt16BE(0);
    if (n < 60000) code += (n % 10).toString();
  }
  return code;
}

function purposeSubject(purpose: VerificationPurpose): string {
  switch (purpose) {
    case "client_portal_register": return "Bekreftelseskode for klient-portalen";
    case "password_change": return "Bekreftelseskode — passord-endring";
    case "login_2fa_email": return "Innloggingskode — Creatorhub";
    case "account_delete": return "Bekreftelseskode — slett konto";
    case "vault_reveal": return "Bekreftelseskode — vis vault-passord";
  }
}

function purposeHumanLabel(purpose: VerificationPurpose): string {
  switch (purpose) {
    case "client_portal_register": return "for å bekrefte e-posten din før du oppretter bruker";
    case "password_change": return "for å bekrefte endring av passord";
    case "login_2fa_email": return "for å logge inn";
    case "account_delete": return "for å bekrefte sletting av kontoen";
    case "vault_reveal": return "for å se et passord fra vault-en";
  }
}

export interface SendCodeInput {
  email: string;
  purpose: VerificationPurpose;
  ipAddress?: string | null;
}

export interface SendCodeResult {
  ok: boolean;
  expiresAt: string;
  /** Returnert KUN i development hvis SMTP ikke er konfigurert — slik at
   *  du kan teste flowen lokalt uten Gmail SMTP. Aldri returner dette i
   *  prod (sjekk NODE_ENV).
   */
  devCode?: string;
  reason?: "email_not_configured" | "send_failed" | "invalid_email";
}

export async function sendVerificationCode(
  pool: Pool,
  input: SendCodeInput,
): Promise<SendCodeResult> {
  await ensureSchema(pool);
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, expiresAt: new Date(0).toISOString(), reason: "invalid_email" };
  }

  // Invalider eventuelle eksisterende ikke-brukte koder for (email, purpose).
  await pool.query(
    `UPDATE email_verification_codes
        SET used_at = NOW()
      WHERE LOWER(email) = $1 AND purpose = $2 AND used_at IS NULL`,
    [email, input.purpose],
  );

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO email_verification_codes (email, purpose, code_hash, expires_at, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [email, input.purpose, codeHash, expiresAt, input.ipAddress ?? null],
  );

  // Send e-post
  const cfg = readGmailConfig();
  if (!cfg) {
    // Dev-mode: returner koden så utvikler kan teste uten SMTP
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email-verification] DEV MODE — kode for ${email} (${input.purpose}): ${code}`);
      return { ok: true, expiresAt: expiresAt.toISOString(), devCode: code, reason: "email_not_configured" };
    }
    return { ok: false, expiresAt: expiresAt.toISOString(), reason: "email_not_configured" };
  }

  const subject = purposeSubject(input.purpose);
  const humanContext = purposeHumanLabel(input.purpose);
  const text = [
    `Hei,`,
    ``,
    `Din kode er: ${code}`,
    ``,
    `Bruk denne ${humanContext}.`,
    `Koden er gyldig i ${CODE_TTL_MINUTES} minutter.`,
    ``,
    `Hvis du ikke ba om dette, kan du ignorere e-posten.`,
    ``,
    `Mvh,`,
    `Creatorhub-teamet`,
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;max-width:520px;margin:0 auto;">
      <p>Hei,</p>
      <p>Bruk koden under ${humanContext}:</p>
      <div style="margin:28px 0;text-align:center;">
        <div style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 28px;background:#f0f9ff;border:2px solid #22d3ee;border-radius:8px;color:#0b1226;font-family:'SF Mono',Menlo,monospace;">
          ${code}
        </div>
      </div>
      <p style="font-size:12px;color:#666;">Koden er gyldig i ${CODE_TTL_MINUTES} minutter. Hvis du ikke ba om denne koden, kan du trygt ignorere e-posten.</p>
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
    return { ok: true, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error("[email-verification] send failed", error);
    return { ok: false, expiresAt: expiresAt.toISOString(), reason: "send_failed" };
  }
}

export interface VerifyCodeResult {
  ok: boolean;
  reason?: "not_found" | "expired" | "used" | "wrong_code" | "max_attempts";
  attemptsRemaining?: number;
}

export async function verifyCode(
  pool: Pool,
  input: { email: string; purpose: VerificationPurpose; code: string },
): Promise<VerifyCodeResult> {
  await ensureSchema(pool);
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  if (!email || !code) return { ok: false, reason: "not_found" };

  // Hent siste ikke-brukte kode
  const r = await pool.query(
    `SELECT id, code_hash, expires_at, used_at, attempts
       FROM email_verification_codes
      WHERE LOWER(email) = $1 AND purpose = $2 AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [email, input.purpose],
  );
  if (r.rows.length === 0) return { ok: false, reason: "not_found" };
  const row = r.rows[0];

  if (new Date(row.expires_at).getTime() < Date.now()) {
    // Marker som brukt så ikke flere forsøk
    await pool.query(`UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1`, [row.id]);
    return { ok: false, reason: "expired" };
  }

  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await pool.query(`UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1`, [row.id]);
    return { ok: false, reason: "max_attempts" };
  }

  // Bcrypt-compare for å være timing-attack-resistent
  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    const newAttempts = (row.attempts ?? 0) + 1;
    await pool.query(
      `UPDATE email_verification_codes SET attempts = $2 WHERE id = $1`,
      [row.id, newAttempts],
    );
    return {
      ok: false,
      reason: newAttempts >= MAX_ATTEMPTS ? "max_attempts" : "wrong_code",
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - newAttempts),
    };
  }

  // Match — marker som brukt
  await pool.query(`UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1`, [row.id]);
  return { ok: true };
}

/** Sjekk om brukeren har en verifisert kode innenfor de siste N minutter
 *  for et gitt purpose. Brukes f.eks. i client-portal-register for å
 *  kreve at klienten har verifisert e-posten før de kan sette passord. */
export async function hasRecentlyVerifiedCode(
  pool: Pool,
  input: { email: string; purpose: VerificationPurpose; withinMinutes?: number },
): Promise<boolean> {
  await ensureSchema(pool);
  const withinMinutes = input.withinMinutes ?? 30;
  const r = await pool.query(
    `SELECT 1 FROM email_verification_codes
      WHERE LOWER(email) = $1
        AND purpose = $2
        AND used_at IS NOT NULL
        AND used_at > NOW() - ($3 || ' minutes')::interval
      LIMIT 1`,
    [input.email.trim().toLowerCase(), input.purpose, String(withinMinutes)],
  );
  return r.rows.length > 0;
}
