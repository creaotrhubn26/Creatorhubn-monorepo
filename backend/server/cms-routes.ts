import express from "express";
import type { Pool } from "pg";

export interface CmsRoutesDeps {
  app: express.Application;
  pool: Pool;
  ensureCmsSchema: () => Promise<void>;
  requireUserSession: (req: any, res: any) => any;
}

export function setupCmsRoutes(deps: CmsRoutesDeps): void {
  const { app, pool, ensureCmsSchema, requireUserSession } = deps;

  // CMS Admin — fields CRUD
  app.get("/api/cms/admin/fields", async (_req, res) => {
    try {
      await ensureCmsSchema();
      const result = await pool.query(
        `SELECT id, field_key, label, field_type, description, validation,
                default_value, is_active, created_at, updated_at
         FROM cms_fields ORDER BY label ASC LIMIT 500`,
      );
      res.json({
        fields: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          key: r.field_key,
          label: r.label,
          type: r.field_type,
          description: r.description ?? "",
          validation: r.validation ?? {},
          defaultValue: r.default_value ?? "",
          isActive: r.is_active !== false,
        })),
      });
    } catch (err) {
      console.warn("[cms] list fields failed:", err);
      res.json({ fields: [] });
    }
  });

  app.post("/api/cms/admin/fields", async (req, res) => {
    try {
      await ensureCmsSchema();
      const {
        key,
        label,
        type,
        description,
        validation,
        defaultValue,
        isActive,
      } = req.body ?? {};
      if (!key || !label)
        return res.status(400).json({ error: "key_and_label_required" });
      const result = await pool.query(
        `INSERT INTO cms_fields (field_key, label, field_type, description, validation, default_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          String(key),
          String(label),
          String(type || "text"),
          description ?? null,
          JSON.stringify(validation ?? {}),
          defaultValue ?? null,
          isActive !== false,
        ],
      );
      res.status(201).json({ id: result.rows[0].id, success: true });
    } catch (err) {
      console.error("[cms] create field failed:", err);
      res.status(500).json({
        error: "create_field_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.put("/api/cms/admin/fields/:id", async (req, res) => {
    try {
      await ensureCmsSchema();
      const {
        label,
        type,
        description,
        validation,
        defaultValue,
        isActive,
      } = req.body ?? {};
      await pool.query(
        `UPDATE cms_fields
         SET label = COALESCE($1, label),
             field_type = COALESCE($2, field_type),
             description = COALESCE($3, description),
             validation = COALESCE($4, validation),
             default_value = COALESCE($5, default_value),
             is_active = COALESCE($6, is_active),
             updated_at = NOW()
         WHERE id = $7`,
        [
          label ?? null,
          type ?? null,
          description ?? null,
          validation ?? null,
          defaultValue ?? null,
          isActive ?? null,
          req.params.id,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[cms] update field failed:", err);
      res.status(500).json({ error: "update_field_failed" });
    }
  });

  app.delete("/api/cms/admin/fields/:id", async (req, res) => {
    try {
      await ensureCmsSchema();
      await pool.query(`DELETE FROM cms_fields WHERE id = $1`, [
        req.params.id,
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error("[cms] delete field failed:", err);
      res.status(500).json({ error: "delete_field_failed" });
    }
  });

  // CMS Admin — content types CRUD
  app.get("/api/cms/admin/content-types", async (_req, res) => {
    try {
      await ensureCmsSchema();
      const result = await pool.query(
        `SELECT id, type_key, label, description, field_keys, is_active, created_at, updated_at
         FROM cms_content_types ORDER BY label ASC LIMIT 500`,
      );
      res.json({
        contentTypes: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          key: r.type_key,
          label: r.label,
          description: r.description ?? "",
          fieldKeys: r.field_keys ?? [],
          isActive: r.is_active !== false,
        })),
      });
    } catch (err) {
      console.warn("[cms] list content-types failed:", err);
      res.json({ contentTypes: [] });
    }
  });

  app.post("/api/cms/admin/content-types", async (req, res) => {
    try {
      await ensureCmsSchema();
      const { key, label, description, fieldKeys, isActive } = req.body ?? {};
      if (!key || !label)
        return res.status(400).json({ error: "key_and_label_required" });
      const result = await pool.query(
        `INSERT INTO cms_content_types (type_key, label, description, field_keys, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          String(key),
          String(label),
          description ?? null,
          JSON.stringify(fieldKeys ?? []),
          isActive !== false,
        ],
      );
      res.status(201).json({ id: result.rows[0].id, success: true });
    } catch (err) {
      console.error("[cms] create content-type failed:", err);
      res.status(500).json({
        error: "create_content_type_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.put("/api/cms/admin/content-types/:id", async (req, res) => {
    try {
      await ensureCmsSchema();
      const { label, description, fieldKeys, isActive } = req.body ?? {};
      await pool.query(
        `UPDATE cms_content_types
         SET label = COALESCE($1, label),
             description = COALESCE($2, description),
             field_keys = COALESCE($3, field_keys),
             is_active = COALESCE($4, is_active),
             updated_at = NOW()
         WHERE id = $5`,
        [
          label ?? null,
          description ?? null,
          fieldKeys ?? null,
          isActive ?? null,
          req.params.id,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[cms] update content-type failed:", err);
      res.status(500).json({ error: "update_content_type_failed" });
    }
  });

  app.delete("/api/cms/admin/content-types/:id", async (req, res) => {
    try {
      await ensureCmsSchema();
      await pool.query(`DELETE FROM cms_content_types WHERE id = $1`, [
        req.params.id,
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error("[cms] delete content-type failed:", err);
      res.status(500).json({ error: "delete_content_type_failed" });
    }
  });

  app.get("/api/cms/admin/stats", async (_req, res) => {
    try {
      await ensureCmsSchema();
      const [fields, types, content] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS c FROM cms_fields WHERE is_active = true`,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c FROM cms_content_types WHERE is_active = true`,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c FROM cms_content WHERE is_published = true`,
        ),
      ]);
      res.json({
        fields: fields.rows[0]?.c ?? 0,
        contentTypes: types.rows[0]?.c ?? 0,
        content: content.rows[0]?.c ?? 0,
      });
    } catch (err) {
      console.warn("[cms] stats failed:", err);
      res.json({ fields: 0, contentTypes: 0, content: 0 });
    }
  });

  // CMS public read — alle CreatorHub-flater leser herfra med
  // /api/cms/content/:key?profession=…&locale=…
  // Profesjon-spesifikk override vinner over generisk hvis begge finnes.
  app.get("/api/cms/content/:key", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "key_required" });
    const profession =
      typeof req.query.profession === "string"
        ? req.query.profession.trim()
        : null;
    const locale =
      typeof req.query.locale === "string"
        ? req.query.locale.trim()
        : "nb-NO";
    try {
      await ensureCmsSchema();
      const result = await pool.query(
        `SELECT content_key, content_type_key, profession, locale, payload, updated_at
         FROM cms_content
         WHERE content_key = $1
           AND is_published = true
           AND locale = $2
           AND (profession = $3 OR profession IS NULL)
         ORDER BY profession NULLS LAST
         LIMIT 1`,
        [key, locale, profession],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "not_found" });
      const row = result.rows[0];
      res.json({
        key: row.content_key,
        contentType: row.content_type_key,
        profession: row.profession,
        locale: row.locale,
        payload: row.payload ?? {},
        updatedAt: row.updated_at,
      });
    } catch (err) {
      console.error("[cms] content fetch failed:", err);
      res.status(500).json({
        error: "fetch_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // CMS write (admin) — upsert by (content_key, profession, locale)
  app.put("/api/cms/content/:key", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "key_required" });
    const { contentType, profession, locale, payload, isPublished } =
      req.body ?? {};
    try {
      await ensureCmsSchema();
      await pool.query(
        `INSERT INTO cms_content (content_key, content_type_key, profession, locale, payload, is_published, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (content_key, COALESCE(profession, ''), COALESCE(locale, 'nb-NO')) DO UPDATE SET
           content_type_key = EXCLUDED.content_type_key,
           payload = EXCLUDED.payload,
           is_published = EXCLUDED.is_published,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          key,
          contentType ?? null,
          profession ?? null,
          locale ?? "nb-NO",
          JSON.stringify(payload ?? {}),
          isPublished !== false,
          session.userId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[cms] content upsert failed:", err);
      res.status(500).json({
        error: "upsert_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
