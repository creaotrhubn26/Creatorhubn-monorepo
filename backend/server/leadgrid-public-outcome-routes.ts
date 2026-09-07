import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { apiKeyAllowsProject, requireApiKey } from "./leadgrid-api-key-auth.js";
import {
  leadgridOutcomeEventInputSchema,
  OutcomeEventWriteError,
  recordLeadgridOutcomeEvent,
} from "./leadgrid-outcome-events.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function registerLeadgridPublicOutcomeRoutes(deps: {
  app: Express;
  pool: Pool;
}): void {
  const { app, pool } = deps;

  app.post(
    "/api/v1/projects/:projectId/leads/:leadId/outcome-events",
    requireApiKey(pool, ["outcomes.write"]),
    async (req: Request, res: Response) => {
      const organizationId = req.apiKey!.organizationId;
      const projectId = String(req.params.projectId ?? "").trim();
      const leadId = String(req.params.leadId ?? "").trim();

      if (!projectId || projectId.length > 255 || !UUID_PATTERN.test(leadId)) {
        res.status(400).json({
          error: "validation_failed",
          issues: [{ path: "path", message: "invalid_project_or_lead_id" }],
        });
        return;
      }
      if (!apiKeyAllowsProject(req.apiKey!, projectId)) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      const parsed = leadgridOutcomeEventInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          error: "validation_failed",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      const headerKey = req.get("Idempotency-Key")?.trim();
      const idempotencyKey = headerKey || parsed.data.external_event_id;
      if (
        idempotencyKey.length > 255 ||
        !SAFE_KEY_PATTERN.test(idempotencyKey)
      ) {
        res.status(400).json({
          error: "validation_failed",
          issues: [
            { path: "Idempotency-Key", message: "invalid_idempotency_key" },
          ],
        });
        return;
      }

      try {
        const result = await recordLeadgridOutcomeEvent(pool, {
          organizationId,
          projectId,
          leadId,
          apiKeyId: req.apiKey!.apiKeyId,
          idempotencyKey,
          event: parsed.data,
        });
        res.status(result.replayed ? 200 : 201).json({
          data: result.event,
          meta: { version: "v1", replayed: result.replayed },
        });
      } catch (error) {
        if (error instanceof OutcomeEventWriteError) {
          res.status(error.status).json({ error: error.code });
          return;
        }
        console.warn("[public-api-v1] outcome event failed:", error);
        res.status(500).json({
          error: "outcome_event_failed",
          detail: "internal_error",
        });
      }
    },
  );
}
