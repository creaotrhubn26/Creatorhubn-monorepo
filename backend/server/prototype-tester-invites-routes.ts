/**
 * prototype-tester-invites-routes.ts — Slice 9X.53
 *
 * Egen NDA + program-vilkår-flyt for prototype-testere (adskilt fra
 * role_room_tester_invites — det er kun for Role Room).
 *
 * Endpoints:
 *   POST   /api/prototype-tester-invites              — admin/auto-bro lager invitasjon
 *   GET    /api/prototype-tester-invites/:token       — public: hent for accept-page
 *   POST   /api/prototype-tester-invites/:token/accept — public: signer NDA + godta program-vilkår
 *   GET    /api/prototype-tester-invites/me/status    — innlogget bruker: er jeg aktiv tester?
 *
 * Auto-bro: når en invite_request med selected_plan='prototype_tester'
 * godkjennes via PUT /api/invites/admin/requests/:id/status, kalles
 * createInviteFromApprovedRequest() automatisk.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";

export interface PrototypeTesterInvitesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

const PROGRAM_DURATION_WEEKS = 12;
const INVITE_EXPIRES_DAYS = 14;
const PROGRAM_TERMS_VERSION = "1.0";
const NDA_VERSION = "1.0";

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prototype_tester_invites (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token                       TEXT NOT NULL UNIQUE,
      email                       TEXT NOT NULL,
      name                        TEXT NOT NULL,
      testing_areas               JSONB NOT NULL DEFAULT '[]'::jsonb,
      personal_message            TEXT,
      invite_request_id           UUID,
      nda_version                 VARCHAR(16) NOT NULL DEFAULT '1.0',
      program_terms_version       VARCHAR(16) NOT NULL DEFAULT '1.0',
      status                      VARCHAR(20) NOT NULL DEFAULT 'pending',
      accepted_at                 TIMESTAMPTZ,
      accepted_nda_name           TEXT,
      accepted_program_terms      BOOLEAN DEFAULT false,
      accepted_ip                 TEXT,
      program_started_at          TIMESTAMPTZ,
      program_ends_at             TIMESTAMPTZ,
      program_duration_weeks      INTEGER NOT NULL DEFAULT 12,
      benefit_granted             BOOLEAN DEFAULT false,
      benefit_granted_at          TIMESTAMPTZ,
      benefit_description         TEXT,
      feedback_count              INTEGER NOT NULL DEFAULT 0,
      last_feedback_at            TIMESTAMPTZ,
      last_login_at               TIMESTAMPTZ,
      last_digest_sent_at         TIMESTAMPTZ,
      invited_by                  TEXT,
      expires_at                  TIMESTAMPTZ NOT NULL,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => undefined);
  // Slice 9X.53 — Granulert tilgang (Hybrid C-modell)
  for (const col of [
    `granted_plan VARCHAR(50) NOT NULL DEFAULT 'tester_all_access'`,
    `granted_features JSONB NOT NULL DEFAULT '[]'::jsonb`,
  ]) {
    await pool.query(`ALTER TABLE prototype_tester_invites ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_email
       ON prototype_tester_invites (LOWER(email))`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_status
       ON prototype_tester_invites (status, program_ends_at)`,
  ).catch(() => undefined);
}

function getMailer(): nodemailer.Transporter | null {
  const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "").trim();
  const mailPass = (process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (!mailUser || !mailPass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: mailUser, pass: mailPass } });
}

function buildInviteEmailHtml(name: string, inviteUrl: string, personalMessage: string | null): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h2 style="margin:0 0 16px;">Hei ${escapeHtml(name)} 👋</h2>
      <p style="font-size:15px;line-height:1.6;">
        Søknaden din om å bli prototype-tester i Creatorhubn er <b>godkjent</b>!
      </p>
      ${personalMessage ? `<div style="background:#fff8ee;border-left:3px solid #ffba6c;padding:12px 16px;margin:16px 0;font-style:italic;">"${escapeHtml(personalMessage)}"</div>` : ""}
      <p style="font-size:15px;line-height:1.6;">
        Før du får tilgang må du gå gjennom forpliktelses-vilkårene (12 uker, ~2 t/uke,
        min. 4 feedback per måned) og signere en NDA.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteUrl}" style="display:inline-block;background:#ffba6c;color:#150d05;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;">Les vilkår og signer</a>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.5;">
        Lenken er gyldig i ${INVITE_EXPIRES_DAYS} dager. Hvis knappen ikke fungerer:<br>
        <a href="${inviteUrl}" style="color:#1976d2;word-break:break-all;">${inviteUrl}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
      <p style="font-size:12px;color:#999;">
        Du får denne fordi du søkte om å bli prototype-tester via creatorhubn.com.
        Hvis dette er en feil, kan du ignorere e-posten.
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowToInvite(r: any): any {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    testingAreas: r.testing_areas || [],
    personalMessage: r.personal_message,
    ndaVersion: r.nda_version,
    programTermsVersion: r.program_terms_version,
    status: r.status,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    programStartedAt: r.program_started_at,
    programEndsAt: r.program_ends_at,
    programDurationWeeks: r.program_duration_weeks,
    feedbackCount: r.feedback_count,
    lastFeedbackAt: r.last_feedback_at,
    benefitGranted: r.benefit_granted,
    grantedPlan: r.granted_plan || "tester_all_access",
    grantedFeatures: r.granted_features || [],
  };
}

/**
 * Auto-bro: kalles av invite-approval-flow i index.ts.
 * Eksportert som standalone så index.ts kan importere den.
 */
export async function createInviteFromApprovedRequest(
  pool: any,
  inviteRequestId: string,
  email: string,
  name: string,
  invitedBy: string | null,
  testingAreas: string[] = [],
  baseUrl: string = "https://creatorhubn.com",
  grantedPlan: string = "tester_all_access",
  grantedFeatures: string[] = [],
): Promise<{ id: string; token: string; inviteUrl: string } | null> {
  try {
    await ensureSchema(pool);
    // Skip hvis det allerede finnes en aktiv invitasjon for denne søknaden
    const existing = await pool.query(
      `SELECT id, token FROM prototype_tester_invites
        WHERE invite_request_id = $1 AND status IN ('pending','accepted')
        LIMIT 1`,
      [inviteRequestId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      const row = existing.rows[0];
      return {
        id: row.id,
        token: row.token,
        inviteUrl: `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(row.token)}`,
      };
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const ins = await pool.query(
      `INSERT INTO prototype_tester_invites
         (token, email, name, testing_areas, invite_request_id, nda_version,
          program_terms_version, expires_at, invited_by, granted_plan, granted_features)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id, token`,
      [
        token,
        email,
        name,
        JSON.stringify(testingAreas),
        inviteRequestId,
        NDA_VERSION,
        PROGRAM_TERMS_VERSION,
        expiresAt.toISOString(),
        invitedBy,
        grantedPlan,
        JSON.stringify(grantedFeatures),
      ],
    );
    const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(token)}`;

    // Send e-post (best effort — ikke blokker hvis mailer ikke konfigurert)
    const mailer = getMailer();
    if (mailer) {
      const mailUser = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "";
      mailer.sendMail({
        from: `"Creatorhubn" <${mailUser}>`,
        to: email,
        subject: "Du er godkjent som prototype-tester i Creatorhubn 🎉",
        html: buildInviteEmailHtml(name, inviteUrl, null),
      }).catch((err) => console.error("[prototype-tester-invite] mail failed:", err?.message || err));
    } else {
      console.warn("[prototype-tester-invite] Mailer not configured — invitasjon opprettet uten e-post");
    }

    return { id: ins.rows[0].id, token, inviteUrl };
  } catch (err) {
    console.error("createInviteFromApprovedRequest failed:", err);
    return null;
  }
}

export function setupPrototypeTesterInvitesRoutes(deps: PrototypeTesterInvitesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── POST /api/prototype-tester-invites ─────────────────────
  // Admin oppretter invitasjon manuelt (push-modell, i tillegg til
  // auto-bro fra approval).
  app.post("/api/prototype-tester-invites", async (req, res) => {
    try {
      await ensureSchema(pool);
      const body = req.body ?? {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const testingAreas = Array.isArray(body.testingAreas) ? body.testingAreas : [];
      const personalMessage = typeof body.personalMessage === "string" ? body.personalMessage.slice(0, 2000) : null;
      const invitedBy = typeof body.invitedBy === "string" ? body.invitedBy : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Gyldig e-post er påkrevd" });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Navn er påkrevd (min 2 tegn)" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      const ins = await pool.query(
        `INSERT INTO prototype_tester_invites
           (token, email, name, testing_areas, personal_message, nda_version,
            program_terms_version, expires_at, invited_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
         RETURNING id, token, expires_at, created_at`,
        [
          token,
          email,
          name,
          JSON.stringify(testingAreas),
          personalMessage,
          NDA_VERSION,
          PROGRAM_TERMS_VERSION,
          expiresAt.toISOString(),
          invitedBy,
        ],
      );
      const row = ins.rows[0];
      const baseUrl = req.headers.origin || `https://${req.headers.host || "creatorhubn.com"}`;
      const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(row.token)}`;

      // Send e-post (best effort)
      const mailer = getMailer();
      if (mailer) {
        const mailUser = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "";
        mailer.sendMail({
          from: `"Creatorhubn" <${mailUser}>`,
          to: email,
          subject: "Du er invitert som prototype-tester i Creatorhubn 🎉",
          html: buildInviteEmailHtml(name, inviteUrl, personalMessage),
        }).catch((err) => console.error("[prototype-tester-invite] mail failed:", err?.message || err));
      }

      res.status(201).json({
        id: String(row.id),
        token: row.token,
        inviteUrl,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        mailerConfigured: !!mailer,
      });
    } catch (err: any) {
      console.error("POST /prototype-tester-invites:", err);
      res.status(500).json({ error: "Kunne ikke opprette invitasjon" });
    }
  });

  // ─── GET /api/prototype-tester-invites/:token ───────────────
  app.get("/api/prototype-tester-invites/:token", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT * FROM prototype_tester_invites WHERE token = $1 LIMIT 1`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      const row = r.rows[0];
      const expired = new Date(row.expires_at).getTime() < Date.now();
      const payload = rowToInvite(row);
      if (expired && payload.status === "pending") {
        await pool.query(
          `UPDATE prototype_tester_invites SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [row.id],
        );
        payload.status = "expired";
      }
      res.json(payload);
    } catch (err) {
      console.error("GET /prototype-tester-invites/:token:", err);
      res.status(500).json({ error: "Kunne ikke hente invitasjon" });
    }
  });

  // ─── POST /api/prototype-tester-invites/:token/accept ───────
  app.post("/api/prototype-tester-invites/:token/accept", async (req, res) => {
    try {
      await ensureSchema(pool);
      const body = req.body ?? {};
      const ndaName = typeof body.ndaName === "string" ? body.ndaName.trim() : "";
      const acceptedProgramTerms = body.acceptedProgramTerms === true;
      const programTermsVersion = typeof body.programTermsVersion === "string" ? body.programTermsVersion : PROGRAM_TERMS_VERSION;

      if (!ndaName || ndaName.length < 2) {
        return res.status(400).json({ error: "Fullt navn er påkrevd som signatur" });
      }
      if (!acceptedProgramTerms) {
        return res.status(400).json({ error: "Du må godta forpliktelses-vilkårene" });
      }

      const existing = await pool.query(
        `SELECT id, status, expires_at FROM prototype_tester_invites WHERE token = $1 LIMIT 1`,
        [req.params.token],
      );
      if (existing.rowCount === 0) return res.status(404).json({ error: "Invitasjon ikke funnet" });
      const inv = existing.rows[0];
      if (inv.status !== "pending") {
        return res.status(409).json({ error: `Invitasjon er allerede ${inv.status}` });
      }
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        await pool.query(
          `UPDATE prototype_tester_invites SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [inv.id],
        );
        return res.status(410).json({ error: "Invitasjon har utløpt — kontakt daniel@creatorhubn.com for ny" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req as any).ip || null;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000);

      const upd = await pool.query(
        `UPDATE prototype_tester_invites
           SET status = 'accepted',
               accepted_at = NOW(),
               accepted_nda_name = $1,
               accepted_program_terms = true,
               program_terms_version = $2,
               accepted_ip = $3,
               program_started_at = $4,
               program_ends_at = $5,
               updated_at = NOW()
           WHERE id = $6
         RETURNING *`,
        [ndaName.slice(0, 200), programTermsVersion, ip, startsAt, endsAt, inv.id],
      );
      res.json({
        success: true,
        invite: rowToInvite(upd.rows[0]),
        message: "Velkommen som prototype-tester!",
      });
    } catch (err) {
      console.error("POST /prototype-tester-invites/:token/accept:", err);
      res.status(500).json({ error: "Kunne ikke signere — prøv igjen" });
    }
  });

  // ─── GET /api/prototype-tester-invites/me/status ────────────
  // Innlogget bruker: er jeg en aktiv prototype-tester?
  app.get("/api/prototype-tester-invites/me/status", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.json({ isTester: false });
      await ensureSchema(pool);
      // Heuristikk: matcher e-post mot innlogget bruker
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0 || !userR.rows[0].email) return res.json({ isTester: false });
      const email = String(userR.rows[0].email).toLowerCase();
      const inv = await pool.query(
        `SELECT * FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted'
            AND program_ends_at > NOW()
          ORDER BY program_started_at DESC LIMIT 1`,
        [email],
      );
      if (inv.rowCount === 0) return res.json({ isTester: false });
      const row = inv.rows[0];
      // Side-effekt: oppdater last_login_at idempotent
      await pool.query(
        `UPDATE prototype_tester_invites SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      ).catch(() => undefined);
      const daysRemaining = Math.max(0, Math.ceil((new Date(row.program_ends_at).getTime() - Date.now()) / (24 * 3600 * 1000)));
      const daysInProgram = Math.max(0, Math.ceil((Date.now() - new Date(row.program_started_at).getTime()) / (24 * 3600 * 1000)));
      const monthsElapsed = Math.max(1, Math.ceil(daysInProgram / 30));
      const expectedFeedbacks = monthsElapsed * 4;
      res.json({
        isTester: true,
        inviteId: row.id,
        programStartedAt: row.program_started_at,
        programEndsAt: row.program_ends_at,
        daysRemaining,
        feedbackCount: row.feedback_count,
        expectedFeedbacks,
        isOnTrack: row.feedback_count >= expectedFeedbacks * 0.7,
        benefitGranted: row.benefit_granted,
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites/me/status:", err);
      res.json({ isTester: false });
    }
  });
}
