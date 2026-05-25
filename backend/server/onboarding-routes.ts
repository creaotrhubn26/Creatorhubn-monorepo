import express from "express";
import type { Pool } from "pg";

export interface OnboardingRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveActiveSessionFromRequest: (req: express.Request) => Promise<any>;
}

export function setupOnboardingRoutes(deps: OnboardingRoutesDeps): void {
  const { app, pool, resolveActiveSessionFromRequest } = deps;

  app.get("/api/onboarding/status", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session)
      return res.status(401).json({ error: "not_authenticated" });
    try {
      const svc = await import("./onboarding-service.js");
      const status = await svc.getOnboardingStatus(pool, session.userId);
      return res.json(status);
    } catch (error) {
      console.error("[onboarding/status] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/onboarding/complete-step", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session)
      return res.status(401).json({ error: "not_authenticated" });
    const body = (
      req.body && typeof req.body === "object" ? req.body : {}
    ) as Record<string, unknown>;
    const stepId = typeof body.stepId === "string" ? body.stepId : "";
    try {
      const svc = await import("./onboarding-service.js");
      const status = await svc.markStepCompleted(
        pool,
        session.userId,
        stepId as any,
      );
      return res.json(status);
    } catch (error) {
      console.error("[onboarding/complete-step] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  app.post("/api/onboarding/dismiss", async (req, res) => {
    const session = await resolveActiveSessionFromRequest(req);
    if (!session)
      return res.status(401).json({ error: "not_authenticated" });
    try {
      const svc = await import("./onboarding-service.js");
      const status = await svc.dismissOnboarding(pool, session.userId);
      return res.json(status);
    } catch (error) {
      console.error("[onboarding/dismiss] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });
}
