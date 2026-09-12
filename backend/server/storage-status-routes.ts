// User-facing endepunkt for å vise hva som er igjen av lagringskvoten.
// Brukes av frontend for: progress-bar i Innstillinger, varsel i header
// når kvoten er nesten full, og preflight-check før store opplastinger.

import express from "express";
import type { Pool } from "pg";
import { getStorageStatus } from "./storage-quota-service.js";

export interface StorageStatusRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupStorageStatusRoutes(deps: StorageStatusRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/storage/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const userId = session.userId;

    try {
      const status = await getStorageStatus(pool, userId);
      res.json({
        success: true,
        tier: status.user.tier,
        usedBytes: status.usedBytes,
        limitBytes: status.user.storageLimitBytes,
        freeBytes: status.freeBytes,
        usedFraction: status.usedFraction,
        overageBytes: status.overageBytes,
        overageGB: status.overageGB,
        allowsOverage: status.user.allowsOverage,
        stripeSubscriptionId: status.user.stripeSubscriptionId,
        meteredItemConfigured: !!status.user.stripeStorageMeterItemId,
      });
    } catch (err) {
      // Storage-quota-service kan feile hvis users-tabell mangler nyere
      // tier/limit-kolonner. Returner trygge defaults (50GB free tier) i
      // stedet for 500 — frontend StorageUsageBanner krasjer ellers.
      console.warn("[storage-status] degraded:", (err as any)?.message || err);
      res.json({
        success: true,
        tier: "free",
        usedBytes: 0,
        limitBytes: 50 * 1024 * 1024 * 1024,
        freeBytes: 50 * 1024 * 1024 * 1024,
        usedFraction: 0,
        overageBytes: 0,
        overageGB: 0,
        allowsOverage: false,
        stripeSubscriptionId: null,
        meteredItemConfigured: false,
        degraded: true,
      });
    }
  });
}
