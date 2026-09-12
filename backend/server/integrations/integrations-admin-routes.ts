/**
 * integrations-admin-routes.ts
 *
 * Admin Integration Center v1 — read-only (Implementation Plan steg 2/6,
 * docs/integration-audit/07). Server-side super_admin-håndhevelse (samme
 * mønster som superadmin-routes.ts: fersk rolle fra DB, aldri kun
 * klient-side-gating).
 *
 *   GET /api/admin/integrations
 *       → { integrations: [...], summary: { total, byStatus } }
 *
 * Credentials eksponeres ALDRI — credentialReference er navn/beskrivelse,
 * ikke verdier (håndhevet allerede i registry-skjemaet).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getIntegrationRegistry } from "./integration-registry.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

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

async function requireSuperAdmin(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const session = getSession(req, activeSessions);
  if (!session) {
    res.status(401).json({ error: "Ikke innlogget" });
    return null;
  }
  try {
    const r = await pool.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [session.userId],
    );
    if (r.rows.length === 0 || r.rows[0].role !== "super_admin") {
      res.status(403).json({ error: "Krever super-admin" });
      return null;
    }
    return session;
  } catch (err) {
    console.error("[integrations-admin] rolle-oppslag feilet:", err);
    res.status(500).json({ error: "internal_error" });
    return null;
  }
}

export function registerIntegrationsAdminRoutes({ app, pool, activeSessions }: Deps): void {
  app.get("/api/admin/integrations", async (req: Request, res: Response) => {
    if (!(await requireSuperAdmin(req, res, pool, activeSessions))) return;

    try {
      const registry = getIntegrationRegistry();

      // Live-status: siste signal + antall per provider fra
      // normalized_signals (fail-soft — tabell kan mangle pre-0376).
      const liveByProvider = new Map<string, { lastSignalAt: string; signalCount: number }>();
      try {
        const live = await pool.query<{
          provider: string;
          last_signal_at: Date | string;
          signal_count: string;
        }>(
          `SELECT provider, MAX(collected_at) AS last_signal_at, COUNT(*) AS signal_count
             FROM normalized_signals GROUP BY provider`,
        );
        for (const row of live.rows) {
          liveByProvider.set(row.provider, {
            lastSignalAt: new Date(row.last_signal_at).toISOString(),
            signalCount: Number(row.signal_count),
          });
        }
      } catch {
        // normalized_signals finnes ikke ennå — vis registry uten live-data
      }

      const integrations = [...registry.values()].map((e) => {
        // GEO-probe-signaler lagres per motor (geo-probe-<engine>) —
        // match både eksakt id og prefiks.
        const live = liveByProvider.get(e.integrationId) ?? null;
        return {
          ...e,
          lastSignalAt: live?.lastSignalAt ?? null,
          signalCount: live?.signalCount ?? 0,
        };
      });

      const byStatus: Record<string, number> = {};
      for (const e of integrations) {
        byStatus[e.availabilityStatus] = (byStatus[e.availabilityStatus] ?? 0) + 1;
      }
      return res.json({
        integrations,
        summary: { total: integrations.length, byStatus },
      });
    } catch (err) {
      console.error("[integrations-admin] registry-lesing feilet:", err);
      return res.status(500).json({ error: "registry_invalid" });
    }
  });
}
