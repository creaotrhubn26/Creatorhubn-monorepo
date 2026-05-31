import express from "express";
import type { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../migrations/schema.js";

export interface OrchestrationRoutesDeps {
  app: express.Application;
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  requireUserSession: (req: any, res: any) => any;
}

export function setupOrchestrationRoutes(
  deps: OrchestrationRoutesDeps,
): void {
  const { app, pool, db, requireUserSession } = deps;

  // Custom workflow storage forblir in-memory for nå (fallback for
  // editingWorkflows-tabellen håndteres lenger ned).
  const customWorkflows: Record<string, any[]> = {};

  // Helper: mark eldre køede runs som 'expired' når de når expires_at.
  // Kjøres ved hver status-query for å holde data ærlig uten egen cron.
  const expireStaleRuns = async (): Promise<void> => {
    try {
      await pool.query(
        `UPDATE orchestration_runs
            SET status = 'expired',
                updated_at = now(),
                completed_at = now(),
                error_message = COALESCE(error_message, 'Ingen worker plukket opp jobben innen tidsfristen')
          WHERE status IN ('queued', 'running')
            AND expires_at < now()`,
      );
    } catch (err) {
      // Stille — vi vil ikke at en feilet UPDATE skal blokkere status-svaret
      console.error("[orchestration] expireStaleRuns failed:", err);
    }
  };

  // Get orchestration status — returnerer nå alle runs for session-id,
  // ikke en hardkodet liste på 4. Bruker faktisk DB-state.
  app.get("/api/orchestration/status/:sessionId", async (req, res) => {
    const { sessionId } = req.params;

    await expireStaleRuns();

    try {
      const result = await pool.query(
        `SELECT
           orchestration_id,
           status,
           trigger_data,
           completed_actions,
           failed_actions,
           error_message,
           started_at,
           updated_at,
           completed_at,
           expires_at
         FROM orchestration_runs
         WHERE session_id = $1
         ORDER BY started_at DESC`,
        [sessionId],
      );

      // For hver orchestration_id: behold kun seneste run.
      const latestPerOrchestration: Record<string, any> = {};
      for (const row of result.rows) {
        if (!latestPerOrchestration[row.orchestration_id]) {
          latestPerOrchestration[row.orchestration_id] = {
            running: row.status === "queued" || row.status === "running",
            lastRun: row.started_at,
            completedActions: row.completed_actions || [],
            failedActions: row.failed_actions || [],
            status: row.status,
            errorMessage: row.error_message || null,
            completedAt: row.completed_at,
            expiresAt: row.expires_at,
          };
        }
      }

      res.json({
        success: true,
        sessionId,
        orchestrations: latestPerOrchestration,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[orchestration] status query failed:", err);
      res.status(500).json({
        success: false,
        error: "Kunne ikke hente orkesteringsstatus",
      });
    }
  });

  // Trigger orchestration — persisterer til DB. Ingen fake completion.
  // Status forblir 'queued' inntil en worker faktisk gjør jobben, eller
  // til expires_at passerer (15 min default) og statusen settes til 'expired'.
  app.post("/api/orchestration/trigger", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const { orchestrationId, triggerData, sessionId } = req.body;

    if (!orchestrationId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: "orchestrationId og sessionId må sendes inn",
      });
    }

    const userId =
      (req as any).session?.userId ||
      (req as any).user?.id ||
      "anonymous";

    try {
      const insert = await pool.query(
        `INSERT INTO orchestration_runs
           (session_id, orchestration_id, user_id, status, trigger_data)
         VALUES ($1, $2, $3, 'queued', $4)
         RETURNING id, started_at, expires_at`,
        [sessionId, orchestrationId, userId, triggerData || {}],
      );

      const row = insert.rows[0];

      res.json({
        success: true,
        runId: row.id,
        orchestrationId,
        sessionId,
        status: "queued",
        message:
          "Orkestreringen er køet. Statusen oppdateres når en behandler plukker opp jobben.",
        startedAt: row.started_at,
        expiresAt: row.expires_at,
      });
    } catch (err) {
      console.error("[orchestration] trigger insert failed:", err);
      res.status(500).json({
        success: false,
        error: "Kunne ikke kø orkestreringen",
      });
    }
  });

  // Stop orchestration
  app.post("/api/orchestration/stop", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const { orchestrationId, sessionId } = req.body;

    try {
      const result = await pool.query(
        `UPDATE orchestration_runs
            SET status = 'stopped',
                updated_at = now(),
                completed_at = now()
          WHERE session_id = $1
            AND orchestration_id = $2
            AND status IN ('queued', 'running')
          RETURNING id`,
        [sessionId, orchestrationId],
      );

      res.json({
        success: true,
        orchestrationId,
        sessionId,
        status: "stopped",
        stopped: result.rowCount || 0,
      });
    } catch (err) {
      console.error("[orchestration] stop failed:", err);
      res.status(500).json({
        success: false,
        error: "Kunne ikke stoppe orkestreringen",
      });
    }
  });

  // Worker-API: gjør at en utfører kan oppdatere progresjonen på et run.
  // Brukes når actions kjører ekte — vi har ingen workers enda, men endepunktet
  // finnes så vi kan koble dem på uten å lyve om status.
  app.post("/api/orchestration/runs/:runId/progress", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const { runId } = req.params;
    const { completedAction, failedAction, errorMessage, status } = req.body;

    try {
      const updates: string[] = ["updated_at = now()"];
      const params: any[] = [];
      let paramIdx = 1;

      if (completedAction) {
        updates.push(
          `completed_actions = completed_actions || $${paramIdx}::jsonb`,
        );
        params.push(JSON.stringify([completedAction]));
        paramIdx++;
      }
      if (failedAction) {
        updates.push(
          `failed_actions = failed_actions || $${paramIdx}::jsonb`,
        );
        params.push(JSON.stringify([failedAction]));
        paramIdx++;
      }
      if (errorMessage) {
        updates.push(`error_message = $${paramIdx}`);
        params.push(errorMessage);
        paramIdx++;
      }
      if (status) {
        updates.push(`status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
        if (
          status === "completed" ||
          status === "partial" ||
          status === "failed"
        ) {
          updates.push("completed_at = now()");
        }
      }

      params.push(runId);

      await pool.query(
        `UPDATE orchestration_runs
            SET ${updates.join(", ")}
          WHERE id = $${paramIdx}`,
        params,
      );

      res.json({ success: true });
    } catch (err) {
      console.error("[orchestration] progress update failed:", err);
      res.status(500).json({
        success: false,
        error: "Kunne ikke oppdatere progresjon",
      });
    }
  });

  // Get custom workflows - DB-first with in-memory fallback
  app.get("/api/orchestration/workflows/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
      // Try database first
      const dbWorkflows = await db
        .select()
        .from(schema.editingWorkflows)
        .where(eq(schema.editingWorkflows.userId, userId));

      if (dbWorkflows.length > 0) {
        return res.json({
          success: true,
          workflows: dbWorkflows.map((w) => ({
            ...w,
            steps: w.steps || [],
          })),
          count: dbWorkflows.length,
          source: "database",
        });
      }
    } catch (dbError) {
      console.warn(
        "Database query failed for workflows, using in-memory fallback:",
        dbError,
      );
    }

    // Fallback to in-memory
    const workflows = customWorkflows[userId] || [];
    res.json({
      success: true,
      workflows,
      count: workflows.length,
      source: "memory",
    });
  });

  // Save custom workflow - DB-first with in-memory fallback
  app.post("/api/orchestration/workflows/:userId", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const { userId } = req.params;
    const workflow = req.body;

    const newWorkflow = {
      id: workflow.id || crypto.randomUUID(),
      userId,
      projectId: workflow.projectId || "default",
      workflowName: workflow.name || workflow.workflowName || "Unnamed Workflow",
      workflowType: workflow.type || workflow.workflowType || "custom",
      steps: JSON.stringify(workflow.steps || []),
      totalFiles: workflow.totalFiles || 0,
      processedFiles: 0,
      batchSettings: workflow.batchSettings
        ? JSON.stringify(workflow.batchSettings)
        : null,
      qualityControl: workflow.qualityControl
        ? JSON.stringify(workflow.qualityControl)
        : null,
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Try database first
      await db.insert(schema.editingWorkflows).values(newWorkflow);

      return res.json({
        success: true,
        workflow: { ...newWorkflow, steps: workflow.steps || [] },
        message: "Workflow saved to database successfully",
        source: "database",
      });
    } catch (dbError) {
      console.warn(
        "Database insert failed for workflow, using in-memory fallback:",
        dbError,
      );
    }

    // Fallback to in-memory
    if (!customWorkflows[userId]) {
      customWorkflows[userId] = [];
    }

    const memoryWorkflow = {
      ...workflow,
      id: newWorkflow.id,
      userId,
      createdAt: newWorkflow.createdAt,
      updatedAt: newWorkflow.updatedAt,
    };

    customWorkflows[userId].push(memoryWorkflow);

    res.json({
      success: true,
      workflow: memoryWorkflow,
      message: "Workflow saved to memory (database unavailable)",
      source: "memory",
    });
  });

  // Delete custom workflow - DB-first with in-memory fallback
  app.delete(
    "/api/orchestration/workflows/:userId/:workflowId",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      const { userId, workflowId } = req.params;

      try {
        // Try database first
        await db
          .delete(schema.editingWorkflows)
          .where(eq(schema.editingWorkflows.id, workflowId));
      } catch (dbError) {
        console.warn("Database delete failed for workflow:", dbError);
      }

      // Also remove from in-memory
      if (customWorkflows[userId]) {
        customWorkflows[userId] = customWorkflows[userId].filter(
          (w) => w.id.toString() !== workflowId,
        );
      }

      res.json({
        success: true,
        message: "Workflow deleted successfully",
      });
    },
  );

  // Slice 9X.79 — Ekte workflow-execution via engine (ikke simulering)
  app.post(
    "/api/orchestration/workflows/:userId/:workflowId/execute",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      const { userId, workflowId } = req.params;
      const { context, steps: bodySteps, workflowName } = req.body || {};

      // Finn workflow fra in-memory dict (custom) eller bruk steps fra body
      // (frontend kan sende predefined-workflow-steps direkte)
      const workflow = customWorkflows[userId]?.find(
        (w) => w.id.toString() === workflowId,
      );
      const steps = workflow?.actions || workflow?.steps || bodySteps || [];

      if (!steps.length) {
        return res.status(400).json({ success: false, error: 'no_steps' });
      }

      const normalizedSteps = steps.map((s: any) => ({
        action_id: s.action?.id || s.action_id || s.id,
        action_name: s.action?.name || s.action_name || s.name,
      }));

      try {
        const { startWorkflowRun } = await import('./workflow-execution-engine.js');
        const { runId, stepsTotal } = await startWorkflowRun({
          pool,
          userId,
          workflowId,
          workflowName: workflowName || workflow?.name || 'Workflow',
          profession: req.body?.profession,
          steps: normalizedSteps,
          context: context || {},
        });
        res.json({
          success: true,
          runId,
          workflowId,
          status: 'queued',
          message: `Workflow startet — kjører ${stepsTotal} steg`,
          stepsTotal,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('[workflow-execute] failed:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Hent run-status for frontend polling
  app.get(
    "/api/orchestration/workflows/runs/:runId",
    async (req, res) => {
      try {
        const { getRunStatus } = await import('./workflow-execution-engine.js');
        const data = await getRunStatus(pool, req.params.runId);
        if (!data) return res.status(404).json({ success: false, error: 'not_found' });
        res.json({ success: true, ...data });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Bekreft manuelt steg
  app.post(
    "/api/orchestration/workflows/runs/:runId/steps/:stepIndex/confirm",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { confirmManualStep } = await import('./workflow-execution-engine.js');
        await confirmManualStep(pool, req.params.runId, parseInt(req.params.stepIndex, 10), req.body?.note);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Re-kjør et feilet steg
  app.post(
    "/api/orchestration/workflows/runs/:runId/steps/:stepIndex/retry",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { retryStep } = await import('./workflow-execution-engine.js');
        const result = await retryStep(pool, req.params.runId, parseInt(req.params.stepIndex, 10));
        res.json({ success: true, ...result });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Avbryt en kjørende run
  app.post(
    "/api/orchestration/workflows/runs/:runId/cancel",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { cancelRun } = await import('./workflow-execution-engine.js');
        const result = await cancelRun(pool, req.params.runId);
        res.json({ success: true, ...result });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Planlagte workflows
  app.get(
    "/api/orchestration/workflows/:userId/schedules",
    async (req, res) => {
      try {
        const { listSchedules } = await import('./workflow-scheduler.js');
        const rows = await listSchedules(pool, req.params.userId);
        res.json({ success: true, data: rows });
      } catch (err: any) {
        if (err?.code === '42P01') return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  app.put(
    "/api/orchestration/workflows/:userId/:workflowId/schedule",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { upsertSchedule } = await import('./workflow-scheduler.js');
        const row = await upsertSchedule(pool, {
          workflowId: req.params.workflowId,
          userId: req.params.userId,
          profession: req.body?.profession,
          scheduleType: req.body?.scheduleType,
          scheduleHour: Number(req.body?.scheduleHour ?? 9),
          scheduleDow: req.body?.scheduleDow !== undefined ? Number(req.body.scheduleDow) : null,
          enabled: req.body?.enabled !== false,
        });
        res.json({ success: true, data: row });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  app.delete(
    "/api/orchestration/workflows/:userId/:workflowId/schedule",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { deleteSchedule } = await import('./workflow-scheduler.js');
        await deleteSchedule(pool, req.params.userId, req.params.workflowId);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Event-baserte triggere
  app.get(
    "/api/orchestration/workflows/:userId/triggers",
    async (req, res) => {
      try {
        const { listTriggers, SUPPORTED_EVENTS } = await import('./workflow-triggers.js');
        const rows = await listTriggers(pool, req.params.userId);
        res.json({ success: true, data: rows, supportedEvents: SUPPORTED_EVENTS });
      } catch (err: any) {
        if (err?.code === '42P01') {
          const { SUPPORTED_EVENTS } = await import('./workflow-triggers.js');
          return res.json({ success: true, data: [], supportedEvents: SUPPORTED_EVENTS });
        }
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  app.put(
    "/api/orchestration/workflows/:userId/:workflowId/triggers/:eventType",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { upsertTrigger } = await import('./workflow-triggers.js');
        const row = await upsertTrigger(pool, {
          workflowId: req.params.workflowId,
          userId: req.params.userId,
          profession: req.body?.profession,
          eventType: req.params.eventType as any,
          conditions: req.body?.conditions || {},
          enabled: req.body?.enabled !== false,
        });
        res.json({ success: true, data: row });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
      }
    },
  );

  app.delete(
    "/api/orchestration/workflows/:userId/:workflowId/triggers/:eventType",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const { deleteTrigger } = await import('./workflow-triggers.js');
        await deleteTrigger(pool, req.params.userId, req.params.workflowId, req.params.eventType as any);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — AI-kostnad fra SmartFlyt for header-widget
  app.get(
    "/api/orchestration/workflows/:userId/ai-cost",
    async (req, res) => {
      try {
        const userId = req.params.userId;
        const days = Math.min(parseInt((req.query.days as string) || '30', 10), 90);
        const r = await pool.query(
          `SELECT
             COUNT(*)::int                       AS call_count,
             COALESCE(SUM(cost_usd), 0)::float8 AS total_usd,
             COALESCE(SUM(input_tokens), 0)::int  AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::int AS output_tokens
           FROM ai_usage_log
           WHERE user_id = $1
             AND feature LIKE 'smartflyt/%'
             AND created_at >= NOW() - ($2 || ' days')::interval`,
          [userId, String(days)],
        );
        const row = r.rows[0] || {};
        // USD → NOK med rough 11 (vises kun som indikator, ikke regnskap)
        const totalUsd = Number(row.total_usd) || 0;
        const totalNok = totalUsd * 11;
        res.json({
          success: true,
          data: {
            days,
            callCount: row.call_count || 0,
            totalUsd,
            totalNok,
            inputTokens: row.input_tokens || 0,
            outputTokens: row.output_tokens || 0,
          },
        });
      } catch (err: any) {
        if (err?.code === '42P01') {
          return res.json({ success: true, data: { days: 30, callCount: 0, totalUsd: 0, totalNok: 0, inputTokens: 0, outputTokens: 0 } });
        }
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Siste auto-culling-resultat for Photo Enhancer-panel
  app.get(
    "/api/orchestration/workflows/:userId/latest-culling",
    async (req, res) => {
      try {
        const userId = req.params.userId;
        const r = await pool.query(
          `SELECT s.result_data, s.completed_at, r.workflow_name, r.id AS run_id
             FROM workflow_run_steps s
             JOIN workflow_runs r ON r.id = s.run_id
            WHERE r.user_id = $1
              AND s.action_id = 'auto-culling'
              AND s.status = 'completed'
              AND s.result_data ? 'counts'
            ORDER BY s.completed_at DESC
            LIMIT 1`,
          [userId],
        );
        if (r.rows.length === 0) {
          return res.json({ success: true, data: null });
        }
        const row = r.rows[0];
        res.json({
          success: true,
          data: {
            runId: row.run_id,
            workflowName: row.workflow_name,
            completedAt: row.completed_at,
            ...row.result_data,
          },
        });
      } catch (err: any) {
        if (err?.code === '42P01') return res.json({ success: true, data: null });
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // Slice 9X.79 — Hent run-historikk for en bruker
  app.get(
    "/api/orchestration/workflows/:userId/runs",
    async (req, res) => {
      try {
        const userId = req.params.userId;
        const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
        const result = await pool.query(
          `SELECT r.id, r.workflow_id, r.workflow_name, r.status, r.profession,
                  r.steps_total, r.steps_completed, r.steps_failed,
                  r.started_at, r.completed_at, r.created_at,
                  EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.started_at)) AS duration_sec,
                  (SELECT COUNT(*) FROM workflow_run_steps s
                    WHERE s.run_id = r.id AND s.status = 'awaiting_manual') AS awaiting_count
             FROM workflow_runs r
             WHERE r.user_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2`,
          [userId, limit],
        );
        res.json({ success: true, data: result.rows });
      } catch (err: any) {
        if (err?.code === '42P01') return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );
}
