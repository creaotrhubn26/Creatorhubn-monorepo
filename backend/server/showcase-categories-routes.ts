/**
 * showcase-categories-routes.ts
 *
 * Setup-funksjon for /api/showcase/categories + /day-categories +
 * /profession/:profession endpoints.
 *
 * 4 endpoints:
 *   - GET    /categories                  (liste, filtrer på profession+userId)
 *   - POST   /categories                  (create)
 *   - GET    /day-categories              (gruppering av items per dag-navn fra crop_data)
 *   - GET    /profession/:profession      (alle items for én profession, inkl. analytics-aggregat)
 *
 * Auth: åpen — userId leses fra query/header, ingen session-validering.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupShowcaseCategoriesRoutes } from "./showcase-categories-routes";
 *
 *   setupShowcaseCategoriesRoutes({
 *     app, pool, getTableColumns, mapShowcaseItemRow,
 *   });
 *
 * Mode-noter: profession-feltet er et profession-filter (photographer,
 * etc.), ikke en Role Room-mode. Ingen mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

import {
  readNumber,
  readOptionalIsoDate,
  readString,
  normalizeJsonObjectField,
} from "./_shared";

export interface ShowcaseCategoriesRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  getTableColumns: (tableName: string) => Promise<Set<string>>;
  mapShowcaseItemRow: (row: Record<string, unknown>) => Record<string, unknown>;
}

export function setupShowcaseCategoriesRoutes(
  deps: ShowcaseCategoriesRoutesDeps,
): void {
  const { app, pool, requireUserSession, getTableColumns, mapShowcaseItemRow } = deps;

  // GET /api/showcase/categories — Get showcase categories (optionally by profession)
  app.get("/api/showcase/categories", async (req, res) => {
    try {
      const profession = readString(req.query.profession);
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const columns = await getTableColumns("showcase_categories");
      const filters: string[] = [];
      const params: unknown[] = [];

      if (columns.has("is_active")) {
        filters.push("is_active = true");
      }
      if (profession && columns.has("profession")) {
        params.push(profession);
        filters.push(`profession = $${params.length}`);
      }
      if (userId && columns.has("user_id")) {
        params.push(userId);
        filters.push(`user_id = $${params.length}`);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const orderBy = columns.has("sort_order")
        ? "ORDER BY sort_order ASC, name ASC"
        : "ORDER BY name ASC";
      const query = `SELECT * FROM showcase_categories ${whereClause} ${orderBy}`;
      const result = await pool.query(query, params);
      res.json(
        result.rows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          name: readString(row.name) || "Kategori",
          slug:
            readString(row.slug) ||
            (readString(row.name) || "kategori")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
          description: readString(row.description) || "",
          icon: readString(row.icon) || undefined,
          color: readString(row.color) || undefined,
          sortOrder: readNumber(row.sort_order) ?? 0,
          createdAt:
            readOptionalIsoDate(row.created_at) || new Date().toISOString(),
          updatedAt:
            readOptionalIsoDate(row.updated_at) || new Date().toISOString(),
          createdBy: readString(row.user_id) || userId || "system",
          profession: readString(row.profession) || profession || undefined,
        })),
      );
    } catch (error) {
      // Manglende showcase_categories-tabell skal ikke krasje showcase-sida.
      // Returner tom liste istedet for 500.
      console.warn(
        "[showcase-categories] list degraded:",
        (error as any)?.message || error,
      );
      res.json([]);
    }
  });

  // POST /api/showcase/categories — Create showcase category
  app.post("/api/showcase/categories", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const { name, profession, description, color, icon } = req.body as Record<
        string,
        unknown
      >;
      const now = new Date().toISOString();
      const columns = await getTableColumns("showcase_categories");
      const userId =
        readString(req.body?.userId) ||
        readString(req.headers["x-user-id"]) ||
        "system";
      const fieldSpecs = [
        { column: "id", value: crypto.randomUUID() },
        { column: "user_id", value: userId },
        { column: "name", value: readString(name) || "Ny kategori" },
        {
          column: "description",
          value: readString(description) || "",
        },
        { column: "profession", value: readString(profession) || "photographer" },
        { column: "color", value: readString(color) || "#f5a623" },
        { column: "icon", value: readString(icon) || "category" },
        { column: "is_active", value: true },
        { column: "sort_order", value: 0 },
        { column: "created_at", value: now, timestamp: true },
        { column: "updated_at", value: now, timestamp: true },
      ].filter((spec) => columns.has(spec.column));
      const placeholders: string[] = [];
      const values: unknown[] = [];
      for (const spec of fieldSpecs) {
        values.push(spec.value);
        placeholders.push(
          spec.timestamp ? `$${values.length}::timestamp` : `$${values.length}`,
        );
      }
      const result = await pool.query(
        `INSERT INTO showcase_categories (${fieldSpecs
          .map((spec) => spec.column)
          .join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING *`,
        values,
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating showcase category:", error);
      res.status(500).json({ error: "Kunne ikke opprette kategori" });
    }
  });

  // GET /api/showcase/profession/:profession — Get showcase items for a profession
  app.get("/api/showcase/profession/:profession", async (req, res) => {
    try {
      const { profession } = req.params;
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;

      let query = `SELECT si.*,
                   COALESCE((SELECT SUM(sa.views) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) as view_count,
                   COALESCE((SELECT SUM(sa.likes) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) as like_count,
                   COALESCE((SELECT SUM(sa.downloads) FROM showcase_analytics sa WHERE sa.showcase_item_id = si.id), 0) as download_count
                   FROM showcase_items si WHERE si.profession = $1`;
      const params: unknown[] = [profession];
      let paramIdx = 2;

      if (userId) {
        query += ` AND si.user_id = $${paramIdx}`;
        params.push(userId);
        paramIdx++;
      }

      query += " AND si.is_active = true ORDER BY si.created_at DESC";
      const result = await pool.query(query, params);
      res.json(
        result.rows.map((row: Record<string, unknown>) => mapShowcaseItemRow(row)),
      );
    } catch (error) {
      // Manglende showcase_items eller showcase_analytics-tabell skal ikke
      // krasje profesjonal-feed. Returner tom liste i stedet for 500.
      console.warn(
        "[showcase-profession] list degraded:",
        (error as any)?.message || error,
      );
      res.json([]);
    }
  });

  app.get("/api/showcase/day-categories", async (req, res) => {
    try {
      const profession = readString(req.query.profession);
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        null;
      const params: unknown[] = [];
      const filters: string[] = ["coalesce(is_active, true) = true"];
      if (profession) {
        params.push(profession);
        filters.push(`profession = $${params.length}`);
      }
      if (userId) {
        params.push(userId);
        filters.push(`user_id = $${params.length}`);
      }

      const result = await pool.query(
        `SELECT id, category, project_id, title, crop_data, created_at
           FROM showcase_items
          WHERE ${filters.join(" AND ")}
          ORDER BY created_at ASC`,
        params,
      );

      const grouped = new Map<
        string,
        { id: string; name: string; itemIds: string[]; projectIds: string[] }
      >();

      for (const row of result.rows as Array<Record<string, unknown>>) {
        const cropData = normalizeJsonObjectField(row.crop_data) || {};
        const metadata = normalizeJsonObjectField(cropData.metadata) || {};
        const dayName =
          readString(cropData.dayName) ||
          readString(cropData.dayLabel) ||
          readString(metadata.dayName) ||
          readString(row.category) ||
          "Uten dag";
        const key = dayName.toLowerCase();
        const group = grouped.get(key) || {
          id: key.replace(/[^a-z0-9]+/g, "-"),
          name: dayName,
          itemIds: [],
          projectIds: [],
        };
        group.itemIds.push(String(row.id));
        const projectId = readString(row.project_id);
        if (projectId) {
          group.projectIds.push(projectId);
        }
        grouped.set(key, group);
      }

      res.json({
        dayCategories: Array.from(grouped.values()).map((group) => ({
          id: group.id,
          name: group.name,
          itemCount: group.itemIds.length,
          itemIds: group.itemIds,
          projectIds: Array.from(new Set(group.projectIds)),
        })),
      });
    } catch (error) {
      console.error("Error loading showcase day categories:", error);
      res.status(500).json({ error: "Kunne ikke hente dag-kategorier" });
    }
  });
}
