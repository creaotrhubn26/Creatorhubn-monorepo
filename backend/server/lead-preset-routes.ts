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
import { createHash } from "node:crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
} from "./leadgrid-project-access.js";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import {
  LeadCreationValidationError,
  parseLeadCreationBody,
  parseLeadCreationIdempotencyKey,
} from "./lead-map-create-contract.js";
import {
  createLeadFromPin,
  DuplicateLeadError,
  LeadCreationIdempotencyConflictError,
} from "./lead-map-service.js";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CUSTOM_FIELD_TYPES = new Set([
  "text",
  "long_text",
  "number",
  "dropdown",
  "multi_select",
  "boolean",
  "date",
  "datetime",
  "url",
  "email",
  "phone",
  "currency",
]);

class PresetRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(code);
    this.name = "PresetRequestError";
  }
}

function recordBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PresetRequestError("invalid_payload");
  }
  return raw as Record<string, unknown>;
}

function optionalText(
  value: unknown,
  maxLength: number,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new PresetRequestError(`invalid_${field}`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  return normalized;
}

function textArray(
  value: unknown,
  field: string,
  maxItems = 100,
  maxLength = 160,
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  const normalized = value.map((entry) => {
    const item = optionalText(entry, maxLength, field);
    if (!item) throw new PresetRequestError(`invalid_${field}`);
    return item;
  });
  return [...new Set(normalized)];
}

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  const parsed = value as Record<string, unknown>;
  if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > 64 * 1024) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  return parsed;
}

function jsonArray(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 250) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 64 * 1024) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  return value;
}

function jsonValue(value: unknown, field: string): unknown {
  if (value === undefined) return null;
  const encoded = JSON.stringify(value);
  if (encoded === undefined || Buffer.byteLength(encoded, "utf8") > 64 * 1024) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  return value;
}

function integerValue(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (
    !Number.isInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 100_000
  ) {
    throw new PresetRequestError(`invalid_${field}`);
  }
  return Number(value);
}

function requestedProjectId(body: Record<string, unknown>): string | null {
  return optionalText(body.project_id ?? body.projectId, 255, "project_id");
}

function requestedPresetId(body: Record<string, unknown>): string | null {
  const presetId = optionalText(
    body.preset_id ?? body.presetId,
    64,
    "preset_id",
  );
  if (presetId && !UUID_PATTERN.test(presetId)) {
    throw new PresetRequestError("preset_not_found", 404);
  }
  return presetId?.toLowerCase() ?? null;
}

function routeIdentifier(value: unknown, notFoundCode: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new PresetRequestError(notFoundCode, 404);
  }
  return value.trim().toLowerCase();
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function presetCreationHash(input: {
  lead: ReturnType<typeof parseLeadCreationBody>;
  presetId: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
}): string {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

async function resolveConfigOrganization(
  _req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  try {
    return await resolveOrgIdForUser(pool, userId);
  } catch {
    return null;
  }
}

async function resolveProjectOrganization(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  try {
    const projectId = requestedProjectId(recordBody(req.body ?? {}));
    if (!projectId) return null;
    const project = await loadAccessibleLeadgridProject(
      pool,
      projectId,
      userId,
    );
    return project?.organizationId ?? null;
  } catch {
    return null;
  }
}

async function requestConfigScope(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<{ userId: string; organizationId: string } | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  const organizationId = await resolveConfigOrganization(
    req,
    pool,
    session.userId,
  );
  if (!organizationId) {
    res.status(404).json({ error: "organization_not_found" });
    return null;
  }
  return { userId: session.userId, organizationId };
}

async function validatePresetIds(
  queryable: Pick<Pool, "query">,
  organizationId: string,
  raw: unknown,
): Promise<string[]> {
  const presetIds = textArray(raw, "preset_ids", 100, 64).map((id) => {
    if (!UUID_PATTERN.test(id)) {
      throw new PresetRequestError("preset_not_found", 404);
    }
    return id.toLowerCase();
  });
  if (presetIds.length === 0) return [];
  const result = await queryable.query<{ id: string }>(
    `SELECT id::text
       FROM lead_parameter_presets
      WHERE organization_id = $1::uuid
        AND id = ANY($2::uuid[])`,
    [organizationId, presetIds],
  );
  if (result.rows.length !== presetIds.length) {
    throw new PresetRequestError("preset_not_found", 404);
  }
  return presetIds;
}

function sendPresetRequestError(error: unknown, res: Response): boolean {
  if (!(error instanceof PresetRequestError)) return false;
  res.status(error.status).json({ error: error.code });
  return true;
}

function canonicalLeadPayload(
  body: Record<string, unknown>,
  preset: PresetRow | null,
  projectId: string,
): Record<string, unknown> {
  const select = (snakeCase: string, camelCase: string): unknown =>
    body[snakeCase] ?? body[camelCase];
  return {
    name: body.name,
    company: body.company ?? body.name,
    contact_name: select("contact_name", "contactName"),
    contact_role: select("contact_role", "contactRole"),
    organization_number: select("organization_number", "organizationNumber"),
    website_url: select("website_url", "websiteUrl"),
    google_place_id: select("google_place_id", "googlePlaceId"),
    phone: body.phone,
    email: body.email,
    industry_id: select("industry_id", "industryId"),
    industry_label:
      select("industry_label", "industryLabel") ?? preset?.industry ?? null,
    employee_count_estimate: select(
      "employee_count_estimate",
      "employeeCountEstimate",
    ),
    annual_revenue_nok_estimate: select(
      "annual_revenue_nok_estimate",
      "annualRevenueNokEstimate",
    ),
    notes: body.notes,
    lead_temperature: select("lead_temperature", "leadTemperature"),
    lead_status: select("lead_status", "leadStatus"),
    next_follow_up_at: select("next_follow_up_at", "nextFollowUpAt"),
    next_action: select("next_action", "nextAction"),
    latitude: body.latitude,
    longitude: body.longitude,
    address: body.address,
    postal_code: select("postal_code", "postalCode"),
    city: body.city,
    location_confidence: select("location_confidence", "locationConfidence"),
    lead_source:
      select("lead_source", "leadSource") ??
      preset?.default_lead_source ??
      "preset",
    project_id: projectId,
  };
}

async function applyPresetDefaults(
  pool: Pool,
  input: {
    leadId: string;
    organizationId: string;
    projectId: string;
    userId: string;
    preset: PresetRow | null;
    tags: string[];
    customFields: Record<string, unknown>;
  },
): Promise<{ needsSeeded: number; signalsSeeded: number }> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const update = await client.query(
      `UPDATE crm_customers
          SET tags = ARRAY(
                SELECT tag.value
                  FROM unnest(
                    COALESCE(crm_customers.tags, ARRAY[]::text[]) || $4::text[]
                  ) WITH ORDINALITY AS tag(value, position)
                 GROUP BY tag.value
                 ORDER BY MIN(tag.position)
              ),
              -- On an idempotent replay, values written after the original
              -- creation win over the replayed request. A crash between the
              -- factory commit and this update can still safely finish the
              -- missing decoration on retry.
              custom_fields = $5::jsonb || COALESCE(
                crm_customers.custom_fields,
                '{}'::jsonb
              ),
              lead_parameter_preset_id = COALESCE(
                crm_customers.lead_parameter_preset_id,
                $6::uuid
              ),
              updated_at = now()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
        RETURNING id::text`,
      [
        input.leadId,
        input.organizationId,
        input.projectId,
        input.tags,
        JSON.stringify(input.customFields),
        input.preset?.id ?? null,
      ],
    );
    if (update.rowCount !== 1) {
      throw new PresetRequestError("lead_not_found", 404);
    }

    let needsSeeded = 0;
    for (const needType of input.preset?.default_needs ?? []) {
      const inserted = await client.query(
        `INSERT INTO crm_customer_needs
           (customer_id, organization_id, project_id, need_type, priority,
            evidence, detected_by, status)
         VALUES ($1, $2::uuid, $3, $4, 3, $5, $6, 'detected')
         ON CONFLICT (customer_id, need_type) DO NOTHING
         RETURNING id`,
        [
          input.leadId,
          input.organizationId,
          input.projectId,
          needType,
          `Fra preset "${input.preset?.name}"`,
          input.userId,
        ],
      );
      needsSeeded += inserted.rowCount ?? 0;
    }

    let signalsSeeded = 0;
    for (const signalType of input.preset?.default_signals ?? []) {
      const inserted = await client.query(
        `INSERT INTO crm_customer_signals
           (customer_id, organization_id, project_id, signal_type, polarity,
            raw_value, source)
         VALUES ($1, $2::uuid, $3, $4, 'neutral', $5, 'preset')
         ON CONFLICT (customer_id, signal_type) DO NOTHING
         RETURNING id`,
        [
          input.leadId,
          input.organizationId,
          input.projectId,
          signalType,
          `Fra preset "${input.preset?.name}"`,
        ],
      );
      signalsSeeded += inserted.rowCount ?? 0;
    }

    await client.query("COMMIT");
    return { needsSeeded, signalsSeeded };
  } catch (error) {
    try {
      await client?.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client?.release();
  }
}

async function removePartiallyCreatedLead(
  pool: Pool,
  input: { leadId: string; organizationId: string; projectId: string },
): Promise<void> {
  await pool.query(
    `DELETE FROM crm_customers
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [input.leadId, input.organizationId, input.projectId],
  );
}

export function registerLeadPresetRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const ROOT = "/api/admin-room/lead-map";
  const presetViewGuard = requireLeadMapPermission("marketing.presets.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveConfigOrganization,
  });
  const presetEditGuard = requireLeadMapPermission("marketing.presets.edit", {
    pool,
    activeSessions,
    resolveOrgId: resolveConfigOrganization,
  });
  const customFieldEditGuard = requireLeadMapPermission(
    "marketing.custom_fields.edit",
    { pool, activeSessions, resolveOrgId: resolveConfigOrganization },
  );
  const leadCreateGuard = requireLeadMapPermission("leads.create", {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrganization,
  });

  // GET /presets
  app.get(
    `${ROOT}/presets`,
    presetViewGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const r = await pool.query<PresetRow>(
          `SELECT ${PRESET_SELECT}
             FROM lead_parameter_presets
            WHERE organization_id = $1::uuid
              AND is_active = true
            ORDER BY name`,
          [scope.organizationId],
        );
        return res.json({ presets: r.rows });
      } catch {
        return res
          .status(500)
          .json({ error: "presets_list_failed", detail: "internal_error" });
      }
    },
  );

  // POST /presets
  app.post(
    `${ROOT}/presets`,
    presetEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const b = recordBody(req.body);
        const name = optionalText(b.name, 120, "name");
        if (!name) throw new PresetRequestError("name_required");
        const defaultNeeds = textArray(
          b.default_needs,
          "default_needs",
          100,
          60,
        );
        const defaultSignals = textArray(
          b.default_signals,
          "default_signals",
          100,
          60,
        );
        const scoringWeights = jsonObject(
          b.default_scoring_weights,
          "default_scoring_weights",
        );
        const defaultCustomFields = jsonObject(
          b.default_custom_fields,
          "default_custom_fields",
        );
        const defaultTags = textArray(b.default_tags, "default_tags", 100, 80);
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
            scope.organizationId,
            name,
            optionalText(b.description, 10_000, "description"),
            optionalText(b.industry, 120, "industry"),
            optionalText(b.category, 40, "category"),
            defaultNeeds,
            defaultSignals,
            JSON.stringify(scoringWeights),
            JSON.stringify(defaultCustomFields),
            defaultTags,
            optionalText(b.default_lead_source, 80, "default_lead_source"),
            scope.userId,
          ],
        );
        return res.status(201).json({ preset: r.rows[0] });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res
          .status(500)
          .json({ error: "preset_create_failed", detail: "internal_error" });
      }
    },
  );

  // PATCH /presets/:id
  app.patch(
    `${ROOT}/presets/:id`,
    presetEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const id = routeIdentifier(req.params.id, "preset_not_found");
        const b = recordBody(req.body);
        const updates: string[] = [];
        const params: unknown[] = [];
        const set = (column: string, value: unknown, cast = "") => {
          params.push(value);
          updates.push(`${column} = $${params.length}${cast}`);
        };
        if (b.name !== undefined) {
          const name = optionalText(b.name, 120, "name");
          if (!name) throw new PresetRequestError("name_required");
          set("name", name);
        }
        if (b.description !== undefined) {
          set(
            "description",
            optionalText(b.description, 10_000, "description"),
          );
        }
        if (b.industry !== undefined) {
          set("industry", optionalText(b.industry, 120, "industry"));
        }
        if (b.category !== undefined) {
          set("category", optionalText(b.category, 40, "category"));
        }
        if (b.default_needs !== undefined) {
          set(
            "default_needs",
            textArray(b.default_needs, "default_needs", 100, 60),
            "::text[]",
          );
        }
        if (b.default_signals !== undefined) {
          set(
            "default_signals",
            textArray(b.default_signals, "default_signals", 100, 60),
            "::text[]",
          );
        }
        if (b.default_scoring_weights !== undefined) {
          set(
            "default_scoring_weights",
            JSON.stringify(
              jsonObject(b.default_scoring_weights, "default_scoring_weights"),
            ),
            "::jsonb",
          );
        }
        if (b.default_custom_fields !== undefined) {
          set(
            "default_custom_fields",
            JSON.stringify(
              jsonObject(b.default_custom_fields, "default_custom_fields"),
            ),
            "::jsonb",
          );
        }
        if (b.default_tags !== undefined) {
          set(
            "default_tags",
            textArray(b.default_tags, "default_tags", 100, 80),
            "::text[]",
          );
        }
        if (b.default_lead_source !== undefined) {
          set(
            "default_lead_source",
            optionalText(b.default_lead_source, 80, "default_lead_source"),
          );
        }
        if (typeof b.is_active === "boolean") set("is_active", b.is_active);
        if (updates.length === 0) {
          throw new PresetRequestError("no_changes");
        }
        updates.push("updated_at = now()");
        params.push(id, scope.organizationId);
        const r = await pool.query<PresetRow>(
          `UPDATE lead_parameter_presets SET ${updates.join(", ")}
            WHERE id = $${params.length - 1}::uuid
              AND organization_id = $${params.length}::uuid
              AND is_system = false
            RETURNING ${PRESET_SELECT}`,
          params,
        );
        if (r.rowCount === 0) {
          return res.status(404).json({ error: "preset_not_found" });
        }
        return res.json({ preset: r.rows[0] });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res
          .status(500)
          .json({ error: "preset_update_failed", detail: "internal_error" });
      }
    },
  );

  // DELETE /presets/:id
  app.delete(
    `${ROOT}/presets/:id`,
    presetEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const id = routeIdentifier(req.params.id, "preset_not_found");
        const r = await pool.query(
          `UPDATE lead_parameter_presets
              SET is_active = false,
                  updated_at = now()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND is_system = false
            RETURNING id::text`,
          [id, scope.organizationId],
        );
        if (r.rowCount === 0) {
          return res.status(404).json({ error: "preset_not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res
          .status(500)
          .json({ error: "preset_delete_failed", detail: "internal_error" });
      }
    },
  );

  // GET /custom-fields
  app.get(
    `${ROOT}/custom-fields`,
    presetViewGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const r = await pool.query<CustomFieldRow>(
          `SELECT ${CUSTOM_FIELD_SELECT}
             FROM lead_custom_field_definitions
            WHERE organization_id = $1::uuid
              AND is_active = true
            ORDER BY sort_order, label`,
          [scope.organizationId],
        );
        return res.json({ custom_fields: r.rows });
      } catch {
        return res.status(500).json({
          error: "custom_fields_list_failed",
          detail: "internal_error",
        });
      }
    },
  );

  // POST /custom-fields
  app.post(
    `${ROOT}/custom-fields`,
    customFieldEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const b = recordBody(req.body);
        const fieldKey = optionalText(b.field_key, 60, "field_key");
        const label = optionalText(b.label, 160, "label");
        const fieldType = optionalText(b.field_type, 20, "field_type");
        if (!fieldKey || !label || !fieldType) {
          throw new PresetRequestError(
            "field_key_label_and_field_type_required",
          );
        }
        if (!CUSTOM_FIELD_TYPES.has(fieldType)) {
          throw new PresetRequestError("invalid_field_type");
        }
        const presetIds = await validatePresetIds(
          pool,
          scope.organizationId,
          b.preset_ids,
        );
        const r = await pool.query<CustomFieldRow>(
          `INSERT INTO lead_custom_field_definitions
             (organization_id, field_key, label, description, field_type,
              options, gated_view_permission, gated_edit_permission,
              is_required, default_value, preset_ids, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb,
                   $11::uuid[], $12, $13)
           RETURNING ${CUSTOM_FIELD_SELECT}`,
          [
            scope.organizationId,
            fieldKey,
            label,
            optionalText(b.description, 10_000, "description"),
            fieldType,
            JSON.stringify(jsonArray(b.options, "options")),
            optionalText(b.gated_view_permission, 80, "gated_view_permission"),
            optionalText(b.gated_edit_permission, 80, "gated_edit_permission"),
            b.is_required === true,
            JSON.stringify(jsonValue(b.default_value, "default_value")),
            presetIds,
            integerValue(b.sort_order, "sort_order", 100),
            scope.userId,
          ],
        );
        return res.status(201).json({ custom_field: r.rows[0] });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res.status(500).json({
          error: "custom_field_create_failed",
          detail: "internal_error",
        });
      }
    },
  );

  // PATCH /custom-fields/:id
  app.patch(
    `${ROOT}/custom-fields/:id`,
    customFieldEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const id = routeIdentifier(req.params.id, "custom_field_not_found");
        const b = recordBody(req.body);
        const updates: string[] = [];
        const params: unknown[] = [];
        const set = (column: string, value: unknown, cast = "") => {
          params.push(value);
          updates.push(`${column} = $${params.length}${cast}`);
        };
        if (b.field_key !== undefined) {
          const fieldKey = optionalText(b.field_key, 60, "field_key");
          if (!fieldKey) throw new PresetRequestError("field_key_required");
          set("field_key", fieldKey);
        }
        if (b.label !== undefined) {
          const label = optionalText(b.label, 160, "label");
          if (!label) throw new PresetRequestError("label_required");
          set("label", label);
        }
        if (b.description !== undefined) {
          set(
            "description",
            optionalText(b.description, 10_000, "description"),
          );
        }
        if (b.field_type !== undefined) {
          const fieldType = optionalText(b.field_type, 20, "field_type");
          if (!fieldType || !CUSTOM_FIELD_TYPES.has(fieldType)) {
            throw new PresetRequestError("invalid_field_type");
          }
          set("field_type", fieldType);
        }
        if (b.options !== undefined) {
          set(
            "options",
            JSON.stringify(jsonArray(b.options, "options")),
            "::jsonb",
          );
        }
        if (b.gated_view_permission !== undefined) {
          set(
            "gated_view_permission",
            optionalText(b.gated_view_permission, 80, "gated_view_permission"),
          );
        }
        if (b.gated_edit_permission !== undefined) {
          set(
            "gated_edit_permission",
            optionalText(b.gated_edit_permission, 80, "gated_edit_permission"),
          );
        }
        if (b.is_required !== undefined) {
          if (typeof b.is_required !== "boolean") {
            throw new PresetRequestError("invalid_is_required");
          }
          set("is_required", b.is_required);
        }
        if (b.default_value !== undefined) {
          set(
            "default_value",
            JSON.stringify(jsonValue(b.default_value, "default_value")),
            "::jsonb",
          );
        }
        if (b.preset_ids !== undefined) {
          const presetIds = await validatePresetIds(
            pool,
            scope.organizationId,
            b.preset_ids,
          );
          set("preset_ids", presetIds, "::uuid[]");
        }
        if (b.sort_order !== undefined) {
          set("sort_order", integerValue(b.sort_order, "sort_order", 100));
        }
        if (b.is_active !== undefined) {
          if (typeof b.is_active !== "boolean") {
            throw new PresetRequestError("invalid_is_active");
          }
          set("is_active", b.is_active);
        }
        if (updates.length === 0) {
          throw new PresetRequestError("no_changes");
        }
        updates.push("updated_at = now()");
        params.push(id, scope.organizationId);
        const result = await pool.query<CustomFieldRow>(
          `UPDATE lead_custom_field_definitions
              SET ${updates.join(", ")}
            WHERE id = $${params.length - 1}::uuid
              AND organization_id = $${params.length}::uuid
              AND is_system = false
            RETURNING ${CUSTOM_FIELD_SELECT}`,
          params,
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "custom_field_not_found" });
        }
        return res.json({ custom_field: result.rows[0] });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res.status(500).json({
          error: "custom_field_update_failed",
          detail: "internal_error",
        });
      }
    },
  );

  // DELETE /custom-fields/:id
  app.delete(
    `${ROOT}/custom-fields/:id`,
    customFieldEditGuard,
    async (req: Request, res: Response) => {
      try {
        const scope = await requestConfigScope(req, res, pool, activeSessions);
        if (!scope) return;
        const id = routeIdentifier(req.params.id, "custom_field_not_found");
        const result = await pool.query(
          `UPDATE lead_custom_field_definitions
              SET is_active = false,
                  updated_at = now()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND is_system = false
            RETURNING id::text`,
          [id, scope.organizationId],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "custom_field_not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        if (sendPresetRequestError(error, res)) return;
        return res.status(500).json({
          error: "custom_field_delete_failed",
          detail: "internal_error",
        });
      }
    },
  );

  // POST /leads/create-with-preset
  app.post(
    `${ROOT}/leads/create-with-preset`,
    leadCreateGuard,
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      let createdScope: {
        leadId: string;
        organizationId: string;
        projectId: string;
        created: boolean;
      } | null = null;
      try {
        const body = recordBody(req.body);
        const projectId = requestedProjectId(body);
        if (!projectId) {
          throw new PresetRequestError("project_id_required");
        }
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          throw new PresetRequestError("project_not_found", 404);
        }

        const presetId = requestedPresetId(body);
        let preset: PresetRow | null = null;
        if (presetId) {
          const result = await pool.query<PresetRow>(
            `SELECT ${PRESET_SELECT}
               FROM lead_parameter_presets
              WHERE id = $1::uuid
                AND organization_id = $2::uuid
                AND is_active = true
              LIMIT 1`,
            [presetId, project.organizationId],
          );
          preset = result.rows[0] ?? null;
          if (!preset) {
            throw new PresetRequestError("preset_not_found", 404);
          }
        }

        const lead = parseLeadCreationBody(
          canonicalLeadPayload(body, preset, project.id),
        );
        if (lead.googlePlaceId) {
          throw new PresetRequestError(
            "google_place_id_requires_discovery_attestation",
          );
        }
        const presetCustomFields = jsonObject(
          preset?.default_custom_fields,
          "default_custom_fields",
        );
        const customFieldOverrides = jsonObject(
          body.custom_fields_overrides ?? body.customFieldsOverrides,
          "custom_fields_overrides",
        );
        const mergedCustomFields = {
          ...presetCustomFields,
          ...customFieldOverrides,
        };
        const tags = [
          ...new Set([
            ...textArray(preset?.default_tags, "default_tags", 100, 80),
            ...textArray(body.tags, "tags", 100, 80),
          ]),
        ].slice(0, 100);
        const idempotencyKey = parseLeadCreationIdempotencyKey(
          req.get("Idempotency-Key"),
        );
        const creation = await createLeadFromPin(pool, {
          ...lead,
          ownerUserId: session.userId,
          organizationId: project.organizationId,
          projectId: project.id,
          idempotencyKey,
          requestHash: idempotencyKey
            ? presetCreationHash({
                lead,
                presetId: preset?.id ?? null,
                tags,
                customFields: mergedCustomFields,
              })
            : null,
        });
        createdScope = {
          leadId: creation.id,
          organizationId: project.organizationId,
          projectId: project.id,
          created: creation.created,
        };
        const applied = await applyPresetDefaults(pool, {
          leadId: creation.id,
          organizationId: project.organizationId,
          projectId: project.id,
          userId: session.userId,
          preset,
          tags,
          customFields: mergedCustomFields,
        });

        if (creation.idempotentReplay) {
          res.setHeader("Idempotent-Replayed", "true");
        }
        return res.status(creation.created ? 201 : 200).json({
          lead_id: creation.id,
          organization_id: project.organizationId,
          project_id: project.id,
          preset_used: preset?.id ?? null,
          preset_name: preset?.name ?? null,
          replayed: creation.idempotentReplay,
          custom_fields_applied: Object.keys(mergedCustomFields).length,
          needs_seeded: applied.needsSeeded,
          signals_seeded: applied.signalsSeeded,
        });
      } catch (error) {
        if (createdScope?.created) {
          try {
            await removePartiallyCreatedLead(pool, createdScope);
          } catch {
            console.warn(
              "[lead-presets] failed to compensate partial lead creation",
            );
          }
        }
        if (sendPresetRequestError(error, res)) return;
        if (error instanceof LeadCreationValidationError) {
          return res.status(400).json({ error: error.code });
        }
        if (error instanceof DuplicateLeadError) {
          return res.status(409).json({
            error: "duplicate_lead",
            existing_lead_id: error.existingLeadId,
            matched_fields: error.matchedFields,
          });
        }
        if (error instanceof LeadCreationIdempotencyConflictError) {
          return res.status(409).json({
            error: "idempotency_key_conflict",
            existing_lead_id: error.existingLeadId,
          });
        }
        return res
          .status(500)
          .json({ error: "lead_create_failed", detail: "internal_error" });
      }
    },
  );
}
