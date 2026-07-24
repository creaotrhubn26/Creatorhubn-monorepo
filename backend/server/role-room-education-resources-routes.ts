/**
 * role-room-education-resources-routes.ts — mountes under /api/role-room.
 *
 * Utdannings-workspace, opplæringslag 3: FAG-BIBLIOTEK. Faglærer kurerer korte
 * «hvordan»-leksjoner festet til produksjonsstegene (idé/manus → casting →
 * planlegging → opptak → etterarbeid → levering). Owner-scopet: hver
 * institusjon har sitt eget bibliotek.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/resources          (?category= filter)
 *   POST   /api/role-room/education/resources
 *   PATCH  /api/role-room/education/resources/:id
 *   DELETE /api/role-room/education/resources/:id
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

const CATEGORIES = new Set(["idea", "casting", "planning", "shoot", "post", "delivery", "general"]);

export interface ResourceView {
  id: string;
  title: string;
  category: string;
  description: string | null;
  url: string | null;
  body: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
}

function resourceRowToView(r: Record<string, unknown>): ResourceView {
  return {
    id: String(r.id),
    title: (r.title as string) ?? "",
    category: (r.category as string) ?? "general",
    description: (r.description as string) ?? null,
    url: (r.url as string) ?? null,
    body: (r.body as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
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

export interface CreateEducationResourcesRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationResourcesRouter(
  pool: Pool,
  deps: CreateEducationResourcesRouterDeps = {},
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

  router.get("/education/resources", requireAuth, async (req, res) => {
    const category = typeof req.query.category === "string" && CATEGORIES.has(req.query.category)
      ? req.query.category
      : null;
    try {
      const r = await pool.query(
        `SELECT * FROM role_room_education_resources
          WHERE owner_user_id = $1
            AND ($2::text IS NULL OR category = $2)
          ORDER BY category ASC, sort_order ASC, created_at DESC`,
        [uid(req), category],
      );
      res.json({ resources: r.rows.map(resourceRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ resources: [] }); return; }
      console.warn("[education-resources] list failed:", (err as Error).message);
      res.json({ resources: [] });
    }
  });

  router.post("/education/resources", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as {
      title?: string; category?: string; description?: string; url?: string; body?: string; sortOrder?: number;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    const category = body.category && CATEGORIES.has(body.category) ? body.category : "general";
    try {
      const id = newEntityId("edres");
      const r = await pool.query(
        `INSERT INTO role_room_education_resources
           (id, owner_user_id, title, category, description, url, body, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          id, uid(req), title, category,
          body.description?.trim() || null, body.url?.trim() || null,
          body.body?.trim() || null, Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
        ],
      );
      res.status(201).json({ resource: resourceRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-resources] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/resources/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as {
      title?: string; category?: string; description?: string; url?: string; body?: string; sortOrder?: number;
    };
    const category = typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : null;
    try {
      const r = await pool.query(
        `UPDATE role_room_education_resources
            SET title = COALESCE($3, title),
                category = COALESCE($4, category),
                description = COALESCE($5, description),
                url = COALESCE($6, url),
                body = COALESCE($7, body),
                sort_order = COALESCE($8, sort_order),
                updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING *`,
        [
          req.params.id, uid(req),
          typeof body.title === "string" ? body.title.trim() : null,
          category,
          typeof body.description === "string" ? body.description.trim() : null,
          typeof body.url === "string" ? body.url.trim() : null,
          typeof body.body === "string" ? body.body.trim() : null,
          Number.isFinite(body.sortOrder) ? body.sortOrder : null,
        ],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ resource: resourceRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-resources] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/resources/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_resources WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-resources] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  return router;
}
