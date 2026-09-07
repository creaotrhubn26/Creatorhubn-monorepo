/**
 * lead-map-org-routes.ts
 *
 * Organisasjons-håndtering for Lead Map. En organisasjon er et
 * paraply-objekt over flere prosjekter. Prosjekttilgang avgjøres separat
 * av direkte prosjektmedlemskap og den effektive projects.view_all-
 * tillatelsen.
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
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { leadgridPublicOrigin } from "./leadgrid-public-origin.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

export const VALID_ORGANIZATION_MEMBER_ROLES = [
  "admin",
  "salgssjef",
  "teamleder",
  "salgskonsulent",
  "promotor",
  "markedssjef",
  "markedskoordinator",
  "seo_spesialist",
  "content_ansvarlig",
  "performance_marketer",
  "markedsanalytiker",
  "member",
  "viewer",
] as const;

const VALID_ORGANIZATION_MEMBER_ROLE_SET = new Set<string>(
  VALID_ORGANIZATION_MEMBER_ROLES,
);

export function isValidOrganizationMemberRole(
  role: unknown,
): role is (typeof VALID_ORGANIZATION_MEMBER_ROLES)[number] {
  return typeof role === "string" && VALID_ORGANIZATION_MEMBER_ROLE_SET.has(role);
}

// RT-5: tynn wrapper rundt sentral resolveLeadMapSession (DB-fallback
// ved cache-miss).
async function getUser(
  req: Request,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  return resolveLeadMapSession(req, pool, activeSessions);
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
  const subject = `${args.inviterName} har invitert deg til ${args.orgName} på Leadgrid`;
  const text = `Hei!

${args.inviterName} har invitert deg til organisasjonen "${args.orgName}" på Leadgrid.

Rolle: ${roleLabel}

Som org-medlem får du tilgang til arbeidsområdet og prosjektene du er tildelt
eller har tillatelse til å se i ${args.orgName}.

Klikk her for å akseptere invitasjonen og logge inn:
${args.acceptUrl}

Lenken er gyldig i 7 dager.

— Leadgrid · leadgrid.no`;
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
            Prosjekttilgang styres av hvilke prosjekter du er tildelt og
            tillatelsene dine i organisasjonen.
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
            Leadgrid · leadgrid.no
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
      const session = await getUser(req, pool, activeSessions);
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
                  (SELECT COUNT(*)::int FROM leadgrid_projects
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
        return res.status(500).json({ error: "list_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /organizations/:id ──────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
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
        return res.status(500).json({ error: "detail_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /organizations ─────────────────────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
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
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await isOrgMember(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "ikke_medlem" });
      }
      try {
        // NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') eksisterer ikke — users-tabellen har first_name + last_name.
        // COALESCE bygger displayName fra det vi har.
        const r = await pool.query<{
          id: string; user_id: string; role: string;
          joined_at: string; last_active_at: string | null;
          user_name: string | null; user_email: string | null;
        }>(
          `SELECT om.id::text, om.user_id, om.role,
                  om.joined_at::text, om.last_active_at::text,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name,
                  u.email AS user_email
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
        // Graceful: tabell/kolonne mangler → tom liste (iPad: "Ingen medlemmer").
        console.warn("[lead-map members] failed:", (err as Error).message);
        return res.json({ members: [] });
      }
    },
  );

  // ─── POST /organizations/:id/invitations ─────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/invitations",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
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
      if (!isValidOrganizationMemberRole(role)) {
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
        const acceptUrl = `${leadgridPublicOrigin()}/lead-map/accept?token=${encodeURIComponent(token)}`;
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
          fromLabel: "Leadgrid",
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
        return res.status(500).json({ error: "invite_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /organizations/:id/invitations ──────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/invitations",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
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
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS inviter_name
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
        console.warn("[lead-map invitations] failed:", (err as Error).message);
        return res.json({ invitations: [] });
      }
    },
  );

  // ─── DELETE /organizations/:id/members/:userId ───────────────────
  app.delete(
    "/api/admin-room/lead-map/organizations/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
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
        return res.status(500).json({ error: "remove_failed", detail: "internal_error" });
      }
    },
  );

  // ─── PATCH /organizations/:id/members/:userId ────────────────────
  app.patch(
    "/api/admin-room/lead-map/organizations/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      if (!(await requireOrgAdmin(pool, session.userId, req.params.id))) {
        return res.status(403).json({ error: "kun_admin_kan_endre" });
      }
      const body = req.body as { role?: string };
      if (!isValidOrganizationMemberRole(body.role)) {
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
        return res.status(500).json({ error: "update_failed", detail: "internal_error" });
      }
    },
  );
}
