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
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function requestedProjectId(req: Request): string | null {
  const value =
    req.body?.project_id ?? req.body?.projectId ??
    req.query?.project_id ?? req.query?.projectId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function resolveWorkflowProject(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  let projectId = requestedProjectId(req);
  const id = req.params?.id;
  if (!projectId && typeof id === "string" && id.length > 0) {
    try {
      const r = await pool.query<{ project_id: string | null }>(
        `SELECT project_id::text
           FROM leadgrid_workflows
          WHERE id = $1::uuid
          LIMIT 1`,
        [id],
      );
      projectId = r.rows[0]?.project_id ?? null;
    } catch {
      return null;
    }
  }
  if (!projectId) return null;
  return loadAccessibleLeadgridProject(pool, projectId, userId);
}

async function resolveWorkflowOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  return (await resolveWorkflowProject(req, pool, userId))?.organizationId ?? null;
}

interface WorkflowListRow {
  id: string;
  project_id: string;
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
    projectId: r.project_id,
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
    resolveOrgId: resolveWorkflowOrgId,
  });
  const permCreate = requireLeadMapPermission("workflows.create", {
    pool,
    activeSessions,
    resolveOrgId: resolveWorkflowOrgId,
  });
  const permExecute = requireLeadMapPermission("workflows.execute", {
    pool,
    activeSessions,
    resolveOrgId: resolveWorkflowOrgId,
  });

  // ── GET /api/leadgrid/workflows ────────────────────────────────────
  app.get(
    "/api/leadgrid/workflows",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(requestedProjectId(req) ? 404 : 400).json({
          error: requestedProjectId(req)
            ? "project_not_found"
            : "project_id_required",
        });
        return;
      }
      try {
        const onlyActiveRaw = req.query.active;
        const onlyActive =
          onlyActiveRaw === "true" || onlyActiveRaw === "1";
        const r = await pool.query<WorkflowListRow>(
          `SELECT id::text, project_id::text, name, description, is_active, trigger_type,
                  trigger_config, conditions, actions, execution_count,
                  last_executed_at, last_error_at, last_error_message,
                  template_key, created_by, created_at, updated_at
             FROM leadgrid_workflows
            WHERE organization_id = $1::uuid
              AND project_id = $2
              ${onlyActive ? "AND is_active = TRUE" : ""}
            ORDER BY updated_at DESC
            LIMIT 200`,
          [project.organizationId, project.id],
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
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(requestedProjectId(req) ? 404 : 400).json({
          error: requestedProjectId(req)
            ? "project_not_found"
            : "project_id_required",
        });
        return;
      }
      res.json({ templates: WORKFLOW_TEMPLATES });
    },
  );

  // ── GET /api/leadgrid/workflows/:id ────────────────────────────────
  app.get(
    "/api/leadgrid/workflows/:id",
    permView,
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
        return;
      }
      try {
        const r = await pool.query<WorkflowListRow>(
          `SELECT id::text, project_id::text, name, description, is_active, trigger_type,
                  trigger_config, conditions, actions, execution_count,
                  last_executed_at, last_error_at, last_error_message,
                  template_key, created_by, created_at, updated_at
             FROM leadgrid_workflows
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [req.params.id, project.organizationId, project.id],
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(requestedProjectId(req) ? 404 : 400).json({
          error: requestedProjectId(req)
            ? "project_not_found"
            : "project_id_required",
        });
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
      if (actions.some((action) =>
        action.type === "leadgrid.discover_leads" &&
        action.project_id !== undefined &&
        action.project_id !== project.id
      )) {
        res.status(400).json({ error: "workflow_project_scope_mismatch" });
        return;
      }
      const isActive =
        typeof payload.is_active === "boolean" ? payload.is_active : true;
      const description =
        typeof payload.description === "string" ? payload.description : null;

      try {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_workflows
             (organization_id, project_id, created_by, name, description, is_active,
              trigger_type, trigger_config, conditions, actions, template_key)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
           RETURNING id::text`,
          [
            project.organizationId,
            project.id,
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
          {
            workflow_id: id,
            project_id: project.id,
            name,
            trigger_type: trigger.type,
          },
          project.organizationId,
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
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
             FROM leadgrid_workflows
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [req.params.id, project.organizationId, project.id],
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
        if (v.value.actions.some((action) =>
          action.type === "leadgrid.discover_leads" &&
          action.project_id !== undefined &&
          action.project_id !== project.id
        )) {
          res.status(400).json({ error: "workflow_project_scope_mismatch" });
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
      const idParam = p++;
      vals.push(req.params.id);
      const orgParam = p++;
      vals.push(project.organizationId);
      const projectParam = p++;
      vals.push(project.id);

      try {
        const updated = await pool.query(
          `UPDATE leadgrid_workflows
              SET ${sets.join(", ")}
            WHERE id = $${idParam}::uuid
              AND organization_id = $${orgParam}::uuid
              AND project_id = $${projectParam}`,
          vals,
        );
        if (!updated.rowCount) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        // Hvis is_active endret, emit webhook
        if (typeof body.is_active === "boolean") {
          void emitWebhook(
            pool,
            body.is_active ? "workflow.activated" : "workflow.deactivated",
            { workflow_id: req.params.id, project_id: project.id },
            project.organizationId,
          );
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
        return;
      }
      try {
        const updated = await pool.query(
          `UPDATE leadgrid_workflows
              SET is_active = FALSE, updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [req.params.id, project.organizationId, project.id],
        );
        if (!updated.rowCount) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
        return;
      }
      try {
        const w = await pool.query<{
          id: string;
          organization_id: string;
          project_id: string;
          name: string;
          trigger_type: string;
          trigger_config: unknown;
          conditions: unknown;
          actions: unknown;
          is_active: boolean;
        }>(
          `SELECT id::text, organization_id::text, project_id::text, name, trigger_type,
                  trigger_config, conditions, actions, is_active
             FROM leadgrid_workflows
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [req.params.id, project.organizationId, project.id],
        );
        const row = w.rows[0];
        if (!row) {
          res.status(404).json({ error: "workflow_not_found" });
          return;
        }
        const leadId =
          (req.body?.lead_id as string | undefined) ??
          (req.body?.leadId as string | undefined);
        if (leadId) {
          const lead = await loadAccessibleLeadgridLead(pool, {
            leadId,
            userId: session.userId,
          });
          if (
            !lead ||
            lead.organizationId !== project.organizationId ||
            lead.projectId !== project.id
          ) {
            res.status(404).json({ error: "lead_not_found" });
            return;
          }
        }
        const event: WorkflowEvent = {
          pool,
          organizationId: row.organization_id,
          projectId: row.project_id,
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
            project_id: row.project_id,
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
        return;
      }
      try {
        const w = await pool.query<{
          id: string;
          organization_id: string;
          project_id: string;
          name: string;
          trigger_type: string;
          trigger_config: unknown;
          conditions: unknown;
          actions: unknown;
          is_active: boolean;
        }>(
          `SELECT id::text, organization_id::text, project_id::text, name, trigger_type,
                  trigger_config, conditions, actions, is_active
             FROM leadgrid_workflows
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [req.params.id, project.organizationId, project.id],
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
        // Body kan inneholde:
        //   - lead_id / leadId        (single-lead, eldre format)
        //   - lead_ids / leadIds      (array av lead-ids, fra iPad-bulk-UI)
        // Vi normaliserer til en array internt. Tom array = ingen lead-binding
        // (workflow kjøres én gang uten leadId).
        const singleLeadId =
          (req.body?.lead_id as string | undefined) ??
          (req.body?.leadId as string | undefined) ??
          null;
        const arrayCandidate =
          (req.body?.lead_ids as unknown) ?? (req.body?.leadIds as unknown);
        const leadIds: string[] = Array.from(new Set(Array.isArray(arrayCandidate)
          ? arrayCandidate
              .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
              .map((x) => x.trim())
              .slice(0, 100) // hard-cap så vi ikke aksepterer 10 000 IDs
          : singleLeadId
            ? [singleLeadId]
            : []));

        // Valider hele bulk-settet før noen jobber startes. Dermed kan ikke en
        // blanding av prosjekt-ID-er gi en delvis utført workflow.
        for (const leadId of leadIds) {
          const lead = await loadAccessibleLeadgridLead(pool, {
            leadId,
            userId: session.userId,
          });
          if (
            !lead ||
            lead.organizationId !== project.organizationId ||
            lead.projectId !== project.id
          ) {
            res.status(404).json({ error: "lead_not_found" });
            return;
          }
        }

        const triggeredAt = new Date().toISOString();
        const totalLeads = Math.max(leadIds.length, 1);

        const buildEvent = (leadId: string | null): WorkflowEvent => ({
          pool,
          organizationId: row.organization_id,
          projectId: row.project_id,
          type: "manual",
          leadId,
          actorUserId: session.userId,
          data: {
            source: "manual_execute",
            bulk: leadIds.length > 1,
            total: leadIds.length,
            triggered_at: triggeredAt,
          },
        });
        const wfDef = {
          id: row.id,
          organization_id: row.organization_id,
          project_id: row.project_id,
          name: row.name,
          trigger_type: row.trigger_type,
          trigger_config: row.trigger_config as WorkflowEvent["data"] as never,
          conditions: row.conditions as never,
          actions: row.actions as never,
          is_active: row.is_active,
        };
        if (leadIds.length === 0) {
          // Bevarer eldre oppførsel — én eksekvering uten lead-binding.
          void executeWorkflow(pool, wfDef, buildEvent(null));
        } else {
          for (const lid of leadIds) {
            void executeWorkflow(pool, wfDef, buildEvent(lid));
          }
        }
        // iPad bulk-UI forventer en "execution_id"-shape; bygg en
        // deterministisk pseudo-id basert på workflow + tidspunkt så
        // UI kan vise progress (selv om hver per-lead-eksekvering
        // har sin egen id i leadgrid_workflow_executions).
        const executionId = `${row.id}:${Date.parse(triggeredAt)}`;
        res.json({
          ok: true,
          queued: true,
          execution_id: executionId,
          status: "running",
          total_leads: totalLeads,
          triggered_at: triggeredAt,
          lead_ids: leadIds,
        });
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
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const project = await resolveWorkflowProject(req, pool, session.userId);
      if (!project) {
        res.status(404).json({ error: "workflow_not_found" });
        return;
      }
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
             FROM leadgrid_workflow_executions execution
            WHERE execution.workflow_id = $1::uuid
              AND execution.organization_id = $2::uuid
              AND execution.project_id = $3
              AND EXISTS (
                SELECT 1
                  FROM leadgrid_workflows workflow
                 WHERE workflow.id = execution.workflow_id
                   AND workflow.organization_id = $2::uuid
                   AND workflow.project_id = $3
              )
            ORDER BY started_at DESC
            LIMIT $4`,
          [req.params.id, project.organizationId, project.id, limit],
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
