/**
 * project-team-routes.ts — Team Workspace deling/medlemskap (Fase 1)
 *
 * Lar et foto/video-prosjekt (public.projects) DELES med flere brukere, slik at
 * fotograf + videograf + editor + lyd samkjører seg i samme workspace. Capture
 * var eier-only på flere nivåer; dette legger et team-scoping-lag over.
 *
 * Tabell: project_team_members (eget id-rom for foto/video — IKKE Lead Map sin
 * project_members). canAccessProject() = eier ELLER aktivt medlem; eksporteres
 * så andre ruter kan åpne sine eier-queries for team-medlemmer.
 *
 * Endpoints:
 *   GET    /api/projects/:projectId/team/members
 *   POST   /api/projects/:projectId/team/invite          (eier)
 *   POST   /api/projects/team/accept/:token              (innlogget bruker)
 *   DELETE /api/projects/:projectId/team/members/:memberId (eier)
 *   GET    /api/projects/:projectId/team/presence        (hvem er online nå)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";

export interface ProjectTeamRoutesDeps {
  app: express.Application;
  pool: any;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name: string; role: string } | null;
  escapeHtml: (value: string) => string;
}

const CREW_ROLES = new Set(["fotograf", "videograf", "begge", "editor", "lyd", "assistent"]);
const MEMBER_ROLES = new Set(["editor", "viewer", "member"]);

let schemaReady: Promise<void> | null = null;
async function ensureProjectTeamSchema(pool: any): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_team_members (
          id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id     VARCHAR(64) NOT NULL,
          user_id        VARCHAR(64),
          email          VARCHAR(255) NOT NULL,
          name           VARCHAR(255),
          role           VARCHAR(20) NOT NULL DEFAULT 'member',
          crew_role      VARCHAR(20),
          permissions    JSONB NOT NULL DEFAULT '{"canRead":true,"canEdit":false}'::jsonb,
          status         VARCHAR(20) NOT NULL DEFAULT 'pending',
          invite_token   VARCHAR(80),
          invited_by     VARCHAR(64),
          invited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          accepted_at    TIMESTAMPTZ,
          deactivated_at TIMESTAMPTZ
        )
      `).catch(() => undefined);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ptm_project_email ON project_team_members (project_id, LOWER(email))`).catch(() => undefined);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ptm_project ON project_team_members (project_id) WHERE deactivated_at IS NULL`).catch(() => undefined);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ptm_user ON project_team_members (user_id) WHERE deactivated_at IS NULL`).catch(() => undefined);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ptm_token ON project_team_members (invite_token)`).catch(() => undefined);
    })();
  }
  return schemaReady;
}

/**
 * Sann hvis brukeren er EIER av prosjektet eller et AKTIVT team-medlem.
 * Eksporteres så andre eier-scopede ruter kan utvides til team-tilgang.
 */
export async function canAccessProject(
  pool: any,
  userId: string,
  projectId: string,
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const owner = await pool.query(
      `SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId],
    );
    if ((owner.rowCount ?? 0) > 0) return true;
    await ensureProjectTeamSchema(pool);
    const member = await pool.query(
      `SELECT 1 FROM project_team_members
        WHERE project_id = $1 AND user_id = $2 AND status = 'active' AND deactivated_at IS NULL
        LIMIT 1`,
      [projectId, userId],
    );
    return (member.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

async function isProjectOwner(pool: any, userId: string, projectId: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM projects WHERE id = $1 AND user_id = $2 LIMIT 1`, [projectId, userId]);
  return (r.rowCount ?? 0) > 0;
}

function getMailer(): ReturnType<typeof nodemailer.createTransport> | null {
  const mailUser = (process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "").trim();
  const mailPass = (process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (!mailUser || !mailPass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user: mailUser, pass: mailPass } });
}

function mapMember(r: any): any {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id || null,
    email: r.email,
    name: r.name || null,
    role: r.role || "member",
    crewRole: r.crew_role || null,
    permissions: r.permissions || { canRead: true, canEdit: false },
    status: r.status || "pending",
    invitedAt: r.invited_at,
    acceptedAt: r.accepted_at || null,
  };
}

export function setupProjectTeamRoutes(deps: ProjectTeamRoutesDeps): void {
  const { app, pool, requireUserSession, escapeHtml } = deps;

  // ─── GET medlemmer ───────────────────────────────────────────
  app.get("/api/projects/:projectId/team/members", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { projectId } = req.params;
      if (!(await canAccessProject(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "Ingen tilgang til prosjektet" });
      }
      await ensureProjectTeamSchema(pool);
      const owner = await pool.query(
        `SELECT p.user_id, u.email, u.first_name, u.last_name
           FROM projects p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.id = $1 LIMIT 1`,
        [projectId],
      );
      const members = await pool.query(
        `SELECT * FROM project_team_members
          WHERE project_id = $1 AND deactivated_at IS NULL
          ORDER BY invited_at ASC`,
        [projectId],
      );
      const ownerRow = owner.rows[0];
      res.json({
        owner: ownerRow ? {
          userId: ownerRow.user_id,
          email: ownerRow.email,
          name: [ownerRow.first_name, ownerRow.last_name].filter(Boolean).join(" ") || ownerRow.email,
          isOwner: true,
        } : null,
        isOwner: ownerRow?.user_id === session.userId,
        members: members.rows.map(mapMember),
      });
    } catch (err) {
      console.error("GET /projects/:id/team/members:", err);
      res.status(500).json({ error: "Kunne ikke hente team" });
    }
  });

  // ─── POST invitér medlem (eier) ──────────────────────────────
  app.post("/api/projects/:projectId/team/invite", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { projectId } = req.params;
      if (!(await isProjectOwner(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "Kun prosjekt-eier kan invitere" });
      }
      await ensureProjectTeamSchema(pool);
      const body = req.body ?? {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const crewRole = typeof body.crewRole === "string" && CREW_ROLES.has(body.crewRole.toLowerCase()) ? body.crewRole.toLowerCase() : null;
      const role = typeof body.role === "string" && MEMBER_ROLES.has(body.role.toLowerCase()) ? body.role.toLowerCase() : "member";
      const canEdit = role !== "viewer";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Gyldig e-post påkrevd" });
      }

      // Allerede invitert/medlem?
      const dup = await pool.query(
        `SELECT id, status FROM project_team_members WHERE project_id = $1 AND LOWER(email) = $2 AND deactivated_at IS NULL LIMIT 1`,
        [projectId, email],
      );
      if ((dup.rowCount ?? 0) > 0) {
        return res.status(409).json({ error: "Denne e-posten er allerede invitert til prosjektet" });
      }

      // Knytt til eksisterende bruker hvis e-posten finnes
      const existingUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [email]);
      const linkedUserId = existingUser.rows[0]?.id || null;

      const token = crypto.randomBytes(24).toString("hex");
      const ins = await pool.query(
        `INSERT INTO project_team_members
           (project_id, user_id, email, name, role, crew_role, permissions, status, invite_token, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', $8, $9)
         RETURNING *`,
        [projectId, linkedUserId, email, name || null, role, crewRole,
         JSON.stringify({ canRead: true, canEdit }), token, session.userId],
      );

      // Prosjektnavn til e-post
      const proj = await pool.query(`SELECT COALESCE(title, name, 'prosjektet') AS title FROM projects WHERE id = $1 LIMIT 1`, [projectId]);
      const projectName = proj.rows[0]?.title || "prosjektet";
      const baseUrl = req.headers.origin || `https://${req.headers.host || "creatorhubn.com"}`;
      const acceptUrl = `${baseUrl}/workspace/${encodeURIComponent(projectId)}?invite=${encodeURIComponent(token)}`;

      const mailer = getMailer();
      if (mailer) {
        const mailUser = process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL || "";
        mailer.sendMail({
          from: `"Creatorhub" <${mailUser}>`,
          to: email,
          subject: `Du er lagt til i teamet for «${projectName}»`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
              <h2 style="margin:0 0 12px;">Hei${name ? " " + escapeHtml(name) : ""},</h2>
              <p style="font-size:15px;line-height:1.6;">Du er invitert til å samarbeide på <b>${escapeHtml(projectName)}</b> i Creatorhub${crewRole ? ` som <b>${escapeHtml(crewRole)}</b>` : ""}.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${acceptUrl}" style="display:inline-block;background:#ff8c00;color:#150d05;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:700;">Åpne workspace</a>
              </div>
              <p style="font-size:12px;color:#888;">Hvis knappen ikke virker: <a href="${acceptUrl}">${acceptUrl}</a></p>
            </div>`,
        }).catch((e) => console.error("[project-team invite] mail failed:", e?.message || e));
      }

      res.status(201).json({ ...mapMember(ins.rows[0]), acceptUrl });
    } catch (err) {
      console.error("POST /projects/:id/team/invite:", err);
      res.status(500).json({ error: "Kunne ikke invitere" });
    }
  });

  // ─── POST aksepter invitasjon ────────────────────────────────
  app.post("/api/projects/team/accept/:token", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { token } = req.params;
      await ensureProjectTeamSchema(pool);
      const row = await pool.query(
        `SELECT * FROM project_team_members WHERE invite_token = $1 AND deactivated_at IS NULL LIMIT 1`,
        [token],
      );
      if (row.rowCount === 0) return res.status(404).json({ error: "Ugyldig eller utløpt invitasjon" });
      const member = row.rows[0];
      const upd = await pool.query(
        `UPDATE project_team_members
            SET user_id = $1, status = 'active', accepted_at = NOW(),
                name = COALESCE(name, $2)
          WHERE id = $3
        RETURNING *`,
        [session.userId, session.name || null, member.id],
      );
      res.json({ success: true, projectId: member.project_id, member: mapMember(upd.rows[0]) });
    } catch (err) {
      console.error("POST /projects/team/accept:", err);
      res.status(500).json({ error: "Kunne ikke akseptere invitasjon" });
    }
  });

  // ─── DELETE medlem (eier) ────────────────────────────────────
  app.delete("/api/projects/:projectId/team/members/:memberId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { projectId, memberId } = req.params;
      if (!(await isProjectOwner(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "Kun prosjekt-eier kan fjerne medlemmer" });
      }
      await ensureProjectTeamSchema(pool);
      await pool.query(
        `UPDATE project_team_members SET status = 'revoked', deactivated_at = NOW()
          WHERE id = $1 AND project_id = $2`,
        [memberId, projectId],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /projects/:id/team/members:", err);
      res.status(500).json({ error: "Kunne ikke fjerne medlem" });
    }
  });

  // ─── GET presence (hvem er online) ───────────────────────────
  app.get("/api/projects/:projectId/team/presence", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { projectId } = req.params;
      if (!(await canAccessProject(pool, session.userId, projectId))) {
        return res.status(403).json({ error: "Ingen tilgang" });
      }
      await ensureProjectTeamSchema(pool);
      // Medlemmer + eier, joinet mot user_presence (online = sett siste 90s)
      const rows = await pool.query(
        `SELECT m.user_id, m.email, m.name, m.crew_role,
                (pr.last_seen_at IS NOT NULL AND pr.last_seen_at > NOW() - INTERVAL '90 seconds') AS online
           FROM project_team_members m
           LEFT JOIN user_presence pr ON pr.user_id = m.user_id
          WHERE m.project_id = $1 AND m.status = 'active' AND m.deactivated_at IS NULL`,
        [projectId],
      ).catch(() => ({ rows: [] }));
      const online = rows.rows.filter((r: any) => r.online).length;
      res.json({
        online,
        members: rows.rows.map((r: any) => ({
          userId: r.user_id, email: r.email, name: r.name, crewRole: r.crew_role, online: !!r.online,
        })),
      });
    } catch (err) {
      console.error("GET /projects/:id/team/presence:", err);
      res.json({ online: 0, members: [] });
    }
  });
}
