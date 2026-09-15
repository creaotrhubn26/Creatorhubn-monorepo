/**
 * role-room-talent-signup-routes.ts
 *
 * Åpen selvregistrering for skuespillere/talents i The Role Room.
 *
 *   POST /api/role-room/talents/signup/request-code
 *     → sender 6-sifret kode til e-posten (purpose 'talent_signup')
 *
 *   POST /api/role-room/talents/signup
 *     → kode + passord + navn ⇒ users-rad (role='talent') + draft talents-rad
 *       + mintet sesjon, slik at talenten er innlogget med én gang.
 *
 * Bakgrunn: fram til nå fantes ingen vei til en konto for en skuespiller.
 * invite-requests krever organisasjonsnummer med Brreg-oppslag, Google-login
 * avviser ukjente e-poster, og både byrå-forslag og skole-claim krever en
 * konto som ikke kunne opprettes. Se
 * docs/superpowers/specs/2026-09-15-talent-selvregistrering-design.md.
 *
 * Mønsteret er hentet fra client-portal-routes.ts (POST /api/client/portal/
 * register) med ÉN bevisst forskjell: klientportalen gjør ON CONFLICT (email)
 * DO UPDATE SET password = EXCLUDED.password. Her er e-posten det eneste en
 * angriper trenger å kontrollere, så samme mønster ville latt hvem som helst
 * overskrive passordet på en eksisterende konto. Vi svarer 409 i stedet;
 * gjenvinning går via passord-tilbakestilling.
 */

import type express from "express";
import crypto from "node:crypto";
import type { Pool } from "pg";

import { persistAuthSession } from "./auth-session-store.js";
import { createRoleRoomTurnstileService } from "./role-room-turnstile-service";

export interface RoleRoomTalentSignupRoutesDeps {
  app: express.Application;
  pool: Pool;
  activeSessions: Map<string, any>;
  normalizeMailConfigValue: (value: unknown) => string;
  getDefaultRoleRoomPublicOrigin: () => string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** IP-grense på kode-sending. Verifiseringstjenestens egen cooldown er per
 *  e-post og stopper ikke en angriper som varierer adressen. Samme enkle
 *  in-memory-mønster som _inviteRateLimited i invite-requests-routes.ts. */
const CODE_REQUESTS_PER_WINDOW = 5;
const CODE_WINDOW_MS = 10 * 60 * 1000;
const codeRequestLog = new Map<string, number[]>();

function clientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.ip || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

/** Returnerer sekunder til neste tillatte forsøk, eller 0 når det er fritt. */
function rateLimitRetryAfter(ip: string): number {
  const now = Date.now();
  const hits = (codeRequestLog.get(ip) || []).filter((t) => now - t < CODE_WINDOW_MS);
  if (hits.length >= CODE_REQUESTS_PER_WINDOW) {
    const oldest = hits[0];
    return Math.max(1, Math.ceil((CODE_WINDOW_MS - (now - oldest)) / 1000));
  }
  hits.push(now);
  codeRequestLog.set(ip, hits);
  return 0;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function usernameFromEmail(email: string): string {
  return (
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || `talent-${Date.now()}`
  );
}

export function setupRoleRoomTalentSignupRoutes(
  deps: RoleRoomTalentSignupRoutesDeps,
): void {
  const {
    app,
    pool,
    activeSessions,
    normalizeMailConfigValue,
    getDefaultRoleRoomPublicOrigin,
  } = deps;

  const turnstileService = createRoleRoomTurnstileService({
    normalizeMailConfigValue,
    getDefaultRoleRoomPublicOrigin,
  });

  async function verifyTurnstile(
    req: express.Request,
    res: express.Response,
  ): Promise<boolean> {
    const secret = turnstileService.getRoleRoomTurnstileSecretKey();
    if (!secret) return true; // Ikke konfigurert i dette miljøet — hopp over.

    const token = normalizeMailConfigValue(
      (req.body as Record<string, unknown>)?.turnstileToken ||
        (req.body as Record<string, unknown>)?.["cf-turnstile-response"],
    );
    if (!token) {
      res.status(400).json({ error: "captcha_failed" });
      return false;
    }

    const outcome = await turnstileService.verifyRoleRoomTurnstileToken({
      token,
      ipAddress: clientIp(req),
      expectedAction: "talent_signup",
      expectedHostnames: turnstileService.getRoleRoomTurnstileExpectedHostnames(req),
    });
    if (!outcome.success) {
      console.warn("[talents/signup] turnstile rejected", outcome.errorCodes);
      res.status(400).json({ error: "captcha_failed" });
      return false;
    }
    return true;
  }

  // ── POST /signup/request-code ───────────────────────────────────────
  app.post("/api/role-room/talents/signup/request-code", async (req, res) => {
    const email = readString((req.body as Record<string, unknown>)?.email).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }

    const retryAfterSeconds = rateLimitRetryAfter(clientIp(req));
    if (retryAfterSeconds) {
      return res.status(429).json({ error: "too_many_requests", retryAfterSeconds });
    }

    if (!(await verifyTurnstile(req, res))) return;

    try {
      // Svaret skiller ALDRI på kjent og ukjent e-post — ellers blir
      // endepunktet et oppslagsverk over hvem som er registrert. En e-post
      // som allerede har konto får ingen kode; signup-steget svarer 409.
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [email],
      );
      if (existing.rowCount) {
        return res.json({ ok: true, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
      }

      const verifSvc = await import("./email-verification-service.js");
      const result = await verifSvc.sendVerificationCode(pool, {
        email,
        purpose: "talent_signup",
        ipAddress: clientIp(req),
      });

      if (!result.ok) {
        if (result.reason === "rate_limited") {
          return res.status(429).json({
            error: "too_many_requests",
            retryAfterSeconds: result.retryAfterSeconds ?? 60,
          });
        }
        if (result.reason === "email_not_configured") {
          return res.status(503).json({ error: "email_not_configured" });
        }
        if (result.reason === "send_failed") {
          // Ikke brukerens feil — ikke lyv og si «ugyldig e-post».
          return res.status(502).json({ error: "email_send_failed" });
        }
        return res.status(400).json({ error: "invalid_email" });
      }

      return res.json({
        ok: true,
        expiresAt: result.expiresAt,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    } catch (error) {
      console.error("[talents/signup/request-code] failed", error);
      return res.status(500).json({ error: "code_send_failed" });
    }
  });

  // ── POST /signup ────────────────────────────────────────────────────
  app.post("/api/role-room/talents/signup", async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = readString(body.email).toLowerCase();
    const code = readString(body.code);
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = readString(body.displayName);

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    if (!displayName) {
      return res.status(400).json({ error: "missing_name" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: "weak_password" });
    }

    try {
      const verifSvc = await import("./email-verification-service.js");
      const verification = await verifSvc.verifyCode(pool, {
        email,
        purpose: "talent_signup",
        code,
      });
      if (!verification.ok) {
        return res.status(400).json({ error: "invalid_code" });
      }

      // Sjekk FØR insert, og bruk ikke ON CONFLICT DO UPDATE på passordet:
      // en verifisert e-postkode skal aldri kunne overta en konto som finnes.
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [email],
      );
      if (existing.rowCount) {
        return res.status(409).json({ error: "account_exists" });
      }

      const bcrypt = await import("bcrypt");
      const hashed = await bcrypt.default.hash(password, 10);
      const nameParts = displayName.split(/\s+/);
      const firstName = (nameParts[0] || email.split("@")[0] || "Talent").slice(0, 64);
      const lastName = nameParts.slice(1).join(" ").slice(0, 64) || null;

      const inserted = await pool.query(
        `INSERT INTO users (email, username, first_name, last_name, role, password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'talent', $5, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, first_name, last_name, role`,
        [email, usernameFromEmail(email), firstName, lastName, hashed],
      );
      if (!inserted.rowCount) {
        // Kappløp mot en parallell registrering på samme e-post.
        return res.status(409).json({ error: "account_exists" });
      }
      const user = inserted.rows[0];

      // Draft-profil uten samtykke-rader: usynlig i byrå-søk til talenten
      // selv deler noe. Best-effort — en feil her skal ikke gjøre kontoen
      // ubrukelig, profilen kan opprettes fra ProfilePage etterpå.
      let talentId: string | null = null;
      try {
        const talent = await pool.query(
          `INSERT INTO talents (owner_user_id, display_name, email, profile_status)
           VALUES ($1, $2, $3, 'draft')
           RETURNING id`,
          [String(user.id), displayName.slice(0, 255), email],
        );
        talentId = talent.rows[0]?.id ?? null;
      } catch (error) {
        console.error("[talents/signup] draft-profil feilet", error);
      }

      const sessionToken = crypto.randomUUID();
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
      const sessionData = {
        userId: String(user.id),
        email: user.email,
        name: fullName,
        role: "talent",
        roleLabel: "Talent",
        permissions: [],
        displayName: fullName,
        isAdmin: false,
        loginAt: new Date().toISOString(),
      };
      activeSessions.set(sessionToken, sessionData);
      await persistAuthSession(pool, sessionToken, sessionData);

      return res.status(201).json({
        sessionToken,
        talentId,
        user: {
          id: user.id,
          email: user.email,
          name: fullName,
          display_name: fullName,
          role: "talent",
        },
      });
    } catch (error) {
      console.error("[talents/signup] failed", error);
      return res.status(500).json({ error: "signup_failed" });
    }
  });
}
