/**
 * lead-preset-routes.ts
 *
 * Parameter presets + custom field definitions. Org-styrt: presets pr
 * bransje, custom fields pr org.
 *
 * Endepunkter (alle under /api/admin-room/lead-map/):
 *   GET    /presets                          (marketing.presets.view)
 *   POST   /presets                          (marketing.presets.edit)
 *   PATCH  /presets/:id                      (marketing.presets.edit)
 *   DELETE /presets/:id                      (marketing.presets.edit)
 *   GET    /custom-fields                    (marketing.presets.view)
 *   POST   /custom-fields                    (marketing.custom_fields.edit)
 *   PATCH  /custom-fields/:id                (marketing.custom_fields.edit)
 *   DELETE /custom-fields/:id                (marketing.custom_fields.edit)
 *
 *   POST   /leads/create-with-preset         Opprett lead + auto-fyll
 *                                            preset-defaults (needs/tags/
 *                                            custom_fields). Krever
 *                                            leads.create.
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface PresetRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  default_needs: string[];
  default_signals: string[];
  default_scoring_weights: Record<string, number>;
  default_custom_fields: Record<string, unknown>;
  default_tags: string[];
  default_lead_source: string | null;
  is_active: boolean;
  is_system: boolean;
}

interface CustomFieldRow {
  id: string;
  organization_id: string;
  field_key: string;
  label: string;
  description: string | null;
  field_type: string;
  options: unknown[];
  gated_view_permission: string | null;
  gated_edit_permission: string | null;
  is_required: boolean;
  default_value: unknown;
  preset_ids: string[];
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

const PRESET_SELECT = `
  id::text, organization_id::text, name, description, industry, category,
  default_needs, default_signals, default_scoring_weights,
  default_custom_fields, default_tags, default_lead_source,
  is_active, is_system, created_at::text, updated_at::text
`;

const CUSTOM_FIELD_SELECT = `
  id::text, organization_id::text, field_key, label, description,
  field_type, options, gated_view_permission, gated_edit_permission,
  is_required, default_value, preset_ids::text[],
  sort_order, is_active, is_system, created_at::text, updated_at::text
`;

function getSessionUserId(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return activeSessions.get(auth.slice(7))?.userId ?? null;
}

export function registerLeadPresetRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";

  // GET /presets
  app.get(
    `${ROOT}/presets`,
    requireLeadMapPermission("marketing.presets.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      try {
        const r = orgId
          ? await pool.query<PresetRow>(
              `SELECT ${PRESET_SELECT}
                 FROM lead_parameter_presets
                WHERE organization_id = $1 AND is_active = true
                ORDER BY name`,
              [orgId],
            )
          : await pool.query<PresetRow>(
              `SELECT ${PRESET_SELECT}
                 FROM lead_parameter_presets WHERE is_active = true
                ORDER BY organization_id, name LIMIT 100`,
            );
        return res.json({ presets: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "presets_list_failed", detail: String(err) });
      }
    },
  );

  // POST /presets
  app.post(
    `${ROOT}/presets`,
    requireLeadMapPermission("marketing.presets.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getSessionUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = req.body as Partial<PresetRow> & { organization_id?: string };
      if (!b.organization_id) return res.status(400).json({ error: "organization_id påkrevd" });
      if (!b.name || typeof b.name !== "string") {
        return res.status(400).json({ error: "name påkrevd" });
      }
      try {
        const r = await pool.query<PresetRow>(
          `INSERT INTO lead_parameter_presets
             (organization_id, name, description, industry, category,
              default_needs, default_signals, default_scoring_weights,
              default_custom_fields, default_tags, default_lead_source,
              created_by)
           VALUES ($1, $2, $3, $4, $5, $6::text[], $7::text[],
                   $8::jsonb, $9::jsonb, $10::text[], $11, $12)
           RETURNING ${PRESET_SELECT}`,
          [
            b.organization_id, b.name.slice(0, 120),
            b.description ?? null, b.industry ?? null, b.category ?? null,
            b.default_needs ?? [], b.default_signals ?? [],
            JSON.stringify(b.default_scoring_weights ?? {}),
            JSON.stringify(b.default_custom_fields ?? {}),
            b.default_tags ?? [], b.default_lead_source ?? null,
            userId,
          ],
        );
        return res.status(201).json({ preset: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "preset_create_failed", detail: String(err) });
      }
    },
  );

  // PATCH /presets/:id
  app.patch(
    `${ROOT}/presets/:id`,
    requireLeadMapPermission("marketing.presets.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const b = req.body as Partial<PresetRow>;
      const updates: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown, cast?: string) => {
        params.push(val); updates.push(`${col} = $${params.length}${cast ?? ""}`);
      };
      if (typeof b.name === "string") set("name", b.name.slice(0, 120));
      if (b.description !== undefined) set("description", b.description);
      if (b.industry !== undefined) set("industry", b.industry);
      if (b.category !== undefined) set("category", b.category);
      if (Array.isArray(b.default_needs)) set("default_needs", b.default_needs, "::text[]");
      if (Array.isArray(b.default_signals)) set("default_signals", b.default_signals, "::text[]");
      if (b.default_scoring_weights !== undefined)
        set("default_scoring_weights", JSON.stringify(b.default_scoring_weights), "::jsonb");
      if (b.default_custom_fields !== undefined)
        set("default_custom_fields", JSON.stringify(b.default_custom_fields), "::jsonb");
      if (Array.isArray(b.default_tags)) set("default_tags", b.default_tags, "::text[]");
      if (b.default_lead_source !== undefined) set("default_lead_source", b.default_lead_source);
      if (typeof b.is_active === "boolean") set("is_active", b.is_active);
      if (updates.length === 0) return res.status(400).json({ error: "no_changes" });
      updates.push("updated_at = now()");
      params.push(req.params.id);
      try {
        const r = await pool.query<PresetRow>(
          `UPDATE lead_parameter_presets SET ${updates.join(", ")}
            WHERE id = $${params.length} AND is_system = false
            RETURNING ${PRESET_SELECT}`,
          params,
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "preset_not_found_or_system" });
        return res.json({ preset: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "preset_update_failed", detail: String(err) });
      }
    },
  );

  // DELETE /presets/:id
  app.delete(
    `${ROOT}/presets/:id`,
    requireLeadMapPermission("marketing.presets.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      try {
        const r = await pool.query(
          `DELETE FROM lead_parameter_presets WHERE id = $1 AND is_system = false RETURNING id`,
          [req.params.id],
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "preset_not_found_or_system" });
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "preset_delete_failed", detail: String(err) });
      }
    },
  );

  // GET /custom-fields
  app.get(
    `${ROOT}/custom-fields`,
    requireLeadMapPermission("marketing.presets.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = typeof req.query.organization_id === "string"
        ? req.query.organization_id : null;
      try {
        const r = orgId
          ? await pool.query<CustomFieldRow>(
              `SELECT ${CUSTOM_FIELD_SELECT}
                 FROM lead_custom_field_definitions
                WHERE organization_id = $1 AND is_active = true
                ORDER BY sort_order, label`,
              [orgId],
            )
          : await pool.query<CustomFieldRow>(
              `SELECT ${CUSTOM_FIELD_SELECT}
                 FROM lead_custom_field_definitions WHERE is_active = true
                ORDER BY organization_id, sort_order LIMIT 100`,
            );
        return res.json({ custom_fields: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "custom_fields_list_failed", detail: String(err) });
      }
    },
  );

  // POST /custom-fields
  app.post(
    `${ROOT}/custom-fields`,
    requireLeadMapPermission("marketing.custom_fields.edit", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getSessionUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = req.body as Partial<CustomFieldRow> & { organization_id?: string };
      if (!b.organization_id) return res.status(400).json({ error: "organization_id påkrevd" });
      if (!b.field_key || !b.label || !b.field_type) {
        return res.status(400).json({ error: "field_key, label, field_type påkrevd" });
      }
      try {
        const r = await pool.query<CustomFieldRow>(
          `INSERT INTO lead_custom_field_definitions
             (organization_id, field_key, label, description, field_type,
              options, gated_view_permission, gated_edit_permission,
              is_required, default_value, preset_ids, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb,
                   $11::uuid[], $12, $13)
           RETURNING ${CUSTOM_FIELD_SELECT}`,
          [
            b.organization_id, b.field_key.slice(0, 60), b.label.slice(0, 160),
            b.description ?? null, b.field_type,
            JSON.stringify(b.options ?? []),
            b.gated_view_permission ?? null, b.gated_edit_permission ?? null,
            b.is_required ?? false,
            JSON.stringify(b.default_value ?? null),
            (b.preset_ids ?? []).filter((p) => typeof p === "string"),
            b.sort_order ?? 100, userId,
          ],
        );
        return res.status(201).json({ custom_field: r.rows[0] });
      } catch (err) {
        return res.status(500).json({ error: "custom_field_create_failed", detail: String(err) });
      }
    },
  );

  // POST /leads/create-with-preset
  app.post(
    `${ROOT}/leads/create-with-preset`,
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const userId = getSessionUserId(req, activeSessions);
      if (!userId) return res.status(401).json({ error: "Innlogging kreves" });
      const b = req.body as {
        organization_id?: string;
        preset_id?: string;
        name?: string;
        website_url?: string;
        email?: string;
        phone?: string;
        latitude?: number;
        longitude?: number;
        city?: string;
        custom_fields_overrides?: Record<string, unknown>;
      };
      if (!b.name) return res.status(400).json({ error: "name påkrevd" });

      let client: PoolClient | null = null;
      try {
        client = await pool.connect();
        await client.query("BEGIN");

        let preset: PresetRow | null = null;
        if (b.preset_id) {
          const r = await client.query<PresetRow>(
            `SELECT ${PRESET_SELECT}
               FROM lead_parameter_presets WHERE id = $1 LIMIT 1`,
            [b.preset_id],
          );
          preset = r.rows[0] ?? null;
        }

        const mergedCustomFields = {
          ...(preset?.default_custom_fields ?? {}),
          ...(b.custom_fields_overrides ?? {}),
        };

        const leadRes = await client.query<{ id: string }>(
          `INSERT INTO crm_customers
             (name, website_url, email, phone, latitude, longitude, city,
              owner_user_id, status, lead_status,
              lead_category, lead_source, tags, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'lead', 'unvisited',
                   $9, $10, $11::text[], $12::jsonb)
           RETURNING id::text`,
          [
            b.name, b.website_url ?? null, b.email ?? null, b.phone ?? null,
            b.latitude ?? null, b.longitude ?? null, b.city ?? null,
            userId,
            preset?.industry ?? null,
            preset?.default_lead_source ?? null,
            preset?.default_tags ?? [],
            JSON.stringify(mergedCustomFields),
          ],
        );
        const customerId = leadRes.rows[0].id;

        for (const needType of preset?.default_needs ?? []) {
          await client.query(
            `INSERT INTO crm_customer_needs
               (customer_id, need_type, priority, evidence, detected_by, status)
             VALUES ($1, $2, 3, $3, 'preset', 'detected')
             ON CONFLICT (customer_id, need_type) DO NOTHING`,
            [customerId, needType, `Fra preset "${preset?.name}"`],
          );
        }

        await client.query("COMMIT");

        return res.status(201).json({
          lead_id: customerId,
          preset_used: preset?.id ?? null,
          preset_name: preset?.name ?? null,
          custom_fields_applied: Object.keys(mergedCustomFields).length,
          needs_seeded: preset?.default_needs.length ?? 0,
        });
      } catch (err) {
        try { await client?.query("ROLLBACK"); } catch { /* noop */ }
        return res.status(500).json({ error: "lead_create_failed", detail: String(err) });
      } finally {
        client?.release();
      }
    },
  );
}
