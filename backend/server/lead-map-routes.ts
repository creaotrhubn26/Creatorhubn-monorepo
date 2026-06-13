/**
 * lead-map-routes.ts
 *
 * REST-endpoints for The Role Room Lead Map.
 *
 *   GET    /api/admin-room/lead-map/leads?minLat=&maxLat=&minLng=&maxLng=
 *   GET    /api/admin-room/lead-map/leads/:id
 *   PATCH  /api/admin-room/lead-map/leads/:id/status
 *   PATCH  /api/admin-room/lead-map/leads/:id/geo
 *   POST   /api/admin-room/lead-map/leads/:id/visits
 *   GET    /api/admin-room/lead-map/leads/:id/visits
 *   GET    /api/admin-room/lead-map/activities
 *   GET    /api/admin-room/lead-map/metrics
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  getLeadById,
  getLeadMapMetrics,
  listLeadsInBounds,
  listRecentActivities,
  listVisits,
  logVisit,
  setLeadGeo,
  updateLeadStatus,
  type LeadStatus,
  type VisitType,
} from "./lead-map-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

const VALID_STATUSES: ReadonlySet<LeadStatus> = new Set([
  'unvisited', 'visited', 'return', 'not_present', 'declined',
  'interested', 'meeting_booked', 'proposal_sent', 'won', 'lost', 'do_not_contact',
]);

const VALID_VISIT_TYPES: ReadonlySet<VisitType> = new Set([
  'physical', 'phone', 'email', 'online_meeting', 'research',
]);

export function setupLeadMapRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // GET /leads — innenfor bounds + valgfrie filtre
  app.get("/api/admin-room/lead-map/leads", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    let bounds: Parameters<typeof listLeadsInBounds>[1]['bounds'];
    const { minLat, maxLat, minLng, maxLng } = req.query;
    if (minLat && maxLat && minLng && maxLng) {
      bounds = {
        minLat: Number(minLat), maxLat: Number(maxLat),
        minLng: Number(minLng), maxLng: Number(maxLng),
      };
    }

    const statusFilter = typeof req.query.status === 'string'
      ? req.query.status.split(',').filter((s) => VALID_STATUSES.has(s as LeadStatus)) as LeadStatus[]
      : undefined;
    const categoryFilter = typeof req.query.category === 'string'
      ? req.query.category.split(',')
      : undefined;

    try {
      const leads = await listLeadsInBounds(pool, {
        ownerUserId: session.userId, bounds, statusFilter, categoryFilter,
      });
      return res.json({ leads });
    } catch (err) {
      return res.status(500).json({ error: "leads_failed", detail: String(err) });
    }
  });

  // GET /leads/:id
  app.get("/api/admin-room/lead-map/leads/:id", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const lead = await getLeadById(pool, session.userId, req.params.id);
      if (!lead) return res.status(404).json({ error: "not_found" });
      return res.json(lead);
    } catch (err) {
      return res.status(500).json({ error: "lead_failed", detail: String(err) });
    }
  });

  // PATCH /leads/:id/status
  app.patch("/api/admin-room/lead-map/leads/:id/status", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as { status?: string; notes?: string };
    if (!body.status || !VALID_STATUSES.has(body.status as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const r = await updateLeadStatus(pool, {
        ownerUserId: session.userId,
        leadId: req.params.id,
        status: body.status as LeadStatus,
        notes: body.notes,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "status_failed", detail: String(err) });
    }
  });

  // PATCH /leads/:id/geo
  app.patch("/api/admin-room/lead-map/leads/:id/geo", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      latitude?: number; longitude?: number;
      address?: string; postalCode?: string; city?: string; country?: string;
    };
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return res.status(400).json({ error: "mangler_koordinater" });
    }
    try {
      const r = await setLeadGeo(pool, {
        ownerUserId: session.userId,
        leadId: req.params.id,
        latitude: body.latitude, longitude: body.longitude,
        address: body.address, postalCode: body.postalCode,
        city: body.city, country: body.country,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "geo_failed", detail: String(err) });
    }
  });

  // POST /leads/:id/visits
  app.post("/api/admin-room/lead-map/leads/:id/visits", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      visitType?: string;
      contactPerson?: string;
      conversationSummary?: string;
      objectionReason?: string;
      notes?: string;
      newStatus?: string;
      nextAction?: string;
      nextFollowUpAt?: string;
      visitLatitude?: number;
      visitLongitude?: number;
    };

    if (!body.visitType || !VALID_VISIT_TYPES.has(body.visitType as VisitType)) {
      return res.status(400).json({ error: "ugyldig_visit_type" });
    }
    if (body.newStatus && !VALID_STATUSES.has(body.newStatus as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }

    try {
      const r = await logVisit(pool, {
        ownerUserId: session.userId,
        leadId: req.params.id,
        visitType: body.visitType as VisitType,
        contactPerson: body.contactPerson,
        conversationSummary: body.conversationSummary,
        objectionReason: body.objectionReason,
        notes: body.notes,
        newStatus: body.newStatus as LeadStatus | undefined,
        nextAction: body.nextAction,
        nextFollowUpAt: body.nextFollowUpAt,
        visitLatitude: body.visitLatitude,
        visitLongitude: body.visitLongitude,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "visit_failed", detail: String(err) });
    }
  });

  // GET /leads/:id/visits
  app.get("/api/admin-room/lead-map/leads/:id/visits", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const visits = await listVisits(pool, session.userId, req.params.id, 50);
      return res.json({ visits });
    } catch (err) {
      return res.status(500).json({ error: "visits_failed", detail: String(err) });
    }
  });

  // GET /activities — feed
  app.get("/api/admin-room/lead-map/activities", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    try {
      const activities = await listRecentActivities(pool, session.userId, limit);
      return res.json({ activities });
    } catch (err) {
      return res.status(500).json({ error: "activities_failed", detail: String(err) });
    }
  });

  // GET /metrics
  app.get("/api/admin-room/lead-map/metrics", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const metrics = await getLeadMapMetrics(pool, session.userId);
      return res.json(metrics);
    } catch (err) {
      return res.status(500).json({ error: "metrics_failed", detail: String(err) });
    }
  });
}
