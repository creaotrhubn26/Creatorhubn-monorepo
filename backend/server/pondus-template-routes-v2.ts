import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import {
  analyzePondusTemplate,
  parsePondusTemplateInput,
  type PondusTemplateInput,
} from "./pondus-domain.js";
import {
  assertPondusEntitled,
  canManagePondus,
  isPondusTemplateVisible,
  resolvePondusAccess,
  sendPondusAccessError,
  type PondusAccessContext,
  type PondusSession,
} from "./pondus-access.js";

export interface PondusTemplateRoutesV2Deps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => PondusSession | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEMPLATE_COLUMNS = `id, name, description, category, kind, score, steps, objections,
  analysis, analysis_meta, created_by, org_id, is_published, published_at,
  published_by, version, archived_at, created_at, updated_at`;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    kind: row.kind,
    score: Number(row.score ?? 0),
    steps: row.steps ?? [],
    objections: row.objections ?? [],
    analysis: row.analysis ?? {},
    analysis_meta: row.analysis_meta ?? {},
    created_by: row.created_by,
    org_id: row.org_id,
    is_published: Boolean(row.is_published),
    published_at: row.published_at,
    published_by: row.published_by,
    version: Number(row.version ?? 1),
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function snapshot(row: Record<string, unknown>) {
  return {
    name: row.name,
    description: row.description,
    category: row.category,
    kind: row.kind,
    score: row.score,
    steps: row.steps,
    objections: row.objections,
    analysis: row.analysis,
    analysis_meta: row.analysis_meta,
    org_id: row.org_id,
    is_published: row.is_published,
    published_at: row.published_at,
    published_by: row.published_by,
    version: row.version,
  };
}

function validationError(res: Response, issues: Array<{ path: string; message: string }>) {
  return res.status(400).json({ error: "validation_failed", issues });
}

async function requestAccess(
  pool: Pool,
  req: Request,
  res: Response,
  session: PondusSession,
): Promise<PondusAccessContext | null> {
  try {
    const access = await resolvePondusAccess(pool, req, session);
    return await assertPondusEntitled(pool, access, res) ? access : null;
  } catch (error) {
    if (sendPondusAccessError(res, error)) return null;
    throw error;
  }
}

async function saveSnapshot(client: PoolClient, row: Record<string, unknown>, userId: string) {
  await client.query(
    `INSERT INTO pondus_template_versions (template_id, version, snapshot, changed_by)
     VALUES ($1::uuid, $2, $3::jsonb, $4)
     ON CONFLICT (template_id, version) DO NOTHING`,
    [row.id, Number(row.version ?? 1), JSON.stringify(snapshot(row)), userId],
  );
}

function canManageRow(access: PondusAccessContext, row: Record<string, unknown>): boolean {
  if (access.platformAdmin) return true;
  return canManagePondus(access)
    && row.org_id != null
    && String(row.org_id) === access.organizationId;
}

export function registerPondusTemplateRoutesV2(deps: PondusTemplateRoutesV2Deps): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/leadgrid/pondus/templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      const values: unknown[] = [];
      const clauses = ["archived_at IS NULL"];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        clauses.push(sql.replace("$?", `$${values.length}`));
      };
      const showDrafts = text(req.query.published).toLowerCase() === "all" && canManagePondus(access);
      if (!showDrafts) clauses.push("is_published = TRUE");
      if (!access.platformAdmin) {
        add(
          showDrafts
            ? "((org_id IS NULL AND is_published = TRUE) OR org_id = $?::uuid)"
            : "(org_id IS NULL OR org_id = $?::uuid)",
          access.organizationId,
        );
      }
      const category = text(req.query.category).trim();
      const kind = text(req.query.kind).trim();
      if (category) add("category = $?", category);
      if (kind) add("kind = $?", kind);
      const result = await pool.query(
        `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
          WHERE ${clauses.join(" AND ")}
          ORDER BY is_published DESC, score DESC, updated_at DESC`,
        values,
      );
      res.json({ templates: result.rows.map((row) => mapTemplate(row)) });
    } catch (error) {
      console.error("[pondus-v2] list failed:", error);
      res.status(500).json({ error: "pondus_templates_failed" });
    }
  });

  app.get("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!(await isPondusTemplateVisible(pool, id, access, { includeDraftForManagers: true }))) {
        return res.status(404).json({ error: "not_found" });
      }
      const result = await pool.query(`SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates WHERE id = $1::uuid`, [id]);
      return res.json({ template: mapTemplate(result.rows[0]) });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] get failed:", error);
      return res.status(500).json({ error: "pondus_template_failed" });
    }
  });

  app.post("/api/leadgrid/pondus/analyze", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!canManagePondus(access)) return res.status(403).json({ error: "manager_role_required" });
      const parsed = parsePondusTemplateInput(req.body);
      if (parsed.ok === false) return validationError(res, parsed.issues);
      return res.json(analyzePondusTemplate(parsed.value));
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] analyze failed:", error);
      return res.status(500).json({ error: "pondus_analysis_failed" });
    }
  });

  app.post("/api/leadgrid/pondus/templates", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!canManagePondus(access)) return res.status(403).json({ error: "manager_role_required" });
      const parsed = parsePondusTemplateInput(req.body);
      if (parsed.ok === false) return validationError(res, parsed.issues);
      const input = parsed.value;
      const analysis = analyzePondusTemplate(input);
      const requestedOrg = req.body?.org_id;
      let orgId: string | null = access.platformAdmin ? null : access.organizationId;
      if (access.platformAdmin && requestedOrg != null) {
        if (typeof requestedOrg !== "string" || !UUID.test(requestedOrg)) {
          return res.status(400).json({ error: "invalid_org_id" });
        }
        orgId = requestedOrg;
      }
      if (!access.platformAdmin && !orgId) return res.status(400).json({ error: "organization_required" });
      const publishNow = !access.platformAdmin;
      const result = await pool.query(
        `INSERT INTO pondus_templates
          (name, description, category, kind, score, steps, objections, analysis,
           analysis_meta, created_by, org_id, is_published, published_at, published_by, version)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,
                 $10::varchar(255),$11::uuid,$12::boolean,
                 CASE WHEN $12::boolean THEN NOW() ELSE NULL END,
                 CASE WHEN $12::boolean THEN $10::varchar(255) ELSE NULL END,1)
         RETURNING ${TEMPLATE_COLUMNS}`,
        [
          input.name, input.description ?? null, input.category, input.kind, analysis.score,
          JSON.stringify(input.steps ?? []), JSON.stringify(input.objections ?? []),
          JSON.stringify(analysis.analysis), JSON.stringify(analysis.analysis_meta),
          session.userId, orgId, publishNow,
        ],
      );
      return res.status(201).json({ template: mapTemplate(result.rows[0]) });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] create failed:", error);
      return res.status(500).json({ error: "pondus_template_create_failed" });
    }
  });

  app.patch("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    const partial = parsePondusTemplateInput(req.body, { partial: true });
    if (partial.ok === false) return validationError(res, partial.issues);
    if (partial.value.expectedVersion == null) {
      return res.status(428).json({ error: "expected_version_required" });
    }
    const client = await pool.connect();
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      await client.query("BEGIN");
      const currentResult = await client.query(
        `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
          WHERE id = $1::uuid AND archived_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "not_found" });
      }
      if (!canManageRow(access, current)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "manager_role_required" });
      }
      const currentVersion = Number(current.version ?? 1);
      if (partial.value.expectedVersion !== currentVersion) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "version_conflict",
          expected_version: partial.value.expectedVersion,
          current_version: currentVersion,
        });
      }
      const merged: PondusTemplateInput = {
        name: partial.value.name ?? String(current.name ?? ""),
        description: partial.value.description !== undefined
          ? partial.value.description : (current.description as string | null),
        category: partial.value.category ?? String(current.category ?? "custom"),
        kind: partial.value.kind ?? String(current.kind ?? "telephone"),
        steps: partial.value.steps ?? (current.steps as PondusTemplateInput["steps"] ?? []),
        objections: partial.value.objections
          ?? (current.objections as PondusTemplateInput["objections"] ?? []),
      };
      const validated = parsePondusTemplateInput(merged);
      if (validated.ok === false) {
        await client.query("ROLLBACK");
        return validationError(res, validated.issues);
      }
      const analysis = analyzePondusTemplate(validated.value);
      await saveSnapshot(client, current, session.userId);
      const result = await client.query(
        `UPDATE pondus_templates
            SET name=$2, description=$3, category=$4, kind=$5, steps=$6::jsonb,
                objections=$7::jsonb, score=$8, analysis=$9::jsonb,
                analysis_meta=$10::jsonb, version=version+1, updated_at=NOW()
          WHERE id=$1::uuid AND version=$11
          RETURNING ${TEMPLATE_COLUMNS}`,
        [
          id, validated.value.name, validated.value.description ?? null,
          validated.value.category, validated.value.kind,
          JSON.stringify(validated.value.steps ?? []),
          JSON.stringify(validated.value.objections ?? []), analysis.score,
          JSON.stringify(analysis.analysis), JSON.stringify(analysis.analysis_meta), currentVersion,
        ],
      );
      if (!result.rows[0]) throw new Error("optimistic_update_lost");
      await client.query("COMMIT");
      return res.json({ template: mapTemplate(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] update failed:", error);
      return res.status(500).json({ error: "pondus_template_update_failed" });
    } finally {
      client.release();
    }
  });

  app.post("/api/leadgrid/pondus/templates/:id/publish", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    const shouldPublish = req.body?.published !== false;
    if (req.body?.expected_version == null && req.body?.expectedVersion == null) {
      return res.status(428).json({ error: "expected_version_required" });
    }
    const expected = Number(req.body?.expected_version ?? req.body?.expectedVersion);
    if (!Number.isInteger(expected) || expected < 1) {
      return res.status(400).json({ error: "invalid_expected_version" });
    }
    const client = await pool.connect();
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      await client.query("BEGIN");
      const currentResult = await client.query(
        `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
          WHERE id=$1::uuid AND archived_at IS NULL FOR UPDATE`, [id],
      );
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "not_found" });
      }
      if (!canManageRow(access, current)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "manager_role_required" });
      }
      if (expected !== Number(current.version)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "version_conflict", current_version: Number(current.version) });
      }
      await saveSnapshot(client, current, session.userId);
      const result = await client.query(
        `UPDATE pondus_templates
            SET is_published=$2,
                published_at=CASE WHEN $2 THEN NOW() ELSE published_at END,
                published_by=CASE WHEN $2 THEN $3 ELSE published_by END,
                version=version+1, updated_at=NOW()
          WHERE id=$1::uuid AND version=$4
          RETURNING ${TEMPLATE_COLUMNS}`,
        [id, shouldPublish, session.userId, expected],
      );
      await client.query("COMMIT");
      return res.json({ template: mapTemplate(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] publish failed:", error);
      return res.status(500).json({ error: "pondus_template_publish_failed" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/leadgrid/pondus/templates/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      const currentResult = await pool.query(
        `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates WHERE id=$1::uuid AND archived_at IS NULL`, [id],
      );
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) return res.status(404).json({ error: "not_found" });
      if (!canManageRow(access, current)) return res.status(403).json({ error: "manager_role_required" });
      await pool.query(
        `UPDATE pondus_templates SET archived_at=NOW(), is_published=FALSE, updated_at=NOW()
          WHERE id=$1::uuid`, [id],
      );
      return res.json({ ok: true, id, mode: "archived" });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] archive failed:", error);
      return res.status(500).json({ error: "pondus_template_delete_failed" });
    }
  });

  app.get("/api/leadgrid/pondus/templates/:id/versions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!canManagePondus(access)) {
        return res.status(404).json({ error: "not_found" });
      }
      const templateResult = await pool.query<{ org_id: string | null; archived_at: unknown }>(
        `SELECT org_id::text, archived_at FROM pondus_templates WHERE id=$1::uuid LIMIT 1`, [id],
      );
      const template = templateResult.rows[0];
      if (!template || template.archived_at
          || (!access.platformAdmin && template.org_id !== access.organizationId)) {
        return res.status(404).json({ error: "not_found" });
      }
      const result = await pool.query(
        `SELECT id, template_id, version, snapshot, changed_by, changed_at
           FROM pondus_template_versions WHERE template_id=$1::uuid ORDER BY version DESC`, [id],
      );
      return res.json({
        versions: result.rows.map((row) => ({
          id: row.id, template_id: row.template_id, version: Number(row.version),
          snapshot: row.snapshot ?? {}, changed_by: row.changed_by, changed_at: row.changed_at,
        })),
      });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] versions failed:", error);
      return res.status(500).json({ error: "pondus_versions_failed" });
    }
  });

  app.post("/api/leadgrid/pondus/templates/:id/rollback/:version", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = text(req.params.id);
    const targetVersion = Number(req.params.version);
    if (!UUID.test(id)) return res.status(400).json({ error: "invalid_id" });
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      return res.status(400).json({ error: "invalid_version" });
    }
    if (req.body?.expected_version == null && req.body?.expectedVersion == null) {
      return res.status(428).json({ error: "expected_version_required" });
    }
    const expected = Number(req.body?.expected_version ?? req.body?.expectedVersion);
    if (!Number.isInteger(expected) || expected < 1) {
      return res.status(400).json({ error: "invalid_expected_version" });
    }
    const client = await pool.connect();
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      await client.query("BEGIN");
      const currentResult = await client.query(
        `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
          WHERE id=$1::uuid AND archived_at IS NULL FOR UPDATE`, [id],
      );
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "not_found" });
      }
      if (!canManageRow(access, current)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "manager_role_required" });
      }
      if (expected !== Number(current.version)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "version_conflict", current_version: Number(current.version) });
      }
      const versionResult = await client.query<{ snapshot: Record<string, unknown> }>(
        `SELECT snapshot FROM pondus_template_versions
          WHERE template_id=$1::uuid AND version=$2 LIMIT 1`, [id, targetVersion],
      );
      const target = versionResult.rows[0]?.snapshot;
      if (!target) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "version_not_found" });
      }
      const validated = parsePondusTemplateInput(target);
      if (validated.ok === false) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "invalid_version_snapshot", issues: validated.issues });
      }
      const fallbackAnalysis = analyzePondusTemplate(validated.value);
      await saveSnapshot(client, current, session.userId);
      const result = await client.query(
        `UPDATE pondus_templates
            SET name=$2, description=$3, category=$4, kind=$5, score=$6,
                steps=$7::jsonb, objections=$8::jsonb, analysis=$9::jsonb,
                analysis_meta=$10::jsonb, is_published=$11, version=version+1,
                updated_at=NOW()
          WHERE id=$1::uuid AND version=$12
          RETURNING ${TEMPLATE_COLUMNS}`,
        [
          id, validated.value.name, validated.value.description ?? null,
          validated.value.category, validated.value.kind,
          Number(target.score ?? fallbackAnalysis.score),
          JSON.stringify(validated.value.steps ?? []), JSON.stringify(validated.value.objections ?? []),
          JSON.stringify(target.analysis ?? fallbackAnalysis.analysis),
          JSON.stringify(target.analysis_meta ?? fallbackAnalysis.analysis_meta),
          target.is_published === true, expected,
        ],
      );
      await client.query("COMMIT");
      return res.json({ template: mapTemplate(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] rollback failed:", error);
      return res.status(500).json({ error: "pondus_rollback_failed" });
    } finally {
      client.release();
    }
  });

  app.get("/api/leadgrid/pondus/content-by-step", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = text(req.query.template_id);
    if (!UUID.test(templateId)) return res.status(400).json({ error: "missing_or_invalid_template_id" });
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!(await isPondusTemplateVisible(pool, templateId, access, { includeDraftForManagers: true }))) {
        return res.status(404).json({ error: "not_found" });
      }
      const values: unknown[] = [templateId];
      let stepClause = "";
      const stepKey = text(req.query.step_key).trim();
      if (stepKey) {
        values.push(stepKey);
        stepClause = "AND step_key=$2";
      }
      const result = await pool.query(
        `SELECT id, template_id, step_key, variant_name, content_text, score, created_by, created_at
           FROM pondus_content_by_step WHERE template_id=$1::uuid ${stepClause}
          ORDER BY score DESC, created_at DESC`, values,
      );
      return res.json({ variants: result.rows });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] content list failed:", error);
      return res.status(500).json({ error: "pondus_content_failed" });
    }
  });

  app.post("/api/leadgrid/pondus/content-by-step", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = text(req.body?.template_id);
    const stepKey = text(req.body?.step_key).trim();
    const variantName = text(req.body?.variant_name).trim();
    const contentText = text(req.body?.content_text);
    if (!UUID.test(templateId)) return res.status(400).json({ error: "invalid_template_id" });
    const issues = [
      ...(!stepKey || stepKey.length > 60 ? [{ path: "step_key", message: "Må være 1–60 tegn." }] : []),
      ...(!variantName || variantName.length > 120 ? [{ path: "variant_name", message: "Må være 1–120 tegn." }] : []),
      ...(!contentText || contentText.length > 4_000 ? [{ path: "content_text", message: "Må være 1–4000 tegn." }] : []),
    ];
    if (issues.length) return validationError(res, issues);
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!canManagePondus(access)) {
        return res.status(404).json({ error: "not_found" });
      }
      const templateResult = await pool.query<{ org_id: string | null; archived_at: unknown }>(
        `SELECT org_id::text, archived_at FROM pondus_templates WHERE id=$1::uuid LIMIT 1`, [templateId],
      );
      const template = templateResult.rows[0];
      if (!template || template.archived_at
          || (!access.platformAdmin && template.org_id !== access.organizationId)) {
        return res.status(404).json({ error: "not_found" });
      }
      const result = await pool.query(
        `INSERT INTO pondus_content_by_step
          (template_id, step_key, variant_name, content_text, score, created_by)
         VALUES ($1::uuid,$2,$3,$4,$5,$6)
         RETURNING id, template_id, step_key, variant_name, content_text, score, created_by, created_at`,
        [templateId, stepKey, variantName, contentText,
         Math.max(0, Math.min(100, Number(req.body?.score) || 0)), session.userId],
      );
      return res.status(201).json({ variant: result.rows[0] });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] content create failed:", error);
      return res.status(500).json({ error: "pondus_content_create_failed" });
    }
  });

  app.post("/api/leadgrid/pondus/objections/bulk-attach", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const category = text(req.body?.category).trim();
    const prompt = text(req.body?.prompt).trim();
    const responseText = text(req.body?.response).trim();
    const issues = [
      ...(!category || category.length > 60 ? [{ path: "category", message: "Må være 1–60 tegn." }] : []),
      ...(!prompt || prompt.length > 500 ? [{ path: "prompt", message: "Må være 1–500 tegn." }] : []),
      ...(!responseText || responseText.length > 4_000
        ? [{ path: "response", message: "Må være 1–4000 tegn." }] : []),
    ];
    if (issues.length) return validationError(res, issues);
    const client = await pool.connect();
    try {
      const access = await requestAccess(pool, req, res, session);
      if (!access) return;
      if (!canManagePondus(access)) return res.status(403).json({ error: "manager_role_required" });
      await client.query("BEGIN");
      const currentResult = await client.query(
        access.platformAdmin
          ? `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
              WHERE category=$1 AND org_id IS NULL AND archived_at IS NULL FOR UPDATE`
          : `SELECT ${TEMPLATE_COLUMNS} FROM pondus_templates
              WHERE category=$1 AND org_id=$2::uuid AND archived_at IS NULL FOR UPDATE`,
        access.platformAdmin ? [category] : [category, access.organizationId],
      );
      const updated = [];
      for (const raw of currentResult.rows) {
        const current = raw as Record<string, unknown>;
        const input: PondusTemplateInput = {
          name: String(current.name), description: current.description as string | null,
          category: String(current.category), kind: String(current.kind),
          steps: current.steps as PondusTemplateInput["steps"],
          objections: [
            ...((current.objections as PondusTemplateInput["objections"]) ?? []),
            { id: crypto.randomUUID(), prompt, response: responseText },
          ],
        };
        const validated = parsePondusTemplateInput(input);
        if (validated.ok === false) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "template_validation_failed", template_id: current.id, issues: validated.issues });
        }
        const analysis = analyzePondusTemplate(validated.value);
        await saveSnapshot(client, current, session.userId);
        const result = await client.query(
          `UPDATE pondus_templates
              SET objections=$2::jsonb, score=$3, analysis=$4::jsonb,
                  analysis_meta=$5::jsonb, version=version+1, updated_at=NOW()
            WHERE id=$1::uuid RETURNING ${TEMPLATE_COLUMNS}`,
          [current.id, JSON.stringify(validated.value.objections), analysis.score,
           JSON.stringify(analysis.analysis), JSON.stringify(analysis.analysis_meta)],
        );
        updated.push(mapTemplate(result.rows[0]));
      }
      await client.query("COMMIT");
      return res.json({ updated: updated.length, templates: updated });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-v2] bulk attach failed:", error);
      return res.status(500).json({ error: "pondus_objection_bulk_attach_failed" });
    } finally {
      client.release();
    }
  });
}
