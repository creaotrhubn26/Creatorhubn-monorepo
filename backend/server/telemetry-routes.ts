import express from "express";
import type { Pool } from "pg";

export interface TelemetryRoutesDeps {
  app: express.Application;
  pool: Pool;
  getUserIdFromAuth: (req: any) => string | null;
  ingestErgonomicsBatch: (
    pool: Pool,
    userId: string,
    events: any[],
  ) => Promise<{ ingested: number }>;
  /**
   * Matcher ergonomics-telemetry-service.ts:418 (ingestReflect).
   * answers-felt heter 'payload' i tidligere wire-kontrakt; vi tar imot
   * begge ved å unionere keys (alle felter er optional).
   */
  ingestErgonomicsReflect: (
    pool: Pool,
    userId: string,
    sessionId: string,
    answers: { hardest?: string; regretted?: string; wouldSave?: string },
  ) => Promise<{ id: number }>;
  summariseErgonomicsSession: (
    pool: Pool,
    userId: string,
    sessionId: string,
  ) => Promise<any>;
  summariseErgonomicsForUser: (
    pool: Pool,
    userId: string,
    lookbackDays: number,
    excludeSessionId?: string,
  ) => Promise<any>;
  compareErgonomicsSession: (session: any, baseline: any) => any;
}

export function setupTelemetryRoutes(deps: TelemetryRoutesDeps): void {
  const {
    app,
    pool,
    getUserIdFromAuth,
    ingestErgonomicsBatch,
    ingestErgonomicsReflect,
    summariseErgonomicsSession,
    summariseErgonomicsForUser,
    compareErgonomicsSession,
  } = deps;

  app.post("/api/telemetry/culling-session", async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const body = req.body as { events?: unknown } | undefined;
    const rawEvents = Array.isArray(body?.events) ? body.events : [];
    if (rawEvents.length === 0) {
      return res.json({ success: true, ingested: 0 });
    }
    if (rawEvents.length > 2000) {
      return res
        .status(413)
        .json({ error: "batch_too_large", max: 2000 });
    }
    try {
      const ALLOWED_KINDS = new Set([
        "session_start",
        "view",
        "decide",
        "reverse",
        "pause",
        "session_end",
      ]);
      const events = rawEvents
        .map((raw: unknown) => {
          if (!raw || typeof raw !== "object") return null;
          const r = raw as Record<string, unknown>;
          if (typeof r.sessionId !== "string" || !r.sessionId) return null;
          if (typeof r.kind !== "string" || !ALLOWED_KINDS.has(r.kind))
            return null;
          return {
            sessionId: String(r.sessionId).slice(0, 128),
            kind: r.kind as
              | "session_start"
              | "view"
              | "decide"
              | "reverse"
              | "pause"
              | "session_end",
            ms: Number(r.ms) || 0,
            sequence: Number(r.sequence) || 0,
            assetId:
              typeof r.assetId === "string" ? r.assetId.slice(0, 128) : null,
            action:
              typeof r.action === "string" ? r.action.slice(0, 64) : null,
            previousAction:
              typeof r.previousAction === "string"
                ? r.previousAction.slice(0, 64)
                : null,
            newAction:
              typeof r.newAction === "string"
                ? r.newAction.slice(0, 64)
                : null,
            firstView:
              typeof r.firstView === "boolean" ? r.firstView : undefined,
          };
        })
        .filter((e: any): e is NonNullable<typeof e> => e !== null);
      const { ingested } = await ingestErgonomicsBatch(
        pool,
        userId,
        events,
      );
      res.json({ success: true, ingested });
    } catch (error) {
      console.error("[telemetry] culling-session ingest failed:", error);
      res.status(500).json({ error: "ingest_failed" });
    }
  });

  app.post("/api/telemetry/reflect", async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const body = req.body as
      | {
          sessionId?: unknown;
          hardest?: unknown;
          regretted?: unknown;
          wouldSave?: unknown;
        }
      | undefined;
    if (typeof body?.sessionId !== "string" || !body.sessionId) {
      return res.status(400).json({ error: "sessionId_required" });
    }
    try {
      const { id } = await ingestErgonomicsReflect(
        pool,
        userId,
        String(body.sessionId).slice(0, 128),
        {
          hardest:
            typeof body.hardest === "string" ? body.hardest : undefined,
          regretted:
            typeof body.regretted === "string" ? body.regretted : undefined,
          wouldSave:
            typeof body.wouldSave === "string" ? body.wouldSave : undefined,
        },
      );
      res.json({ success: true, id });
    } catch (error) {
      console.error("[telemetry] reflect ingest failed:", error);
      res.status(500).json({ error: "reflect_ingest_failed" });
    }
  });

  // GET /api/telemetry/ergonomics/session/:sessionId — the "immediate
  // value" endpoint for the post-session insights card.
  app.get(
    "/api/telemetry/ergonomics/session/:sessionId",
    async (req, res) => {
      const userId = getUserIdFromAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const sessionId = String(req.params.sessionId || "").slice(0, 128);
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId_required" });
      }
      try {
        const session = await summariseErgonomicsSession(
          pool,
          userId,
          sessionId,
        );
        const baseline = await summariseErgonomicsForUser(
          pool,
          userId,
          30,
          sessionId,
        );
        const comparison = compareErgonomicsSession(session, baseline);
        res.json({
          success: true,
          sessionId,
          session,
          baseline,
          comparison,
        });
      } catch (error) {
        console.error("[telemetry] session summary failed:", error);
        res.status(500).json({ error: "session_summary_failed" });
      }
    },
  );

  app.get("/api/telemetry/ergonomics/summary", async (req, res) => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const lookbackDays = Number(req.query?.lookbackDays) || 30;
    try {
      const summary = await summariseErgonomicsForUser(
        pool,
        userId,
        lookbackDays,
      );
      res.json({ success: true, lookbackDays, summary });
    } catch (error) {
      console.error("[telemetry] summary failed:", error);
      res.status(500).json({ error: "summary_failed" });
    }
  });
}
