/**
 * customer-success-routes.ts
 *
 * Wave M2 — Customer Success Manager API.
 *
 * Endpoints:
 *   GET    /api/admin-room/customer-success/dashboard
 *   GET    /api/admin-room/customer-success/renewals?days=90&status=at_risk
 *   GET    /api/admin-room/customers/:userId/health
 *   GET    /api/admin-room/customers/:userId/interactions
 *   POST   /api/admin-room/customers/:userId/interactions
 *   PATCH  /api/admin-room/customer-success/renewals/:renewalId
 *   POST   /api/admin-room/customer-success/snapshot-all
 *          (cron-token-gated bulk-snapshot)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  buildDashboardSummary,
  captureSnapshotsForAllActiveCustomers,
  computeHealthForUser,
  createInteraction,
  listInteractions,
  listUpcomingRenewals,
  updateRenewalStatus,
} from "./customer-success-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

export function setupCustomerSuccessRoutes(deps: Deps): void {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  function requireAdmin(req: Request, res: Response): SessionData | null {
    const session = getSession(req, activeSessions);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "Admin Room kreves" }); return null; }
    return session;
  }

  {
    // GET /dashboard
    app.get("/api/admin-room/customer-success/dashboard", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        const summary = await buildDashboardSummary(pool);
        return res.json(summary);
      } catch (err) {
        return res.status(500).json({ error: "dashboard_failed", detail: String(err) });
      }
    });

    // GET /renewals
    app.get("/api/admin-room/customer-success/renewals", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 90));
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.split(',') : undefined;
      try {
        const r = await listUpcomingRenewals(pool, { daysAhead: days, statusFilter });
        return res.json({ renewals: r });
      } catch (err) {
        return res.status(500).json({ error: "renewals_failed", detail: String(err) });
      }
    });

    // PATCH /renewals/:id
    app.patch("/api/admin-room/customer-success/renewals/:id", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = req.body as { status?: string; notes?: string };
      if (!body.status) return res.status(400).json({ error: "mangler_status" });
      try {
        await updateRenewalStatus(pool, {
          renewalId: req.params.id,
          status: body.status,
          notes: body.notes,
        });
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "update_failed", detail: String(err) });
      }
    });

    // GET /customers/:userId/health
    app.get("/api/admin-room/customers/:userId/health", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        const h = await computeHealthForUser(pool, req.params.userId);
        return res.json(h);
      } catch (err) {
        return res.status(500).json({ error: "health_failed", detail: String(err) });
      }
    });

    // GET /customers/:userId/interactions
    app.get("/api/admin-room/customers/:userId/interactions", async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      try {
        const r = await listInteractions(pool, req.params.userId, limit);
        return res.json({ interactions: r });
      } catch (err) {
        return res.status(500).json({ error: "interactions_failed", detail: String(err) });
      }
    });

    // POST /customers/:userId/interactions
    app.post("/api/admin-room/customers/:userId/interactions", async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as {
        interactionType?: string;
        subject?: string;
        body?: string;
        sentiment?: string;
        followUpAt?: string;
        attendees?: unknown[];
        meetingUrl?: string;
        expansionValueNok?: number;
        churnRiskLevel?: 'low' | 'medium' | 'high';
        occurredAt?: string;
      };
      if (!body.interactionType) return res.status(400).json({ error: "mangler_interactionType" });
      try {
        const r = await createInteraction(pool, {
          userId: req.params.userId,
          loggedByUserId: session.userId,
          interactionType: body.interactionType,
          subject: body.subject,
          body: body.body,
          sentiment: body.sentiment,
          followUpAt: body.followUpAt,
          attendees: body.attendees,
          meetingUrl: body.meetingUrl,
          expansionValueNok: body.expansionValueNok,
          churnRiskLevel: body.churnRiskLevel,
          occurredAt: body.occurredAt,
        });
        return res.json(r);
      } catch (err) {
        return res.status(500).json({ error: "create_failed", detail: String(err) });
      }
    });

    // POST /snapshot-all — token-gated cron (samme mønster som L7)
    app.post("/api/admin-room/customer-success/snapshot-all", async (req, res) => {
      const cronToken = req.headers['x-cron-trigger-token'] as string | undefined;
      const expected = process.env.CUSTOMER_SUCCESS_SNAPSHOT_TOKEN
        || process.env.CRON_TRIGGER_TOKEN;
      const tokenValid = expected && cronToken === expected;
      if (!tokenValid) {
        const session = requireAdmin(req, res);
        if (!session) return;
      }
      try {
        const r = await captureSnapshotsForAllActiveCustomers(pool);
        return res.json(r);
      } catch (err) {
        return res.status(500).json({ error: "snapshot_failed", detail: String(err) });
      }
    });
  }
}
