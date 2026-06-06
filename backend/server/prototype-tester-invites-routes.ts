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
  requireUserSession: (req: any, res: any) => any;
  requireAdminSession: (req: any, res: any) => any;
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
  // Slice 9X.56 — Team-flyt: master kan invitere opptil max_team_size-1
  // andre medlemmer. Alle deler aligned program_ends_at fra master sin start.
  for (const col of [
    `team_role VARCHAR(20) NOT NULL DEFAULT 'individual'`,
    `master_invite_id UUID`,
    `max_team_size INTEGER NOT NULL DEFAULT 1`,
  ]) {
    await pool.query(`ALTER TABLE prototype_tester_invites ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_master
       ON prototype_tester_invites (master_invite_id)
       WHERE master_invite_id IS NOT NULL`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_email
       ON prototype_tester_invites (LOWER(email))`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_status
       ON prototype_tester_invites (status, program_ends_at)`,
  ).catch(() => undefined);
}

function getMailer(): ReturnType<typeof nodemailer.createTransport> | null {
  const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "").trim();
  const mailPass = (process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (!mailUser || !mailPass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: mailUser, pass: mailPass } });
}

function buildInviteEmailHtml(name: string, inviteUrl: string, personalMessage: string | null): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h2 style="margin:0 0 16px;">Hei ${escapeHtml(name)},</h2>
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
    teamRole: r.team_role || "individual",
    masterInviteId: r.master_invite_id || null,
    maxTeamSize: r.max_team_size || 1,
  };
}

/**
 * Auto-bro: kalles av invite-approval-flow i index.ts.
 * Eksportert som standalone så index.ts kan importere den.
 */
// Slice 9X.56 — Parse team-størrelse fra message-feltet.
// InviteRequestForm prepender "[Team: X medlemmer]" når søker er team-master.
function parseTeamSizeFromMessage(message: string | null): number {
  if (!message) return 1;
  const m = message.match(/\[Team:\s*(\d+)\s*medlemmer?\]/i);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(5, Math.max(1, n)); // Hard-cap maks 5
}

const MAX_TEAM_SIZE = 5;

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
  teamSize: number = 1,
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
    const clampedTeamSize = Math.min(MAX_TEAM_SIZE, Math.max(1, teamSize));
    const isTeamMaster = clampedTeamSize > 1;
    const ins = await pool.query(
      `INSERT INTO prototype_tester_invites
         (token, email, name, testing_areas, invite_request_id, nda_version,
          program_terms_version, expires_at, invited_by, granted_plan,
          granted_features, team_role, max_team_size)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
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
        isTeamMaster ? "master" : "individual",
        clampedTeamSize,
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
        subject: "Du er godkjent som prototype-tester i Creatorhubn",
        html: buildInviteEmailHtml(name, inviteUrl, null),
      }).catch((err: unknown) => console.error("[prototype-tester-invite] mail failed:", (err as { message?: string })?.message || err));
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
  const { app, pool, getPricingUserId, requireUserSession, requireAdminSession } = deps;

  // ─── POST /api/prototype-tester-invites ─────────────────────
  // Admin oppretter invitasjon manuelt (push-modell, i tillegg til
  // auto-bro fra approval).
  app.post("/api/prototype-tester-invites", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
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
          subject: "Du er invitert som prototype-tester i Creatorhubn",
          html: buildInviteEmailHtml(name, inviteUrl, personalMessage),
        }).catch((err: unknown) => console.error("[prototype-tester-invite] mail failed:", (err as { message?: string })?.message || err));
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
      let endsAt = new Date(startsAt.getTime() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000);

      // Slice 9X.56 — Aligned team-end-date: hvis dette er et team-medlem,
      // arv master's program_ends_at slik at alle slutter samtidig.
      const inviteFull = await pool.query(
        `SELECT master_invite_id FROM prototype_tester_invites WHERE id = $1 LIMIT 1`,
        [inv.id],
      );
      const masterId = inviteFull.rows[0]?.master_invite_id;
      if (masterId) {
        const masterR = await pool.query(
          `SELECT program_ends_at FROM prototype_tester_invites WHERE id = $1 AND status = 'accepted' LIMIT 1`,
          [masterId],
        );
        if (masterR.rowCount > 0 && masterR.rows[0].program_ends_at) {
          endsAt = new Date(masterR.rows[0].program_ends_at);
        }
      }

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
        grantedPlan: row.granted_plan || "tester_all_access",
        grantedFeatures: row.granted_features || [],
        teamRole: row.team_role || "individual",
        masterInviteId: row.master_invite_id || null,
        maxTeamSize: row.max_team_size || 1,
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites/me/status:", err);
      res.json({ isTester: false });
    }
  });

  // ─── GET /api/prototype-tester-invites/me/team ──────────────
  // Slice 9X.56 — Master ser sitt team: medlemmer + plasser igjen.
  app.get("/api/prototype-tester-invites/me/team", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
      const email = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id, max_team_size, team_role, program_ends_at, granted_plan, granted_features
           FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          ORDER BY program_started_at DESC LIMIT 1`,
        [email],
      );
      if (masterR.rowCount === 0) {
        return res.json({ isMaster: false, members: [], slotsRemaining: 0, maxTeamSize: 0 });
      }
      const master = masterR.rows[0];

      const membersR = await pool.query(
        `SELECT id, email, name, status, accepted_at, invited_at AS created_at, program_ends_at
           FROM prototype_tester_invites
          WHERE master_invite_id = $1
          ORDER BY created_at ASC`,
        [master.id],
      );
      const usedSlots = membersR.rowCount + 1; // +1 = master selv
      const slotsRemaining = Math.max(0, master.max_team_size - usedSlots);
      res.json({
        isMaster: true,
        masterId: master.id,
        maxTeamSize: master.max_team_size,
        slotsRemaining,
        sharedProgramEndsAt: master.program_ends_at,
        members: membersR.rows.map((r: any) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          status: r.status,
          invitedAt: r.created_at,
          acceptedAt: r.accepted_at,
          programEndsAt: r.program_ends_at,
        })),
      });
    } catch (err) {
      console.error("GET /prototype-tester-invites/me/team:", err);
      res.status(500).json({ error: "Kunne ikke hente team" });
    }
  });

  // ─── POST /api/prototype-tester-invites/me/team/invite ──────
  // Master inviterer team-medlem. Arver granted_plan, granted_features og
  // sharedProgramEndsAt automatisk. NDA-e-post sendes hvis mailer er satt.
  app.post("/api/prototype-tester-invites/me/team/invite", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);

      const body = req.body ?? {};
      const memberEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const memberName = typeof body.name === "string" ? body.name.trim() : "";
      if (!memberEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)) {
        return res.status(400).json({ error: "Gyldig e-post påkrevd" });
      }
      if (!memberName || memberName.length < 2) {
        return res.status(400).json({ error: "Navn påkrevd (min 2 tegn)" });
      }

      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
      const masterEmail = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id, max_team_size, granted_plan, granted_features, program_ends_at
           FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          ORDER BY program_started_at DESC LIMIT 1`,
        [masterEmail],
      );
      if (masterR.rowCount === 0) {
        return res.status(403).json({ error: "Du er ikke registrert som team-master" });
      }
      const master = masterR.rows[0];

      // Sjekk at det er plass igjen
      const countR = await pool.query(
        `SELECT COUNT(*)::int AS used FROM prototype_tester_invites WHERE master_invite_id = $1`,
        [master.id],
      );
      const usedSlots = countR.rows[0].used + 1; // +1 for master selv
      if (usedSlots >= master.max_team_size) {
        return res.status(409).json({ error: "Teamet er fullt — du har brukt alle plassene" });
      }

      // Sjekk for duplikat på e-post
      const dup = await pool.query(
        `SELECT id FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status IN ('pending','accepted')
          LIMIT 1`,
        [memberEmail],
      );
      if ((dup.rowCount ?? 0) > 0) {
        return res.status(409).json({ error: "Denne e-posten har allerede en aktiv invitasjon" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      const ins = await pool.query(
        `INSERT INTO prototype_tester_invites
           (token, email, name, nda_version, program_terms_version, expires_at,
            invited_by, granted_plan, granted_features, team_role,
            master_invite_id, max_team_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'member', $10, 1)
         RETURNING id, token`,
        [
          token,
          memberEmail,
          memberName,
          NDA_VERSION,
          PROGRAM_TERMS_VERSION,
          expiresAt.toISOString(),
          uid,
          master.granted_plan,
          JSON.stringify(master.granted_features || []),
          master.id,
        ],
      );

      const baseUrl = req.headers.origin || `https://${req.headers.host || "creatorhubn.com"}`;
      const inviteUrl = `${baseUrl}/prototype-tester/accept-invite?token=${encodeURIComponent(token)}`;

      const mailer = getMailer();
      if (mailer) {
        const mailUser = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "";
        mailer.sendMail({
          from: `"Creatorhubn" <${mailUser}>`,
          to: memberEmail,
          subject: "Du er invitert som prototype-tester (team-medlem)",
          html: buildInviteEmailHtml(
            memberName,
            inviteUrl,
            `Du har blitt invitert som team-medlem. Når du signerer NDA-en blir du del av det aktive prototype-tester-teamet (program slutter ${new Date(master.program_ends_at).toLocaleDateString("nb-NO")}).`,
          ),
        }).catch((err) => console.error("[team-invite] mail failed:", err?.message || err));
      }

      res.status(201).json({
        id: ins.rows[0].id,
        token: ins.rows[0].token,
        inviteUrl,
        sharedProgramEndsAt: master.program_ends_at,
        mailerConfigured: !!mailer,
      });
    } catch (err) {
      console.error("POST /me/team/invite:", err);
      res.status(500).json({ error: "Kunne ikke invitere team-medlem" });
    }
  });

  // ─── DELETE /api/prototype-tester-invites/me/team/:memberId ───
  // Master kan trekke tilbake en team-invitasjon FØR medlemmet har signert.
  app.delete("/api/prototype-tester-invites/me/team/:memberId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      await ensureSchema(pool);
      const userR = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [uid]);
      if (userR.rowCount === 0) return res.status(404).json({ error: "Bruker ikke funnet" });
      const email = String(userR.rows[0].email).toLowerCase();

      const masterR = await pool.query(
        `SELECT id FROM prototype_tester_invites
          WHERE LOWER(email) = $1 AND status = 'accepted' AND team_role = 'master'
          LIMIT 1`,
        [email],
      );
      if (masterR.rowCount === 0) return res.status(403).json({ error: "Du er ikke team-master" });

      // Bare trekk tilbake hvis medlemmet ennå ikke har signert
      const del = await pool.query(
        `DELETE FROM prototype_tester_invites
          WHERE id = $1 AND master_invite_id = $2 AND status = 'pending'
        RETURNING id`,
        [req.params.memberId, masterR.rows[0].id],
      );
      if (del.rowCount === 0) {
        return res.status(404).json({ error: "Fant ikke ventende invitasjon — kan ikke trekke tilbake etter signering" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /me/team/:memberId:", err);
      res.status(500).json({ error: "Kunne ikke trekke tilbake" });
    }
  });
}
