/**
 * lead-map-org-routes.ts
 *
 * Organisasjons-håndtering for Lead Map. En organisasjon er et
 * paraply-objekt over flere prosjekter. Org-medlemmer arver tilgang
 * til alle prosjekter i org-en.
 *
 * Endepunkter:
 *   GET    /organizations                       — liste mine org-er
 *   GET    /organizations/:id                   — detalj + medlemmer
 *   POST   /organizations                       — opprett ny org
 *   PATCH  /organizations/:id                   — oppdater info
 *   POST   /organizations/:id/invitations       — invitér bruker
 *   GET    /organizations/:id/members           — medlems-liste
 *   GET    /organizations/:id/invitations       — pending invites
 *   DELETE /organizations/:id/members/:userId   — fjern medlem
 *   PATCH  /organizations/:id/members/:userId   — endre rolle
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

async function requireOrgAdmin(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId],
  );
  return r.rows[0]?.role === "admin";
}

async function isOrgMember(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOrgInviteEmail(args: {
  orgName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const roleLabel =
    args.role === "admin"
      ? "Administrator (full kontroll)"
      : args.role === "viewer"
        ? "Leser (kun visning)"
        : "Medlem (full skrive-tilgang)";
  const subject = `${args.inviterName} har invitert deg til ${args.orgName} på Lead Map`;
  const text = `Hei!

${args.inviterName} har invitert deg til organisasjonen "${args.orgName}" på Lead Map.

Rolle: ${roleLabel}

Som org-medlem får du tilgang til alle prosjekter i ${args.orgName}.

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
          <div style="font-size:14px;color:#c084fc;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">ORGANISASJONS-INVITASJON</div>
          <h1 style="margin:0;font-size:22px;color:#1a1a1a;line-height:1.3;">
            ${escapeHtml(args.inviterName)} har invitert deg til <span style="color:#c084fc;">${escapeHtml(args.orgName)}</span>
          </h1>
        </td></tr>
        <tr><td style="padding:20px 32px;">
          <p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.6;">
            Du har fått tilgang til organisasjonen med rollen
            <strong style="color:#c084fc;">${escapeHtml(roleLabel)}</strong>.
            Som medlem får du tilgang til alle prosjekter i organisasjonen.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 24px;">
          <a href="${escapeHtml(args.acceptUrl)}"
             style="display:inline-block;padding:14px 28px;background:#c084fc;color:#0a0a0f;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;">
            Aksepter invitasjon
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
            Lenken er gyldig i 7 dager. Hvis du ikke kjenner igjen ${escapeHtml(args.inviterName)} eller ${escapeHtml(args.orgName)}, ignorér denne e-posten.
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

export function registerLeadMapOrgRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /organizations ──────────────────────────────────────────
  // Liste organisasjoner brukeren er medlem av
  app.get(
    "/api/admin-room/lead-map/organizations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{
          id: string; name: string; slug: string | null;
          plan: string; org_type: string;
          logo_url: string | null;
          role: string; member_count: number;
          project_count: number;
        }>(
          `SELECT o.id::text, o.name, o.slug, o.plan, o.org_type,
                  o.logo_url,
                  om.role,
                  (SELECT COUNT(*)::int FROM organization_members
                    WHERE organization_id = o.id) AS member_count,
                  (SELECT COUNT(*)::int FROM casting_projects
                    WHERE organization_id = o.id) AS project_count
             FROM organizations o
             JOIN organization_members om ON om.organization_id = o.id
            WHERE om.user_id = $1
            ORDER BY
              CASE o.org_type WHEN 'developer' THEN 1 ELSE 2 END,
              o.created_at ASC`,
          [session.userId],
        );
        return res.json({
          organizations: r.rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            plan: row.plan,
            orgType: row.org_type,
            logoUrl: row.logo_url,
            role: row.role,
            memberCount: row.member_count,
            projectCount: row.project_count,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id ──────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await isOrgMember(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        const r = await pool.query<{
          id: string; name: string; slug: string | null;
          plan: string; org_type: string;
          logo_url: string | null; brand_color: string | null;
          meta: Record<string, unknown>;
          created_at: string;
        }>(
          `SELECT id::text, name, slug, plan, org_type,
                  logo_url, brand_color, meta, created_at::text
             FROM organizations WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "not_found" });
        return res.json({ organization: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "detail_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /organizations ─────────────────────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const body = req.body as { name?: string; slug?: string };
      if (!body.name?.trim()) {
        return res.status(400).json({ error: "navn_kreves" });
      }
      try {
        const orgRes = await pool.query<{ id: string }>(
          `INSERT INTO organizations (name, slug, owner_user_id)
           VALUES ($1, $2, $3) RETURNING id::text`,
          [body.name.trim(), body.slug?.trim() ?? null, session.userId],
        );
        const orgId = orgRes.rows[0].id;
        // Opprett-brukeren blir admin
        await pool.query(
          `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
           VALUES ($1, $2, 'admin', $2)`,
          [orgId, session.userId],
        );
        return res.json({ ok: true, organizationId: orgId });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("organizations_slug_key")) {
          return res.status(409).json({ error: "slug_finnes_allerede" });
        }
        return res.status(500).json({ error: "create_failed", detail: msg });
      }
    },
  );

  // ─── GET /organizations/:id/members ──────────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/members",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await isOrgMember(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        const r = await pool.query<{
          id: string; user_id: string; role: string;
          joined_at: string; last_active_at: string | null;
          user_name: string | null; user_email: string | null;
        }>(
          `SELECT om.id::text, om.user_id, om.role,
                  om.joined_at::text, om.last_active_at::text,
                  u.name AS user_name, u.email AS user_email
             FROM organization_members om
             LEFT JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = $1
            ORDER BY
              CASE om.role
                WHEN 'admin' THEN 1
                WHEN 'member' THEN 2
                WHEN 'viewer' THEN 3
                ELSE 4
              END,
              om.joined_at ASC`,
          [req.params.id],
        );
        return res.json({
          members: r.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            role: row.role,
            joinedAt: row.joined_at,
            lastActiveAt: row.last_active_at,
            userName: row.user_name,
            userEmail: row.user_email,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "members_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /organizations/:id/invitations ─────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOrgAdmin(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "kun_admin_kan_invitere" });
      }
      const body = req.body as {
        email?: string;
        role?: string;
        sales_team_id?: string;
      };
      const email = body.email?.trim().toLowerCase();
      const role = body.role ?? "member";
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "ugyldig_email" });
      }
      const VALID_ORG_ROLES = [
        "admin", "salgssjef", "teamleder",
        "salgskonsulent", "promotor",
        "member", "viewer",
      ];
      if (!VALID_ORG_ROLES.includes(role)) {
        return res.status(400).json({ error: "ugyldig_rolle" });
      }
      try {
        // Sjekk om allerede medlem
        const exists = await pool.query<{ id: string }>(
          `SELECT om.id::text FROM organization_members om
             JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = $1 AND LOWER(u.email) = $2 LIMIT 1`,
          [req.params.id, email],
        );
        if (exists.rows.length > 0) {
          return res.status(409).json({ error: "allerede_medlem" });
        }
        // Org-navn + inviter-navn
        const org = await pool.query<{ name: string }>(
          `SELECT name FROM organizations WHERE id = $1`,
          [req.params.id],
        );
        if (org.rows.length === 0) return res.status(404).json({ error: "org_ikke_funnet" });
        const inviter = await pool.query<{ name: string | null; email: string | null }>(
          `SELECT name, email FROM users WHERE id = $1`,
          [session.userId],
        );
        const inviterName = inviter.rows[0]?.name?.trim()
          || inviter.rows[0]?.email
          || "En bruker";
        const token = crypto.randomBytes(32).toString("base64url");
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO project_invitations (
             organization_id, email, role, sales_team_id, token, invited_by, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
           RETURNING id::text`,
          [req.params.id, email, role, body.sales_team_id ?? null, token, session.userId],
        );
        const invitationId = ins.rows[0].id;
        const acceptUrl = `https://theroleroom.com/lead-map/accept?token=${token}`;
        const { subject, html, text } = buildOrgInviteEmail({
          orgName: org.rows[0].name,
          inviterName,
          role,
          acceptUrl,
        });
        const result = await sendTransactionalEmail({
          to: email,
          subject,
          html,
          text,
          kind: "lead_map_org_invite",
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
            result.sent ? "sent" : (result.reason ?? "failed"),
            result.messageId ?? null,
          ],
        );
        return res.json({
          ok: true,
          invitationId,
          emailSent: result.sent,
          emailReason: result.sent ? null : result.reason,
        });
      } catch (err) {
        return res.status(500).json({ error: "invite_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/invitations ──────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await isOrgMember(pool, session.userId, req.params.id))) {
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
                  u.name AS inviter_name
             FROM project_invitations pi
             LEFT JOIN users u ON u.id = pi.invited_by
            WHERE pi.organization_id = $1
              AND pi.accepted_at IS NULL
              AND pi.expires_at > NOW()
            ORDER BY pi.invited_at DESC`,
          [req.params.id],
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

  // ─── DELETE /organizations/:id/members/:userId ───────────────────
  app.delete(
    "/api/admin-room/lead-map/organizations/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOrgAdmin(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "kun_admin_kan_fjerne" });
      }
      // Beskytt mot å fjerne siste admin
      if (req.params.userId === session.userId) {
        const admins = await pool.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM organization_members
            WHERE organization_id = $1 AND role = 'admin'`,
          [req.params.id],
        );
        if ((admins.rows[0]?.n ?? 0) <= 1) {
          return res.status(409).json({ error: "siste_admin_kan_ikke_fjernes" });
        }
      }
      try {
        await pool.query(
          `DELETE FROM organization_members
            WHERE organization_id = $1 AND user_id = $2`,
          [req.params.id, req.params.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "remove_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /organizations/:id/members/:userId ────────────────────
  app.patch(
    "/api/admin-room/lead-map/organizations/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOrgAdmin(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "kun_admin_kan_endre" });
      }
      const body = req.body as { role?: string };
      if (!body.role || !["admin", "member", "viewer"].includes(body.role)) {
        return res.status(400).json({ error: "ugyldig_rolle" });
      }
      try {
        await pool.query(
          `UPDATE organization_members
              SET role = $3
            WHERE organization_id = $1 AND user_id = $2`,
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
          email: string; role: string;
          expires_at: string; accepted_at: string | null;
          organization_id: string | null; project_id: string | null;
          org_name: string | null; project_name: string | null;
          inviter_name: string | null;
        }>(
          `SELECT pi.email, pi.role, pi.expires_at::text, pi.accepted_at::text,
                  pi.organization_id::text, pi.project_id,
                  o.name AS org_name,
                  cp.name AS project_name,
                  u.name AS inviter_name
             FROM project_invitations pi
             LEFT JOIN organizations o ON o.id = pi.organization_id
             LEFT JOIN casting_projects cp ON cp.id = pi.project_id
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
          targetType: row.organization_id ? "organization" : "project",
          targetName: row.org_name ?? row.project_name,
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
          id: string; organization_id: string | null; project_id: string | null;
          email: string; role: string; sales_team_id: string | null;
          expires_at: string; accepted_at: string | null;
        }>(
          `SELECT id::text, organization_id::text, project_id, email, role,
                  sales_team_id::text, expires_at::text, accepted_at::text
             FROM project_invitations WHERE token = $1 LIMIT 1`,
          [req.params.token],
        );
        if (invRes.rows.length === 0) return res.status(404).json({ error: "ugyldig_token" });
        const inv = invRes.rows[0];
        if (inv.accepted_at) return res.status(409).json({ error: "allerede_akseptert" });
        if (new Date(inv.expires_at) < new Date()) {
          return res.status(410).json({ error: "utlopt" });
        }
        if (session.email && session.email.toLowerCase() !== inv.email.toLowerCase()) {
          return res.status(403).json({ error: "feil_bruker" });
        }
        if (inv.organization_id) {
          await pool.query(
            `INSERT INTO organization_members (
               organization_id, user_id, role, sales_team_id
             ) VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, user_id) DO UPDATE
               SET role = EXCLUDED.role,
                   sales_team_id = EXCLUDED.sales_team_id`,
            [inv.organization_id, session.userId, inv.role, inv.sales_team_id],
          );
        } else if (inv.project_id) {
          await pool.query(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
            [inv.project_id, session.userId, inv.role],
          );
        }
        await pool.query(
          `UPDATE project_invitations
              SET accepted_at = NOW(), accepted_by_user_id = $2
            WHERE id = $1`,
          [inv.id, session.userId],
        );
        return res.json({
          ok: true,
          target: inv.organization_id ? "organization" : "project",
          targetId: inv.organization_id ?? inv.project_id,
          role: inv.role,
        });
      } catch (err) {
        return res.status(500).json({ error: "accept_failed", detail: String(err) });
      }
    },
  );
}
