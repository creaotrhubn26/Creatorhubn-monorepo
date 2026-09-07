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
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import {
  requestedLeadMapProjectId,
  resolveLeadMapProjectScope,
  sendLeadMapProjectScopeError,
} from "./lead-map-project-scope.js";

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
  pool: Pool,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [orgId, userId],
  );
  return r.rows[0]?.role ?? null;
}

const CAN_CREATE_ROLES = new Set(["admin", "salgssjef", "teamleder"]);

interface AnnotationScope {
  id: string;
  organizationId: string;
  projectId: string | null;
  createdByUserId: string;
}

type OptionalIdResult = { ok: true; value: string | null } | { ok: false };

type OptionalLeadResult =
  | { ok: true; value: string | null; projectId: string | null }
  | { ok: false };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadAnnotationScope(
  pool: Pool,
  annotationId: string,
): Promise<AnnotationScope | null> {
  if (!UUID_PATTERN.test(annotationId)) return null;
  const result = await pool.query<{
    id: string;
    organization_id: string;
    project_id: string | null;
    created_by_user_id: string;
  }>(
    `SELECT id::text, organization_id::text, project_id,
            created_by_user_id
       FROM map_annotations
      WHERE id = $1::uuid
      LIMIT 1`,
    [annotationId],
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        organizationId: row.organization_id,
        projectId: row.project_id,
        createdByUserId: row.created_by_user_id,
      }
    : null;
}

async function authorizeAnnotation(
  pool: Pool,
  userId: string,
  annotationId: string,
  mode: "edit" | "delete",
  res: Response,
): Promise<AnnotationScope | null> {
  const annotation = await loadAnnotationScope(pool, annotationId);
  if (!annotation) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  if (annotation.projectId) {
    const project = await loadAccessibleLeadgridProject(
      pool,
      annotation.projectId,
      userId,
    );
    if (!project || project.organizationId !== annotation.organizationId) {
      res.status(404).json({ error: "not_found" });
      return null;
    }
  }
  const role = await getMemberRole(pool, userId, annotation.organizationId);
  const isCreator = annotation.createdByUserId === userId;
  const allowed =
    mode === "delete"
      ? role === "admin"
      : Boolean(role && (CAN_CREATE_ROLES.has(role) || isCreator));
  if (!allowed) {
    res.status(403).json({
      error: mode === "delete" ? "kun_admin_kan_slette" : "ikke_tillatt",
    });
    return null;
  }
  return annotation;
}

async function validateAssignee(
  pool: Pool,
  organizationId: string,
  rawUserId: unknown,
  res: Response,
): Promise<OptionalIdResult> {
  if (rawUserId === undefined || rawUserId === null) {
    return { ok: true, value: null };
  }
  if (typeof rawUserId !== "string" || !rawUserId.trim()) {
    res.status(400).json({ error: "ugyldig_assigned_to_user_id" });
    return { ok: false };
  }
  const userId = rawUserId.trim();
  const member = await pool.query(
    `SELECT 1
       FROM organization_members
      WHERE organization_id = $1::uuid
        AND user_id = $2
      LIMIT 1`,
    [organizationId, userId],
  );
  if (!member.rows.length) {
    res.status(400).json({ error: "assignee_not_in_organization" });
    return { ok: false };
  }
  return { ok: true, value: userId };
}

async function validateTargetLead(
  pool: Pool,
  userId: string,
  organizationId: string,
  projectId: string | null,
  rawLeadId: unknown,
  res: Response,
): Promise<OptionalLeadResult> {
  if (rawLeadId === undefined || rawLeadId === null) {
    return { ok: true, value: null, projectId };
  }
  if (typeof rawLeadId !== "string" || !rawLeadId.trim()) {
    res.status(400).json({ error: "ugyldig_target_lead_id" });
    return { ok: false };
  }
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: rawLeadId.trim(),
    userId,
  });
  if (!lead) {
    res.status(404).json({ error: "target_lead_not_found" });
    return { ok: false };
  }
  if (
    lead.organizationId !== organizationId ||
    (projectId !== null && lead.projectId !== projectId)
  ) {
    res.status(400).json({ error: "target_lead_scope_mismatch" });
    return { ok: false };
  }
  return { ok: true, value: lead.id, projectId: lead.projectId };
}
export function registerLeadMapAnnotationRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  // ─── GET /organizations/:id/annotations ─────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/annotations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const role = await getMemberRole(pool, session.userId, req.params.id);
        if (!role) return res.status(403).json({ error: "ikke_medlem" });
        const requestedProjectId = requestedLeadMapProjectId(req);
        const scope = await resolveLeadMapProjectScope(pool, {
          userId: session.userId,
          organizationId: req.params.id,
          requestedProjectId,
        });
        const includeArchived = req.query.include_archived === "true";
        const assignedToMeOnly = req.query.assigned_to_me_only === "true";
        const restrictToMe =
          assignedToMeOnly || role === "salgskonsulent" || role === "promotor";
        const params: unknown[] = [scope.organizationId, scope.projectId];
        let restrictClause = "";
        if (restrictToMe) {
          restrictClause =
            "AND (a.assigned_to_user_id = $3 OR a.assigned_to_user_id IS NULL)";
          params.push(session.userId);
        }
        const archivedClause = includeArchived
          ? ""
          : "AND a.archived_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > NOW())";
        const result = await pool.query(
          `SELECT a.id::text, a.organization_id::text, a.project_id,
                  a.created_by_user_id, a.annotation_type, a.geometry,
                  a.title, a.body, a.color, a.stroke_width,
                  a.assigned_to_user_id, a.target_lead_id,
                  a.expires_at::text, a.archived_at::text, a.meta,
                  a.created_at::text, a.updated_at::text,
                  NULLIF(TRIM(CONCAT_WS(' ', creator.first_name, creator.last_name)), '') AS created_by_name,
                  NULLIF(TRIM(CONCAT_WS(' ', assignee.first_name, assignee.last_name)), '') AS assigned_to_name,
                  target_lead.name AS target_lead_name
             FROM map_annotations a
             LEFT JOIN users creator ON creator.id = a.created_by_user_id
             LEFT JOIN users assignee ON assignee.id = a.assigned_to_user_id
             LEFT JOIN crm_customers target_lead
               ON target_lead.id = a.target_lead_id
              AND target_lead.organization_id = a.organization_id
              AND target_lead.project_id IS NOT DISTINCT FROM a.project_id
            WHERE a.organization_id = $1::uuid
              AND a.project_id IS NOT DISTINCT FROM $2
              ${archivedClause}
              ${restrictClause}
            ORDER BY a.created_at DESC
            LIMIT 200`,
          params,
        );
        return res.json({
          annotations: result.rows,
          canCreate: CAN_CREATE_ROLES.has(role),
        });
      } catch (err) {
        if (sendLeadMapProjectScopeError(err, res)) return;
        return res
          .status(500)
          .json({ error: "list_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /organizations/:id/annotations ────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/annotations",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const body = req.body as Record<string, unknown>;
      if (
        typeof body.annotation_type !== "string" ||
        !VALID_TYPES.has(body.annotation_type)
      ) {
        return res.status(400).json({ error: "ugyldig_type" });
      }
      if (!body.geometry || typeof body.geometry !== "object") {
        return res.status(400).json({ error: "mangler_geometry" });
      }
      try {
        const role = await getMemberRole(pool, session.userId, req.params.id);
        if (!role || !CAN_CREATE_ROLES.has(role)) {
          return res.status(403).json({ error: "ikke_tillatt_opprette" });
        }
        const requestedProjectId = requestedLeadMapProjectId(req);
        const requestedScope = await resolveLeadMapProjectScope(pool, {
          userId: session.userId,
          organizationId: req.params.id,
          requestedProjectId,
        });
        if (!requestedScope.organizationId) {
          return res.status(404).json({ error: "project_not_found" });
        }
        const targetLead = await validateTargetLead(
          pool,
          session.userId,
          requestedScope.organizationId,
          requestedScope.projectId,
          body.target_lead_id,
          res,
        );
        if (!targetLead.ok) return;
        const projectId = requestedScope.projectId ?? targetLead.projectId;
        const assignee = await validateAssignee(
          pool,
          requestedScope.organizationId,
          body.assigned_to_user_id,
          res,
        );
        if (!assignee.ok) return;
        const result = await pool.query<{ id: string }>(
          `INSERT INTO map_annotations (
             organization_id, project_id, created_by_user_id,
             annotation_type, geometry, title, body, color, stroke_width,
             assigned_to_user_id, target_lead_id, expires_at
           )
           SELECT $1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8, $9,
                  $10, $11::uuid, $12::timestamptz
            WHERE (
              $10::text IS NULL
              OR EXISTS (
                SELECT 1 FROM organization_members member
                 WHERE member.organization_id = $1::uuid
                   AND member.user_id = $10
              )
            )
              AND (
                $11::uuid IS NULL
                OR EXISTS (
                  SELECT 1 FROM crm_customers target_lead
                   WHERE target_lead.id = $11::uuid
                     AND target_lead.organization_id = $1::uuid
                     AND target_lead.project_id IS NOT DISTINCT FROM $2
                )
              )
           RETURNING id::text`,
          [
            requestedScope.organizationId,
            projectId,
            session.userId,
            body.annotation_type,
            JSON.stringify(body.geometry),
            typeof body.title === "string" ? body.title : null,
            typeof body.body === "string" ? body.body : null,
            typeof body.color === "string" ? body.color : "#c084fc",
            typeof body.stroke_width === "number" ? body.stroke_width : 3.0,
            assignee.value,
            targetLead.value,
            typeof body.expires_at === "string" ? body.expires_at : null,
          ],
        );
        const id = result.rows[0]?.id;
        if (!id) {
          return res.status(409).json({ error: "annotation_scope_changed" });
        }
        return res.json({ ok: true, id });
      } catch (err) {
        if (sendLeadMapProjectScopeError(err, res)) return;
        return res
          .status(500)
          .json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );

  // ─── PATCH /annotations/:id ─────────────────────────────────────
  app.patch(
    "/api/admin-room/lead-map/annotations/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const annotation = await authorizeAnnotation(
          pool,
          session.userId,
          req.params.id,
          "edit",
          res,
        );
        if (!annotation) return;
        const body = req.body as Record<string, unknown>;
        const normalized = { ...body };
        if ("assigned_to_user_id" in body) {
          const assignee = await validateAssignee(
            pool,
            annotation.organizationId,
            body.assigned_to_user_id,
            res,
          );
          if (!assignee.ok) return;
          normalized.assigned_to_user_id = assignee.value;
        }
        if ("target_lead_id" in body) {
          const targetLead = await validateTargetLead(
            pool,
            session.userId,
            annotation.organizationId,
            annotation.projectId,
            body.target_lead_id,
            res,
          );
          if (!targetLead.ok) return;
          if (
            targetLead.value &&
            targetLead.projectId !== annotation.projectId
          ) {
            return res
              .status(400)
              .json({ error: "target_lead_scope_mismatch" });
          }
          normalized.target_lead_id = targetLead.value;
        }
        const allowed = [
          "title",
          "body",
          "color",
          "stroke_width",
          "assigned_to_user_id",
          "target_lead_id",
          "expires_at",
          "geometry",
        ];
        const sets: string[] = [];
        const values: unknown[] = [
          annotation.id,
          annotation.organizationId,
          annotation.projectId,
        ];
        let index = 4;
        for (const key of allowed) {
          if (key in normalized) {
            sets.push(`${key} = $${index++}`);
            values.push(normalized[key]);
          }
        }
        if (sets.length === 0) return res.json({ ok: true, updated: 0 });
        const updated = await pool.query(
          `UPDATE map_annotations
              SET ${sets.join(", ")}, updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id IS NOT DISTINCT FROM $3
          RETURNING id`,
          values,
        );
        if (!updated.rows.length) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true, updated: sets.length });
      } catch (err) {
        return res
          .status(500)
          .json({ error: "update_failed", detail: "internal_error" });
      }
    },
  );

  // ─── POST /annotations/:id/archive ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/annotations/:id/archive",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const annotation = await authorizeAnnotation(
          pool,
          session.userId,
          req.params.id,
          "edit",
          res,
        );
        if (!annotation) return;
        const updated = await pool.query(
          `UPDATE map_annotations
              SET archived_at = NOW(),
                  archived_by_user_id = $4
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id IS NOT DISTINCT FROM $3
          RETURNING id`,
          [
            annotation.id,
            annotation.organizationId,
            annotation.projectId,
            session.userId,
          ],
        );
        if (!updated.rows.length) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (err) {
        return res
          .status(500)
          .json({ error: "archive_failed", detail: "internal_error" });
      }
    },
  );

  // ─── DELETE /annotations/:id (hard slett — admin only) ──────────
  app.delete(
    "/api/admin-room/lead-map/annotations/:id",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      try {
        const annotation = await authorizeAnnotation(
          pool,
          session.userId,
          req.params.id,
          "delete",
          res,
        );
        if (!annotation) return;
        const deleted = await pool.query(
          `DELETE FROM map_annotations
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id IS NOT DISTINCT FROM $3
          RETURNING id`,
          [annotation.id, annotation.organizationId, annotation.projectId],
        );
        if (!deleted.rows.length) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (err) {
        return res
          .status(500)
          .json({ error: "delete_failed", detail: "internal_error" });
      }
    },
  );
}
