/**
 * admin-workspace-cases-routes.ts
 *
 * «Saker»-modul (cases + comments) for AdminWorkspace. En sak er en lett
 * oppfølgings-tråd Daniel åpner for å følge opp en lead, kunde, partner,
 * investor, outreach-template eller funding-app — eller bare en intern
 * påminnelse.
 *
 * Endpoints (alle bak requireAdminRoomAccess):
 *
 *   GET    /api/admin-room/workspace/cases?product=&status=&priority=  — list
 *   GET    /api/admin-room/workspace/cases/:id                          — read + comments
 *   POST   /api/admin-room/workspace/cases                              — create
 *   PATCH  /api/admin-room/workspace/cases/:id                          — update
 *   DELETE /api/admin-room/workspace/cases/:id                          — delete (cascade)
 *   POST   /api/admin-room/workspace/cases/:id/comments                 — add comment
 *   DELETE /api/admin-room/workspace/case-comments/:commentId           — delete comment (own only)
 *
 * Wire opp i index.ts ved å legge til:
 *
 *   import { setupAdminWorkspaceCasesRoutes } from "./admin-workspace-cases-routes";
 *
 *   setupAdminWorkspaceCasesRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString, readStringArray } from "./_shared";

const VALID_STATUS = new Set(["open", "in_progress", "blocked", "done", "archived"]);
const VALID_PRIORITY = new Set(["low", "normal", "high", "urgent"]);
const VALID_PRODUCT = new Set(["role_room", "leadgrid"]);
const VALID_LINKED_ENTITY = new Set([
  "customer",
  "partner",
  "investor",
  "outreach_template",
  "funding_app",
]);

function normalizeProductKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "" || v === "internal" || v === "null") return null;
  return VALID_PRODUCT.has(v) ? v : null;
}

function normalizeLinkedEntityType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "" || v === "null") return null;
  return VALID_LINKED_ENTITY.has(v) ? v : null;
}

export function setupAdminWorkspaceCasesRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // ── List saker (med filter) ─────────────────────────────────────
  app.get("/api/admin-room/workspace/cases", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const productFilter = asString(req.query.product);
    const statusFilter = asString(req.query.status);
    const priorityFilter = asString(req.query.priority);

    const where: string[] = ["user_id = $1"];
    const params: unknown[] = [session.userId];

    if (productFilter !== null) {
      // 'internal' eller 'null' → filtrer på NULL product_key
      if (productFilter === "internal" || productFilter === "null") {
        where.push("product_key IS NULL");
      } else if (VALID_PRODUCT.has(productFilter)) {
        params.push(productFilter);
        where.push(`product_key = $${params.length}`);
      }
    }

    if (statusFilter !== null && VALID_STATUS.has(statusFilter)) {
      params.push(statusFilter);
      where.push(`status = $${params.length}`);
    }

    if (priorityFilter !== null && VALID_PRIORITY.has(priorityFilter)) {
      params.push(priorityFilter);
      where.push(`priority = $${params.length}`);
    }

    try {
      const result = await pool.query(
        `SELECT * FROM admin_workspace_cases
          WHERE ${where.join(" AND ")}
          ORDER BY
            CASE status
              WHEN 'urgent'      THEN 0
              WHEN 'in_progress' THEN 1
              WHEN 'open'        THEN 2
              WHEN 'blocked'     THEN 3
              WHEN 'done'        THEN 4
              WHEN 'archived'    THEN 5
              ELSE 6
            END,
            CASE priority
              WHEN 'urgent' THEN 0
              WHEN 'high'   THEN 1
              WHEN 'normal' THEN 2
              WHEN 'low'    THEN 3
              ELSE 4
            END,
            COALESCE(due_date, '9999-12-31'::date) ASC,
            updated_at DESC`,
        params,
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[admin-workspace cases] list error", err);
      res.status(500).json({ error: "Kunne ikke hente saker" });
    }
  });

  // ── Hent én sak + kommentarer ───────────────────────────────────
  app.get("/api/admin-room/workspace/cases/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const caseResult = await pool.query(
        `SELECT * FROM admin_workspace_cases WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (caseResult.rowCount === 0) {
        res.status(404).json({ error: "Sak ikke funnet" });
        return;
      }

      const commentsResult = await pool.query(
        `SELECT * FROM admin_workspace_case_comments
          WHERE case_id = $1
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      res.json({ item: caseResult.rows[0], comments: commentsResult.rows });
    } catch (err) {
      console.error("[admin-workspace cases] read error", err);
      res.status(500).json({ error: "Kunne ikke hente sak" });
    }
  });

  // ── Opprett sak ────────────────────────────────────────────────
  app.post("/api/admin-room/workspace/cases", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const title = asString(body.title);
    if (!title) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }

    const status = asString(body.status, "open");
    if (status === null || !VALID_STATUS.has(status)) {
      res.status(400).json({ error: `Ugyldig status. Tillatte: ${[...VALID_STATUS].join(", ")}` });
      return;
    }

    const priority = asString(body.priority, "normal");
    if (priority === null || !VALID_PRIORITY.has(priority)) {
      res.status(400).json({ error: `Ugyldig priority. Tillatte: ${[...VALID_PRIORITY].join(", ")}` });
      return;
    }

    const productKey = normalizeProductKey(body.productKey);
    const linkedEntityType = normalizeLinkedEntityType(body.linkedEntityType);
    const linkedEntityId = linkedEntityType ? asString(body.linkedEntityId) : null;
    const dueDate = asString(body.dueDate);
    const bodyText = asString(body.body);
    const tags = readStringArray(body.tags);

    try {
      const result = await pool.query(
        `INSERT INTO admin_workspace_cases
          (user_id, product_key, title, body, status, priority, due_date,
           linked_entity_type, linked_entity_id, tags, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1)
          RETURNING *`,
        [
          session.userId,
          productKey,
          title,
          bodyText,
          status,
          priority,
          dueDate,
          linkedEntityType,
          linkedEntityId,
          tags,
        ],
      );

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_case",
        entityId: result.rows[0].id,
        action: "created",
        summary: `[${productKey ?? "intern"}] Sak opprettet: ${title}`,
      });

      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-workspace cases] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette sak" });
    }
  });

  // ── Oppdater sak ───────────────────────────────────────────────
  app.patch("/api/admin-room/workspace/cases/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const sets: string[] = [];
    const params: unknown[] = [];
    const changedFields: string[] = [];

    const push = (sqlExpr: string, value: unknown, fieldName: string) => {
      params.push(value);
      sets.push(`${sqlExpr} = $${params.length}`);
      changedFields.push(fieldName);
    };

    if ("title" in body) {
      const title = asString(body.title);
      if (!title) {
        res.status(400).json({ error: "title kan ikke være tomt" });
        return;
      }
      push("title", title, "title");
    }

    if ("body" in body) {
      push("body", asString(body.body), "body");
    }

    if ("status" in body) {
      const status = asString(body.status);
      if (status === null || !VALID_STATUS.has(status)) {
        res.status(400).json({ error: `Ugyldig status. Tillatte: ${[...VALID_STATUS].join(", ")}` });
        return;
      }
      push("status", status, "status");
    }

    if ("priority" in body) {
      const priority = asString(body.priority);
      if (priority === null || !VALID_PRIORITY.has(priority)) {
        res.status(400).json({ error: `Ugyldig priority. Tillatte: ${[...VALID_PRIORITY].join(", ")}` });
        return;
      }
      push("priority", priority, "priority");
    }

    if ("dueDate" in body) {
      push("due_date", asString(body.dueDate), "dueDate");
    }

    if ("productKey" in body) {
      push("product_key", normalizeProductKey(body.productKey), "productKey");
    }

    if ("linkedEntityType" in body) {
      const linkedEntityType = normalizeLinkedEntityType(body.linkedEntityType);
      push("linked_entity_type", linkedEntityType, "linkedEntityType");
      // Hvis vi sletter koblingen, slett også id
      if (linkedEntityType === null) {
        push("linked_entity_id", null, "linkedEntityId");
      }
    }

    if ("linkedEntityId" in body) {
      push("linked_entity_id", asString(body.linkedEntityId), "linkedEntityId");
    }

    if ("tags" in body) {
      push("tags", readStringArray(body.tags), "tags");
    }

    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }

    sets.push("updated_at = now()");
    params.push(session.userId);
    sets.push(`updated_by = $${params.length}`);

    params.push(req.params.id, session.userId);

    try {
      const result = await pool.query(
        `UPDATE admin_workspace_cases
            SET ${sets.join(", ")}
          WHERE id = $${params.length - 1} AND user_id = $${params.length}
          RETURNING *`,
        params,
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Sak ikke funnet" });
        return;
      }

      const updated = result.rows[0];
      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_case",
        entityId: updated.id,
        action: "updated",
        summary: `[${updated.product_key ?? "intern"}] Sak oppdatert: ${updated.title} (felt: ${changedFields.join(", ")})`,
      });

      res.json({ item: updated });
    } catch (err) {
      console.error("[admin-workspace cases] patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere sak" });
    }
  });

  // ── Slett sak (cascade comments) ───────────────────────────────
  app.delete("/api/admin-room/workspace/cases/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_workspace_cases
          WHERE id = $1 AND user_id = $2
          RETURNING id, title, product_key`,
        [req.params.id, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Sak ikke funnet" });
        return;
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_case",
        entityId: result.rows[0].id,
        action: "deleted",
        summary: `[${result.rows[0].product_key ?? "intern"}] Sak slettet: ${result.rows[0].title}`,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("[admin-workspace cases] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette sak" });
    }
  });

  // ── Legg til kommentar ─────────────────────────────────────────
  app.post("/api/admin-room/workspace/cases/:id/comments", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const commentBody = asString(body.body);
    if (!commentBody) {
      res.status(400).json({ error: "body er påkrevd" });
      return;
    }

    try {
      // Verifiser at saken finnes og tilhører brukeren
      const caseCheck = await pool.query(
        `SELECT id, title, product_key FROM admin_workspace_cases
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (caseCheck.rowCount === 0) {
        res.status(404).json({ error: "Sak ikke funnet" });
        return;
      }

      const result = await pool.query(
        `INSERT INTO admin_workspace_case_comments (case_id, user_id, body)
          VALUES ($1, $2, $3)
          RETURNING *`,
        [req.params.id, session.userId, commentBody],
      );

      // Bump parent updated_at + updated_by så sync-historikk reflekterer
      // siste kommentar-aktivitet på saken.
      await pool.query(
        `UPDATE admin_workspace_cases
            SET updated_at = now(), updated_by = $1
          WHERE id = $2`,
        [session.userId, req.params.id],
      );

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_case",
        entityId: req.params.id,
        action: "commented",
        summary: `[${caseCheck.rows[0].product_key ?? "intern"}] Kommentar lagt til på sak: ${caseCheck.rows[0].title}`,
      });

      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[admin-workspace case-comments] create error", err);
      res.status(500).json({ error: "Kunne ikke legge til kommentar" });
    }
  });

  // ── Slett kommentar (own only) ─────────────────────────────────
  app.delete("/api/admin-room/workspace/case-comments/:commentId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM admin_workspace_case_comments
          WHERE id = $1 AND user_id = $2
          RETURNING case_id`,
        [req.params.commentId, session.userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Kommentar ikke funnet eller ikke slettbar" });
        return;
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_case",
        entityId: result.rows[0].case_id,
        action: "comment_deleted",
        summary: `Kommentar slettet på sak ${result.rows[0].case_id}`,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("[admin-workspace case-comments] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette kommentar" });
    }
  });
}
