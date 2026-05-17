/**
 * Routes for Datakilder-fanen i Creative Sync Workspace.
 *
 *   GET   /api/role-room/data-sources/:projectId           — alle kilder
 *   POST  /api/role-room/data-sources/:projectId/configure — upsert config
 *   DELETE /api/role-room/data-sources/:projectId/:platform/:configKey
 *   POST  /api/role-room/data-sources/:projectId/:platform/test
 *
 * Alle endpoints krever admin-session + auth-protection. Eierskap-sjekk
 * for prosjekt-id sentralisert i guard-funksjonen requireProjectAccess.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  listAllDataSources,
  testDataSourceConnection,
} from "./role-room-data-sources.js";
import {
  upsertKpiSourceConfig,
  deleteKpiSourceConfig,
  validateConfigInput,
  type KpiSourcePlatform,
} from "./role-room-kpi-source-config.js";
import {
  discoverAllGoogleProperties,
  listGoogleAnalyticsProperties,
  listGoogleBusinessLocations,
  listSearchConsoleSites,
  listYouTubeChannels,
} from "./role-room-google-property-discovery.js";

interface AdminSession {
  userId: string;
  email: string;
  role?: string;
}

export interface DataSourcesRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

const FEATURE_ID = "role-room-agent-producer";

const ALLOWED_PLATFORMS: ReadonlySet<KpiSourcePlatform> = new Set<KpiSourcePlatform>([
  "google_analytics", "google_business", "google_search_console",
  "youtube", "meta_business", "instagram", "facebook", "linkedin", "tiktok",
]);

export function setupRoleRoomDataSourcesRoutes(deps: DataSourcesRoutesDeps): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  // GET — list alle datakilder for et prosjekt
  app.get("/api/role-room/data-sources/:projectId", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    try {
      const sources = await listAllDataSources(pool, { projectId, userId: session.userId });
      return res.json({
        success: true,
        projectId,
        sources,
        sourceCount: sources.length,
        verifiedCount: sources.filter((s) => s.state === "verified").length,
      });
    } catch (error) {
      console.error("[data-sources-routes] list failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste datakilder." });
    }
  });

  // POST — upsert config (f.eks. GA4-property-id, GBP-location-id)
  app.post("/api/role-room/data-sources/:projectId/configure", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const platform = typeof body.platform === "string" ? body.platform : "";
    const configKey = typeof body.configKey === "string" ? body.configKey : "";
    const configValue = typeof body.configValue === "string" ? body.configValue : "";
    const displayLabel = typeof body.displayLabel === "string" ? body.displayLabel : undefined;

    const errors = validateConfigInput({ projectId, platform, configKey, configValue, displayLabel });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: "Validering feilet", details: errors });
    }

    const entry = await upsertKpiSourceConfig(pool, {
      projectId,
      platform: platform as KpiSourcePlatform,
      configKey,
      configValue,
      displayLabel: displayLabel ?? null,
      setByUserId: session.userId,
    });
    if (!entry) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre konfigurasjon." });
    }
    return res.json({ success: true, entry });
  });

  // DELETE — fjern config-entry
  app.delete("/api/role-room/data-sources/:projectId/:platform/:configKey", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    const platform = String(req.params.platform || "").trim();
    const configKey = String(req.params.configKey || "").trim();
    if (!projectId || !configKey) {
      return res.status(400).json({ success: false, error: "projectId og configKey er påkrevd." });
    }
    if (!ALLOWED_PLATFORMS.has(platform as KpiSourcePlatform)) {
      return res.status(400).json({ success: false, error: `Ugyldig platform: ${platform}` });
    }

    const ok = await deleteKpiSourceConfig(pool, projectId, platform as KpiSourcePlatform, configKey, session.userId);
    return res.json({ success: true, deleted: ok });
  });

  // GET — discover Google properties/locations/channels/sites for picker
  // Returnerer alt i én respons så frontend kan rendre 4 dropdowns med
  // ett API-kall. Hvis brukeren mangler scope for én av delene, får UI
  // tydelig feilmelding per platform.
  app.get("/api/role-room/data-sources/google/discover", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const platform = String(req.query.platform || "").trim();

    try {
      if (platform === "google_analytics") {
        return res.json({ success: true, ...(await listGoogleAnalyticsProperties(pool, session.userId)) });
      }
      if (platform === "google_business") {
        return res.json({ success: true, ...(await listGoogleBusinessLocations(pool, session.userId)) });
      }
      if (platform === "google_search_console") {
        return res.json({ success: true, ...(await listSearchConsoleSites(pool, session.userId)) });
      }
      if (platform === "youtube") {
        return res.json({ success: true, ...(await listYouTubeChannels(pool, session.userId)) });
      }
      // Default: alle på én gang
      const all = await discoverAllGoogleProperties(pool, session.userId);
      return res.json({ success: true, ...all });
    } catch (error) {
      console.error("[data-sources-routes] discover failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke hente Google-properties." });
    }
  });

  // POST — test connection (pinger faktisk API)
  app.post("/api/role-room/data-sources/:projectId/:platform/test", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    const platform = String(req.params.platform || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    if (!ALLOWED_PLATFORMS.has(platform as KpiSourcePlatform)) {
      return res.status(400).json({ success: false, error: `Ugyldig platform: ${platform}` });
    }

    const result = await testDataSourceConnection(pool, {
      projectId,
      userId: session.userId,
      platform: platform as KpiSourcePlatform,
    });
    return res.json({ success: true, result });
  });
}
