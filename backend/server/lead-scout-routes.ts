/** Project-scoped Lead Scout HTTP surface. */
import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { assertPublicUrl } from "./ssrf-guard.js";
import {
  checkEndpointRateLimit,
  RateLimitExceededError,
} from "./role-room-agent-ratelimit.js";
import {
  runScoutForLead,
  ScoutIdempotencyConflictError,
  ScoutLeadNotFoundError,
  ScoutPreviousAttemptFailedError,
  ScoutRunInProgressError,
  type ScoutResult,
} from "./lead-scout-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}
interface ScopedRequest {
  userId: string;
  project: LeadgridAccessibleProject;
}
interface ScopedLeadRequest extends ScopedRequest { leadId: string }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestedProjectId(req: Request): string {
  const supplied = [req.body?.project_id, req.body?.projectId,
    req.query.project_id, req.query.projectId]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(supplied)];
  return unique.length === 1 && unique[0].length <= 255 ? unique[0] : "";
}

function requestIdempotencyKey(req: Request): string {
  const raw = req.headers["idempotency-key"];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedScoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate || candidate.length > 2048) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    return null;
  }
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.username = "";
    parsed.password = "";
    return assertPublicUrl(parsed.toString()).toString();
  } catch {
    return null;
  }
}

async function resolveAuthorizedProjectOrg(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) return null;
  try {
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    return project?.organizationId ?? null;
  } catch {
    return null;
  }
}

async function resolveProject(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<ScopedRequest | null> {
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
  const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return { userId: session.userId, project };
}

async function resolveLead(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<ScopedLeadRequest | null> {
  const scope = await resolveProject(req, res, pool, activeSessions);
  if (!scope) return null;
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: req.params.id ?? "",
    userId: scope.userId,
  });
  if (!lead || lead.organizationId !== scope.project.organizationId
    || lead.projectId !== scope.project.id) {
    res.status(404).json({ error: "lead_not_found" });
    return null;
  }
  return { ...scope, leadId: lead.id };
}

function sendScoutError(res: Response, error: unknown): Response {
  if (error instanceof RateLimitExceededError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return res.status(429).json({ error: "scout_rate_limited" });
  }
  if (error instanceof ScoutIdempotencyConflictError) {
    return res.status(409).json({ error: "idempotency_key_conflict" });
  }
  if (error instanceof ScoutLeadNotFoundError) {
    return res.status(404).json({ error: "lead_not_found" });
  }
  if (error instanceof ScoutRunInProgressError) {
    res.setHeader("Retry-After", "5");
    return res.status(409).json({ error: "scout_in_progress", scout_run_id: error.runId });
  }
  if (error instanceof ScoutPreviousAttemptFailedError) {
    return res.status(409).json({
      error: "scout_attempt_failed",
      scout_run_id: error.runId,
      hint: "Start a new run to retry after an explicit failure.",
    });
  }
  if (error instanceof TypeError) {
    return res.status(400).json({ error: "invalid_scout_request" });
  }
  return res.status(500).json({ error: "scout_failed", detail: "internal_error" });
}

export function registerLeadScoutRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";
  const permission = (key: string) => requireLeadMapPermission(key, {
    pool,
    activeSessions,
    resolveOrgId: resolveAuthorizedProjectOrg,
  });

  app.post(
    `${ROOT}/leads/:id/scout`,
    permission("marketing.scout.run"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveLead(req, res, pool, activeSessions);
        if (!scope) return;
        const key = requestIdempotencyKey(req);
        if (key.length < 8 || key.length > 200) {
          return res.status(400).json({ error: "idempotency_key_required" });
        }
        const leadResult = await pool.query<{
          id: string; name: string; website_url: string | null;
          lead_category: string | null;
        }>(
          `SELECT id::text, name, website_url, lead_category
             FROM crm_customers
            WHERE id::text = $1
              AND organization_id = $2::uuid
              AND project_id = $3
              AND archived_at IS NULL
            LIMIT 1`,
          [scope.leadId, scope.project.organizationId, scope.project.id],
        );
        const lead = leadResult.rows[0];
        if (!lead) return res.status(404).json({ error: "lead_not_found" });
        const submittedUrl = typeof req.body?.url === "string"
          ? req.body.url : lead.website_url;
        if (!submittedUrl) {
          return res.status(400).json({ error: "mangler_website_url" });
        }
        const websiteUrl = normalizedScoutUrl(submittedUrl);
        if (!websiteUrl) return res.status(400).json({ error: "invalid_website_url" });
        checkEndpointRateLimit(scope.userId, "leadgrid_scout_single", 10);
        const result = await runScoutForLead(pool, {
          customerId: lead.id,
          organizationId: scope.project.organizationId,
          projectId: scope.project.id,
          leadName: lead.name,
          websiteUrl,
          industry: lead.lead_category,
          triggeredBy: scope.userId,
          idempotencyKey: key,
        });
        res.setHeader("Idempotent-Replay", result.idempotent_replay ? "true" : "false");
        return res.status(result.idempotent_replay ? 200 : 201).json(result);
      } catch (error) {
        return sendScoutError(res, error);
      }
    },
  );

  app.get(
    `${ROOT}/leads/:id/needs-overview`,
    permission("marketing.needs.view"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveLead(req, res, pool, activeSessions);
        if (!scope) return;
        const values = [scope.leadId, scope.project.organizationId, scope.project.id];
        const [needs, signals, scores, lastRun, composite] = await Promise.all([
          pool.query(
            `SELECT id::text, need_type, priority, claude_confidence,
                    evidence, evidence_url, status, detected_at::text, updated_at::text
               FROM crm_customer_needs
              WHERE customer_id=$1 AND organization_id=$2::uuid AND project_id=$3
                AND status IN ('detected','accepted')
              ORDER BY priority DESC, claude_confidence DESC NULLS LAST`,
            values,
          ),
          pool.query(
            `SELECT id::text, signal_type, polarity, raw_value, source, detected_at::text
               FROM crm_customer_signals
              WHERE customer_id=$1 AND organization_id=$2::uuid AND project_id=$3
              ORDER BY polarity, signal_type`,
            values,
          ),
          pool.query(
            `SELECT id::text, dimension, raw_value, normalized_0_100,
                    weight, contribution::text AS contribution, source, computed_at::text
               FROM crm_customer_scores
              WHERE customer_id=$1 AND organization_id=$2::uuid AND project_id=$3
              ORDER BY contribution DESC NULLS LAST`,
            values,
          ),
          pool.query(
            `SELECT id::text, status, started_at::text, finished_at::text,
                    needs_found, signals_found, scores_computed,
                    tech_fingerprint, error_message
               FROM crm_customer_scout_runs
              WHERE customer_id=$1 AND organization_id=$2::uuid AND project_id=$3
              ORDER BY started_at DESC LIMIT 1`,
            values,
          ),
          pool.query<{ score: string }>(
            `SELECT COALESCE(ROUND(SUM(contribution)/NULLIF(SUM(weight),0)),0)::text AS score
               FROM crm_customer_scores
              WHERE customer_id=$1 AND organization_id=$2::uuid AND project_id=$3`,
            values,
          ),
        ]);
        return res.json({
          organization_id: scope.project.organizationId,
          project_id: scope.project.id,
          needs: needs.rows,
          signals: signals.rows,
          scores: scores.rows,
          composite_score: Math.round(Number(composite.rows[0]?.score ?? 0)),
          last_run: lastRun.rows[0] ?? null,
        });
      } catch {
        return res.status(500).json({ error: "needs_overview_failed", detail: "internal_error" });
      }
    },
  );

  app.patch(
    `${ROOT}/needs/:id`,
    permission("marketing.needs.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        if (!UUID_PATTERN.test(req.params.id)) {
          return res.status(404).json({ error: "need_not_found" });
        }
        const set: string[] = [];
        const values: unknown[] = [];
        if (typeof req.body?.priority === "number") {
          values.push(Math.max(1, Math.min(5, Math.round(req.body.priority))));
          set.push(`priority=$${values.length}`);
        }
        if (typeof req.body?.status === "string"
          && ["detected","accepted","dismissed","resolved"].includes(req.body.status)) {
          values.push(req.body.status);
          set.push(`status=$${values.length}`);
          set.push(req.body.status === "resolved" ? "resolved_at=now()" : "resolved_at=NULL");
        }
        if (typeof req.body?.evidence === "string") {
          values.push(req.body.evidence.slice(0, 1000));
          set.push(`evidence=$${values.length}`);
        }
        if (set.length === 0) return res.status(400).json({ error: "no_changes" });
        set.push("updated_at=now()");
        values.push(req.params.id, scope.project.organizationId, scope.project.id);
        const idAt = values.length - 2;
        const orgAt = values.length - 1;
        const projectAt = values.length;
        const updated = await pool.query(
          `UPDATE crm_customer_needs need SET ${set.join(", ")}
            WHERE need.id=$${idAt}::uuid
              AND need.organization_id=$${orgAt}::uuid
              AND need.project_id=$${projectAt}
              AND EXISTS (
                SELECT 1 FROM crm_customers lead
                 WHERE lead.id::text=need.customer_id
                   AND lead.organization_id=need.organization_id
                   AND lead.project_id=need.project_id
                   AND lead.archived_at IS NULL
              )
            RETURNING id::text, customer_id, need_type, priority, status, updated_at::text`,
          values,
        );
        if (updated.rowCount === 0) return res.status(404).json({ error: "need_not_found" });
        return res.json({ need: updated.rows[0] });
      } catch {
        return res.status(500).json({ error: "update_failed" });
      }
    },
  );

  app.post(
    `${ROOT}/leads/scout-bulk`,
    permission("marketing.scout.run"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        const key = requestIdempotencyKey(req);
        if (key.length < 8 || key.length > 200) {
          return res.status(400).json({ error: "idempotency_key_required" });
        }
        const submittedLeadIds: unknown[] = Array.isArray(req.body?.lead_ids)
          ? req.body.lead_ids
          : [];
        if (submittedLeadIds.length === 0 || submittedLeadIds.length > 10
          || submittedLeadIds.some((value) => typeof value !== "string"
            || !UUID_PATTERN.test(value.trim()))) {
          return res.status(400).json({ error: "lead_ids_must_contain_1_to_10_unique_ids" });
        }
        const normalizedLeadIds = (submittedLeadIds as string[]).map((value) => value.trim());
        const leadIds = [...new Set(normalizedLeadIds)];
        if (leadIds.length !== normalizedLeadIds.length) {
          return res.status(400).json({ error: "lead_ids_must_contain_1_to_10_unique_ids" });
        }

        // Validate every lead before creating a batch or starting external I/O.
        const leadRows = await pool.query<{
          id: string; name: string; website_url: string | null;
          lead_category: string | null;
        }>(
          `SELECT id::text, name, website_url, lead_category
             FROM crm_customers
            WHERE id::text=ANY($1::text[])
              AND organization_id=$2::uuid AND project_id=$3
              AND archived_at IS NULL`,
          [leadIds, scope.project.organizationId, scope.project.id],
        );
        const byId = new Map(leadRows.rows.map((lead) => [lead.id, lead]));
        if (leadIds.some((id) => !byId.has(id))) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        if (leadIds.some((id) => !byId.get(id)?.website_url)) {
          return res.status(400).json({ error: "lead_missing_website_url" });
        }
        const validatedUrls = new Map<string, string>();
        for (const leadId of leadIds) {
          const websiteUrl = normalizedScoutUrl(byId.get(leadId)?.website_url);
          if (!websiteUrl) {
            return res.status(400).json({ error: "lead_has_invalid_website_url" });
          }
          validatedUrls.set(leadId, websiteUrl);
        }
        checkEndpointRateLimit(scope.userId, "leadgrid_scout_bulk", 4);

        const keyHash = sha256(key);
        const requestHash = sha256(JSON.stringify({
          organizationId: scope.project.organizationId,
          projectId: scope.project.id,
          leadIds: [...leadIds].sort(),
        }));
        const claim = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_scout_batches
             (organization_id,project_id,triggered_by,idempotency_key_hash,request_hash,status)
           VALUES ($1::uuid,$2,$3,$4,$5,'running')
           ON CONFLICT (organization_id,project_id,idempotency_key_hash) DO NOTHING
           RETURNING id::text`,
          [scope.project.organizationId, scope.project.id, scope.userId, keyHash, requestHash],
        );
        let batchId = claim.rows[0]?.id;
        if (!batchId) {
          const priorResult = await pool.query<{
            id: string; request_hash: string; result_payload: unknown; stale: boolean;
          }>(
            `SELECT id::text,request_hash,result_payload,
                    started_at < now()-interval '30 minutes' AS stale
               FROM leadgrid_scout_batches
              WHERE organization_id=$1::uuid AND project_id=$2
                AND idempotency_key_hash=$3 LIMIT 1`,
            [scope.project.organizationId, scope.project.id, keyHash],
          );
          const prior = priorResult.rows[0];
          if (!prior || prior.request_hash !== requestHash) {
            return res.status(409).json({ error: "idempotency_key_conflict" });
          }
          if (prior.result_payload) {
            res.setHeader("Idempotent-Replay", "true");
            return res.status(200).json({
              ...(prior.result_payload as Record<string, unknown>),
              idempotent_replay: true,
            });
          }
          if (!prior.stale) {
            res.setHeader("Retry-After", "5");
            return res.status(409).json({ error: "scout_batch_in_progress", batch_id: prior.id });
          }
          const takeover = await pool.query<{ id: string }>(
            `UPDATE leadgrid_scout_batches
                  SET triggered_by=$4,status='running',started_at=now(),finished_at=NULL
                WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
                  AND started_at < now()-interval '30 minutes'
                RETURNING id::text`,
            [prior.id, scope.project.organizationId, scope.project.id, scope.userId],
          );
          batchId = takeover.rows[0]?.id;
          if (!batchId) {
            res.setHeader("Retry-After", "5");
            return res.status(409).json({ error: "scout_batch_in_progress" });
          }
        }

        const results: Array<{
          lead_id: string;
          status: "completed" | "failed";
          result?: ScoutResult;
          error?: string;
        }> = [];
        for (const leadId of leadIds) {
          const lead = byId.get(leadId)!;
          try {
            const result = await runScoutForLead(pool, {
              customerId: lead.id,
              organizationId: scope.project.organizationId,
              projectId: scope.project.id,
              leadName: lead.name,
              websiteUrl: validatedUrls.get(lead.id)!,
              industry: lead.lead_category,
              triggeredBy: scope.userId,
              idempotencyKey: sha256(`${key}\0${lead.id}`),
            });
            results.push({ lead_id: lead.id, status: "completed", result });
          } catch {
            results.push({ lead_id: lead.id, status: "failed", error: "scout_failed" });
          }
        }
        const payload = {
          batch_id: batchId,
          organization_id: scope.project.organizationId,
          project_id: scope.project.id,
          completed_count: results.filter((item) => item.status === "completed").length,
          failed_count: results.filter((item) => item.status === "failed").length,
          results,
          idempotent_replay: false,
        };
        await pool.query(
          `UPDATE leadgrid_scout_batches
                SET status=CASE WHEN $4::int=0 THEN 'completed' ELSE 'failed' END,
                    result_payload=$5::jsonb,finished_at=now()
              WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
                AND status='running'`,
          [batchId, scope.project.organizationId, scope.project.id,
            payload.failed_count, JSON.stringify(payload)],
        );
        return res.status(201).json(payload);
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          res.setHeader("Retry-After", String(error.retryAfterSeconds));
          return res.status(429).json({ error: "scout_rate_limited" });
        }
        return res.status(500).json({ error: "scout_batch_failed", detail: "internal_error" });
      }
    },
  );
}
