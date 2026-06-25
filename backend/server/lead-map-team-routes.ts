/**
 * lead-map-team-routes.ts
 *
 * Multi-bruker-tilgang til Lead Map-prosjekter via project_members +
 * project_invitations. Invitasjons-e-poster sendes via Resend
 * (eller Gmail SMTP-fallback) gjennom sendTransactionalEmail.
 *
 * Endepunkter:
 *   GET    /projects/:id/members              — liste m/ rolle + sist aktiv
 *   POST   /projects/:id/invitations          — invitér e-post + rolle
 *   GET    /projects/:id/invitations          — pending invites
 *   DELETE /projects/:id/invitations/:invId   — kanseller invitasjon
 *   DELETE /projects/:id/members/:userId      — fjern medlem
 *   PATCH  /projects/:id/members/:userId      — endre rolle
 *   POST   /invitations/:token/accept         — aksepter (krever auth)
 *   GET    /invitations/:token                — preview invitasjon (ingen auth)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

/** Sjekk at innlogget bruker har rollen owner på prosjektet. */
async function requireOwner(
  pool: Pool,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM project_members
      WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, userId],
  );
  return r.rows[0]?.role === "owner";
}

/** Sjekk at brukeren er medlem (uansett rolle). */
async function isMember(
  pool: Pool,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM project_members
      WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, userId],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  invited_at: string;
  last_active_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

function rowToMember(r: MemberRow) {
  return {
    id: r.id,
    userId: r.user_id,
    role: r.role,
    invitedAt: r.invited_at,
    lastActiveAt: r.last_active_at,
    userName: r.user_name,
    userEmail: r.user_email,
  };
}

function buildInviteEmail(args: {
  projectName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const roleLabel =
    args.role === "owner"
      ? "Eier"
      : args.role === "viewer"
        ? "Leser (kun visning)"
        : "Medlem";
  const subject = `${args.inviterName} har invitert deg til Lead Map: ${args.projectName}`;
  const text = `Hei!

${args.inviterName} har invitert deg til prosjektet "${args.projectName}" på Lead Map.

Rolle: ${roleLabel}

Klikk her for å akseptere invitasjonen og logge inn:
${args.acceptUrl}

Lenken er gyldig i 7 dager.

— Lead Map · theroleroom.com`;
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f7;padding:40px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="540" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;">
        <tr><td style="padding:32px 32px 0;">
          <div style="font-size:14px;color:#c084fc;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">LEAD MAP-INVITASJON</div>
          <h1 style="margin:0;font-size:22px;color:#1a1a1a;line-height:1.3;">
            ${escapeHtml(args.inviterName)} har invitert deg til <span style="color:#c084fc;">${escapeHtml(args.projectName)}</span>
          </h1>
        </td></tr>
        <tr><td style="padding:20px 32px;">
          <p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.6;">
            Du har fått tilgang til prosjektet med rollen
            <strong style="color:#c084fc;">${escapeHtml(roleLabel)}</strong>.
            Klikk på knappen under for å akseptere invitasjonen.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${escapeAttr(args.acceptUrl)}"
             style="display:inline-block;padding:14px 28px;background:#c084fc;color:#0a0a0f;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;">
            Aksepter invitasjon
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
            Lenken er gyldig i 7 dager. Hvis du ikke kjenner igjen ${escapeHtml(args.inviterName)} eller ${escapeHtml(args.projectName)}, ignorér denne e-posten.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#bbb;">
            Lead Map · theroleroom.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export function registerLeadMapTeamRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /projects/:id/members ───────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/projects/:id/members",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      if (!(await isMember(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        const r = await pool.query<MemberRow>(
          `SELECT pm.id::text, pm.user_id, pm.role,
                  pm.invited_at::text, pm.last_active_at::text,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name, u.email AS user_email
             FROM project_members pm
             LEFT JOIN users u ON u.id = pm.user_id
            WHERE pm.project_id = $1
            ORDER BY
              CASE pm.role
                WHEN 'owner' THEN 1
                WHEN 'member' THEN 2
                WHEN 'viewer' THEN 3
                ELSE 4
              END,
              pm.invited_at ASC`,
          [projectId],
        );
        return res.json({ members: r.rows.map(rowToMember) });
      } catch (err) {
        return res.status(500).json({ error: "members_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /projects/:id/invitations (pending) ─────────────────────
  app.get(
    "/api/admin-room/lead-map/projects/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      if (!(await isMember(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        const r = await pool.query<{
          id: string; email: string; role: string;
          invited_at: string; expires_at: string;
          email_status: string | null;
          inviter_name: string | null;
        }>(
          `SELECT pi.id::text, pi.email, pi.role,
                  pi.invited_at::text, pi.expires_at::text,
                  pi.email_status,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS inviter_name
             FROM project_invitations pi
             LEFT JOIN users u ON u.id = pi.invited_by
            WHERE pi.project_id = $1
              AND pi.accepted_at IS NULL
              AND pi.expires_at > NOW()
            ORDER BY pi.invited_at DESC`,
          [projectId],
        );
        return res.json({
          invitations: r.rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            invitedAt: row.invited_at,
            expiresAt: row.expires_at,
            emailStatus: row.email_status,
            inviterName: row.inviter_name,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "invitations_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /projects/:id/invitations ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/projects/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      if (!(await requireOwner(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "kun_eier_kan_invitere" });
      }
      const body = req.body as { email?: string; role?: string };
      const email = body.email?.trim().toLowerCase();
      const role = body.role ?? "member";
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "ugyldig_email" });
      }
      if (!["owner", "member", "viewer"].includes(role)) {
        return res.status(400).json({ error: "ugyldig_rolle" });
      }
      try {
        // Sjekk om e-post allerede er medlem
        const exists = await pool.query<{ id: string }>(
          `SELECT pm.id::text FROM project_members pm
             LEFT JOIN users u ON u.id = pm.user_id
            WHERE pm.project_id = $1 AND LOWER(u.email) = $2 LIMIT 1`,
          [projectId, email],
        );
        if (exists.rows.length > 0) {
          return res.status(409).json({ error: "allerede_medlem" });
        }

        // Hent prosjekt-navn + inviter-navn for email-template
        const proj = await pool.query<{ name: string }>(
          `SELECT name FROM casting_projects WHERE id = $1 LIMIT 1`,
          [projectId],
        );
        if (proj.rows.length === 0) {
          return res.status(404).json({ error: "prosjekt_ikke_funnet" });
        }
        const inviter = await pool.query<{ name: string | null; email: string | null }>(
          `SELECT name, email FROM users WHERE id = $1 LIMIT 1`,
          [session.userId],
        );
        const inviterName = inviter.rows[0]?.name?.trim()
          || inviter.rows[0]?.email
          || "En bruker";

        const token = crypto.randomBytes(32).toString("base64url");
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO project_invitations (
             project_id, email, role, token, invited_by, expires_at
           ) VALUES (
             $1, $2, $3, $4, $5, NOW() + INTERVAL '7 days'
           )
           RETURNING id::text`,
          [projectId, email, role, token, session.userId],
        );
        const invitationId = ins.rows[0].id;

        // Send email
        const acceptUrl = `https://theroleroom.com/lead-map/accept?token=${token}`;
        const { subject, html, text } = buildInviteEmail({
          projectName: proj.rows[0].name,
          inviterName,
          role,
          acceptUrl,
        });
        const emailResult = await sendTransactionalEmail({
          to: email,
          subject,
          html,
          text,
          kind: "lead_map_team_invite",
          projectId,
          sentByUserId: session.userId,
          pool,
        });
        await pool.query(
          `UPDATE project_invitations
              SET email_status = $2,
                  email_provider_message_id = $3
            WHERE id = $1`,
          [
            invitationId,
            emailResult.sent ? "sent" : (emailResult.reason ?? "failed"),
            emailResult.messageId ?? null,
          ],
        );

        return res.json({
          ok: true,
          invitationId,
          emailSent: emailResult.sent,
          emailReason: emailResult.sent ? null : emailResult.reason,
        });
      } catch (err) {
        return res.status(500).json({ error: "invite_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /projects/:id/invitations/:invId ─────────────────────
  app.delete(
    "/api/admin-room/lead-map/projects/:id/invitations/:invId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOwner(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "kun_eier_kan_kansellere" });
      }
      try {
        await pool.query(
          `DELETE FROM project_invitations
            WHERE id = $1 AND project_id = $2`,
          [req.params.invId, req.params.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "cancel_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /projects/:id/members/:userId ────────────────────────
  app.delete(
    "/api/admin-room/lead-map/projects/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      const targetUserId = req.params.userId;
      if (!(await requireOwner(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "kun_eier_kan_fjerne" });
      }
      // Ikke tillat at en eier fjerner siste eier
      if (targetUserId === session.userId) {
        const owners = await pool.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM project_members
            WHERE project_id = $1 AND role = 'owner'`,
          [projectId],
        );
        if ((owners.rows[0]?.n ?? 0) <= 1) {
          return res.status(409).json({ error: "siste_eier_kan_ikke_fjernes" });
        }
      }
      try {
        await pool.query(
          `DELETE FROM project_members
            WHERE project_id = $1 AND user_id = $2`,
          [projectId, targetUserId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "remove_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /projects/:id/members/:userId ─────────────────────────
  app.patch(
    "/api/admin-room/lead-map/projects/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOwner(pool, req.params.id, session.userId))) {
        return res.status(403).json({ error: "kun_eier_kan_endre" });
      }
      const body = req.body as { role?: string };
      if (!body.role || !["owner", "member", "viewer"].includes(body.role)) {
        return res.status(400).json({ error: "ugyldig_rolle" });
      }
      try {
        await pool.query(
          `UPDATE project_members
              SET role = $3
            WHERE project_id = $1 AND user_id = $2`,
          [req.params.id, req.params.userId, body.role],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /invitations/:token (preview, ingen auth) ──────────────
  app.get(
    "/api/lead-map/invitations/:token",
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query<{
          email: string; role: string; expires_at: string;
          project_name: string; inviter_name: string | null;
          accepted_at: string | null;
        }>(
          `SELECT pi.email, pi.role, pi.expires_at::text, pi.accepted_at::text,
                  cp.name AS project_name,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS inviter_name
             FROM project_invitations pi
             JOIN casting_projects cp ON cp.id = pi.project_id
             LEFT JOIN users u ON u.id = pi.invited_by
            WHERE pi.token = $1
            LIMIT 1`,
          [req.params.token],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "ugyldig_token" });
        const row = r.rows[0];
        if (row.accepted_at) return res.status(409).json({ error: "allerede_akseptert" });
        if (new Date(row.expires_at) < new Date()) {
          return res.status(410).json({ error: "utlopt" });
        }
        return res.json({
          email: row.email,
          role: row.role,
          projectName: row.project_name,
          inviterName: row.inviter_name,
          expiresAt: row.expires_at,
        });
      } catch (err) {
        return res.status(500).json({ error: "preview_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /invitations/:token/accept ────────────────────────────
  app.post(
    "/api/lead-map/invitations/:token/accept",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const invRes = await pool.query<{
          id: string; project_id: string; email: string;
          role: string; expires_at: string; accepted_at: string | null;
        }>(
          `SELECT id::text, project_id, email, role,
                  expires_at::text, accepted_at::text
             FROM project_invitations WHERE token = $1 LIMIT 1`,
          [req.params.token],
        );
        if (invRes.rows.length === 0) return res.status(404).json({ error: "ugyldig_token" });
        const inv = invRes.rows[0];
        if (inv.accepted_at) return res.status(409).json({ error: "allerede_akseptert" });
        if (new Date(inv.expires_at) < new Date()) {
          return res.status(410).json({ error: "utlopt" });
        }
        // Sjekk at innlogget bruker matcher invited email
        if (session.email && session.email.toLowerCase() !== inv.email.toLowerCase()) {
          return res.status(403).json({ error: "feil_bruker" });
        }
        // Opprett medlem-rad
        await pool.query(
          `INSERT INTO project_members (project_id, user_id, role, invited_by)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [inv.project_id, session.userId, inv.role],
        );
        // Marker invitasjon som akseptert
        await pool.query(
          `UPDATE project_invitations
              SET accepted_at = NOW(),
                  accepted_by_user_id = $2
            WHERE id = $1`,
          [inv.id, session.userId],
        );
        return res.json({ ok: true, projectId: inv.project_id, role: inv.role });
      } catch (err) {
        return res.status(500).json({ error: "accept_failed", detail: String(err) });
      }
    },
  );
}
