/**
 * Project-scoped delivery playbooks and client focus-request inbox.
 *
 * Every route requires one accessible Leadgrid customer project. Row IDs are
 * useful only inside that exact organization/project tuple, so foreign IDs
 * receive the same 404 as unknown IDs.
 */

import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { notifyClient } from "./client-notification-service.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

interface PlaybookStep {
  step: number;
  title: string;
  instructions: string;
  estimated_minutes: number;
  needs_client_input: boolean;
  action_type: string;
}

interface PlaybookRequirement {
  title: string;
  description: string;
  type: string;
}

interface FocusRow {
  id: string;
  organization_id: string;
  project_id: string;
  customer_id: string;
  need_type: string;
  status: string;
  client_note: string | null;
}

interface DeliverableProgress {
  steps?: Array<Record<string, unknown>>;
  requirements?: Array<Record<string, unknown>>;
}

const ALLOWED_FOCUS_STATUSES = new Set([
  "pending",
  "acknowledged",
  "in_progress",
  "completed",
  "declined",
  "withdrawn",
]);
const ALLOWED_STEP_STATUSES = new Set([
  "pending",
  "in_progress",
  "done",
  "blocked",
]);

const PLAYBOOK_SELECT = `
  id::text, organization_id::text, need_type, title, description, category,
  requires_from_client, steps, verification, estimated_total_minutes,
  difficulty, is_active, is_system,
  created_at::text, updated_at::text
`;

function requestedProjectId(req: Request): string | null {
  const raw =
    req.body?.project_id ??
    req.body?.projectId ??
    req.query?.project_id ??
    req.query?.projectId;
  if (typeof raw !== "string") return null;
  const projectId = raw.trim();
  return projectId && projectId.length <= 255 ? projectId : null;
}

async function resolveAccessibleProjectOrganization(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) return null;
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  return project?.organizationId ?? null;
}

async function requireProject(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, LeadgridSession>,
): Promise<{
  session: LeadgridSession;
  project: LeadgridAccessibleProject;
} | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  const projectId = requestedProjectId(req);
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return null;
  }
  const project = await loadAccessibleLeadgridProject(
    pool,
    projectId,
    session.userId,
  );
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return { session, project };
}

function buildInitialProgress(
  steps: PlaybookStep[],
  requirements: PlaybookRequirement[],
): DeliverableProgress {
  return {
    steps: steps.map((step) => ({
      step: step.step,
      status: "pending",
      completed_at: null,
      completed_by: null,
      notes: null,
    })),
    requirements: requirements.map((requirement) => ({
      title: requirement.title,
      received: false,
      received_at: null,
    })),
  };
}

function safeSteps(raw: unknown): PlaybookStep[] {
  return Array.isArray(raw) ? raw as PlaybookStep[] : [];
}

function safeRequirements(raw: unknown): PlaybookRequirement[] {
  return Array.isArray(raw) ? raw as PlaybookRequirement[] : [];
}

async function rollback(client: PoolClient | null): Promise<void> {
  await client?.query("ROLLBACK").catch(() => undefined);
}

export function registerDeliveryPlaybookRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const root = "/api/admin-room/lead-map";
  const permissionOptions = {
    pool,
    activeSessions,
    resolveOrgId: resolveAccessibleProjectOrganization,
  };

  app.get(
    root + "/playbooks",
    requireLeadMapPermission("marketing.playbooks.view", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      try {
        const result = await pool.query(
          `SELECT ${PLAYBOOK_SELECT}
             FROM delivery_playbooks
            WHERE is_active = TRUE
              AND (
                organization_id = $1::uuid
                OR (organization_id IS NULL AND is_system = TRUE)
              )
            ORDER BY
              CASE WHEN organization_id = $1::uuid THEN 0 ELSE 1 END,
              need_type`,
          [scope.project.organizationId],
        );
        return res.json({
          project_id: scope.project.id,
          playbooks: result.rows,
        });
      } catch {
        return res.status(500).json({ error: "list_failed" });
      }
    },
  );

  app.get(
    root + "/playbooks/by-need/:need_type",
    requireLeadMapPermission("marketing.playbooks.view", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      try {
        const result = await pool.query(
          `SELECT ${PLAYBOOK_SELECT}
             FROM delivery_playbooks
            WHERE need_type = $1
              AND is_active = TRUE
              AND (
                organization_id = $2::uuid
                OR (organization_id IS NULL AND is_system = TRUE)
              )
            ORDER BY
              CASE WHEN organization_id = $2::uuid THEN 0 ELSE 1 END
            LIMIT 1`,
          [req.params.need_type, scope.project.organizationId],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "no_playbook" });
        }
        return res.json({
          project_id: scope.project.id,
          playbook: result.rows[0],
        });
      } catch {
        return res.status(500).json({ error: "find_failed" });
      }
    },
  );

  app.get(
    root + "/focus-requests",
    requireLeadMapPermission("marketing.deliveries.execute", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      const statusFilter =
        typeof req.query.status === "string" && req.query.status.trim()
          ? req.query.status.trim()
          : null;
      if (
        statusFilter
        && statusFilter !== "open"
        && !ALLOWED_FOCUS_STATUSES.has(statusFilter)
      ) {
        return res.status(400).json({ error: "invalid_status" });
      }

      try {
        const result = await pool.query(
          `SELECT cfr.id::text,
                  cfr.project_id,
                  cfr.customer_id,
                  cfr.need_type,
                  cfr.client_note,
                  cfr.status,
                  cfr.requested_at::text,
                  cfr.assigned_user_id,
                  customer.name AS customer_name,
                  customer.logo_url AS customer_logo,
                  customer.website_url,
                  customer.lead_category,
                  project.name AS project_name,
                  delivery.id::text AS deliverable_id
             FROM client_focus_requests cfr
             JOIN leadgrid_projects project
               ON project.organization_id = cfr.organization_id
              AND project.id = cfr.project_id
             JOIN crm_customers customer
               ON customer.id::text = cfr.customer_id::text
              AND customer.organization_id = cfr.organization_id
              AND customer.project_id = cfr.project_id
             LEFT JOIN LATERAL (
               SELECT candidate.id
                 FROM project_deliverables candidate
                WHERE candidate.focus_request_id = cfr.id
                  AND candidate.organization_id = cfr.organization_id
                  AND candidate.project_id = cfr.project_id
                ORDER BY candidate.created_at ASC, candidate.id ASC
                LIMIT 1
             ) delivery ON TRUE
            WHERE cfr.organization_id = $1::uuid
              AND cfr.project_id = $2
              AND (
                $3::text IS NULL
                OR ($3 = 'open' AND cfr.status IN ('pending', 'acknowledged'))
                OR cfr.status = $3
              )
            ORDER BY
              CASE cfr.status
                WHEN 'pending' THEN 1
                WHEN 'acknowledged' THEN 2
                WHEN 'in_progress' THEN 3
                WHEN 'completed' THEN 4
                ELSE 5
              END,
              cfr.requested_at DESC
            LIMIT 200`,
          [
            scope.project.organizationId,
            scope.project.id,
            statusFilter,
          ],
        );
        return res.json({
          project_id: scope.project.id,
          focus_requests: result.rows,
        });
      } catch {
        return res.status(500).json({ error: "inbox_failed" });
      }
    },
  );

  app.post(
    root + "/focus-requests/:id/start-delivery",
    requireLeadMapPermission("marketing.deliveries.execute", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      let client: PoolClient | null = null;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [
            "leadgrid-delivery:"
              + scope.project.organizationId
              + ":"
              + scope.project.id
              + ":"
              + req.params.id,
          ],
        );

        const focusResult = await client.query<FocusRow>(
          `SELECT focus.id::text,
                  focus.organization_id::text,
                  focus.project_id,
                  focus.customer_id::text,
                  focus.need_type,
                  focus.status,
                  focus.client_note
             FROM client_focus_requests focus
             JOIN crm_customers customer
               ON customer.id::text = focus.customer_id::text
              AND customer.organization_id = focus.organization_id
              AND customer.project_id = focus.project_id
            WHERE focus.id = $1::uuid
              AND focus.organization_id = $2::uuid
              AND focus.project_id = $3
            FOR UPDATE OF focus`,
          [
            req.params.id,
            scope.project.organizationId,
            scope.project.id,
          ],
        );
        const focus = focusResult.rows[0];
        if (!focus) {
          await rollback(client);
          return res.status(404).json({ error: "focus_request_not_found" });
        }
        if (focus.status === "declined" || focus.status === "withdrawn") {
          await rollback(client);
          return res.status(409).json({
            error: focus.status === "withdrawn"
              ? "focus_request_withdrawn"
              : "focus_request_declined",
          });
        }

        const existing = await client.query<{
          id: string;
          playbook_id: string;
          steps_count: number;
          requirements_count: number;
          title: string;
        }>(
          `SELECT delivery.id::text,
                  delivery.playbook_id::text,
                  COALESCE(jsonb_array_length(
                    delivery.progress_data->'steps'
                  ), 0)::int AS steps_count,
                  COALESCE(jsonb_array_length(
                    delivery.progress_data->'requirements'
                  ), 0)::int AS requirements_count,
                  delivery.title
             FROM project_deliverables delivery
            WHERE delivery.organization_id = $1::uuid
              AND delivery.project_id = $2
              AND delivery.focus_request_id = $3::uuid
            ORDER BY delivery.created_at ASC, delivery.id ASC
            LIMIT 1`,
          [focus.organization_id, focus.project_id, focus.id],
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          const row = existing.rows[0];
          res.setHeader("Idempotent-Replayed", "true");
          return res.status(200).json({
            deliverable_id: row.id,
            playbook_id: row.playbook_id,
            project_id: focus.project_id,
            steps_count: row.steps_count,
            requirements_count: row.requirements_count,
            replayed: true,
            message: "Leveransen finnes allerede.",
          });
        }

        const playbookResult = await client.query<{
          id: string;
          title: string;
          description: string | null;
          steps: unknown;
          requires_from_client: unknown;
        }>(
          `SELECT id::text,
                  title,
                  description,
                  steps,
                  requires_from_client
             FROM delivery_playbooks
            WHERE need_type = $1
              AND is_active = TRUE
              AND (
                organization_id = $2::uuid
                OR (organization_id IS NULL AND is_system = TRUE)
              )
            ORDER BY
              CASE WHEN organization_id = $2::uuid THEN 0 ELSE 1 END
            LIMIT 1`,
          [focus.need_type, focus.organization_id],
        );
        const playbook = playbookResult.rows[0];
        if (!playbook) {
          await rollback(client);
          return res.status(400).json({ error: "no_playbook_for_need" });
        }
        const steps = safeSteps(playbook.steps);
        const requirements = safeRequirements(playbook.requires_from_client);
        const progress = buildInitialProgress(steps, requirements);

        const deliverableResult = await client.query<{ id: string }>(
          `INSERT INTO project_deliverables
             (project_id, organization_id, customer_id, title, description,
              status, related_need_type, playbook_id, focus_request_id,
              progress_data, client_summary, assigned_user_id, created_by,
              started_at, target_date)
           VALUES (
             $1, $2::uuid, $3, $4, $5,
             'in_progress', $6, $7::uuid, $8::uuid,
             $9::jsonb, $10, $11, $11,
             NOW(), (NOW() + INTERVAL '14 days')::date
           )
           RETURNING id::text`,
          [
            focus.project_id,
            focus.organization_id,
            focus.customer_id,
            playbook.title,
            playbook.description,
            focus.need_type,
            playbook.id,
            focus.id,
            JSON.stringify(progress),
            "Vi har satt i gang "
              + playbook.title.toLowerCase()
              + ". Du ser fremgang her etter hvert som stegene fullføres.",
            scope.session.userId,
          ],
        );

        await client.query(
          `UPDATE client_focus_requests
              SET status = 'in_progress',
                  acknowledged_at = COALESCE(acknowledged_at, NOW()),
                  assigned_user_id = COALESCE(assigned_user_id, $4)
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [
            focus.id,
            focus.organization_id,
            focus.project_id,
            scope.session.userId,
          ],
        );
        await client.query("COMMIT");

        return res.status(201).json({
          deliverable_id: deliverableResult.rows[0].id,
          playbook_id: playbook.id,
          project_id: focus.project_id,
          steps_count: steps.length,
          requirements_count: requirements.length,
          replayed: false,
          message: "Leveranse opprettet: " + playbook.title,
        });
      } catch (error) {
        await rollback(client);
        console.error("[leadgrid delivery] start failed");
        return res.status(500).json({ error: "start_failed" });
      } finally {
        client?.release();
      }
    },
  );

  app.patch(
    root + "/focus-requests/:id",
    requireLeadMapPermission("marketing.deliveries.execute", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      const status =
        req.body?.status === undefined
          ? undefined
          : typeof req.body.status === "string"
            ? req.body.status.trim()
            : "";
      if (status !== undefined && !ALLOWED_FOCUS_STATUSES.has(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }

      let assignedUserId: string | null | undefined;
      if (req.body?.assigned_user_id !== undefined) {
        if (req.body.assigned_user_id === null) {
          assignedUserId = null;
        } else if (
          typeof req.body.assigned_user_id === "string"
          && req.body.assigned_user_id.trim()
        ) {
          const normalizedAssigneeId = req.body.assigned_user_id.trim();
          assignedUserId = normalizedAssigneeId;
          const assigneeAccess = await loadAccessibleLeadgridProject(
            pool,
            scope.project.id,
            normalizedAssigneeId,
          );
          if (
            !assigneeAccess
            || assigneeAccess.organizationId !== scope.project.organizationId
          ) {
            return res.status(404).json({ error: "assignee_not_found" });
          }
        } else {
          return res.status(400).json({ error: "invalid_assigned_user_id" });
        }
      }
      if (status === undefined && assignedUserId === undefined) {
        return res.status(400).json({ error: "no_changes" });
      }

      try {
        const result = await pool.query(
          `UPDATE client_focus_requests
              SET status = COALESCE($4, status),
                  assigned_user_id = CASE
                    WHEN $5::boolean THEN $6
                    ELSE assigned_user_id
                  END,
                  acknowledged_at = CASE
                    WHEN $4 IN ('acknowledged', 'in_progress')
                      THEN COALESCE(acknowledged_at, NOW())
                    ELSE acknowledged_at
                  END,
                  completed_at = CASE
                    WHEN $4 = 'completed'
                      THEN COALESCE(completed_at, NOW())
                    ELSE completed_at
                  END
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            RETURNING id::text, project_id, status, assigned_user_id`,
          [
            req.params.id,
            scope.project.organizationId,
            scope.project.id,
            status ?? null,
            assignedUserId !== undefined,
            assignedUserId ?? null,
          ],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ focus_request: result.rows[0] });
      } catch {
        return res.status(500).json({ error: "update_failed" });
      }
    },
  );

  app.get(
    root + "/deliverables/:id",
    requireLeadMapPermission("marketing.deliveries.execute", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;
      try {
        const result = await pool.query(
          `SELECT delivery.id::text,
                  delivery.project_id,
                  delivery.title,
                  delivery.description,
                  delivery.status,
                  delivery.client_summary,
                  delivery.related_need_type,
                  delivery.playbook_id::text,
                  delivery.progress_data,
                  delivery.target_date::text,
                  delivery.started_at::text,
                  delivery.completed_at::text,
                  delivery.assigned_user_id,
                  playbook.title AS playbook_title,
                  playbook.steps AS playbook_steps,
                  playbook.requires_from_client AS playbook_requirements,
                  playbook.verification AS playbook_verification,
                  playbook.estimated_total_minutes AS playbook_minutes,
                  playbook.difficulty AS playbook_difficulty
             FROM project_deliverables delivery
             LEFT JOIN delivery_playbooks playbook
               ON playbook.id = delivery.playbook_id
              AND (
                playbook.organization_id = delivery.organization_id
                OR (
                  playbook.organization_id IS NULL
                  AND playbook.is_system = TRUE
                )
              )
            WHERE delivery.id = $1::uuid
              AND delivery.organization_id = $2::uuid
              AND delivery.project_id = $3
            LIMIT 1`,
          [req.params.id, scope.project.organizationId, scope.project.id],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ deliverable: result.rows[0] });
      } catch {
        return res.status(500).json({ error: "load_failed" });
      }
    },
  );

  app.patch(
    root + "/deliverables/:id/step",
    requireLeadMapPermission("marketing.deliveries.execute", permissionOptions),
    async (req: Request, res: Response) => {
      const scope = await requireProject(req, res, pool, activeSessions);
      if (!scope) return;

      const stepNumber = req.body?.step_number;
      const stepStatus = req.body?.status;
      const requirementIndex = req.body?.requirement_index;
      const received = req.body?.received;
      const isStepUpdate =
        Number.isInteger(stepNumber)
        && typeof stepStatus === "string"
        && ALLOWED_STEP_STATUSES.has(stepStatus);
      const isRequirementUpdate =
        Number.isInteger(requirementIndex)
        && Number(requirementIndex) >= 0
        && typeof received === "boolean";
      if (isStepUpdate === isRequirementUpdate) {
        return res.status(400).json({ error: "invalid_step_update" });
      }
      const notes =
        typeof req.body?.notes === "string"
          ? req.body.notes.trim().slice(0, 2_000)
          : null;

      let client: PoolClient | null = null;
      let notification: {
        customerId: string;
        title: string;
        portalToken: string | null;
      } | null = null;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        const loaded = await client.query<{
          progress_data: DeliverableProgress | null;
          focus_request_id: string | null;
          customer_id: string | null;
          title: string;
        }>(
          `SELECT progress_data,
                  focus_request_id::text,
                  customer_id::text,
                  title
             FROM project_deliverables
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            FOR UPDATE`,
          [req.params.id, scope.project.organizationId, scope.project.id],
        );
        const current = loaded.rows[0];
        if (!current) {
          await rollback(client);
          return res.status(404).json({ error: "not_found" });
        }

        const progress: DeliverableProgress =
          current.progress_data
          && typeof current.progress_data === "object"
            ? structuredClone(current.progress_data)
            : { steps: [], requirements: [] };

        if (isStepUpdate) {
          const steps = Array.isArray(progress.steps) ? progress.steps : [];
          const index = steps.findIndex(
            (step) => Number(step.step) === Number(stepNumber),
          );
          if (index < 0) {
            await rollback(client);
            return res.status(400).json({ error: "step_not_found" });
          }
          steps[index] = {
            ...steps[index],
            status: stepStatus,
            notes: notes ?? steps[index].notes ?? null,
            completed_at:
              stepStatus === "done"
                ? new Date().toISOString()
                : null,
            completed_by:
              stepStatus === "done"
                ? scope.session.userId
                : null,
          };
          progress.steps = steps;
        } else {
          const requirements = Array.isArray(progress.requirements)
            ? progress.requirements
            : [];
          const index = Number(requirementIndex);
          if (!requirements[index]) {
            await rollback(client);
            return res.status(400).json({ error: "requirement_not_found" });
          }
          requirements[index] = {
            ...requirements[index],
            received,
            received_at: received ? new Date().toISOString() : null,
          };
          progress.requirements = requirements;
        }

        const steps = Array.isArray(progress.steps) ? progress.steps : [];
        const allDone =
          steps.length > 0
          && steps.every((step) => step.status === "done");
        const updated = await client.query(
          `UPDATE project_deliverables
              SET progress_data = $4::jsonb,
                  status = CASE
                    WHEN $5::boolean THEN 'completed'
                    ELSE status
                  END,
                  completed_at = CASE
                    WHEN $5::boolean
                      THEN COALESCE(completed_at, NOW())
                    ELSE completed_at
                  END,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            RETURNING id::text,
                      project_id,
                      status,
                      progress_data,
                      completed_at::text`,
          [
            req.params.id,
            scope.project.organizationId,
            scope.project.id,
            JSON.stringify(progress),
            allDone,
          ],
        );

        if (allDone && current.focus_request_id) {
          await client.query(
            `UPDATE client_focus_requests
                SET status = 'completed',
                    completed_at = COALESCE(completed_at, NOW())
              WHERE id = $1::uuid
                AND organization_id = $2::uuid
                AND project_id = $3`,
            [
              current.focus_request_id,
              scope.project.organizationId,
              scope.project.id,
            ],
          );
        }

        if (allDone && current.customer_id) {
          const token = await client.query<{ token: string }>(
            `SELECT token
               FROM client_portal_tokens
              WHERE customer_id::text = $1
                AND organization_id = $2::uuid
                AND project_id = $3
                AND revoked_at IS NULL
                AND expires_at > NOW()
              ORDER BY created_at DESC
              LIMIT 1`,
            [
              current.customer_id,
              scope.project.organizationId,
              scope.project.id,
            ],
          );
          notification = {
            customerId: current.customer_id,
            title: current.title,
            portalToken: token.rows[0]?.token ?? null,
          };
        }

        await client.query("COMMIT");

        if (notification) {
          try {
            await notifyClient(pool, {
              customerId: notification.customerId,
              organizationId: scope.project.organizationId,
              projectId: scope.project.id,
              event: "deliverable_completed",
              deliverableTitle: notification.title,
              portalToken: notification.portalToken ?? undefined,
            });
          } catch {
            console.error("[leadgrid delivery] client notification failed");
          }
        }
        return res.json({ deliverable: updated.rows[0] });
      } catch {
        await rollback(client);
        return res.status(500).json({ error: "step_update_failed" });
      } finally {
        client?.release();
      }
    },
  );
}

export const __test = {
  buildInitialProgress,
  requestedProjectId,
};
