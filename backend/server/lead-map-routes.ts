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
  consumeQuota,
  getEntitlement,
  startTrial,
  TIER_PRICING_NOK,
  type LeadMapTier,
} from "./lead-map-entitlements-service.js";
import Stripe from "stripe";
import {
  generateLeadPitch,
  getLeadById,
  getLeadMapMetrics,
  importPlaceAsLead,
  listLeadsInBounds,
  listRecentActivities,
  listVisits,
  logVisit,
  searchPlaces,
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

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key, { apiVersion: '2025-01-27.acacia' as Stripe.StripeConfig['apiVersion'] });
  return stripeClient;
}

export function setupLeadMapRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // Helper: krev aktiv entitlement (returnerer 402 hvis ikke)
  async function requireEntitlement(req: Request, res: Response, configId: string) {
    const e = await getEntitlement(pool, configId);
    if (!e) {
      res.status(402).json({
        error: "lead_map_module_not_active",
        upgradeUrl: `/api/role-room/agent/configs/${configId}/lead-map/checkout?tier=pro`,
        tiers: {
          discover: { priceNok: TIER_PRICING_NOK.discover },
          pro: { priceNok: TIER_PRICING_NOK.pro },
          agency: { priceNok: TIER_PRICING_NOK.agency },
        },
      });
      return null;
    }
    return e;
  }

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
      const lead = await getLeadById(pool, { ownerUserId: session.userId }, req.params.id);
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
      const visits = await listVisits(pool, { ownerUserId: session.userId }, req.params.id, 50);
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
      const activities = await listRecentActivities(pool, { ownerUserId: session.userId }, limit);
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
      const metrics = await getLeadMapMetrics(pool, { ownerUserId: session.userId });
      return res.json(metrics);
    } catch (err) {
      return res.status(500).json({ error: "metrics_failed", detail: String(err) });
    }
  });

  // POST /leads/:id/generate-pitch — Claude AI pitch
  app.post("/api/admin-room/lead-map/leads/:id/generate-pitch", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { serviceFocus?: string };
    try {
      const r = await generateLeadPitch(pool, {
        ownerUserId: session.userId, leadId: req.params.id,
        serviceFocus: body.serviceFocus,
      });
      if (!r) return res.status(503).json({ error: "ai_unavailable_or_lead_not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "pitch_failed", detail: String(err) });
    }
  });

  // POST /places/search — Google Places search
  app.post("/api/admin-room/lead-map/places/search", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      query?: string; latitude?: number; longitude?: number;
      radiusMeters?: number; type?: string;
    };
    if (!body.query) return res.status(400).json({ error: "mangler_query" });

    try {
      const r = await searchPlaces(pool, {
        ownerUserId: session.userId,
        query: body.query,
        latitude: body.latitude, longitude: body.longitude,
        radiusMeters: body.radiusMeters ?? 5000,
        type: body.type,
      });
      if (!r.ok) return res.status(503).json({ error: r.reason });
      return res.json({ results: r.results });
    } catch (err) {
      return res.status(500).json({ error: "places_failed", detail: String(err) });
    }
  });

  // POST /places/import — importer ett Places-resultat som lead
  app.post("/api/admin-room/lead-map/places/import", async (req: Request, res: Response) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      place?: Parameters<typeof importPlaceAsLead>[1]['place'];
      leadCategory?: string;
    };
    if (!body.place?.placeId) return res.status(400).json({ error: "mangler_place" });

    try {
      const r = await importPlaceAsLead(pool, {
        ownerUserId: session.userId,
        place: body.place,
        leadCategory: body.leadCategory,
      });
      if (!r.ok) return res.status(r.reason === 'already_imported' ? 409 : 500).json(r);
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "import_failed", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // KLIENT-VENDT (Role Room Agent) — multi-tenant via agent_config_id
  // ════════════════════════════════════════════════════════════════════
  //
  // Disse routes brukes av byråene som leverer Lead Map som tjeneste til
  // sine klienter. Hver klient-config har isolert lead-rom via
  // agent_config_id-filter. Eierskap verifiseres via at session.userId
  // er produsenten som administrerer config-en.

  async function verifyConfigAccess(configId: string, userId: string): Promise<boolean> {
    try {
      const r = await pool.query(
        `SELECT 1 FROM client_ads_configs WHERE id = $1::uuid AND producer_user_id = $2`,
        [configId, userId],
      );
      return (r.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // GET /agent/configs/:configId/lead-map/leads
  app.get("/api/role-room/agent/configs/:configId/lead-map/leads", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }

    let bounds: Parameters<typeof listLeadsInBounds>[1]['bounds'];
    const { minLat, maxLat, minLng, maxLng } = req.query;
    if (minLat && maxLat && minLng && maxLng) {
      bounds = { minLat: Number(minLat), maxLat: Number(maxLat), minLng: Number(minLng), maxLng: Number(maxLng) };
    }
    const statusFilter = typeof req.query.status === 'string'
      ? req.query.status.split(',').filter((s) => VALID_STATUSES.has(s as LeadStatus)) as LeadStatus[]
      : undefined;

    try {
      const leads = await listLeadsInBounds(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        bounds, statusFilter,
      });
      return res.json({ leads });
    } catch (err) {
      return res.status(500).json({ error: "leads_failed", detail: String(err) });
    }
  });

  // GET /agent/configs/:configId/lead-map/leads/:id
  app.get("/api/role-room/agent/configs/:configId/lead-map/leads/:id", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    try {
      const lead = await getLeadById(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
      }, req.params.id);
      if (!lead) return res.status(404).json({ error: "not_found" });
      return res.json(lead);
    } catch (err) {
      return res.status(500).json({ error: "lead_failed", detail: String(err) });
    }
  });

  // PATCH /agent/configs/:configId/lead-map/leads/:id/status
  app.patch("/api/role-room/agent/configs/:configId/lead-map/leads/:id/status", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as { status?: string; notes?: string };
    if (!body.status || !VALID_STATUSES.has(body.status as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const r = await updateLeadStatus(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
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

  // POST /agent/configs/:configId/lead-map/leads/:id/visits
  app.post("/api/role-room/agent/configs/:configId/lead-map/leads/:id/visits", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as {
      visitType?: string; contactPerson?: string;
      conversationSummary?: string; objectionReason?: string;
      notes?: string; newStatus?: string;
      nextAction?: string; nextFollowUpAt?: string;
      visitLatitude?: number; visitLongitude?: number;
    };
    if (!body.visitType || !VALID_VISIT_TYPES.has(body.visitType as VisitType)) {
      return res.status(400).json({ error: "ugyldig_visit_type" });
    }
    try {
      const r = await logVisit(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        leadId: req.params.id,
        visitType: body.visitType as VisitType,
        contactPerson: body.contactPerson,
        conversationSummary: body.conversationSummary,
        objectionReason: body.objectionReason,
        notes: body.notes,
        newStatus: body.newStatus as LeadStatus | undefined,
        nextAction: body.nextAction,
        nextFollowUpAt: body.nextFollowUpAt,
        visitLatitude: body.visitLatitude, visitLongitude: body.visitLongitude,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "visit_failed", detail: String(err) });
    }
  });

  // GET /agent/configs/:configId/lead-map/metrics
  app.get("/api/role-room/agent/configs/:configId/lead-map/metrics", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    try {
      const metrics = await getLeadMapMetrics(pool, {
        ownerUserId: session.userId, agentConfigId: req.params.configId,
      });
      return res.json(metrics);
    } catch (err) {
      return res.status(500).json({ error: "metrics_failed", detail: String(err) });
    }
  });

  // GET /agent/configs/:configId/lead-map/activities
  app.get("/api/role-room/agent/configs/:configId/lead-map/activities", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    try {
      const activities = await listRecentActivities(pool, {
        ownerUserId: session.userId, agentConfigId: req.params.configId,
      }, limit);
      return res.json({ activities });
    } catch (err) {
      return res.status(500).json({ error: "activities_failed", detail: String(err) });
    }
  });

  // POST /agent/configs/:configId/lead-map/places/search
  app.post("/api/role-room/agent/configs/:configId/lead-map/places/search", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as {
      query?: string; latitude?: number; longitude?: number;
      radiusMeters?: number; type?: string;
    };
    if (!body.query) return res.status(400).json({ error: "mangler_query" });
    try {
      const r = await searchPlaces(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        query: body.query,
        latitude: body.latitude, longitude: body.longitude,
        radiusMeters: body.radiusMeters ?? 5000,
        type: body.type,
      });
      if (!r.ok) return res.status(503).json({ error: r.reason });
      return res.json({ results: r.results });
    } catch (err) {
      return res.status(500).json({ error: "places_failed", detail: String(err) });
    }
  });

  // POST /agent/configs/:configId/lead-map/places/import
  app.post("/api/role-room/agent/configs/:configId/lead-map/places/import", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as {
      place?: Parameters<typeof importPlaceAsLead>[1]['place'];
      leadCategory?: string;
    };
    if (!body.place?.placeId) return res.status(400).json({ error: "mangler_place" });
    try {
      const r = await importPlaceAsLead(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        place: body.place,
        leadCategory: body.leadCategory,
      });
      if (!r.ok) return res.status(r.reason === 'already_imported' ? 409 : 500).json(r);
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "import_failed", detail: String(err) });
    }
  });

  // POST /agent/configs/:configId/lead-map/leads/:id/generate-pitch
  app.post("/api/role-room/agent/configs/:configId/lead-map/leads/:id/generate-pitch", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as { serviceFocus?: string };
    try {
      const r = await generateLeadPitch(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        leadId: req.params.id,
        serviceFocus: body.serviceFocus,
      });
      if (!r) return res.status(503).json({ error: "ai_unavailable_or_lead_not_found" });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "pitch_failed", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // ENTITLEMENT / BILLING
  // ════════════════════════════════════════════════════════════════════

  // GET /agent/configs/:configId/lead-map/entitlement
  app.get("/api/role-room/agent/configs/:configId/lead-map/entitlement", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    try {
      const e = await getEntitlement(pool, req.params.configId);
      if (!e) {
        return res.json({
          active: false,
          tiers: {
            discover: { priceNok: TIER_PRICING_NOK.discover, limits: { leadsPerMonth: 50, aiPitchesPerMonth: 0 } },
            pro: { priceNok: TIER_PRICING_NOK.pro, limits: { leadsPerMonth: 250, aiPitchesPerMonth: 50 } },
            agency: { priceNok: TIER_PRICING_NOK.agency, limits: { leadsPerMonth: null, aiPitchesPerMonth: null } },
          },
        });
      }
      return res.json({ active: true, entitlement: e });
    } catch (err) {
      return res.status(500).json({ error: "entitlement_failed", detail: String(err) });
    }
  });

  // POST /agent/configs/:configId/lead-map/trial — start 14-dagers pro-trial
  app.post("/api/role-room/agent/configs/:configId/lead-map/trial", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    try {
      const r = await startTrial(pool, {
        configId: req.params.configId, producerUserId: session.userId,
      });
      if (!r.ok) return res.status(409).json(r);
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "trial_failed", detail: String(err) });
    }
  });

  // POST /agent/configs/:configId/lead-map/checkout — opprett Stripe Checkout-session
  app.post("/api/role-room/agent/configs/:configId/lead-map/checkout", async (req, res) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }

    const tier = String(req.query.tier ?? req.body?.tier ?? '') as LeadMapTier;
    const priceId = tier === 'discover' ? process.env.STRIPE_PRICE_LEAD_MAP_DISCOVER
      : tier === 'pro' ? process.env.STRIPE_PRICE_LEAD_MAP_PRO
      : tier === 'agency' ? process.env.STRIPE_PRICE_LEAD_MAP_AGENCY
      : null;
    if (!priceId) return res.status(400).json({ error: "ugyldig_tier_eller_pris_mangler" });

    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });

    const successUrl = (req.body?.successUrl as string)
      || `${process.env.ROLE_ROOM_PUBLIC_URL || 'https://theroleroom.com'}/agent/lead-map/success`;
    const cancelUrl = (req.body?.cancelUrl as string)
      || `${process.env.ROLE_ROOM_PUBLIC_URL || 'https://theroleroom.com'}/agent/lead-map`;

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          module: 'lead_map',
          config_id: req.params.configId,
          producer_user_id: session.userId,
          tier,
        },
        subscription_data: {
          metadata: {
            module: 'lead_map',
            config_id: req.params.configId,
            producer_user_id: session.userId,
            tier,
          },
        },
      });
      return res.json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id });
    } catch (err) {
      return res.status(500).json({ error: "checkout_failed", detail: String(err) });
    }
  });
}
