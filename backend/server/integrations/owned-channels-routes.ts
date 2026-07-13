/**
 * owned-channels-routes.ts
 *
 *   POST /api/integrations/sync/owned-channels
 *        Header: x-cron-token (CRON_TRIGGER_TOKEN — samme som øvrige
 *        cron-ruter). Body: { producerUserId? } — uten: alle synkbare.
 *        Fire-and-forget, sekvensielt.
 *
 *   GET  /api/integrations/signals/ai-traffic
 *        Admin-session. Org-scopet lesning av ai_referral_sessions fra
 *        normalized_signals → { sources: [{source, sessions}], total,
 *        periodStart, periodEnd, lastCollectedAt } for AI-trafikk-panelet.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  listSyncableProducers,
  syncOwnedChannelSignals,
} from "./owned-channels-signal-sync.js";
import { syncLeadgridSalesSignals } from "./leadgrid-sales-signal-sync.js";
import { syncBrregMarketSignals } from "./brreg-market-signal-sync.js";
import { queryNormalizedSignals } from "./normalized-signal-store.js";
import { resolveOrgIdForUser } from "../leadgrid-org-resolver.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7).trim()) ?? null;
  }
  return null;
}

export function registerOwnedChannelsRoutes({
  app, pool, activeSessions, isAdminEmail,
}: Deps): void {
  // Offentlige registerdata (BRREG): markedsstørrelse + nyregistreringer
  // per vertikal → normalized_signals. Åpne data, NLOD.
  app.post("/api/integrations/sync/brreg-market", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncBrregMarketSignals(pool);
      if (result.errors.length > 0) console.warn("[brreg-market-sync]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[brreg-market-sync] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  // Kundens egne salgsdata (won/lost per ISO-uke) → normalized_signals.
  // first_party-kilde; idempotent; fase 4-fasiten bygges her.
  app.post("/api/integrations/sync/leadgrid-sales", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const result = await syncLeadgridSalesSignals(pool);
      if (result.errors.length > 0) console.warn("[leadgrid-sales-sync]", result.errors.join(" | "));
      return res.json(result);
    } catch (err) {
      console.error("[leadgrid-sales-sync] failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  app.post("/api/integrations/sync/owned-channels", async (req, res) => {
    const token = req.headers["x-cron-token"];
    const expected = process.env.CRON_TRIGGER_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ error: "invalid_cron_token" });
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const producers = typeof body.producerUserId === "string"
        ? [body.producerUserId]
        : await listSyncableProducers(pool);

      // Fire-and-forget, sekvensielt — eksterne kvoter er delte
      void (async () => {
        for (const producerUserId of producers) {
          try {
            const result = await syncOwnedChannelSignals(pool, { producerUserId });
            console.log(
              `[owned-sync] ${producerUserId}: ${result.inserted} nye signaler` +
                (result.skippedReason ? ` (${result.skippedReason})` : ""),
            );
          } catch (err) {
            console.error(`[owned-sync] feilet for ${producerUserId}:`, err);
          }
        }
      })();

      return res.json({ started: producers.length });
    } catch (err) {
      console.error("[owned-sync] cron failed", err);
      return res.status(500).json({ error: "sync_failed" });
    }
  });

  app.get("/api/integrations/signals/ai-traffic", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    try {
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!UUID_PATTERN.test(orgId)) {
        return res.json({ sources: [], total: 0, note: "ingen organisasjon tilknyttet" });
      }
      const signals = await queryNormalizedSignals(pool, {
        organizationId: orgId,
        metricType: "ai_referral_sessions",
        limit: 500,
      });
      // Nyeste signal per (kilde/topic) — re-synk overlapper i perioder
      const bySource = new Map<string, { sessions: number; collectedAt: string; periodStart: string; periodEnd: string }>();
      for (const s of signals) {
        const existing = bySource.get(s.topic);
        if (!existing || s.collectedAt > existing.collectedAt) {
          bySource.set(s.topic, {
            sessions: s.metricValue,
            collectedAt: s.collectedAt,
            periodStart: s.periodStart,
            periodEnd: s.periodEnd,
          });
        }
      }
      const sources = [...bySource.entries()]
        .map(([source, v]) => ({ source, sessions: v.sessions }))
        .sort((a, b) => b.sessions - a.sessions);
      const newest = [...bySource.values()].sort((a, b) => (a.collectedAt < b.collectedAt ? 1 : -1))[0];
      return res.json({
        sources,
        total: sources.reduce((sum, s) => sum + s.sessions, 0),
        periodStart: newest?.periodStart ?? null,
        periodEnd: newest?.periodEnd ?? null,
        lastCollectedAt: newest?.collectedAt ?? null,
      });
    } catch (err) {
      console.error("[ai-traffic] read failed", err);
      return res.status(500).json({ error: "read_failed" });
    }
  });
}
