import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface AdminMiscRoutesDeps {
  app: express.Application;
  pool: Pool;
  isEvendiSmokeAuthorized: (req: any) => boolean;
  runEvendiSmoke: (...args: any[]) => Promise<any>;
  compatResolveUserId: (req: any) => string;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  dbCompatAdminInteractionKey: (logId: string) => string;
  compatAdminInteractionLog: Array<Record<string, unknown>>;
}

export function setupAdminMiscRoutes(deps: AdminMiscRoutesDeps): void {
  const {
    app,
    pool,
    isEvendiSmokeAuthorized,
    runEvendiSmoke,
    compatResolveUserId,
    compatStoreSet,
    dbCompatAdminInteractionKey,
    compatAdminInteractionLog,
  } = deps;

  app.get("/api/admin/gdpr-settings", (req, res) => {
    res.json({
      cookieConsentEnabled: false,
      dataRetentionDays: 365,
      gdprEnabled: true,
    });
  });

  app.get("/api/admin/profession-types", async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT name AS id, display_name AS name, is_active AS enabled, sort_order AS "sortOrder", description, category FROM profession_types WHERE is_active = true ORDER BY sort_order',
      );
      if (result.rows.length > 0) {
        return res.json(result.rows);
      }
    } catch (err) {
      console.warn(
        "profession_types DB read failed, using fallback:",
        (err as any).message,
      );
    }
    // Fallback
    res.json([
      { id: "photographer", name: "Fotograf", enabled: true },
      { id: "videographer", name: "Videograf", enabled: true },
      { id: "music_producer", name: "Musikk Produsent", enabled: true },
      { id: "enterprise", name: "Enterprise", enabled: true },
    ]);
  });

  app.post("/api/admin/log-interaction", async (req, res) => {
    const userId = compatResolveUserId(req);
    const logEntry = {
      id: crypto.randomUUID(),
      userId,
      action: req.body?.action || "unknown",
      details: req.body?.details || null,
      timestamp: req.body?.timestamp || new Date().toISOString(),
      userType: req.body?.userType || "unknown",
      prototypeTester: req.body?.prototypeTester || null,
      createdAt: new Date().toISOString(),
    };
    compatAdminInteractionLog.push(logEntry);
    if (compatAdminInteractionLog.length > 5000)
      compatAdminInteractionLog.shift();
    await compatStoreSet(dbCompatAdminInteractionKey(logEntry.id), logEntry);
    res.json({ success: true, logEntry });
  });

  app.get("/api/admin/smoke-tests/evendi", async (req, res) => {
    try {
      if (!isEvendiSmokeAuthorized(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const projectId = (req.query.projectId as string) || "local-user";

      const [
        showcaseCategories,
        showcaseItems,
        worklogList,
        worklogStats,
        landingDesktop,
        landingMobile,
      ] = await Promise.all([
        runEvendiSmoke("/api/showcase/categories?profession=videographer"),
        runEvendiSmoke("/api/showcase/profession/videographer"),
        runEvendiSmoke(`/api/projects/${encodeURIComponent(projectId)}/worklog`),
        runEvendiSmoke(
          `/api/projects/${encodeURIComponent(projectId)}/worklog/stats`,
        ),
        runEvendiSmoke("/api/pages/landing-desktop/published"),
        runEvendiSmoke("/api/pages/landing-mobile/published"),
      ]);

      res.json({
        showcaseCategories,
        showcaseItems,
        worklogList,
        worklogStats,
        landingDesktop,
        landingMobile,
      });
    } catch (error: any) {
      console.error("Evendi smoke test error:", error?.message || error);
      res.status(502).json({ error: "Evendi smoke test failed" });
    }
  });
}
