/**
 * lead-map-annotation-routes.ts
 *
 * Kart-annotasjoner (PR #629+). Salgssjef/Teamleder tegner direkte
 * på Lead Map for å vise selgere hvor de skal fokusere.
 *
 *   GET    /organizations/:id/annotations?assigned_to_me_only=&include_archived=
 *   POST   /organizations/:id/annotations
 *   PATCH  /annotations/:id
 *   POST   /annotations/:id/archive
 *   DELETE /annotations/:id
 *
 * Tilgang:
 *   - Lese: alle org-medlemmer
 *   - Opprette/endre: admin, salgssjef, teamleder (m/ permission)
 *   - Egen-tildelte: salgskonsulent ser kun sine + globale
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

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
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

const VALID_TYPES = new Set(["focus_area", "route", "pin_callout", "freehand"]);

/** Sjekk rolle i org */
async function getMemberRole(
  pool: Pool, userId: string, orgId: string,
): Promise<string | null> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [orgId, userId],
  );
  return r.rows[0]?.role ?? null;
}

const CAN_CREATE_ROLES = new Set(["admin", "salgssjef", "teamleder"]);

export function registerLeadMapAnnotationRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /organizations/:id/annotations ─────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/annotations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role) return res.status(403).json({ error: "ikke_medlem" });

      const includeArchived = req.query.include_archived === "true";
      const assignedToMeOnly = req.query.assigned_to_me_only === "true";
      // Salgskonsulent/promotor: scope automatisk til egne + globale
      const restrictToMe = assignedToMeOnly
        || (role === "salgskonsulent" || role === "promotor");

      try {
        const params: unknown[] = [req.params.id];
        let idx = 2;
        let restrictClause = "";
        if (restrictToMe) {
          restrictClause = `AND (a.assigned_to_user_id = $${idx} OR a.assigned_to_user_id IS NULL)`;
          params.push(session.userId);
          idx += 1;
        }
        const archivedClause = includeArchived
          ? ""
          : "AND a.archived_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > NOW())";
        const r = await pool.query(
          `SELECT a.id::text, a.organization_id::text, a.project_id,
                  a.created_by_user_id, a.annotation_type, a.geometry,
                  a.title, a.body, a.color, a.stroke_width,
                  a.assigned_to_user_id, a.target_lead_id,
                  a.expires_at::text, a.archived_at::text, a.meta,
                  a.created_at::text, a.updated_at::text,
                  creator.name AS created_by_name,
                  assignee.name AS assigned_to_name,
                  l.name AS target_lead_name
             FROM map_annotations a
             LEFT JOIN users creator ON creator.id = a.created_by_user_id
             LEFT JOIN users assignee ON assignee.id = a.assigned_to_user_id
             LEFT JOIN crm_customers l ON l.id = a.target_lead_id
            WHERE a.organization_id = $1
              ${archivedClause}
              ${restrictClause}
            ORDER BY a.created_at DESC
            LIMIT 200`,
          params,
        );
        return res.json({ annotations: r.rows, canCreate: CAN_CREATE_ROLES.has(role) });
      } catch (err) {
        return res.status(500).json({ error: "list_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /organizations/:id/annotations ────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/annotations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const role = await getMemberRole(pool, session.userId, req.params.id);
      if (!role || !CAN_CREATE_ROLES.has(role)) {
        return res.status(403).json({ error: "ikke_tillatt_opprette" });
      }
      const body = req.body as {
        annotation_type?: string;
        geometry?: Record<string, unknown>;
        title?: string;
        body?: string;
        color?: string;
        stroke_width?: number;
        assigned_to_user_id?: string;
        target_lead_id?: string;
        project_id?: string;
        expires_at?: string;
      };
      if (!body.annotation_type || !VALID_TYPES.has(body.annotation_type)) {
        return res.status(400).json({ error: "ugyldig_type" });
      }
      if (!body.geometry || typeof body.geometry !== "object") {
        return res.status(400).json({ error: "mangler_geometry" });
      }
      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO map_annotations (
             organization_id, project_id, created_by_user_id,
             annotation_type, geometry, title, body, color, stroke_width,
             assigned_to_user_id, target_lead_id, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id::text`,
          [
            req.params.id,
            body.project_id ?? null,
            session.userId,
            body.annotation_type,
            body.geometry,
            body.title ?? null,
            body.body ?? null,
            body.color ?? "#c084fc",
            body.stroke_width ?? 3.0,
            body.assigned_to_user_id ?? null,
            body.target_lead_id ?? null,
            body.expires_at ?? null,
          ],
        );
        return res.json({ ok: true, id: r.rows[0].id });
      } catch (err) {
        return res.status(500).json({ error: "create_failed", detail: String(err) });
      }
    },
  );

  // ─── PATCH /annotations/:id ─────────────────────────────────────
  app.patch(
    "/api/admin-room/lead-map/annotations/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        // Verifiser at brukeren har rolle som kan endre
        const annot = await pool.query<{
          organization_id: string; created_by_user_id: string;
        }>(
          `SELECT organization_id::text, created_by_user_id
             FROM map_annotations WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (annot.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const role = await getMemberRole(pool, session.userId, annot.rows[0].organization_id);
        const isCreator = annot.rows[0].created_by_user_id === session.userId;
        if (!role || (!CAN_CREATE_ROLES.has(role) && !isCreator)) {
          return res.status(403).json({ error: "ikke_tillatt" });
        }

        const allowed = [
          "title", "body", "color", "stroke_width",
          "assigned_to_user_id", "target_lead_id", "expires_at", "geometry",
        ];
        const body = req.body as Record<string, unknown>;
        const sets: string[] = [];
        const values: unknown[] = [req.params.id];
        let idx = 2;
        for (const key of allowed) {
          if (key in body) {
            sets.push(`${key} = $${idx++}`);
            values.push(body[key]);
          }
        }
        if (sets.length === 0) return res.json({ ok: true, updated: 0 });
        await pool.query(
          `UPDATE map_annotations
              SET ${sets.join(", ")}, updated_at = NOW()
            WHERE id = $1`,
          values,
        );
        return res.json({ ok: true, updated: sets.length });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    },
  );

  // ─── POST /annotations/:id/archive ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/annotations/:id/archive",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const annot = await pool.query<{
          organization_id: string; created_by_user_id: string;
        }>(
          `SELECT organization_id::text, created_by_user_id
             FROM map_annotations WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (annot.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const role = await getMemberRole(pool, session.userId, annot.rows[0].organization_id);
        const isCreator = annot.rows[0].created_by_user_id === session.userId;
        if (!role || (!CAN_CREATE_ROLES.has(role) && !isCreator)) {
          return res.status(403).json({ error: "ikke_tillatt" });
        }
        await pool.query(
          `UPDATE map_annotations
              SET archived_at = NOW(),
                  archived_by_user_id = $2
            WHERE id = $1`,
          [req.params.id, session.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "archive_failed", detail: String(err) });
      }
    },
  );

  // ─── DELETE /annotations/:id (hard slett — admin only) ──────────
  app.delete(
    "/api/admin-room/lead-map/annotations/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const annot = await pool.query<{ organization_id: string }>(
          `SELECT organization_id::text FROM map_annotations WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (annot.rows.length === 0) return res.status(404).json({ error: "not_found" });
        const role = await getMemberRole(pool, session.userId, annot.rows[0].organization_id);
        if (role !== "admin") {
          return res.status(403).json({ error: "kun_admin_kan_slette" });
        }
        await pool.query(
          `DELETE FROM map_annotations WHERE id = $1`,
          [req.params.id],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "delete_failed", detail: String(err) });
      }
    },
  );
}
