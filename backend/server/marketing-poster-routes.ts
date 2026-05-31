/**
 * marketing-poster-routes.ts
 *
 * Admin Room CRUD for lagrede marketing-feed-posters (4:5 PNG-assets).
 *
 *   GET    /api/admin-room/marketing-posters[?templateId=...]
 *   GET    /api/admin-room/marketing-posters/:id
 *   POST   /api/admin-room/marketing-posters
 *   PATCH  /api/admin-room/marketing-posters/:id
 *   POST   /api/admin-room/marketing-posters/:id/duplicate
 *   DELETE /api/admin-room/marketing-posters/:id
 *
 * Tabellen `marketing_posters` (migrasjon 214) eier dataen. Tabell
 * auto-init i memory så routen ikke 500'er hvis migrasjon ikke er kjørt.
 */

import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

function rowToPoster(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    templateId: row.template_id as string,
    theme: row.theme as string,
    variant: row.variant as string,
    fields: (row.fields as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt:
      row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? (row.updated_at as Date).toISOString() : String(row.updated_at),
  };
}

function asJsonbObject(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return "{}";
}

export function setupMarketingPosterRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // Idempotent tabell-init — beskytter mot 500-er hvis migrasjon 214 ikke
  // har kjørt på en gitt instans (samme mønster som whats-new-routes.ts).
  void pool
    .query(
      `CREATE TABLE IF NOT EXISTS marketing_posters (
        id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
        title text NOT NULL,
        template_id text NOT NULL DEFAULT 'weekly_brief',
        theme text NOT NULL DEFAULT 'purple',
        variant text NOT NULL DEFAULT 'standard',
        fields jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_marketing_posters_template_updated
        ON marketing_posters(template_id, updated_at DESC);`,
    )
    .catch((err) => console.warn("[marketing-poster-routes] table ensure failed:", err));

  // ── Default-template per template-type ────────────────────────────
  // Implementert som dedikert rad med id = "_default_<templateId>" så
  // ingen ekstra kolonne trengs. GET returnerer null hvis ikke satt.
  const defaultIdFor = (templateId: string): string => `_default_${templateId}`;

  app.get("/api/admin-room/marketing-posters/default/:templateId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const templateId = req.params.templateId.trim();
    if (!templateId) {
      res.status(400).json({ error: "templateId required" });
      return;
    }
    try {
      const result = await pool.query(
        `SELECT * FROM marketing_posters WHERE id = $1`,
        [defaultIdFor(templateId)],
      );
      if (!result.rows.length) {
        res.json({ item: null });
        return;
      }
      res.json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters default get error", err);
      res.status(500).json({ error: "Kunne ikke hente default" });
    }
  });

  app.put("/api/admin-room/marketing-posters/default/:templateId", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const templateId = req.params.templateId.trim();
    if (!templateId) {
      res.status(400).json({ error: "templateId required" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = defaultIdFor(templateId);
    try {
      const result = await pool.query(
        `INSERT INTO marketing_posters (id, title, template_id, theme, variant, fields, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           theme = EXCLUDED.theme,
           variant = EXCLUDED.variant,
           fields = EXCLUDED.fields,
           updated_at = now()
         RETURNING *`,
        [
          id,
          asString(body.title, `Default ${templateId}`),
          templateId,
          asString(body.theme, "purple"),
          asString(body.variant, "standard"),
          asJsonbObject(body.fields),
          session.userId,
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_poster",
        entityId: id,
        action: "default_set",
        summary: `Default for ${templateId}`,
      });
      res.json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters default set error", err);
      res.status(500).json({ error: "Kunne ikke lagre default" });
    }
  });

  app.get("/api/admin-room/marketing-posters", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const templateId = asString(req.query.templateId);
    try {
      const result = templateId
        ? await pool.query(
            `SELECT * FROM marketing_posters
              WHERE template_id = $1
              ORDER BY updated_at DESC
              LIMIT 200`,
            [templateId],
          )
        : await pool.query(
            `SELECT * FROM marketing_posters
              ORDER BY updated_at DESC
              LIMIT 200`,
          );
      res.json({ items: result.rows.map(rowToPoster) });
    } catch (err) {
      console.error("marketing-posters list error", err);
      res.status(500).json({ error: "Kunne ikke hente posters" });
    }
  });

  app.get("/api/admin-room/marketing-posters/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM marketing_posters WHERE id = $1`,
        [req.params.id],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters get error", err);
      res.status(500).json({ error: "Kunne ikke hente poster" });
    }
  });

  app.post("/api/admin-room/marketing-posters", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title);
    if (!title) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO marketing_posters (title, template_id, theme, variant, fields, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING *`,
        [
          title,
          asString(body.templateId, "weekly_brief"),
          asString(body.theme, "purple"),
          asString(body.variant, "standard"),
          asJsonbObject(body.fields),
          session.userId,
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_poster",
        entityId: result.rows[0].id,
        action: "created",
        summary: title,
      });
      res.status(201).json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters create error", err);
      res.status(500).json({ error: "Kunne ikke opprette poster" });
    }
  });

  app.patch("/api/admin-room/marketing-posters/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id];
    const push = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if ("title" in body) push("title", asString(body.title));
    if ("templateId" in body) push("template_id", asString(body.templateId, "weekly_brief"));
    if ("theme" in body) push("theme", asString(body.theme, "purple"));
    if ("variant" in body) push("variant", asString(body.variant, "standard"));
    if ("fields" in body) {
      params.push(asJsonbObject(body.fields));
      sets.push(`fields = $${params.length}::jsonb`);
    }
    if (sets.length === 0) {
      res.status(400).json({ error: "ingen_endringer" });
      return;
    }
    sets.push("updated_at = now()");
    try {
      const result = await pool.query(
        `UPDATE marketing_posters SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
        params,
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_poster",
        entityId: req.params.id,
        action: "updated",
        summary: result.rows[0].title as string,
      });
      res.json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere poster" });
    }
  });

  app.post("/api/admin-room/marketing-posters/:id/duplicate", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const original = await pool.query(
        `SELECT * FROM marketing_posters WHERE id = $1`,
        [req.params.id],
      );
      if (!original.rows.length) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const src = original.rows[0] as Record<string, unknown>;
      const result = await pool.query(
        `INSERT INTO marketing_posters (title, template_id, theme, variant, fields, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING *`,
        [
          `${src.title as string} (kopi)`,
          src.template_id as string,
          src.theme as string,
          src.variant as string,
          JSON.stringify(src.fields ?? {}),
          session.userId,
        ],
      );
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_poster",
        entityId: result.rows[0].id,
        action: "duplicated",
        summary: result.rows[0].title as string,
      });
      res.status(201).json({ item: rowToPoster(result.rows[0]) });
    } catch (err) {
      console.error("marketing-posters duplicate error", err);
      res.status(500).json({ error: "Kunne ikke duplisere poster" });
    }
  });

  app.delete("/api/admin-room/marketing-posters/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM marketing_posters WHERE id = $1 RETURNING title`,
        [req.params.id],
      );
      if (!result.rows.length) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await logAdminActivity({
        userId: session.userId,
        entityType: "marketing_poster",
        entityId: req.params.id,
        action: "deleted",
        summary: result.rows[0].title as string,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("marketing-posters delete error", err);
      res.status(500).json({ error: "Kunne ikke slette poster" });
    }
  });
}
