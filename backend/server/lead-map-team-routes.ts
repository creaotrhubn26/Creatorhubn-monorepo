/**
 * lead-map-team-routes.ts
 *
 * Multi-bruker-tilgang til Leadgrid-prosjekter via de tenant-bundne
 * leadgrid_project_members/leadgrid_project_invitations-tabellene. E-post sendes
 * (eller Gmail SMTP-fallback) gjennom sendTransactionalEmail.
 *
 * Endepunkter:
 *   GET    /projects/:id/members              — liste m/ rolle + sist aktiv
 *   POST   /projects/:id/invitations          — invitér e-post + rolle
 *   GET    /projects/:id/invitations          — pending/accepted status
 *   DELETE /projects/:id/invitations/:invId   — kanseller invitasjon
 *   DELETE /projects/:id/members/:userId      — fjern medlem
 *   PATCH  /projects/:id/members/:userId      — endre rolle
 *   POST   /invitations/:token/accept         — aksepter (krever auth)
 *   GET    /invitations/:token                — preview invitasjon (ingen auth)
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";

import { leadgridPublicOrigin } from "./leadgrid-public-origin.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

async function requireAccessibleProject(
  pool: Pick<Pool, "query">,
  res: Response,
  userId: string,
  projectId: string,
): Promise<LeadgridAccessibleProject | null> {
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return project;
}

/** Creator is always an owner; explicit owners retain delegated management. */
async function callerOwnsProject(
  pool: Pick<Pool, "query">,
  userId: string,
  project: LeadgridAccessibleProject,
): Promise<boolean> {
  if (project.createdBy === userId) return true;
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM leadgrid_project_members
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND user_id = $3
      LIMIT 1`,
    [project.organizationId, project.id, userId],
  );
  return r.rows[0]?.role === "owner";
}

async function callerIsSuperAdmin(
  pool: Pick<Pool, "query">,
  userId: string,
): Promise<boolean> {
  const result = await pool.query<{ is_super_admin: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM users WHERE id = $1 AND role = 'super_admin'
     ) AS is_super_admin`,
    [userId],
  );
  return result.rows[0]?.is_super_admin === true;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  invited_at: string;
  last_active_at: string | null;
  user_name: string | null;
  user_email: string | null;
  is_prototype_tester: boolean;
  storage_policy: "organization" | "disabled";
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
    isPrototypeTester: r.is_prototype_tester,
    storagePolicy: r.storage_policy,
  };
}

export function buildLeadgridProjectInviteEmail(args: {
  projectName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  isPrototypeTester?: boolean;
  storagePolicy?: "organization" | "disabled";
}): { subject: string; html: string; text: string } {
  const roleLabel =
    args.role === "owner"
      ? "Eier"
      : args.role === "viewer"
        ? "Leser (kun visning)"
        : "Medlem";
  const accessSummary = args.storagePolicy === "disabled"
    ? "Filopplasting er deaktivert"
    : "Filer bruker organisasjonens delte lagring";
  const testerSummary = args.isPrototypeTester
    ? "Du er invitert som prototype-tester for dette prosjektet."
    : "";
  const subject = `${args.inviterName} har invitert deg til Leadgrid: ${args.projectName}`;
  const text = `Hei!

${args.inviterName} har invitert deg til prosjektet "${args.projectName}" på Leadgrid.

Rolle: ${roleLabel}
${testerSummary ? `\n${testerSummary}` : ""}
Lagring: ${accessSummary}

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
          <div style="font-size:14px;color:#c084fc;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">LEADGRID-INVITASJON</div>
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
          ${args.isPrototypeTester ? `<p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.6;"><strong>Prototype-tester:</strong> Du får tidlig tilgang i dette prosjektet.</p>` : ""}
          <p style="margin:0;font-size:14px;color:#444;line-height:1.6;"><strong>Lagring:</strong> ${escapeHtml(accessSummary)}.</p>
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
            Leadgrid · leadgrid.no
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, projectId);
        if (!project) return;

        const r = await pool.query<MemberRow>(
          `SELECT pm.id::text, pm.user_id, pm.role,
                  pm.invited_at::text, pm.last_active_at::text,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name,
                  u.email AS user_email, pm.is_prototype_tester, pm.storage_policy
             FROM leadgrid_project_members pm
             LEFT JOIN users u ON u.id = pm.user_id
            WHERE pm.organization_id = $1::uuid
              AND pm.project_id = $2
            ORDER BY
              CASE pm.role
                WHEN 'owner' THEN 1
                WHEN 'member' THEN 2
                WHEN 'viewer' THEN 3
                ELSE 4
              END,
              pm.invited_at ASC`,
          [project.organizationId, projectId],
        );
        return res.json({ members: r.rows.map(rowToMember) });
      } catch (err) {
        return res.status(500).json({ error: "members_failed", detail: "internal_error" });
      }
    },
  );

  // ─── GET /projects/:id/invitations (active history) ──────────────
  app.get(
    "/api/admin-room/lead-map/projects/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, projectId);
        if (!project) return;

        const r = await pool.query<{
          id: string; email: string; role: string;
          invited_at: string; expires_at: string; accepted_at: string | null;
          email_status: string | null;
          organization_role: string | null;
          sales_team_id: string | null;
          sales_team_role: string | null;
          inviter_name: string | null;
          is_prototype_tester: boolean;
          storage_policy: "organization" | "disabled";
          setup_managed_by_super_admin: boolean;
        }>(
          `SELECT pi.id::text, pi.email, pi.role,
                  pi.invited_at::text, pi.expires_at::text, pi.accepted_at::text,
                  pi.email_status, pi.organization_role,
                  pi.sales_team_id, pi.sales_team_role,
                  pi.is_prototype_tester, pi.storage_policy,
                  pi.setup_managed_by_super_admin,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS inviter_name
             FROM leadgrid_project_invitations pi
             LEFT JOIN users u ON u.id = pi.invited_by
            WHERE pi.organization_id = $1::uuid
              AND pi.project_id = $2
              AND (pi.accepted_at IS NOT NULL OR pi.expires_at > NOW())
            ORDER BY pi.invited_at DESC
            LIMIT 100`,
          [project.organizationId, projectId],
        );
        return res.json({
          invitations: r.rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            invitedAt: row.invited_at,
            expiresAt: row.expires_at,
            acceptedAt: row.accepted_at,
            status: row.accepted_at ? "accepted" : "pending",
            emailStatus: row.email_status,
            organizationRole: row.organization_role,
            salesTeamId: row.sales_team_id,
            salesTeamRole: row.sales_team_role,
            inviterName: row.inviter_name,
            isPrototypeTester: row.is_prototype_tester,
            storagePolicy: row.storage_policy,
            setupManagedBySuperAdmin: row.setup_managed_by_super_admin,
          })),
        });
      } catch (err) {
        return res.status(500).json({ error: "invitations_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /projects/:id/invitations ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/projects/:id/invitations",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, projectId);
        if (!project) return;
        const isSuperAdmin = await callerIsSuperAdmin(pool, session.userId);
        if (!(await callerOwnsProject(pool, session.userId, project)) && !isSuperAdmin) {
          return res.status(403).json({ error: "kun_eier_kan_invitere" });
        }
        const body = req.body as {
          email?: string;
          role?: string;
          sales_team_id?: string;
          sales_team_role?: string;
          is_prototype_tester?: unknown;
          use_organization_storage?: unknown;
          storage_policy?: unknown;
        };
        const email = body.email?.trim().toLowerCase();
        const role = body.role ?? "member";
        const salesTeamId = body.sales_team_id?.trim() || null;
        const salesTeamRole = body.sales_team_role ?? null;
        const isPrototypeTester = body.is_prototype_tester === true;
        const storagePolicy = body.storage_policy === "disabled"
          || body.use_organization_storage === false
          ? "disabled"
          : "organization";
        const hasSuperAdminSetup = body.is_prototype_tester !== undefined
          || body.use_organization_storage !== undefined
          || body.storage_policy !== undefined;
        if (hasSuperAdminSetup && !isSuperAdmin) {
          return res.status(403).json({ error: "prototype_og_lagringsoppsett_krever_superadmin" });
        }
        if (!email || !email.includes("@")) {
          return res.status(400).json({ error: "ugyldig_email" });
        }
        if (!["owner", "member", "viewer"].includes(role)) {
          return res.status(400).json({ error: "ugyldig_rolle" });
        }
        if ((salesTeamId === null) !== (salesTeamRole === null)) {
          return res.status(400).json({ error: "team_og_teamrolle_kreves_sammen" });
        }
        if (salesTeamRole && !["leader", "member"].includes(salesTeamRole)) {
          return res.status(400).json({ error: "ugyldig_teamrolle" });
        }
        if (salesTeamId) {
          const linkedTeam = await pool.query(
            `SELECT 1
               FROM leadgrid_project_sales_teams project_team
               JOIN leadgrid_sales_teams team
                 ON team.organization_id = project_team.organization_id::text
                AND team.id = project_team.sales_team_id
              WHERE project_team.organization_id = $1::uuid
                AND project_team.project_id = $2
                AND project_team.sales_team_id = $3
              LIMIT 1`,
            [project.organizationId, projectId, salesTeamId],
          );
          if (linkedTeam.rows.length === 0) {
            return res.status(400).json({ error: "team_ikke_koblet_til_prosjekt" });
          }
        }

        // Sjekk om e-post allerede er medlem
        const exists = await pool.query<{ id: string }>(
          `SELECT pm.id::text FROM leadgrid_project_members pm
             LEFT JOIN users u ON u.id = pm.user_id
            WHERE pm.organization_id = $1::uuid
              AND pm.project_id = $2 AND LOWER(u.email) = $3 LIMIT 1`,
          [project.organizationId, projectId, email],
        );
        if (exists.rows.length > 0) {
          return res.status(409).json({ error: "allerede_medlem" });
        }

        // Hent inviter-navn for email-template. Prosjektet kom fra ACL-oppslaget.
        const inviter = await pool.query<{ name: string | null; email: string | null }>(
          `SELECT name, email FROM users WHERE id = $1 LIMIT 1`,
          [session.userId],
        );
        const inviterName = inviter.rows[0]?.name?.trim()
          || inviter.rows[0]?.email
          || "En bruker";

        const token = crypto.randomBytes(32).toString("base64url");
        const ins = await pool.query<{ id: string }>(
           `INSERT INTO leadgrid_project_invitations (
             organization_id, project_id, email, role, sales_team_id,
             sales_team_role, is_prototype_tester, storage_policy,
             setup_managed_by_super_admin, token, invited_by, expires_at
           ) VALUES (
             $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             NOW() + INTERVAL '7 days'
           )
           RETURNING id::text`,
          [
            project.organizationId,
            projectId,
            email,
            role,
            salesTeamId,
            salesTeamRole,
            isPrototypeTester,
            storagePolicy,
            isSuperAdmin && hasSuperAdminSetup,
            token,
            session.userId,
          ],
        );
        const invitationId = ins.rows[0].id;

        // Send email
        const acceptUrl = `${leadgridPublicOrigin()}/lead-map/accept?token=${encodeURIComponent(token)}`;
        const { subject, html, text } = buildLeadgridProjectInviteEmail({
          projectName: project.name,
          inviterName,
          role,
          acceptUrl,
          isPrototypeTester,
          storagePolicy,
        });
        const emailResult = await sendTransactionalEmail({
          to: email,
          subject,
          html,
          text,
          fromLabel: "Leadgrid",
          kind: "lead_map_team_invite",
          projectId,
          sentByUserId: session.userId,
          pool,
        });
        await pool.query(
          `UPDATE leadgrid_project_invitations
              SET email_status = $2,
                  email_provider_message_id = $3
            WHERE id = $1
              AND organization_id = $4::uuid
              AND project_id = $5`,
          [
            invitationId,
            emailResult.sent ? "sent" : (emailResult.reason ?? "failed"),
            emailResult.messageId ?? null,
            project.organizationId,
            projectId,
          ],
        );
        if (isSuperAdmin && hasSuperAdminSetup) {
          await pool.query(
            `INSERT INTO superadmin_audit_log (
               super_admin_id, action, target_org_id, details, ip_address, user_agent
             ) VALUES ($1, 'configure_leadgrid_project_invite', $2::uuid,
                       $3::jsonb, $4, $5)`,
            [
              session.userId,
              project.organizationId,
              JSON.stringify({
                invitationId,
                projectId,
                email,
                role,
                isPrototypeTester,
                storagePolicy,
              }),
              req.ip ?? null,
              req.get("user-agent") ?? null,
            ],
          );
        }

        return res.json({
          ok: true,
          invitationId,
          emailSent: emailResult.sent,
          emailReason: emailResult.sent ? null : emailResult.reason,
          emailStatus: emailResult.sent ? "sent" : (emailResult.reason ?? "failed"),
          isPrototypeTester,
          storagePolicy,
          setupManagedBySuperAdmin: isSuperAdmin && hasSuperAdminSetup,
        });
      } catch (err) {
        return res.status(500).json({ error: "invite_failed", detail: "internal_error" });
      }
    },
  );

  // ─── DELETE /projects/:id/invitations/:invId ─────────────────────
  app.delete(
    "/api/admin-room/lead-map/projects/:id/invitations/:invId",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, req.params.id);
        if (!project) return;
        if (!(await callerOwnsProject(pool, session.userId, project))) {
          return res.status(403).json({ error: "kun_eier_kan_kansellere" });
        }

        await pool.query(
          `DELETE FROM leadgrid_project_invitations
            WHERE id = $1
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [req.params.invId, project.organizationId, project.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "cancel_failed", detail: "internal_error" });
      }
    },
  );

  // ─── DELETE /projects/:id/members/:userId ────────────────────────
  app.delete(
    "/api/admin-room/lead-map/projects/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const projectId = req.params.id;
      const targetUserId = req.params.userId;
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, projectId);
        if (!project) return;
        if (!(await callerOwnsProject(pool, session.userId, project))) {
          return res.status(403).json({ error: "kun_eier_kan_fjerne" });
        }
        if (targetUserId === project.createdBy) {
          return res.status(409).json({ error: "prosjektoppretter_kan_ikke_fjernes" });
        }
        // Ikke tillat at en eier fjerner siste eier
        if (targetUserId === session.userId) {
          const owners = await pool.query<{ n: number }>(
            `SELECT COUNT(*)::int AS n FROM leadgrid_project_members
              WHERE organization_id = $1::uuid
                AND project_id = $2 AND role = 'owner'`,
            [project.organizationId, projectId],
          );
          if ((owners.rows[0]?.n ?? 0) <= 1) {
            return res.status(409).json({ error: "siste_eier_kan_ikke_fjernes" });
          }
        }

        await pool.query(
          `DELETE FROM leadgrid_project_members
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND user_id = $3`,
          [project.organizationId, projectId, targetUserId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "remove_failed", detail: "internal_error" });
      }
    },
  );

  // ─── PATCH /projects/:id/members/:userId ─────────────────────────
  app.patch(
    "/api/admin-room/lead-map/projects/:id/members/:userId",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const project = await requireAccessibleProject(pool, res, session.userId, req.params.id);
        if (!project) return;
        const ownsProject = await callerOwnsProject(pool, session.userId, project);
        const isSuperAdmin = await callerIsSuperAdmin(pool, session.userId);
        const body = req.body as {
          role?: string;
          is_prototype_tester?: unknown;
          use_organization_storage?: unknown;
          storage_policy?: unknown;
        };
        const hasRoleChange = body.role !== undefined;
        const hasSuperAdminSetup = body.is_prototype_tester !== undefined
          || body.use_organization_storage !== undefined
          || body.storage_policy !== undefined;
        if (!hasRoleChange && !hasSuperAdminSetup) {
          return res.status(400).json({ error: "ingen_endringer" });
        }
        if (hasRoleChange && !ownsProject) {
          return res.status(403).json({ error: "kun_eier_kan_endre_rolle" });
        }
        if (hasSuperAdminSetup && !isSuperAdmin) {
          return res.status(403).json({ error: "prototype_og_lagringsoppsett_krever_superadmin" });
        }
        if (hasRoleChange && !["owner", "member", "viewer"].includes(body.role ?? "")) {
          return res.status(400).json({ error: "ugyldig_rolle" });
        }
        if (hasRoleChange && req.params.userId === project.createdBy && body.role !== "owner") {
          return res.status(409).json({
            error: "prosjektoppretter_ma_forbli_eier",
          });
        }

        const isPrototypeTester = body.is_prototype_tester === true;
        const storagePolicy = body.storage_policy === "disabled"
          || body.use_organization_storage === false
          ? "disabled"
          : "organization";

        await pool.query(
          `UPDATE leadgrid_project_members
              SET role = CASE WHEN $4::text IS NULL THEN role ELSE $4 END,
                  is_prototype_tester = CASE WHEN $5 THEN $6 ELSE is_prototype_tester END,
                  storage_policy = CASE WHEN $5 THEN $7 ELSE storage_policy END
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND user_id = $3`,
          [
            project.organizationId,
            project.id,
            req.params.userId,
            body.role ?? null,
            hasSuperAdminSetup,
            isPrototypeTester,
            storagePolicy,
          ],
        );
        if (hasSuperAdminSetup) {
          await pool.query(
            `UPDATE organization_members
                SET leadgrid_is_prototype_tester = $3,
                    leadgrid_storage_policy = $4
              WHERE organization_id = $1::uuid
                AND user_id = $2`,
            [project.organizationId, req.params.userId, isPrototypeTester, storagePolicy],
          );
          await pool.query(
            `INSERT INTO superadmin_audit_log (
               super_admin_id, action, target_org_id, details, ip_address, user_agent
             ) VALUES ($1, 'configure_leadgrid_project_member', $2::uuid,
                       $3::jsonb, $4, $5)`,
            [
              session.userId,
              project.organizationId,
              JSON.stringify({
                projectId: project.id,
                targetUserId: req.params.userId,
                isPrototypeTester,
                storagePolicy,
              }),
              req.ip ?? null,
              req.get("user-agent") ?? null,
            ],
          );
        }
        return res.json({
          ok: true,
          role: body.role ?? null,
          isPrototypeTester: hasSuperAdminSetup ? isPrototypeTester : undefined,
          storagePolicy: hasSuperAdminSetup ? storagePolicy : undefined,
        });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: "internal_error" });
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
          target_type: "organization" | "project";
          target_name: string | null; inviter_name: string | null;
          accepted_at: string | null;
          is_prototype_tester: boolean;
          storage_policy: "organization" | "disabled";
        }>(
          `WITH matching_invitation AS (
             SELECT pi.email, pi.role, pi.expires_at, pi.accepted_at,
                    pi.is_prototype_tester, pi.storage_policy,
                    'project'::text AS target_type,
                    project.name AS target_name,
                    NULLIF(TRIM(CONCAT_WS(' ', inviter.first_name, inviter.last_name)), '') AS inviter_name,
                    0 AS priority
               FROM leadgrid_project_invitations pi
               JOIN leadgrid_projects project
                 ON project.organization_id = pi.organization_id
                AND project.id = pi.project_id
               LEFT JOIN users inviter ON inviter.id = pi.invited_by
              WHERE pi.token = $1
             UNION ALL
             SELECT pi.email, pi.role, pi.expires_at, pi.accepted_at,
                    FALSE AS is_prototype_tester, 'organization'::text AS storage_policy,
                    'organization'::text AS target_type,
                    organization.name AS target_name,
                    NULLIF(TRIM(CONCAT_WS(' ', inviter.first_name, inviter.last_name)), '') AS inviter_name,
                    1 AS priority
               FROM project_invitations pi
               JOIN organizations organization ON organization.id = pi.organization_id
               LEFT JOIN users inviter ON inviter.id = pi.invited_by
              WHERE pi.token = $1
                AND pi.organization_id IS NOT NULL
           )
           SELECT email, role, expires_at::text, accepted_at::text,
                  is_prototype_tester, storage_policy,
                  target_type, target_name, inviter_name
             FROM matching_invitation
            ORDER BY priority
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
          targetType: row.target_type,
          targetName: row.target_name,
          inviterName: row.inviter_name,
          expiresAt: row.expires_at,
          isPrototypeTester: row.is_prototype_tester,
          storagePolicy: row.storage_policy,
        });
      } catch (err) {
        return res.status(500).json({ error: "preview_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /invitations/:token/accept ────────────────────────────
  app.post(
    "/api/lead-map/invitations/:token/accept",
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      let client: PoolClient | null = null;
      try {
        client = await pool.connect();
        await client.query("BEGIN");

        const userResult = await client.query<{ email: string | null }>(
          `SELECT LOWER(NULLIF(TRIM(email), '')) AS email
             FROM users
            WHERE id = $1
            LIMIT 1`,
          [session.userId],
        );
        const verifiedEmail = userResult.rows[0]?.email;
        if (!verifiedEmail) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "konto_epost_mangler" });
        }

        const invRes = await client.query<{
          id: string; organization_id: string; project_id: string; email: string;
          role: string; expires_at: string; accepted_at: string | null;
          organization_role: string | null; sales_team_id: string | null;
          sales_team_role: string | null;
          is_prototype_tester: boolean; storage_policy: "organization" | "disabled";
          setup_managed_by_super_admin: boolean;
        }>(
          `SELECT pi.id::text, pi.organization_id::text, pi.project_id, pi.email, pi.role,
                  pi.expires_at::text, pi.accepted_at::text,
                  pi.organization_role, pi.sales_team_id, pi.sales_team_role,
                  pi.is_prototype_tester, pi.storage_policy,
                  pi.setup_managed_by_super_admin
             FROM leadgrid_project_invitations pi
             JOIN leadgrid_projects p
               ON p.organization_id = pi.organization_id
              AND p.id = pi.project_id
            WHERE pi.token = $1
              AND p.organization_id IS NOT NULL
              AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
            LIMIT 1
              FOR UPDATE OF pi`,
          [req.params.token],
        );
        if (invRes.rows.length === 0) {
          const orgInvitation = await client.query<{
            id: string; organization_id: string; email: string; role: string;
            sales_team_id: string | null; expires_at: string; accepted_at: string | null;
          }>(
            `SELECT pi.id::text, pi.organization_id::text, pi.email, pi.role,
                    pi.sales_team_id::text, pi.expires_at::text, pi.accepted_at::text
               FROM project_invitations pi
               JOIN organizations organization ON organization.id = pi.organization_id
              WHERE pi.token = $1
                AND pi.organization_id IS NOT NULL
              LIMIT 1
                FOR UPDATE OF pi`,
            [req.params.token],
          );
          if (orgInvitation.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "ugyldig_token" });
          }

          const invitation = orgInvitation.rows[0];
          if (invitation.accepted_at) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "allerede_akseptert" });
          }
          if (new Date(invitation.expires_at) < new Date()) {
            await client.query("ROLLBACK");
            return res.status(410).json({ error: "utlopt" });
          }
          if (verifiedEmail !== invitation.email.trim().toLowerCase()) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "feil_bruker" });
          }

          const membership = await client.query<{ role: string }>(
            `INSERT INTO organization_members (
               organization_id, user_id, role, sales_team_id
             ) VALUES ($1::uuid, $2, $3, $4::uuid)
             ON CONFLICT (organization_id, user_id) DO UPDATE
               SET role = CASE
                     WHEN organization_members.role = 'admin' THEN 'admin'
                     ELSE EXCLUDED.role
                   END,
                   sales_team_id = EXCLUDED.sales_team_id
             RETURNING role`,
            [invitation.organization_id, session.userId, invitation.role, invitation.sales_team_id],
          );
          await client.query(
            `UPDATE project_invitations
                SET accepted_at = NOW(), accepted_by_user_id = $2
              WHERE id = $1
                AND organization_id = $3::uuid
                AND accepted_at IS NULL`,
            [invitation.id, session.userId, invitation.organization_id],
          );
          await client.query("COMMIT");
          return res.json({
            ok: true,
            target: "organization",
            targetId: invitation.organization_id,
            role: membership.rows[0]?.role ?? invitation.role,
          });
        }
        const inv = invRes.rows[0];
        if (inv.accepted_at) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "allerede_akseptert" });
        }
        if (new Date(inv.expires_at) < new Date()) {
          await client.query("ROLLBACK");
          return res.status(410).json({ error: "utlopt" });
        }
        if (verifiedEmail !== inv.email.trim().toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "feil_bruker" });
        }

        // Normal project invites receive the narrow baseline role. Customer
        // onboarding invites may explicitly designate an organization admin.
        const organizationRole = inv.organization_role === "admin"
          ? "admin"
          : inv.organization_role === "viewer" || inv.role === "viewer"
            ? "viewer"
            : "member";
        const invitationIsPrototypeTester = inv.is_prototype_tester === true;
        const invitationStoragePolicy = inv.storage_policy === "disabled"
          ? "disabled"
          : "organization";
        const setupManagedBySuperAdmin = inv.setup_managed_by_super_admin === true;
        await client.query(
          `INSERT INTO organization_members (
             organization_id, user_id, role,
             leadgrid_is_prototype_tester, leadgrid_storage_policy
           )
           VALUES ($1::uuid, $2, $3, $4, $5)
           ON CONFLICT (organization_id, user_id) DO UPDATE SET
             role = CASE
               WHEN organization_members.role = 'admin' OR EXCLUDED.role = 'admin' THEN 'admin'
               WHEN organization_members.role = 'viewer' AND EXCLUDED.role = 'member' THEN 'member'
               ELSE organization_members.role
             END,
             leadgrid_is_prototype_tester = CASE
               WHEN $6 THEN EXCLUDED.leadgrid_is_prototype_tester
               ELSE organization_members.leadgrid_is_prototype_tester
             END,
             leadgrid_storage_policy = CASE
               WHEN $6 THEN EXCLUDED.leadgrid_storage_policy
               ELSE organization_members.leadgrid_storage_policy
             END`,
          [
            inv.organization_id,
            session.userId,
            organizationRole,
            invitationIsPrototypeTester,
            invitationStoragePolicy,
            setupManagedBySuperAdmin,
          ],
        );

        const membership = await client.query<{ role: string }>(
          `INSERT INTO leadgrid_project_members
             (organization_id, project_id, user_id, role, invited_by,
              is_prototype_tester, storage_policy)
           VALUES ($1::uuid, $2, $3, $4, NULL, $5, $6)
           ON CONFLICT (organization_id, project_id, user_id) DO UPDATE
             SET role = CASE
               WHEN leadgrid_project_members.role = 'owner' THEN 'owner'
               ELSE EXCLUDED.role
             END,
                 is_prototype_tester = CASE
                   WHEN $7 THEN EXCLUDED.is_prototype_tester
                   ELSE leadgrid_project_members.is_prototype_tester
                 END,
                 storage_policy = CASE
                   WHEN $7 THEN EXCLUDED.storage_policy
                   ELSE leadgrid_project_members.storage_policy
                 END
           RETURNING role`,
          [
            inv.organization_id,
            inv.project_id,
            session.userId,
            inv.role,
            invitationIsPrototypeTester,
            invitationStoragePolicy,
            setupManagedBySuperAdmin,
          ],
        );
        if (inv.sales_team_id && inv.sales_team_role === "leader") {
          await client.query(
            `UPDATE leadgrid_sales_teams team
                SET leader_user_id = $4::text,
                    member_user_ids = COALESCE(member_user_ids, '[]'::jsonb) - $4::text,
                    updated_at = NOW()
              WHERE team.organization_id = $1
                AND team.id = $2
                AND EXISTS (
                  SELECT 1 FROM leadgrid_project_sales_teams project_team
                   WHERE project_team.organization_id = $1::uuid
                     AND project_team.project_id = $3
                     AND project_team.sales_team_id = team.id
                )`,
            [inv.organization_id, inv.sales_team_id, inv.project_id, session.userId],
          );
        } else if (inv.sales_team_id && inv.sales_team_role === "member") {
          await client.query(
            `UPDATE leadgrid_sales_teams team
                SET member_user_ids = CASE
                      WHEN COALESCE(member_user_ids, '[]'::jsonb) @> to_jsonb(ARRAY[$4]::text[])
                        THEN COALESCE(member_user_ids, '[]'::jsonb)
                      ELSE COALESCE(member_user_ids, '[]'::jsonb) || to_jsonb(ARRAY[$4]::text[])
                    END,
                    updated_at = NOW()
              WHERE team.organization_id = $1
                AND team.id = $2
                AND EXISTS (
                  SELECT 1 FROM leadgrid_project_sales_teams project_team
                   WHERE project_team.organization_id = $1::uuid
                     AND project_team.project_id = $3
                     AND project_team.sales_team_id = team.id
                )`,
            [inv.organization_id, inv.sales_team_id, inv.project_id, session.userId],
          );
        }
        if (organizationRole === "admin") {
          await client.query(
            `UPDATE organizations
                SET owner_user_id = $2, contact_email = COALESCE(NULLIF(contact_email, ''), $3),
                    updated_at = NOW()
              WHERE id = $1::uuid`,
            [inv.organization_id, session.userId, verifiedEmail],
          );
        }
        await client.query(
          `UPDATE leadgrid_project_invitations
              SET accepted_at = NOW(),
                  accepted_by_user_id = $2
            WHERE id = $1
              AND organization_id = $3::uuid
              AND project_id = $4
              AND accepted_at IS NULL`,
          [inv.id, session.userId, inv.organization_id, inv.project_id],
        );
        await client.query("COMMIT");
        return res.json({
          ok: true,
          target: "project",
          targetId: inv.project_id,
          projectId: inv.project_id,
          role: membership.rows[0]?.role ?? inv.role,
          organizationRole,
          salesTeamId: inv.sales_team_id,
          salesTeamRole: inv.sales_team_role,
          isPrototypeTester: invitationIsPrototypeTester,
          storagePolicy: invitationStoragePolicy,
          setupManagedBySuperAdmin,
        });
      } catch (err) {
        if (client) await client.query("ROLLBACK").catch(() => undefined);
        return res.status(500).json({ error: "accept_failed", detail: "internal_error" });
      } finally {
        client?.release();
      }
    },
  );
}
