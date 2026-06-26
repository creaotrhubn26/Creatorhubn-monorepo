/**
 * leadgrid-workflow-routes.ts
 *
 * REST-endepunkter for Smart Workflow Builder (#203).
 *
 * Mount-path: /api/leadgrid/workflows/*
 *
 * Endepunkter:
 *   GET    /api/leadgrid/workflows                    — liste alle workflows
 *   GET    /api/leadgrid/workflows/templates          — forhåndsbygde templates
 *   GET    /api/leadgrid/workflows/:id                — detalj
 *   POST   /api/leadgrid/workflows                    — opprett (m/ valgfri template_key)
 *   PATCH  /api/leadgrid/workflows/:id                — oppdater
 *   DELETE /api/leadgrid/workflows/:id                — soft-delete (is_active = false)
 *   POST   /api/leadgrid/workflows/:id/test           — dry-run mot test-lead
 *   POST   /api/leadgrid/workflows/:id/execute        — manuelt trigge mot lead
 *   GET    /api/leadgrid/workflows/:id/executions     — eksekverings-historikk
 *
 * RBAC:
 *   workflows.view    — GET endepunkter
 *   workflows.create  — POST/PATCH/DELETE
 *   workflows.execute — POST /test + /execute
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { emitWebhook } from "./webhook-emitter.js";
import { validateWorkflowPayload } from "./leadgrid-workflow-types.js";
import {
  executeWorkflow,
  publishEvent,
  type WorkflowEvent,
} from "./leadgrid-workflow-engine.js";
import {
  WORKFLOW_TEMPLATES,
  findTemplate,
} from "./leadgrid-workflow-templates.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function defaultOrgId(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.body as { organization_id?: string } | undefined)?.organization_id ??
    (req.query?.organization_id as string | undefined);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  // For /:id, hent workflow.organization_id
  const id = req.params?.id;
  if (typeof id === "string" && id.length > 0) {
    try {
      const r = await pool.query<{ organization_id: string }>(
        `SELECT organization_id::text FROM leadgrid_workflows WHERE id = $1::uuid LIMIT 1`,
        [id],
      );
      if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
    } catch {
      /* ignore */
    }
  }

  return defaultOrgId(pool, userId);
}

interface WorkflowListRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: unknown;
  conditions: unknown;
  actions: unknown;
  execution_count: number;
  last_executed_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  template_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToWorkflow(r: WorkflowListRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: r.is_active,
    triggerType: r.trigger_type,
    triggerConfig: r.trigger_config,
    conditions: r.conditions,
    actions: r.actions,
    executionCount: r.execution_count,
    lastExecutedAt: r.last_executed_at,
    lastErrorAt: r.last_error_at,
    lastErrorMessage: r.last_error_message,
    templateKey: r.template_key,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerLeadgridWorkflowRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permView = requireLeadMapPermission("workflows.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permCreate = requireLeadMapPermission("workflows.create", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });
  const permExecute = requireLeadMapPermission("workflows.execute", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });

  // ── GET /api/leadgrid/workflows ────────────────────────────────────
  app.get(
    "/api/leadgrid/workflows",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.json({ workflows: [] });
        return;
      }
      try {
        const onlyActiveRaw = req.query.active;
        const onlyActive =
          onlyActiveRaw === "true" || onlyActiveRaw === "1";
        const r = await pool.query<WorkflowListRow>(
          `SELECT id::text, name, description, is_active, trigger_type,
                  trigger_config, conditions, actions, execution_count,
                  last_executed_at, last_error_at, last_error_message,
                  template_key, created_by, created_at, updated_at
             FROM leadgrid_workflows
            WHERE organization_id = $1::uuid
              ${onlyActive ? "AND is_active = TRUE" : ""}
            ORDER BY updated_at DESC
            LIMIT 200`,
          [orgId],
        );
        res.json({
          workflows: r.rows.map(rowToWorkflow),
          total: r.rows.length,
        });
      } catch (err) {
        console.error("[workflows GET]", err);
        res.status(500).json({ error: "list_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/workflows/templates ──────────────────────────
  // OBS: må komme FØR /:id-route'n for å unngå at "templates" tolkes som :id
  app.get(
    "/api/leadgrid/workflows/templates",
    permView,
    async (_req: Request, res: Response): Promise<void> => {
      res.json({ templates: WORKFLOW_TEMPLATES });
    },
  );

  // ── GET /api/leadgrid/workflows/:id ────────────────────────────────
  app.get(
    "/api/leadgrid/workflows/:id",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const r = await pool.query<WorkflowListRow>(
          `SELECT id::text, name, description, is_active, trigger_type,
                  trigger_config, conditions, actions, execution_count,
                  last_executed_at, last_error_at, last_error_message,
                  template_key, created_by, created_at, updated_at
             FROM leadgrid_workflows
            WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        const row = r.rows[0];
        if (!row) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        res.json({ workflow: rowToWorkflow(row) });
      } catch (err) {
        console.error("[workflows GET :id]", err);
        res.status(500).json({ error: "fetch_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/workflows ───────────────────────────────────
  app.post(
    "/api/leadgrid/workflows",
    permCreate,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "ingen_org" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      let payload = body;

      // Hvis template_key satt: bygg payload fra templaten + overstyrelser
      const templateKey = body.template_key as string | undefined;
      if (templateKey) {
        const tpl = findTemplate(templateKey);
        if (!tpl) {
          res.status(400).json({ error: "template_not_found" });
          return;
        }
        payload = {
          name: body.name ?? tpl.name,
          description: body.description ?? tpl.description,
          trigger_type: tpl.trigger.type,
          trigger_config: tpl.trigger,
          conditions: body.conditions ?? tpl.conditions,
          actions: body.actions ?? tpl.actions,
          is_active: body.is_active ?? true,
          template_key: templateKey,
        };
      }

      const v = validateWorkflowPayload(payload);
      if (!v.ok) {
        res.status(400).json({ error: v.error });
        return;
      }
      const { name, trigger, conditions, actions } = v.value;
      const isActive =
        typeof payload.is_active === "boolean" ? payload.is_active : true;
      const description =
        typeof payload.description === "string" ? payload.description : null;

      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_workflows
             (organization_id, created_by, name, description, is_active,
              trigger_type, trigger_config, conditions, actions, template_key)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
           RETURNING id::text`,
          [
            orgId,
            session.userId,
            name,
            description,
            isActive,
            trigger.type,
            JSON.stringify(trigger),
            JSON.stringify(conditions),
            JSON.stringify(actions),
            (templateKey as string | undefined) ?? null,
          ],
        );
        const id = r.rows[0]?.id;
        void emitWebhook(
          pool,
          "workflow.created",
          { workflow_id: id, name, trigger_type: trigger.type },
          orgId,
        );
        res.status(201).json({ id, status: "created" });
      } catch (err) {
        console.error("[workflows POST]", err);
        res.status(500).json({ error: "create_failed" });
      }
    },
  );

  // ── PATCH /api/leadgrid/workflows/:id ──────────────────────────────
  app.patch(
    "/api/leadgrid/workflows/:id",
    permCreate,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (typeof body.name === "string") {
        sets.push(`name = $${p++}`);
        vals.push(body.name);
      }
      if (body.description !== undefined) {
        sets.push(`description = $${p++}`);
        vals.push(body.description);
      }
      if (typeof body.is_active === "boolean") {
        sets.push(`is_active = $${p++}`);
        vals.push(body.is_active);
      }

      // Hvis trigger/conditions/actions er med, valider hele payload-en
      if (
        body.trigger_type !== undefined ||
        body.trigger_config !== undefined ||
        body.conditions !== undefined ||
        body.actions !== undefined
      ) {
        // Hent eksisterende for å fylle inn det som ikke er sendt
        const cur = await pool.query<{
          name: string;
          trigger_type: string;
          trigger_config: unknown;
          conditions: unknown;
          actions: unknown;
        }>(
          `SELECT name, trigger_type, trigger_config, conditions, actions
             FROM leadgrid_workflows WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        const c = cur.rows[0];
        if (!c) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        const merged = {
          name: body.name ?? c.name,
          trigger_type: body.trigger_type ?? c.trigger_type,
          trigger_config: body.trigger_config ?? c.trigger_config,
          conditions: body.conditions ?? c.conditions,
          actions: body.actions ?? c.actions,
        };
        const v = validateWorkflowPayload(merged);
        if (!v.ok) {
          res.status(400).json({ error: v.error });
          return;
        }
        sets.push(`trigger_type = $${p++}`);
        vals.push(v.value.trigger.type);
        sets.push(`trigger_config = $${p++}::jsonb`);
        vals.push(JSON.stringify(v.value.trigger));
        sets.push(`conditions = $${p++}::jsonb`);
        vals.push(JSON.stringify(v.value.conditions));
        sets.push(`actions = $${p++}::jsonb`);
        vals.push(JSON.stringify(v.value.actions));
      }

      if (sets.length === 0) {
        res.status(400).json({ error: "no_fields_to_update" });
        return;
      }
      sets.push(`updated_at = NOW()`);
      vals.push(req.params.id);

      try {
        await pool.query(
          `UPDATE leadgrid_workflows SET ${sets.join(", ")} WHERE id = $${p}::uuid`,
          vals,
        );
        // Hvis is_active endret, emit webhook
        if (typeof body.is_active === "boolean") {
          const orgId = await resolveOrgIdSmart(req, pool, session.userId);
          if (orgId) {
            void emitWebhook(
              pool,
              body.is_active ? "workflow.activated" : "workflow.deactivated",
              { workflow_id: req.params.id },
              orgId,
            );
          }
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[workflows PATCH]", err);
        res.status(500).json({ error: "update_failed" });
      }
    },
  );

  // ── DELETE /api/leadgrid/workflows/:id ─────────────────────────────
  app.delete(
    "/api/leadgrid/workflows/:id",
    permCreate,
    async (req: Request, res: Response): Promise<void> => {
      try {
        await pool.query(
          `UPDATE leadgrid_workflows SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid`,
          [req.params.id],
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("[workflows DELETE]", err);
        res.status(500).json({ error: "delete_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/workflows/:id/test ──────────────────────────
  // Dry-run: kjør workflow mot test-lead (eller spesifisert lead) UTEN
  // å sende email/sms/whatsapp eller utføre DB-mutasjoner.
  app.post(
    "/api/leadgrid/workflows/:id/test",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const w = await pool.query<{
          id: string;
          organization_id: string;
          name: string;
          trigger_type: string;
          trigger_config: unknown;
          conditions: unknown;
          actions: unknown;
          is_active: boolean;
        }>(
          `SELECT id::text, organization_id::text, name, trigger_type,
                  trigger_config, conditions, actions, is_active
             FROM leadgrid_workflows WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        const row = w.rows[0];
        if (!row) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        const leadId =
          (req.body?.lead_id as string | undefined) ??
          (req.body?.leadId as string | undefined);
        const event: WorkflowEvent = {
          pool,
          organizationId: row.organization_id,
          type: row.trigger_type as WorkflowEvent["type"],
          leadId: leadId ?? null,
          actorUserId: session.userId,
          data: (req.body?.event_data ?? {}) as Record<string, unknown>,
        };
        const result = await executeWorkflow(
          pool,
          {
            id: row.id,
            organization_id: row.organization_id,
            name: row.name,
            trigger_type: row.trigger_type,
            trigger_config: row.trigger_config as WorkflowEvent["data"] as never,
            conditions: row.conditions as never,
            actions: row.actions as never,
            is_active: row.is_active,
          },
          event,
          { dryRun: true },
        );
        res.json({ result });
      } catch (err) {
        console.error("[workflows POST :id/test]", err);
        res.status(500).json({ error: "test_failed" });
      }
    },
  );

  // ── POST /api/leadgrid/workflows/:id/execute ───────────────────────
  // Manuelt trigge mot lead — real execution.
  app.post(
    "/api/leadgrid/workflows/:id/execute",
    permExecute,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const w = await pool.query<{
          id: string;
          organization_id: string;
          name: string;
          trigger_type: string;
          trigger_config: unknown;
          conditions: unknown;
          actions: unknown;
          is_active: boolean;
        }>(
          `SELECT id::text, organization_id::text, name, trigger_type,
                  trigger_config, conditions, actions, is_active
             FROM leadgrid_workflows WHERE id = $1::uuid LIMIT 1`,
          [req.params.id],
        );
        const row = w.rows[0];
        if (!row) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        if (!row.is_active) {
          res.status(400).json({ error: "workflow_inactive" });
          return;
        }
        const leadId =
          (req.body?.lead_id as string | undefined) ??
          (req.body?.leadId as string | undefined) ??
          null;
        const event: WorkflowEvent = {
          pool,
          organizationId: row.organization_id,
          type: "manual",
          leadId,
          actorUserId: session.userId,
          data: { source: "manual_execute" },
        };
        // Eksekverer asynkront, returnerer execution-id direkte
        void executeWorkflow(
          pool,
          {
            id: row.id,
            organization_id: row.organization_id,
            name: row.name,
            trigger_type: row.trigger_type,
            trigger_config: row.trigger_config as WorkflowEvent["data"] as never,
            conditions: row.conditions as never,
            actions: row.actions as never,
            is_active: row.is_active,
          },
          event,
        );
        res.json({ ok: true, queued: true });
      } catch (err) {
        console.error("[workflows POST :id/execute]", err);
        res.status(500).json({ error: "execute_failed" });
      }
    },
  );

  // ── GET /api/leadgrid/workflows/:id/executions ─────────────────────
  app.get(
    "/api/leadgrid/workflows/:id/executions",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const limitRaw = req.query.limit;
        const limit =
          typeof limitRaw === "string"
            ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50))
            : 50;
        const r = await pool.query<{
          id: string;
          lead_id: string | null;
          trigger_event: unknown;
          status: string;
          actions_executed: unknown;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
        }>(
          `SELECT id::text, lead_id::text, trigger_event, status,
                  actions_executed, error_message,
                  started_at, finished_at, duration_ms
             FROM leadgrid_workflow_executions
            WHERE workflow_id = $1::uuid
            ORDER BY started_at DESC
            LIMIT $2`,
          [req.params.id, limit],
        );
        res.json({
          executions: r.rows.map((row) => ({
            id: row.id,
            leadId: row.lead_id,
            triggerEvent: row.trigger_event,
            status: row.status,
            actionsExecuted: row.actions_executed,
            errorMessage: row.error_message,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            durationMs: row.duration_ms,
          })),
        });
      } catch (err) {
        console.error("[workflows GET :id/executions]", err);
        res.status(500).json({ error: "executions_failed" });
      }
    },
  );

  // ─── Re-export publishEvent så andre moduler kan importere derfra ─
  // (Andre route-filer importerer fra leadgrid-workflow-engine.js direkte.
  //  Denne kommentaren minner deg på det.)
}

export { publishEvent };
