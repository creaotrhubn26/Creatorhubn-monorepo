/**
 * Operative oppgaver for Admin Workspace.
 *
 * Oppgavene er adminens egen arbeidskø og holdes adskilt fra CRM-, casting-
 * og produksjonsoppgaver. De kan kobles til et adminprosjekt og/eller en sak,
 * men alle koblinger valideres mot innlogget bruker på serveren.
 */

import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, readStringArray } from "./_shared";

const VALID_PRODUCTS = new Set(["role_room", "leadgrid"]);
const VALID_STATUSES = new Set(["inbox", "todo", "in_progress", "waiting", "done", "cancelled"]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ProductKey = "role_room" | "leadgrid";

interface ContextRow {
  id: string;
  title: string;
  product_key: ProductKey | null;
}

class TaskInputError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function validDate(value: unknown): string | null {
  const date = asString(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function normalizedTags(value: unknown): string[] {
  return readStringArray(value)
    .map((tag) => tag.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
}

function nullableUuid(value: unknown, field: string): string | null {
  const id = asString(value);
  if (!id) return null;
  if (!UUID_PATTERN.test(id)) {
    throw new TaskInputError(400, `${field} må være en gyldig UUID`);
  }
  return id;
}

function limitedText(value: unknown, field: string, maxLength: number): string | null {
  const text = asString(value);
  if (text && text.length > maxLength) {
    throw new TaskInputError(400, `${field} kan være maks ${maxLength} tegn`);
  }
  return text;
}

async function resolveContext(
  pool: Pool,
  userId: string,
  requestedProduct: ProductKey | null,
  projectId: string | null,
  caseId: string | null,
): Promise<{ productKey: ProductKey | null; project: ContextRow | null; workspaceCase: ContextRow | null }> {
  const [projectResult, caseResult] = await Promise.all([
    projectId
      ? pool.query<ContextRow>(
          `SELECT id::text, title, product_key
             FROM admin_workspace_projects
            WHERE id = $1 AND user_id = $2`,
          [projectId, userId],
        )
      : Promise.resolve({ rows: [] as ContextRow[] }),
    caseId
      ? pool.query<ContextRow>(
          `SELECT id::text, title, product_key
             FROM admin_workspace_cases
            WHERE id = $1 AND user_id = $2`,
          [caseId, userId],
        )
      : Promise.resolve({ rows: [] as ContextRow[] }),
  ]);

  const project = projectResult.rows[0] ?? null;
  const workspaceCase = caseResult.rows[0] ?? null;
  if (projectId && !project) {
    throw new TaskInputError(404, "Prosjektet finnes ikke eller tilhører en annen bruker");
  }
  if (caseId && !workspaceCase) {
    throw new TaskInputError(404, "Saken finnes ikke eller tilhører en annen bruker");
  }

  const linkedProducts = new Set(
    [project?.product_key, workspaceCase?.product_key].filter(
      (value): value is ProductKey => value === "role_room" || value === "leadgrid",
    ),
  );
  if (linkedProducts.size > 1) {
    throw new TaskInputError(400, "Prosjektet og saken tilhører ulike produkter");
  }
  const linkedProduct = linkedProducts.values().next().value as ProductKey | undefined;
  if (requestedProduct && linkedProduct && requestedProduct !== linkedProduct) {
    throw new TaskInputError(400, "Oppgaven og den koblede konteksten må tilhøre samme produkt");
  }

  return {
    productKey: requestedProduct ?? linkedProduct ?? null,
    project,
    workspaceCase,
  };
}

const TASK_SELECT = `
  SELECT t.*,
         t.due_date::text AS due_date,
         p.title AS project_title,
         c.title AS case_title
    FROM admin_workspace_tasks t
    LEFT JOIN admin_workspace_projects p
      ON p.id = t.project_id AND p.user_id = t.user_id
    LEFT JOIN admin_workspace_cases c
      ON c.id = t.case_id AND c.user_id = t.user_id
`;

async function fetchTask(pool: Pool, id: string, userId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `${TASK_SELECT} WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

function sendTaskError(res: Parameters<AdminRoomRoutesDeps["requireAdminRoomAccess"]>[1], error: unknown): boolean {
  if (!(error instanceof TaskInputError)) return false;
  res.status(error.statusCode).json({ error: error.message });
  return true;
}

export function setupAdminWorkspaceTasksRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  app.get("/api/admin-room/workspace/tasks", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const where = ["t.user_id = $1"];
    const params: unknown[] = [session.userId];
    const product = asString(req.query.product);
    const status = asString(req.query.status);
    const priority = asString(req.query.priority);
    const projectId = asString(req.query.projectId);
    const search = asString(req.query.q);
    const openOnly = String(req.query.openOnly ?? "") === "true";

    if (product === "internal") {
      where.push("t.product_key IS NULL");
    } else if (product && VALID_PRODUCTS.has(product)) {
      params.push(product);
      where.push(`t.product_key = $${params.length}`);
    }
    if (status && VALID_STATUSES.has(status)) {
      params.push(status);
      where.push(`t.status = $${params.length}`);
    } else if (openOnly) {
      where.push("t.status NOT IN ('done', 'cancelled')");
    }
    if (priority && VALID_PRIORITIES.has(priority)) {
      params.push(priority);
      where.push(`t.priority = $${params.length}`);
    }
    if (projectId && UUID_PATTERN.test(projectId)) {
      params.push(projectId);
      where.push(`t.project_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        t.title ILIKE $${params.length}
        OR COALESCE(t.description, '') ILIKE $${params.length}
        OR COALESCE(t.assignee, '') ILIKE $${params.length}
      )`);
    }

    try {
      const result = await pool.query(
        `${TASK_SELECT}
          WHERE ${where.join(" AND ")}
          ORDER BY
            CASE WHEN t.status IN ('done', 'cancelled') THEN 1 ELSE 0 END,
            CASE
              WHEN t.due_date < CURRENT_DATE THEN 0
              WHEN t.due_date = CURRENT_DATE THEN 1
              WHEN t.due_date IS NOT NULL THEN 2
              ELSE 3
            END,
            CASE t.priority
              WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3
            END,
            t.due_date ASC NULLS LAST,
            t.updated_at DESC
          LIMIT 500`,
        params,
      );
      res.json({ items: result.rows });
    } catch (error) {
      console.error("[admin-workspace tasks] list error", error);
      res.status(500).json({ error: "Kunne ikke hente oppgaver" });
    }
  });

  app.get("/api/admin-room/workspace/tasks/options", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const product = asString(req.query.product);
    const productKey = product && VALID_PRODUCTS.has(product) ? product : null;
    const internalOnly = product === "internal";

    try {
      const productClause = internalOnly
        ? "AND product_key IS NULL"
        : productKey
          ? "AND (product_key = $2 OR product_key IS NULL)"
          : "";
      const params = productKey ? [session.userId, productKey] : [session.userId];
      const [projects, cases] = await Promise.all([
        pool.query(
          `SELECT id::text, title, product_key, status
             FROM admin_workspace_projects
            WHERE user_id = $1
              AND status <> 'archived'
              ${productClause}
            ORDER BY updated_at DESC
            LIMIT 200`,
          params,
        ),
        pool.query(
          `SELECT id::text, title, product_key, status
             FROM admin_workspace_cases
            WHERE user_id = $1
              AND status <> 'archived'
              ${productClause}
            ORDER BY updated_at DESC
            LIMIT 200`,
          params,
        ),
      ]);
      res.json({ projects: projects.rows, cases: cases.rows });
    } catch (error) {
      console.error("[admin-workspace tasks] options error", error);
      res.status(500).json({ error: "Kunne ikke hente koblingsvalg" });
    }
  });

  app.get("/api/admin-room/workspace/tasks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig oppgave-ID" });
      return;
    }
    try {
      const item = await fetchTask(pool, req.params.id, session.userId);
      if (!item) {
        res.status(404).json({ error: "Oppgaven finnes ikke" });
        return;
      }
      res.json({ item });
    } catch (error) {
      console.error("[admin-workspace tasks] read error", error);
      res.status(500).json({ error: "Kunne ikke hente oppgaven" });
    }
  });

  app.post("/api/admin-room/workspace/tasks", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      const title = limitedText(body.title, "title", 240);
      if (!title) throw new TaskInputError(400, "title er påkrevd");
      const status = asString(body.status, "todo") ?? "todo";
      const priority = asString(body.priority, "normal") ?? "normal";
      const rawProduct = asString(body.productKey);
      const productKey = rawProduct && VALID_PRODUCTS.has(rawProduct)
        ? rawProduct as ProductKey
        : null;
      if (rawProduct && !VALID_PRODUCTS.has(rawProduct)) {
        throw new TaskInputError(400, "Ugyldig productKey");
      }
      if (!VALID_STATUSES.has(status) || !VALID_PRIORITIES.has(priority)) {
        throw new TaskInputError(400, "Ugyldig status eller prioritet");
      }
      const rawDueDate = asString(body.dueDate);
      const dueDate = rawDueDate ? validDate(rawDueDate) : null;
      if (rawDueDate && !dueDate) {
        throw new TaskInputError(400, "dueDate må være på formatet YYYY-MM-DD");
      }
      const projectId = nullableUuid(body.projectId, "projectId");
      const caseId = nullableUuid(body.caseId, "caseId");
      const context = await resolveContext(pool, session.userId, productKey, projectId, caseId);
      const completedAt = status === "done" ? new Date() : null;

      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO admin_workspace_tasks
          (user_id, product_key, title, description, status, priority, due_date,
           assignee, project_id, case_id, tags, completed_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $1)
         RETURNING id::text`,
        [
          session.userId,
          context.productKey,
          title,
          limitedText(body.description, "description", 20_000),
          status,
          priority,
          dueDate,
          limitedText(body.assignee, "assignee", 160),
          projectId,
          caseId,
          normalizedTags(body.tags),
          completedAt,
        ],
      );
      const item = await fetchTask(pool, inserted.rows[0].id, session.userId);
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_task",
        entityId: inserted.rows[0].id,
        action: "created",
        summary: `Oppgave opprettet: ${title}`,
      });
      res.status(201).json({ item });
    } catch (error) {
      if (sendTaskError(res, error)) return;
      console.error("[admin-workspace tasks] create error", error);
      res.status(500).json({ error: "Kunne ikke opprette oppgave" });
    }
  });

  app.patch("/api/admin-room/workspace/tasks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig oppgave-ID" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      const currentResult = await pool.query<{
        product_key: ProductKey | null;
        project_id: string | null;
        case_id: string | null;
      }>(
        `SELECT product_key, project_id::text, case_id::text
           FROM admin_workspace_tasks
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        res.status(404).json({ error: "Oppgaven finnes ikke" });
        return;
      }

      let requestedProduct = current.product_key;
      if ("productKey" in body) {
        const value = asString(body.productKey);
        if (value && !VALID_PRODUCTS.has(value)) {
          throw new TaskInputError(400, "Ugyldig productKey");
        }
        requestedProduct = value as ProductKey | null;
      }
      const projectId = "projectId" in body
        ? nullableUuid(body.projectId, "projectId")
        : current.project_id;
      const caseId = "caseId" in body
        ? nullableUuid(body.caseId, "caseId")
        : current.case_id;
      const context = await resolveContext(pool, session.userId, requestedProduct, projectId, caseId);

      const sets: string[] = [];
      const params: unknown[] = [];
      const changed: string[] = [];
      const push = (column: string, value: unknown, field: string) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
        changed.push(field);
      };

      if ("title" in body) {
        const title = limitedText(body.title, "title", 240);
        if (!title) throw new TaskInputError(400, "title kan ikke være tom");
        push("title", title, "title");
      }
      if ("description" in body) {
        push("description", limitedText(body.description, "description", 20_000), "description");
      }
      if ("assignee" in body) {
        push("assignee", limitedText(body.assignee, "assignee", 160), "assignee");
      }
      if ("status" in body) {
        const status = asString(body.status);
        if (!status || !VALID_STATUSES.has(status)) {
          throw new TaskInputError(400, "Ugyldig status");
        }
        push("status", status, "status");
        sets.push(status === "done" ? "completed_at = NOW()" : "completed_at = NULL");
      }
      if ("priority" in body) {
        const priority = asString(body.priority);
        if (!priority || !VALID_PRIORITIES.has(priority)) {
          throw new TaskInputError(400, "Ugyldig prioritet");
        }
        push("priority", priority, "priority");
      }
      if ("dueDate" in body) {
        const raw = asString(body.dueDate);
        const dueDate = raw ? validDate(raw) : null;
        if (raw && !dueDate) {
          throw new TaskInputError(400, "dueDate må være på formatet YYYY-MM-DD");
        }
        push("due_date", dueDate, "dueDate");
      }
      if ("tags" in body) push("tags", normalizedTags(body.tags), "tags");
      if (
        "productKey" in body
        || "projectId" in body
        || "caseId" in body
      ) {
        push("product_key", context.productKey, "productKey");
        push("project_id", projectId, "projectId");
        push("case_id", caseId, "caseId");
      }
      if (!sets.length) {
        throw new TaskInputError(400, "Ingen felter å oppdatere");
      }

      sets.push("updated_at = NOW()");
      params.push(session.userId);
      sets.push(`updated_by = $${params.length}`);
      params.push(req.params.id, session.userId);
      await pool.query(
        `UPDATE admin_workspace_tasks
            SET ${sets.join(", ")}
          WHERE id = $${params.length - 1} AND user_id = $${params.length}`,
        params,
      );
      const item = await fetchTask(pool, req.params.id, session.userId);
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_task",
        entityId: req.params.id,
        action: "updated",
        summary: `Oppgave oppdatert: ${String(item?.title ?? req.params.id)} (${changed.join(", ")})`,
      });
      res.json({ item });
    } catch (error) {
      if (sendTaskError(res, error)) return;
      console.error("[admin-workspace tasks] update error", error);
      res.status(500).json({ error: "Kunne ikke oppdatere oppgave" });
    }
  });

  app.delete("/api/admin-room/workspace/tasks/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    if (!UUID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: "Ugyldig oppgave-ID" });
      return;
    }
    try {
      const result = await pool.query<{ id: string; title: string }>(
        `DELETE FROM admin_workspace_tasks
          WHERE id = $1 AND user_id = $2
          RETURNING id::text, title`,
        [req.params.id, session.userId],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "Oppgaven finnes ikke" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_task",
        entityId: result.rows[0].id,
        action: "deleted",
        summary: `Oppgave slettet: ${result.rows[0].title}`,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[admin-workspace tasks] delete error", error);
      res.status(500).json({ error: "Kunne ikke slette oppgave" });
    }
  });
}
