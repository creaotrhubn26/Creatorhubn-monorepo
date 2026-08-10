/**
 * role-room-education-productions-routes.ts — mountes under /api/role-room.
 *
 * STUDENTPRODUKSJONER: kobler et kull til et EKTE Role Room-prosjekt
 * (casting_projects). Selve prosjektet opprettes av klienten via den vanlige
 * createProject-flyten (POST /api/role-room/projects) — denne ruten lagrer bare
 * koblingen (kull ↔ project_id) etter å ha verifisert at prosjektet eies av
 * innlogget bruker. Slik gjenbruker vi hele Role Room-verktøyet (story-arc,
 * casting, call-sheet, leveranser) i stedet for en parallell entitet.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/productions        (?cohortId= filter)
 *   POST   /api/role-room/education/productions         ({title, cohortId?, projectId})
 *   DELETE /api/role-room/education/productions/:id      (fjerner KOBLINGEN, ikke prosjektet)
 *
 * Auth: Bearer-token → resolveUser (samme mønster som education-cohorts-routes).
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { newEntityId } from "./_shared-ids.js";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export interface ProductionView {
  id: string;
  cohortId: string | null;
  projectId: string;
  title: string;
  projectStatus: string | null;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
}

function productionRowToView(r: Record<string, unknown>): ProductionView {
  return {
    id: String(r.id),
    cohortId: r.cohort_id ? String(r.cohort_id) : null,
    projectId: String(r.project_id),
    title: (r.title as string) ?? "",
    projectStatus: (r.project_status as string) ?? null,
    assignmentCount: Number(r.assignment_count ?? 0),
    createdAt: isoOrNull(r.created_at) ?? "",
    updatedAt: isoOrNull(r.updated_at) ?? "",
  };
}

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

/**
 * Kjernen i POST /education/productions — trukket ut slik at andre ruter
 * (LTI deep-link-response) kan opprette en ekte produksjon uten å duplisere
 * eierskaps-/insert-logikken. Uten projectId opprettes et EKTE casting_projects
 * (faglærer = created_by); MED projectId må prosjektet allerede eies av brukeren
 * (kaster "project_not_found" ellers).
 */
export async function createEducationProductionRow(
  pool: Pool,
  ownerId: string,
  input: { title: string; cohortId?: string | null; projectId?: string },
): Promise<Record<string, unknown>> {
  let projectId = input.projectId?.trim() || "";
  if (projectId) {
    const owns = await pool.query(`SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2`, [projectId, ownerId]);
    if (owns.rows.length === 0) throw new Error("project_not_found");
  } else {
    projectId = newEntityId("project");
    await pool.query(
      `INSERT INTO casting_projects (id, name, status, created_by, created_at, updated_at)
       VALUES ($1, $2, 'active', $3, now(), now())`,
      [projectId, input.title, ownerId],
    );
  }
  const id = newEntityId("edprod");
  const r = await pool.query(
    `INSERT INTO role_room_education_productions (id, owner_user_id, cohort_id, project_id, title)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *, 0 AS assignment_count, NULL AS project_status`,
    [id, ownerId, input.cohortId || null, projectId, input.title],
  );
  return r.rows[0];
}

export interface CreateEducationProductionsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationProductionsRouter(
  pool: Pool,
  deps: CreateEducationProductionsRouterDeps = {},
): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };
  const uid = (req: Request) => (req as Request & { userId: string }).userId;

  router.get("/education/productions", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      const r = await pool.query(
        `SELECT p.*,
                cp.status AS project_status,
                (SELECT COUNT(*)::int FROM role_room_education_assignments a WHERE a.production_id = p.id) AS assignment_count
           FROM role_room_education_productions p
           LEFT JOIN casting_projects cp ON cp.id = p.project_id
          WHERE p.owner_user_id = $1
            AND ($2::text IS NULL OR p.cohort_id = $2)
          ORDER BY p.created_at DESC`,
        [uid(req), cohortId],
      );
      res.json({ productions: r.rows.map(productionRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ productions: [] }); return; }
      console.warn("[education-productions] list failed:", (err as Error).message);
      res.json({ productions: [] });
    }
  });

  router.post("/education/productions", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { title?: string; cohortId?: string | null; projectId?: string };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const givenProjectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    try {
      const row = await createEducationProductionRow(pool, uid(req), { title, cohortId: body.cohortId, projectId: givenProjectId });
      res.status(201).json({ production: productionRowToView(row) });
    } catch (err) {
      if ((err as Error).message === "project_not_found") { res.status(404).json({ error: "project_not_found" }); return; }
      console.error("[education-productions] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.delete("/education/productions/:id", requireAuth, async (req, res) => {
    try {
      // Fjerner KUN koblingen — det ekte Role Room-prosjektet blir liggende
      // (studentenes arbeid slettes ikke; prosjektet finnes i vanlig Role Room).
      const r = await pool.query(
        `DELETE FROM role_room_education_productions WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-productions] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  return router;
}
