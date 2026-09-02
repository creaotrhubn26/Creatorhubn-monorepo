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
import { autoPopulateLeadMap } from "./lead-map-discovery-populate.js";
import Stripe from "stripe";
import {
  createLeadFromPin,
  DuplicateLeadError,
  LeadCreationIdempotencyConflictError,
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
  type ActivityKind,
  type ActivityOutcome,
  type LeadStatus,
  type VisitType,
} from "./lead-map-service.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  requestedLeadMapOrganizationId,
  resolveAuthorizedLeadMapOrganization,
  resolveLeadOrganizationScope,
  sendLeadMapOrganizationScopeError,
} from "./lead-map-org-scope.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import {
  hashLeadCreationBody,
  LeadCreationValidationError,
  parseLeadCreationBody,
  parseLeadCreationIdempotencyKey,
} from "./lead-map-create-contract.js";
import { CardLeadProjectScopeError, createCardLead } from "./lead-map-card-service.js";

/** Bygger notes-feltet for crm_customers fra visittkort-payload */
function buildNotes(body: {
  title?: string;
  raw_text?: string;
}): string {
  const parts: string[] = [];
  if (body.title?.trim()) parts.push(`Tittel: ${body.title.trim()}`);
  if (body.raw_text?.trim()) {
    parts.push(`\n---\nOCR-tekst fra visittkort:\n${body.raw_text.trim()}`);
  }
  return parts.join("\n");
}
import { notifyStatusChanged } from "./lead-map-notification-service.js";
import { lookupCompanyForNewLead } from "./lead-brreg-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// RT-5: tynn wrapper rundt sentral resolveLeadMapSession (DB-fallback
// ved cache-miss). Handler-call-sites kaller 'await getUser(req, pool,
// activeSessions)'.
async function getUser(
  req: Request,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  return resolveLeadMapSession(req, pool, activeSessions);
}

const VALID_STATUSES: ReadonlySet<LeadStatus> = new Set([
  'unvisited', 'visited', 'return', 'not_present', 'declined',
  'interested', 'meeting_booked', 'proposal_sent', 'won', 'lost', 'do_not_contact',
]);

const VALID_VISIT_TYPES: ReadonlySet<VisitType> = new Set([
  'physical', 'phone', 'email', 'online_meeting', 'research',
]);

const VALID_ACTIVITY_KINDS: ReadonlySet<ActivityKind> = new Set([
  'call', 'email', 'meeting', 'note', 'visit', 'demo', 'proposal', 'deal_close',
]);
const VALID_ACTIVITY_OUTCOMES: ReadonlySet<ActivityOutcome> = new Set([
  'no_answer', 'spoke', 'meeting_booked', 'proposal_sent',
  'interested', 'not_interested', 'won', 'lost',
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

  async function organizationScope(
    req: Request, userId: string, leadId?: string,
  ): Promise<string | null> {
    const requested = requestedLeadMapOrganizationId(req);
    return leadId
      ? resolveLeadOrganizationScope(pool, userId, leadId, requested)
      : resolveAuthorizedLeadMapOrganization(pool, userId, requested);
  }

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
    const session = await getUser(req, pool, activeSessions);
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

    const projectId = typeof req.query.projectId === 'string' && req.query.projectId.length > 0
      ? req.query.projectId
      : null;
    try {
      const organizationId = await organizationScope(req, session.userId);
      const leads = await listLeadsInBounds(pool, {
        ownerUserId: session.userId, organizationId, projectId, bounds, statusFilter, categoryFilter,
      });
      return res.json({ leads });
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "leads_failed", detail: "internal_error" });
    }
  });

  // GET /leads/:id
  app.get("/api/admin-room/lead-map/leads/:id", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const lead = await getLeadById(pool, { ownerUserId: session.userId, organizationId }, req.params.id);
      if (!lead) return res.status(404).json({ error: "not_found" });
      return res.json(lead);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "lead_failed", detail: "internal_error" });
    }
  });

  // Workflow-trigger-publisering (QA 2026-07-05): lead.status_changed
  // hadde INGEN publisher — workflows med status-trigger fyrte aldri.
  // Brukes av begge status-endepunktene + begge visit-endepunktene
  // (besøk kan sette newStatus). Fire-and-forget.
  function publishLeadStatusChanged(opts: {
    leadId: string;
    from: string | null;
    to: string;
    userId: string;
  }): void {
    void (async () => {
      try {
        const { resolveOrgIdForUser } = await import("./leadgrid-org-resolver.js");
        const { publishEvent } = await import("./leadgrid-workflow-engine.js");
        const orgId = await resolveOrgIdForUser(pool, opts.userId);
        await publishEvent({
          pool,
          organizationId: orgId,
          type: "lead.status_changed",
          leadId: opts.leadId,
          actorUserId: opts.userId,
          data: {
            from: opts.from,
            to: opts.to,
            occurred_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.warn("[lead-map] lead.status_changed publish feilet:", (err as Error).message);
      }
    })();
  }

  // PATCH /leads/:id/status
  app.patch("/api/admin-room/lead-map/leads/:id/status",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as { status?: string; notes?: string };
    if (!body.status || !VALID_STATUSES.has(body.status as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const r = await updateLeadStatus(pool, {
        ownerUserId: session.userId,
        organizationId,
        leadId: req.params.id,
        status: body.status as LeadStatus,
        notes: body.notes,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      const oldStatus = r.previous ?? null;

      // Varsle eier hvis status faktisk endret seg + ikke samme bruker
      if (oldStatus !== body.status) {
        setImmediate(() => {
          void notifyStatusChanged(pool, {
            leadId: req.params.id,
            oldStatus,
            newStatus: body.status!,
            triggeredByUserId: session.userId,
          });
        });
        publishLeadStatusChanged({
          leadId: req.params.id,
          from: oldStatus,
          to: body.status,
          userId: session.userId,
        });
      }

      return res.json(r);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "status_failed", detail: "internal_error" });
    }
  });

  // PATCH /leads/:id/temperature (workflow-QA 2026-07-05)
  //
  // Temperatur kunne bare settes ved opprettelse (from-pin) — det fantes
  // ingen oppdateringsflate, så lead.temperature_changed-workflows kunne
  // aldri fyre. Whitelist matcher check-constrainten på crm_customers.
  app.patch("/api/admin-room/lead-map/leads/:id/temperature",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const VALID_TEMPS = new Set(["cold", "warm", "hot", "ready"]);
    const body = (req.body ?? {}) as { temperature?: string };
    if (!body.temperature || !VALID_TEMPS.has(body.temperature)) {
      return res.status(400).json({ error: "ugyldig_temperatur" });
    }
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const scopeParams: unknown[] = [req.params.id];
      const scopeClause = organizationId
        ? (scopeParams.push(organizationId), `organization_id = $${scopeParams.length}::uuid`)
        : (scopeParams.push(session.userId), `owner_user_id = $${scopeParams.length}`);
      const prev = await pool.query<{ lead_temperature: string | null }>(
        `SELECT lead_temperature FROM crm_customers WHERE id = $1::uuid AND ${scopeClause}`,
        scopeParams,
      );
      if (!prev.rows.length) return res.status(404).json({ error: "not_found" });
      const oldTemp = prev.rows[0].lead_temperature ?? null;

      await pool.query(
        `UPDATE crm_customers
            SET lead_temperature = $1, updated_at = NOW()
          WHERE id = $2::uuid AND ${scopeClause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)}`,
        [body.temperature, ...scopeParams],
      );

      if (oldTemp !== body.temperature) {
        void (async () => {
          try {
            const { resolveOrgIdForUser } = await import("./leadgrid-org-resolver.js");
            const { publishEvent } = await import("./leadgrid-workflow-engine.js");
            const orgId = organizationId ?? await resolveOrgIdForUser(pool, session.userId);
            await publishEvent({
              pool,
              organizationId: orgId,
              type: "lead.temperature_changed",
              leadId: req.params.id,
              actorUserId: session.userId,
              data: {
                from: oldTemp,
                to: body.temperature,
                occurred_at: new Date().toISOString(),
              },
            });
          } catch (err) {
            console.warn("[lead-map] lead.temperature_changed publish feilet:", (err as Error).message);
          }
        })();
      }

      return res.json({ ok: true, temperature: body.temperature });
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "temperature_failed", detail: "internal_error" });
    }
  });

  // PATCH /leads/:id/geo
  app.patch("/api/admin-room/lead-map/leads/:id/geo",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      latitude?: number; longitude?: number;
      address?: string; postalCode?: string; city?: string; country?: string;
    };
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return res.status(400).json({ error: "mangler_koordinater" });
    }
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const r = await setLeadGeo(pool, {
        ownerUserId: session.userId,
        organizationId,
        leadId: req.params.id,
        latitude: body.latitude, longitude: body.longitude,
        address: body.address, postalCode: body.postalCode,
        city: body.city, country: body.country,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });
      return res.json(r);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "geo_failed", detail: "internal_error" });
    }
  });

  // POST /leads/:id/visits
  app.post("/api/admin-room/lead-map/leads/:id/visits",
    requireLeadMapPermission("visits.create", { pool, activeSessions }),
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
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
      visitDatetime?: string;
      activityKind?: string;
      outcome?: string;
      durationMinutes?: number;
    };

    if (!body.visitType || !VALID_VISIT_TYPES.has(body.visitType as VisitType)) {
      return res.status(400).json({ error: "ugyldig_visit_type" });
    }
    if (body.newStatus && !VALID_STATUSES.has(body.newStatus as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    if (body.activityKind && !VALID_ACTIVITY_KINDS.has(body.activityKind as ActivityKind)) {
      return res.status(400).json({ error: "ugyldig_activity_kind" });
    }
    if (body.outcome && !VALID_ACTIVITY_OUTCOMES.has(body.outcome as ActivityOutcome)) {
      return res.status(400).json({ error: "ugyldig_outcome" });
    }
    if (body.durationMinutes !== undefined &&
        (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 0 || body.durationMinutes > 1440)) {
      return res.status(400).json({ error: "ugyldig_varighet" });
    }
    if (body.visitDatetime && Number.isNaN(new Date(body.visitDatetime).getTime())) {
      return res.status(400).json({ error: "ugyldig_aktivitetstid" });
    }

    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const r = await logVisit(pool, {
        ownerUserId: session.userId,
        organizationId,
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
        visitDatetime: body.visitDatetime,
        activityKind: body.activityKind as ActivityKind | undefined,
        outcome: body.outcome as ActivityOutcome | undefined,
        durationMinutes: body.durationMinutes,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });

      const oldStatus = r.previousStatus ?? null;
      if (body.newStatus && oldStatus !== body.newStatus) {
        publishLeadStatusChanged({
          leadId: req.params.id,
          from: oldStatus,
          to: body.newStatus,
          userId: session.userId,
        });
      }

      return res.json(r);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "visit_failed", detail: "internal_error" });
    }
  });

  // GET /leads/:id/visits
  app.get("/api/admin-room/lead-map/leads/:id/visits", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const visits = await listVisits(pool, { ownerUserId: session.userId, organizationId }, req.params.id, 50);
      return res.json({ visits });
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "visits_failed", detail: "internal_error" });
    }
  });

  // GET /activities — feed
  app.get("/api/admin-room/lead-map/activities", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    try {
      const organizationId = await organizationScope(req, session.userId);
      const activities = await listRecentActivities(pool, { ownerUserId: session.userId, organizationId }, limit);
      return res.json({ activities });
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "activities_failed", detail: "internal_error" });
    }
  });

  // GET /metrics
  app.get("/api/admin-room/lead-map/metrics", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const projectId = typeof req.query.projectId === 'string' && req.query.projectId.length > 0
        ? req.query.projectId
        : null;
      const organizationId = await organizationScope(req, session.userId);
      const metrics = await getLeadMapMetrics(pool, { ownerUserId: session.userId, organizationId, projectId });
      return res.json(metrics);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "metrics_failed", detail: "internal_error" });
    }
  });

  // POST /leads/:id/generate-pitch — Claude AI pitch
  app.post("/api/admin-room/lead-map/leads/:id/generate-pitch",
    requireLeadMapPermission("ai.use_claude", { pool, activeSessions }),
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { serviceFocus?: string };
    try {
      const organizationId = await organizationScope(req, session.userId, req.params.id);
      const r = await generateLeadPitch(pool, {
        ownerUserId: session.userId, organizationId, leadId: req.params.id,
        serviceFocus: body.serviceFocus,
      });
      if (!r) return res.status(503).json({ error: "ai_unavailable_or_lead_not_found" });
      return res.json(r);
    } catch (err) {
      if (sendLeadMapOrganizationScopeError(err, res)) return;
      return res.status(500).json({ error: "pitch_failed", detail: "internal_error" });
    }
  });

  // POST /places/search — Google Places search
  app.post("/api/admin-room/lead-map/places/search", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      query?: string; latitude?: number; longitude?: number;
      radiusMeters?: number; type?: string;
    };
    if (!body.query) return res.status(400).json({ error: "mangler_query" });

    try {
      const organizationId = await organizationScope(req, session.userId);
      const r = await searchPlaces(pool, {
        ownerUserId: session.userId,
        organizationId,
        query: body.query,
        latitude: body.latitude, longitude: body.longitude,
        radiusMeters: body.radiusMeters ?? 5000,
        type: body.type,
      });
      if (!r.ok) return res.status(503).json({ error: r.reason });
      return res.json({ results: r.results });
    } catch (err) {
      return res.status(500).json({ error: "places_failed", detail: "internal_error" });
    }
  });

  // GET /company-lookup?q= — ekte BRREG-oppslag for «Legg til lead»-skjemaets
  // scan-felt (2026-08-16). Erstatter en klient-side mock som alltid fylte
  // inn samme fiktive «Nordic Elektro AS» uansett hva brukeren skrev inn.
  app.get("/api/admin-room/lead-map/company-lookup", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const q = typeof req.query.q === "string" ? req.query.q : "";
    if (!q.trim()) return res.status(400).json({ error: "mangler_sok" });
    try {
      const result = await lookupCompanyForNewLead(q);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "lookup_failed", detail: "internal_error" });
    }
  });

  // POST /leads/from-card — opprett lead fra skannet visittkort (iPad #182)
  app.post("/api/admin-room/lead-map/leads/from-card",
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const body = (req.body ?? {}) as {
        name?: string;
        title?: string;
        company?: string;
        email?: string;
        phone?: string;
        website?: string;
        raw_text?: string;
        project_id?: string | null;
        lead_source?: string;
      };
      if (!body.name?.trim()) {
        return res.status(400).json({ error: "mangler_navn" });
      }
      // Anbud-gjenbruk (2026-08-02): «Opprett lead fra anbud» på iPad
      // sender org.nr i raw_text (→ sikker BRREG-kobling + full berikelse
      // via samme løype) men skal spores som egen kilde.
      const leadSource = ["business_card_scan", "doffin_anbud"].includes(body.lead_source ?? "")
        ? (body.lead_source as "business_card_scan" | "doffin_anbud")
        : "business_card_scan";
      let idempotencyKey: string | null;
      try {
        idempotencyKey = parseLeadCreationIdempotencyKey(req.get("Idempotency-Key"));
      } catch (error) {
        if (error instanceof LeadCreationValidationError) {
          return res.status(400).json({ error: error.code });
        }
        return res.status(400).json({ error: "ugyldig_idempotency_key" });
      }

      try {
        const organizationId =
          (await organizationScope(req, session.userId))
          ?? (await resolveOrgIdForUser(pool, session.userId));
        // BRREG-kobling FØR insert: org.nr fra OCR-teksten (mod11-validert,
        // sikrest) eller navnesøk på FIRMANAVNET m/ match-vakt. Person-
        // navnet brukes aldri — enrichLeadWithBrreg søker på lead.name,
        // som på kort-leads er kontaktpersonen, derfor må org.nr settes her.
        const { resolveOrgNrForCard } = await import("./lead-brreg-service.js");
        const brregLink = await resolveOrgNrForCard({
          company: body.company ?? null,
          rawText: body.raw_text ?? null,
        }).catch(() => ({ status: "no_match" as const }));

        let notes = buildNotes(body);
        if (brregLink.status === "suggestion") {
          // Vagt navnetreff kobles aldri automatisk — men forslaget er
          // verdt å se for selgeren.
          notes += `\n---\nBRREG-forslag (ikke koblet automatisk): ${brregLink.matchedName} (org.nr ${brregLink.orgNr}) — bekreft i lead-kortet.`;
        }

        const creation = await createCardLead(pool, {
          name: body.name.trim(),
          title: body.title?.trim() || null,
          company: body.company?.trim() || null,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          website: body.website?.trim() || null,
          notes,
          projectId: body.project_id ?? null,
          leadSource,
          organizationNumber: brregLink.status === "linked" ? brregLink.orgNr : null,
          ownerUserId: session.userId,
          organizationId,
          idempotencyKey,
        });
        // Hvis title satt, lagre som notat (vi har ikke felt for kontakt-tittel
        // separat — på crm_customers er notes-feltet tilstrekkelig)
        // Workflow-event (2026-07-04): visittkort-skannede leads skal
        // også fyre lead.created (welcome/intro-workflows) — samme
        // mønster som pin-drop-ruten. Fire-and-forget.
        const cardLeadId = creation.id;
        // Full berikelse (adresse, NACE, daglig leder, regnskap) i bakgrunnen
        // når org.nr er sikkert koblet — pipeline hopper over navnesøket.
        if (creation.created && brregLink.status === "linked") {
          // Via jobb-køen (0400): overlever deploy-restart, retry m/
          // backoff, og feil blir synlige i /api/admin-room/jobs i stedet
          // for en stille console.warn.
          const { enqueueLeadBrregEnrich } = await import("./job-handlers.js");
          await enqueueLeadBrregEnrich(pool, {
            leadId: cardLeadId,
            ownerUserId: session.userId,
          }).catch((err) => {
            console.warn("[from-card] kunne ikke køe BRREG-berikelse:", String(err).slice(0, 120));
          });
        }
        if (creation.created) void (async () => {
          try {
            const { publishEvent } = await import("./leadgrid-workflow-engine.js");
            await publishEvent({
              pool,
              organizationId,
              type: "lead.created",
              leadId: cardLeadId,
              actorUserId: session.userId,
              data: { source: leadSource, occurred_at: new Date().toISOString() },
            });
          } catch (err) {
            console.warn("[lead-map] from-card lead.created feilet:", (err as Error).message);
          }
        })();
        return res.json({
          ok: true,
          id: cardLeadId,
          // iOS-appen kan vise koblingen med en gang («Fant: X AS, org.nr …»)
          brreg: brregLink.status === "no_match" ? null : brregLink,
          replayed: creation.idempotentReplay,
          duplicate_match: creation.duplicateMatch,
        });
      } catch (err) {
        if (sendLeadMapOrganizationScopeError(err, res)) return;
        if (err instanceof LeadCreationIdempotencyConflictError) {
          return res.status(409).json({ error: "idempotency_key_conflict" });
        }
        if (err instanceof CardLeadProjectScopeError) {
          return res.status(400).json({ error: "project_not_in_organization" });
        }
        return res.status(500).json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );

  // POST /leads/from-pin — fullstendig manuell/posisjonsbasert opprettelse
  //
  // Idempotency-Key er valgfri kun for bakoverkompatibilitet med eldre builds.
  // Nye klienter sender én stabil UUID per skjemasesjon. Selve service-laget
  // beskytter både retry og naturlige identiteter atomisk per workspace.
  app.post(
    "/api/admin-room/lead-map/leads/from-pin",
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId)
        return res.status(401).json({ error: "Innlogging kreves" });

      let body: ReturnType<typeof parseLeadCreationBody>;
      let idempotencyKey: string | null;
      try {
        body = parseLeadCreationBody(req.body ?? {});
        idempotencyKey = parseLeadCreationIdempotencyKey(
          req.get("Idempotency-Key"),
        );
      } catch (err) {
        if (err instanceof LeadCreationValidationError) {
          return res.status(400).json({ error: err.code });
        }
        return res.status(400).json({ error: "ugyldig_payload" });
      }

      try {
        const organizationId =
          (await organizationScope(req, session.userId))
          ?? (await resolveOrgIdForUser(pool, session.userId));
        const creation = await createLeadFromPin(pool, {
          ...body,
          ownerUserId: session.userId,
          organizationId,
          idempotencyKey,
          requestHash: idempotencyKey ? hashLeadCreationBody(body) : null,
        });

        if (creation.idempotentReplay) {
          res.setHeader("Idempotent-Replayed", "true");
        }

        // Replay må ikke fyre lead.created på nytt.
        if (creation.created) {
          void (async () => {
            try {
              const { publishEvent } =
                await import("./leadgrid-workflow-engine.js");
              await publishEvent({
                pool,
                organizationId,
                type: "lead.created",
                leadId: creation.id,
                actorUserId: session.userId,
                data: {
                  source: body.leadSource,
                  lead_status: body.leadStatus,
                  lead_temperature: body.leadTemperature,
                  occurred_at: new Date().toISOString(),
                },
              });
            } catch (err) {
              console.warn(
                "[lead-map] lead.created-event feilet:",
                (err as Error).message,
              );
            }
          })();
        }

        return res.json({
          ok: true,
          id: creation.id,
          replayed: creation.idempotentReplay,
        });
      } catch (err) {
        if (sendLeadMapOrganizationScopeError(err, res)) return;
        if (err instanceof DuplicateLeadError) {
          return res.status(409).json({
            error: "duplicate_lead",
            existing_lead_id: err.existingLeadId,
            matched_fields: err.matchedFields,
          });
        }
        if (err instanceof LeadCreationIdempotencyConflictError) {
          return res.status(409).json({
            error: "idempotency_key_conflict",
            existing_lead_id: err.existingLeadId || undefined,
          });
        }
        console.error(
          "[lead-map] from-pin create failed:",
          (err as Error).message,
        );
        return res
          .status(500)
          .json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );

  // POST /places/import — importer ett Places-resultat som lead
  app.post("/api/admin-room/lead-map/places/import", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      place?: Parameters<typeof importPlaceAsLead>[1]['place'];
      leadCategory?: string;
      projectId?: string | null;
    };
    if (!body.place?.placeId) return res.status(400).json({ error: "mangler_place" });

    try {
      const organizationId = await organizationScope(req, session.userId);
      const r = await importPlaceAsLead(pool, {
        ownerUserId: session.userId,
        organizationId,
        place: body.place,
        leadCategory: body.leadCategory,
        projectId: body.projectId ?? null,
      });
      if (!r.ok) return res.status(r.reason === 'already_imported' ? 409 : 500).json(r);
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "import_failed", detail: "internal_error" });
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
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "leads_failed", detail: "internal_error" });
    }
  });

  // GET /agent/configs/:configId/lead-map/leads/:id
  app.get("/api/role-room/agent/configs/:configId/lead-map/leads/:id", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "lead_failed", detail: "internal_error" });
    }
  });

  // PATCH /agent/configs/:configId/lead-map/leads/:id/status
  app.patch("/api/role-room/agent/configs/:configId/lead-map/leads/:id/status", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const body = (req.body ?? {}) as { status?: string; notes?: string };
    if (!body.status || !VALID_STATUSES.has(body.status as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      // Gammel status FØR oppdatering — trengs av workflow-triggeren.
      const prev = await pool.query<{ lead_status: string | null }>(
        `SELECT lead_status FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      const oldStatus = prev.rows[0]?.lead_status ?? null;

      const r = await updateLeadStatus(pool, {
        ownerUserId: session.userId,
        agentConfigId: req.params.configId,
        leadId: req.params.id,
        status: body.status as LeadStatus,
        notes: body.notes,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });

      // Workflow-trigger (QA 2026-07-05): samme kobling som admin-ruten.
      if (oldStatus !== body.status) {
        publishLeadStatusChanged({
          leadId: req.params.id,
          from: oldStatus,
          to: body.status,
          userId: session.userId,
        });
      }

      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "status_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/leads/:id/visits
  app.post("/api/role-room/agent/configs/:configId/lead-map/leads/:id/visits", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      // Gammel status FØR logVisit (workflow-trigger, QA 2026-07-05).
      let oldStatus: string | null = null;
      if (body.newStatus) {
        const prev = await pool.query<{ lead_status: string | null }>(
          `SELECT lead_status FROM crm_customers WHERE id = $1`,
          [req.params.id],
        );
        oldStatus = prev.rows[0]?.lead_status ?? null;
      }

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

      if (body.newStatus && oldStatus !== body.newStatus) {
        publishLeadStatusChanged({
          leadId: req.params.id,
          from: oldStatus,
          to: body.newStatus,
          userId: session.userId,
        });
      }

      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "visit_failed", detail: "internal_error" });
    }
  });

  // GET /agent/configs/:configId/lead-map/metrics
  app.get("/api/role-room/agent/configs/:configId/lead-map/metrics", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "metrics_failed", detail: "internal_error" });
    }
  });

  // GET /agent/configs/:configId/lead-map/activities
  app.get("/api/role-room/agent/configs/:configId/lead-map/activities", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "activities_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/places/search
  app.post("/api/role-room/agent/configs/:configId/lead-map/places/search", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "places_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/places/import
  app.post("/api/role-room/agent/configs/:configId/lead-map/places/import", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "import_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/leads/:id/generate-pitch
  app.post("/api/role-room/agent/configs/:configId/lead-map/leads/:id/generate-pitch", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "pitch_failed", detail: "internal_error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // ENTITLEMENT / BILLING
  // ════════════════════════════════════════════════════════════════════

  // GET /agent/configs/:configId/lead-map/entitlement
  app.get("/api/role-room/agent/configs/:configId/lead-map/entitlement", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "entitlement_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/trial — start 14-dagers pro-trial
  app.post("/api/role-room/agent/configs/:configId/lead-map/trial", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "trial_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/auto-populate — Site Discovery → import lookalike-leads
  app.post("/api/role-room/agent/configs/:configId/lead-map/auto-populate", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    // UUID-validering FØR noen ::uuid-cast — en malformet configId ville
    // ellers kastet «invalid input syntax for type uuid» i verifyConfig-
    // Access/SELECT (før try) → uhåndtert → HENG (Notification-QA 2026-07-07).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.configId)) {
      return res.status(400).json({ error: "ugyldig_config_id" });
    }
    if (!await verifyConfigAccess(req.params.configId, session.userId)) {
      return res.status(403).json({ error: "ingen_tilgang_til_config" });
    }
    const e = await requireEntitlement(req, res, req.params.configId);
    if (!e) return;

    const body = (req.body ?? {}) as {
      clientWebsiteUrl?: string;
      city?: string;
      maxQueries?: number;
      maxImportsPerQuery?: number;
    };

    // Hent URL fra config hvis ikke i body
    let websiteUrl = body.clientWebsiteUrl;
    if (!websiteUrl) {
      const c = await pool.query<{ client_website_url: string | null }>(
        `SELECT client_website_url FROM client_ads_configs WHERE id = $1::uuid`,
        [req.params.configId],
      );
      websiteUrl = c.rows[0]?.client_website_url ?? undefined;
    }
    if (!websiteUrl) return res.status(400).json({ error: "mangler_client_website_url" });

    try {
      const result = await autoPopulateLeadMap(pool, {
        configId: req.params.configId,
        producerUserId: session.userId,
        clientWebsiteUrl: websiteUrl,
        city: body.city,
        maxQueries: body.maxQueries,
        maxImportsPerQuery: body.maxImportsPerQuery,
      });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "auto_populate_failed", detail: "internal_error" });
    }
  });

  // POST /agent/configs/:configId/lead-map/checkout — opprett Stripe Checkout-session
  app.post("/api/role-room/agent/configs/:configId/lead-map/checkout", async (req, res) => {
    const session = await getUser(req, pool, activeSessions);
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
      return res.status(500).json({ error: "checkout_failed", detail: "internal_error" });
    }
  });
}
