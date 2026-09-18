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

import { randomUUID } from "node:crypto";
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
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { idempotencyMiddleware, readIdempotencyKey } from "./_shared-idempotency.js";
import {
  createLeadFromDraft,
  leadDraftInputSchema,
  LeadDraftNormalizationError,
  LeadDuplicateConflictError,
  LeadIdempotencyConflictError,
  LeadScopeValidationError,
  normalizeLeadDraft,
} from "./leadgrid-lead-creation-service.js";
import { registerLeadgridLeadCreationRoutes } from "./leadgrid-lead-creation-routes.js";
import { parseLeadgridFollowUpInput } from "./leadgrid-agent-skills.js";

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

function legacyCreationId(req: Request): string {
  const explicit = req.body?.creation_id;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const key = readIdempotencyKey(req);
  const uuid = key?.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )?.[0];
  return uuid ?? randomUUID();
}

function sendLegacyLeadCreationError(error: unknown, res: Response): boolean {
  if (error instanceof LeadDraftNormalizationError) {
    res.status(400).json({
      error: "validation_failed",
      issues: [{ path: error.field, message: error.reason }],
    });
    return true;
  }
  if (error instanceof LeadDuplicateConflictError) {
    res.status(409).json({
      error: "duplicate_conflict",
      candidates: error.candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        match_reasons: candidate.matchReasons,
      })),
    });
    return true;
  }
  if (error instanceof LeadIdempotencyConflictError) {
    res.status(409).json({ error: "idempotency_payload_conflict" });
    return true;
  }
  if (error instanceof LeadScopeValidationError) {
    res.status(error.code === "organization_mismatch" ? 403 : 400).json({ error: error.code });
    return true;
  }
  return false;
}
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
  registerLeadgridLeadCreationRoutes(deps);
  const nativeWriteIdempotency = idempotencyMiddleware({
    pool,
    scope: "leadgrid-native",
    // Midlertidige serverfeil må kunne prøves igjen med samme action-ID.
    shouldCacheResponse: (status) => status >= 200 && status < 300,
    failClosedOnUnavailable: true,
  });

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
      const leads = await listLeadsInBounds(pool, {
        ownerUserId: session.userId, projectId, bounds, statusFilter, categoryFilter,
      });
      return res.json({ leads });
    } catch (err) {
      return res.status(500).json({ error: "leads_failed", detail: "internal_error" });
    }
  });

  // GET /leads/:id
  app.get("/api/admin-room/lead-map/leads/:id", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const lead = await getLeadById(pool, { ownerUserId: session.userId }, req.params.id);
      if (!lead) return res.status(404).json({ error: "not_found" });
      return res.json(lead);
    } catch (err) {
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
    nativeWriteIdempotency,
    async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as { status?: string; notes?: string };
    if (!body.status || !VALID_STATUSES.has(body.status as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }
    try {
      // Hent gammel status FØR oppdatering (for å varsle om endring)
      const prev = await pool.query<{ lead_status: string | null }>(
        `SELECT lead_status FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      const oldStatus = prev.rows[0]?.lead_status ?? null;

      const r = await updateLeadStatus(pool, {
        ownerUserId: session.userId,
        leadId: req.params.id,
        status: body.status as LeadStatus,
        notes: body.notes,
      });
      if (!r.ok) return res.status(404).json({ error: "not_found" });

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
      const prev = await pool.query<{ lead_temperature: string | null }>(
        `SELECT lead_temperature FROM crm_customers WHERE id = $1`,
        [req.params.id],
      );
      if (!prev.rows.length) return res.status(404).json({ error: "not_found" });
      const oldTemp = prev.rows[0].lead_temperature ?? null;

      await pool.query(
        `UPDATE crm_customers
            SET lead_temperature = $1, updated_at = NOW()
          WHERE id = $2`,
        [body.temperature, req.params.id],
      );

      if (oldTemp !== body.temperature) {
        void (async () => {
          try {
            const { resolveOrgIdForUser } = await import("./leadgrid-org-resolver.js");
            const { publishEvent } = await import("./leadgrid-workflow-engine.js");
            const orgId = await resolveOrgIdForUser(pool, session.userId);
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
      return res.status(500).json({ error: "geo_failed", detail: "internal_error" });
    }
  });

  // POST /leads/:id/visits
  app.post("/api/admin-room/lead-map/leads/:id/visits",
    requireLeadMapPermission("visits.create", { pool, activeSessions }),
    nativeWriteIdempotency,
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
    };

    if (!body.visitType || !VALID_VISIT_TYPES.has(body.visitType as VisitType)) {
      return res.status(400).json({ error: "ugyldig_visit_type" });
    }
    if (body.newStatus && !VALID_STATUSES.has(body.newStatus as LeadStatus)) {
      return res.status(400).json({ error: "ugyldig_status" });
    }

    try {
      // Gammel status FØR logVisit — besøk kan sette newStatus, og da
      // skal lead.status_changed-workflows fyre (QA 2026-07-05).
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

  // PATCH /leads/:id/follow-up — canonical, tenant-scoped and idempotent.
  // Used by confirmed Leadgrid Agent proposals and safe offline replay.
  app.patch("/api/admin-room/lead-map/leads/:id/follow-up",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    nativeWriteIdempotency,
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const organizationId = typeof res.locals.leadMapOrganizationId === "string"
        ? res.locals.leadMapOrganizationId
        : null;
      if (!organizationId) {
        return res.status(400).json({ error: "organization_scope_required" });
      }

      const parsed = parseLeadgridFollowUpInput(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: "validation_failed", issues: parsed.issues });
      }

      try {
        const result = await pool.query<{
          id: string;
          next_follow_up_at: Date;
          next_action: string;
        }>(
          `UPDATE crm_customers
              SET next_follow_up_at = $3::timestamptz,
                  next_action = $4,
                  updated_at = NOW()
            WHERE id::text = $1
              AND organization_id::text = $2
              AND archived_at IS NULL
        RETURNING id::text, next_follow_up_at, next_action`,
          [
            req.params.id,
            organizationId,
            parsed.value.nextFollowUpAt,
            parsed.value.nextAction,
          ],
        );
        const row = result.rows[0];
        if (!row) return res.status(404).json({ error: "not_found" });
        return res.json({
          ok: true,
          lead_id: row.id,
          next_follow_up_at: row.next_follow_up_at.toISOString(),
          next_action: row.next_action,
        });
      } catch {
        return res.status(500).json({ error: "follow_up_failed", detail: "internal_error" });
      }
    },
  );

  // GET /leads/:id/visits
  app.get("/api/admin-room/lead-map/leads/:id/visits", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const visits = await listVisits(pool, { ownerUserId: session.userId }, req.params.id, 50);
      return res.json({ visits });
    } catch (err) {
      return res.status(500).json({ error: "visits_failed", detail: "internal_error" });
    }
  });

  // GET /activities — feed
  app.get("/api/admin-room/lead-map/activities", async (req: Request, res: Response) => {
    const session = await getUser(req, pool, activeSessions);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    try {
      const activities = await listRecentActivities(pool, { ownerUserId: session.userId }, limit);
      return res.json({ activities });
    } catch (err) {
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
      const metrics = await getLeadMapMetrics(pool, { ownerUserId: session.userId, projectId });
      return res.json(metrics);
    } catch (err) {
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
      const r = await generateLeadPitch(pool, {
        ownerUserId: session.userId, leadId: req.params.id,
        serviceFocus: body.serviceFocus,
      });
      if (!r) return res.status(503).json({ error: "ai_unavailable_or_lead_not_found" });
      return res.json(r);
    } catch (err) {
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


  // Legacy-aliaser beholdes for eldre appversjoner, men oversettes til den
  // samme kanoniske, tenant-sikre og idempotente tjenesten som ny klient.
  app.post(
    "/api/admin-room/lead-map/leads/from-card",
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    nativeWriteIdempotency,
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const organizationId =
        typeof res.locals.leadMapOrganizationId === "string"
          ? res.locals.leadMapOrganizationId
          : null;
      if (!organizationId) return res.status(400).json({ error: "organization_required" });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const leadSource =
        body.lead_source === "doffin_anbud" ? "doffin_anbud" : "business_card_scan";
      try {
        const brregLink = await import("./lead-brreg-service.js").then(
          ({ resolveOrgNrForCard }) =>
            resolveOrgNrForCard({
              company: typeof body.company === "string" ? body.company : null,
              rawText: typeof body.raw_text === "string" ? body.raw_text : null,
            }),
        ).catch(() => ({ status: "no_match" as const }));

        const clientNotes = buildNotes({
          title: typeof body.title === "string" ? body.title : undefined,
          raw_text: typeof body.raw_text === "string" ? body.raw_text : undefined,
        });
        let notes = clientNotes;
        if (brregLink.status === "suggestion") {
          notes +=
            "\n---\nBRREG-forslag (ikke koblet automatisk): " +
            brregLink.matchedName + " (org.nr " + brregLink.orgNr +
            ") — bekreft i lead-kortet.";
        }
        const parsed = leadDraftInputSchema.safeParse({
          creation_id: legacyCreationId(req),
          organization_id: organizationId,
          name: body.name,
          company: body.company,
          organization_number: null,
          website_url: body.website,
          contact_name: body.name,
          contact_role: body.title,
          email: body.email,
          phone: body.phone,
          notes: clientNotes,
          lead_source: leadSource,
          project_id: body.project_id,
          raw_text: body.raw_text,
          allow_duplicate: body.allow_duplicate === true,
        });
        if (!parsed.success) {
          return res.status(400).json({
            error: "validation_failed",
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          });
        }
        const originalDraft = normalizeLeadDraft(parsed.data);
        const draft = {
          ...originalDraft,
          organizationNumber:
            brregLink.status === "linked" ? brregLink.orgNr : null,
          notes: notes.trim() ? notes : null,
        };
        const result = await createLeadFromDraft(pool, {
          organizationId,
          userId: session.userId,
          draft,
          idempotencyDraft: originalDraft,
        });
        return res.json({
          ok: true,
          id: result.id,
          created: result.created,
          replayed: result.replayed,
          duplicates_checked: result.duplicatesChecked,
          brreg: brregLink.status === "no_match" ? null : brregLink,
        });
      } catch (error) {
        if (sendLegacyLeadCreationError(error, res)) return;
        console.warn("[lead-map] canonical from-card failed:", error);
        return res.status(500).json({ error: "create_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/from-pin",
    requireLeadMapPermission("leads.create", { pool, activeSessions }),
    nativeWriteIdempotency,
    async (req: Request, res: Response) => {
      const session = await getUser(req, pool, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const organizationId =
        typeof res.locals.leadMapOrganizationId === "string"
          ? res.locals.leadMapOrganizationId
          : null;
      if (!organizationId) return res.status(400).json({ error: "organization_required" });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const validTemperatures = new Set(["hot", "warm", "cold", "ready"]);
      const validConfidences = new Set(["exact", "geocoded", "approximate", "unknown"]);
      const temperature =
        typeof body.lead_temperature === "string" &&
        validTemperatures.has(body.lead_temperature)
          ? body.lead_temperature
          : "warm";
      const locationConfidence =
        typeof body.location_confidence === "string" &&
        validConfidences.has(body.location_confidence)
          ? body.location_confidence
          : "exact";
      try {
        const parsed = leadDraftInputSchema.safeParse({
          creation_id: legacyCreationId(req),
          organization_id: organizationId,
          name: body.name,
          company: body.company,
          email: body.email,
          phone: body.phone,
          address: body.address,
          latitude: body.latitude,
          longitude: body.longitude,
          industry_id: body.industry_id,
          lead_temperature: temperature,
          location_confidence: locationConfidence,
          lead_source:
            typeof body.lead_source === "string" && body.lead_source.trim()
              ? body.lead_source.trim()
              : "manual_pin_drop",
          project_id: body.project_id,
          allow_duplicate: body.allow_duplicate === true,
        });
        if (!parsed.success) {
          return res.status(400).json({
            error: "validation_failed",
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          });
        }
        const result = await createLeadFromDraft(pool, {
          organizationId,
          userId: session.userId,
          draft: normalizeLeadDraft(parsed.data),
        });
        return res.json({
          ok: true,
          id: result.id,
          created: result.created,
          replayed: result.replayed,
          duplicates_checked: result.duplicatesChecked,
        });
      } catch (error) {
        if (sendLegacyLeadCreationError(error, res)) return;
        console.warn("[lead-map] canonical from-pin failed:", error);
        return res.status(500).json({ error: "create_failed", detail: "internal_error" });
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
      const r = await importPlaceAsLead(pool, {
        ownerUserId: session.userId,
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
