/**
 * leadgrid-route-routes.ts
 *
 * "Smart dagsrute" — REST-endepunkter. Mount-path: /api/leadgrid/routes/*
 *
 *   POST   /api/leadgrid/routes/plan        (routes.create)
 *          { planned_date?, start_lat, start_lng, limit? }
 *          → velger selgerens in-grid, forfalt/høy-score leads, ordner dem
 *            (prioritet + nærmeste-nabo via Distance Matrix), persisterer rute.
 *   GET    /api/leadgrid/routes/:id          (routes.view)
 *   PATCH  /api/leadgrid/routes/:id/stops/:stopId  (routes.execute)
 *          { status, outcome?, notes? }
 *
 * Auth: session + RBAC (requireLeadMapPermission). Gjenbruker territorie-
 * filteret (in-grid) og rute-tjenesten.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { parseOr400, planRouteBody, planRouteTripBody } from "./leadgrid-validators.js";
import {
  loadUserTerritories, leadMatchesTerritory, type LeadGeo,
} from "./leadgrid-territory-service.js";
import {
  orderRoute, fetchGoogleMatrix, matrixDriveFns, type RoutePoint,
} from "./leadgrid-route-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData> }

function getSession(req: Request, activeSessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(req: Request, pool: Pool, userId: string): Promise<string | null> {
  const explicit =
    req.body?.organization_id ?? req.body?.organizationId ??
    req.query?.organization_id ?? req.query?.organizationId;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'salgssjef' THEN 2 ELSE 3 END, joined_at ASC
        LIMIT 1`, [userId]);
    return r.rows[0]?.organization_id ?? null;
  } catch { return null; }
}

interface CandidateLead extends LeadGeo {
  id: string; name: string | null; follow_up_priority: number | null;
  lead_score: number | null; expected_value: number | null;
}

interface PlannedRouteResult {
  id: string; name: string;
  total_distance_meters: number; total_drive_seconds: number;
  expected_route_value: number; matrix_source: string;
  stops: Array<{
    position: number; lead_id: string; name: string | null;
    latitude: number | null; longitude: number | null;
    distance_from_previous_meters: number | null; drive_seconds_from_previous: number | null;
  }>;
}

/**
 * Kjernen i "Dagsrute" — kandidat-henting + territorie-filter + ordning
 * + persistering for ÉN dag. Brukes både av POST /routes/plan (uendret
 * enkelt-dags-oppførsel) og POST /routes/plan-trip (2026-08-19, looper
 * denne N ganger — én uke i Nord-Norge = 7 kall med ekskludering av
 * forrige dagers leads, se der).
 */
async function planSingleDayRoute(
  pool: Pool,
  args: {
    orgId: string; userId: string; plannedDate: string | null;
    startLat: number; startLng: number; limit: number;
    excludeLeadIds?: Set<string>; tripId?: string; dayIndex?: number;
  },
): Promise<{ route: PlannedRouteResult } | { message: string }> {
  const territories = await loadUserTerritories(pool, args.orgId, args.userId);

  // Kandidater: mine tildelte leads med koordinater som er forfalt/høy-score.
  // FIX (2026-06-22): crm_customers har ikke organization_id-kolonne —
  // filtrer org via owner_user_id IN organization_members (PR #837/#848).
  // Beholder cp.organization_id OR-alternativ for legacy casting-prosjekter.
  const cand = await pool.query<CandidateLead & { latitude: any; longitude: any }>(
    `SELECT c.id::text, c.name, c.latitude, c.longitude,
            c.postal_code AS "postalCode", c.municipality_code AS "municipalityCode",
            c.follow_up_priority, c.lead_score, c.expected_value
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id = c.project_id
      WHERE c.assigned_user_id = $1
        AND (c.owner_user_id IN (
                SELECT user_id::text FROM organization_members WHERE organization_id = $2::uuid
             )
             OR cp.organization_id = $2::uuid)
        AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
        AND c.lead_status NOT IN ('won','lost','do_not_contact')
        AND (COALESCE(c.follow_up_priority,0) >= 50
             OR c.next_follow_up_at <= NOW()
             OR c.lead_temperature IN ('hot','ready'))
      ORDER BY COALESCE(c.follow_up_priority,0) DESC, COALESCE(c.lead_score,0) DESC
      LIMIT 100`,
    [args.userId, args.orgId],
  );

  // Behold kun in-grid leads (hvis selgeren har en grid; ellers alle) —
  // og ekskluder leads allerede planlagt tidligere dager i samme tur.
  const enforced = territories.length > 0;
  const leads = cand.rows
    .map((r) => ({
      ...r,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    }))
    .filter((l) => !enforced || territories.some((t) => leadMatchesTerritory(l, t)))
    .filter((l) => !args.excludeLeadIds?.has(l.id))
    .slice(0, args.limit);

  if (leads.length === 0) {
    return { message: "Ingen aktuelle leads i din sone akkurat nå." };
  }

  // Ordne ruten.
  const start: RoutePoint = { lat: args.startLat, lng: args.startLng };
  const points: RoutePoint[] = [start, ...leads.map((l) => ({ lat: l.latitude as number, lng: l.longitude as number }))];
  const matrix = await fetchGoogleMatrix(points);
  const fns = matrixDriveFns(points, matrix);
  const priorities = leads.map((l) => l.follow_up_priority ?? l.lead_score ?? 0);
  const ordered = orderRoute(priorities, fns.seconds, fns.meters);
  const expectedRouteValue = leads.reduce((s, l) => s + Number(l.expected_value ?? 0), 0);

  // Persistér.
  const routeName = `Dagsrute ${args.plannedDate ?? new Date().toISOString().slice(0, 10)}`;
  const rRoute = await pool.query<{ id: string }>(
    `INSERT INTO lead_routes
       (organization_id, user_id, name, planned_date, status,
        start_lat, start_lng, total_distance_meters, total_drive_seconds, expected_route_value,
        trip_id, day_index)
     VALUES ($1::uuid, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10::uuid, $11)
     RETURNING id::text`,
    [args.orgId, args.userId, routeName, args.plannedDate,
     args.startLat, args.startLng, ordered.totalDistanceM, ordered.totalDriveSec, expectedRouteValue,
     args.tripId ?? null, args.dayIndex ?? null],
  );
  const routeId = rRoute.rows[0].id;

  for (let pos = 0; pos < ordered.order.length; pos++) {
    const leg = ordered.legs[pos];
    const lead = leads[leg.leadIndex];
    await pool.query(
      `INSERT INTO lead_route_stops
         (route_id, lead_id, position, distance_from_previous_meters, drive_seconds_from_previous)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
      [routeId, lead.id, pos + 1, leg.distanceM, leg.driveSec],
    );
  }

  return {
    route: {
      id: routeId, name: routeName,
      total_distance_meters: ordered.totalDistanceM,
      total_drive_seconds: ordered.totalDriveSec,
      expected_route_value: expectedRouteValue,
      matrix_source: matrix ? "google" : "estimate",
      stops: ordered.order.map((leadIdx, pos) => {
        const lead = leads[leadIdx];
        const leg = ordered.legs[pos];
        return {
          position: pos + 1, lead_id: lead.id, name: lead.name,
          latitude: lead.latitude, longitude: lead.longitude,
          distance_from_previous_meters: leg.distanceM,
          drive_seconds_from_previous: leg.driveSec,
        };
      }),
    },
  };
}

export function registerLeadgridRouteRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };
  const permCreate = requireLeadMapPermission("routes.create", common);
  const permView = requireLeadMapPermission("routes.view", common);
  const permExecute = requireLeadMapPermission("routes.execute", common);

  // ─── POST /api/leadgrid/routes/plan ───────────────────────────────
  app.post("/api/leadgrid/routes/plan", permCreate, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });

    const b = parseOr400(planRouteBody, req.body, res);
    if (!b) return;

    try {
      const result = await planSingleDayRoute(pool, {
        orgId, userId: session.userId, plannedDate: b.planned_date ?? null,
        startLat: b.start_lat, startLng: b.start_lng, limit: b.limit ?? 12,
      });
      if ("message" in result) return res.json({ route: null, message: result.message });
      return res.status(201).json({ route: result.route });
    } catch (err) {
      return res.status(500).json({ error: "plan_failed", detail: "internal_error" });
    }
  });

  // ─── POST /api/leadgrid/routes/plan-trip (2026-08-19) ─────────────
  // Flerdagers "Dagsrute" — planlegger `days` dager i strekk. Hver dag
  // kjører samme enkelt-dags-logikk som over, men ekskluderer leads
  // allerede brukt tidligere dager i turen, og starter dag N+1 der
  // dag N sluttet (geografisk kjeding — naturlig for "kjør en uke
  // nordover og besøk leads underveis").
  app.post("/api/leadgrid/routes/plan-trip", permCreate, async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Innlogging kreves" });
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "mangler_organization_id" });

    const b = parseOr400(planRouteTripBody, req.body, res);
    if (!b) return;

    try {
      const startDate = new Date(`${b.start_date}T00:00:00Z`);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + b.days - 1);
      const tripName = `Tur ${b.start_date} (${b.days} dager)`;
      const tripR = await pool.query<{ id: string }>(
        `INSERT INTO lead_route_trips (organization_id, user_id, name, start_date, end_date)
         VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id::text`,
        [orgId, session.userId, tripName, b.start_date, endDate.toISOString().slice(0, 10)],
      );
      const tripId = tripR.rows[0].id;

      const usedLeadIds = new Set<string>();
      let cursorLat = b.start_lat;
      let cursorLng = b.start_lng;
      const days: Array<{ day_index: number; planned_date: string; route: PlannedRouteResult | null; message?: string }> = [];

      for (let dayIndex = 0; dayIndex < b.days; dayIndex++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + dayIndex);
        const plannedDate = d.toISOString().slice(0, 10);
        const result = await planSingleDayRoute(pool, {
          orgId, userId: session.userId, plannedDate,
          startLat: cursorLat, startLng: cursorLng, limit: b.per_day_limit ?? 12,
          excludeLeadIds: usedLeadIds, tripId, dayIndex: dayIndex + 1,
        });
        if ("message" in result) {
          days.push({ day_index: dayIndex + 1, planned_date: plannedDate, route: null, message: result.message });
          continue; // ikke flere leads i sonen — hopp til neste dag, ikke avbryt hele turen
        }
        days.push({ day_index: dayIndex + 1, planned_date: plannedDate, route: result.route });
        for (const stop of result.route.stops) usedLeadIds.add(stop.lead_id);
        const lastStop = result.route.stops[result.route.stops.length - 1];
        if (lastStop?.latitude != null && lastStop?.longitude != null) {
          cursorLat = lastStop.latitude;
          cursorLng = lastStop.longitude;
        }
      }

      return res.status(201).json({
        trip: { id: tripId, name: tripName, start_date: b.start_date, end_date: endDate.toISOString().slice(0, 10) },
        days,
      });
    } catch (err) {
      return res.status(500).json({ error: "plan_trip_failed", detail: "internal_error" });
    }
  });

  // ─── GET /api/leadgrid/routes/trip/:tripId ─────────────────────────
  app.get("/api/leadgrid/routes/trip/:tripId", permView, async (req: Request, res: Response) => {
    try {
      const tripR = await pool.query(
        `SELECT id::text, name, start_date, end_date, status, created_at
           FROM lead_route_trips WHERE id = $1::uuid LIMIT 1`,
        [req.params.tripId],
      );
      if (!tripR.rows.length) return res.status(404).json({ error: "ikke_funnet" });
      const routesR = await pool.query(
        `SELECT id::text, day_index, planned_date, status, total_distance_meters,
                total_drive_seconds, expected_route_value
           FROM lead_routes WHERE trip_id = $1::uuid ORDER BY day_index ASC`,
        [req.params.tripId],
      );
      return res.json({ trip: tripR.rows[0], routes: routesR.rows });
    } catch (err) {
      return res.status(500).json({ error: "read_failed", detail: "internal_error" });
    }
  });

  // ─── GET /api/leadgrid/routes/:id ─────────────────────────────────
  //
  // Router-fix (2026-07-02): kun match ekte UUID-er som `:id`. Ellers ville
  // rutene `/routes/team-nearby`, `/routes/leads/at-position`, `/routes/positions`
  // osv. (registrert i routes-adherence-routes.ts, LATER i index.ts) blitt
  // slukt av dette `:id`-mønsteret og resultere i 500 (`invalid input syntax
  // for type uuid`). UUID-regex-constraint gjør at Express faller igjennom til
  // neste handler når `id` ikke er UUID-formatert.
  app.get(
    "/api/leadgrid/routes/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
    permView,
    async (req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `SELECT id::text, name, planned_date, status, start_lat, start_lng,
                total_distance_meters, total_drive_seconds, expected_route_value,
                created_at, started_at, completed_at
           FROM lead_routes WHERE id = $1::uuid LIMIT 1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: "ikke_funnet" });
      const stops = await pool.query(
        `SELECT s.id::text, s.position, s.lead_id::text, s.status, s.outcome, s.notes,
                s.distance_from_previous_meters, s.drive_seconds_from_previous,
                s.arrived_at, s.completed_at,
                c.name, c.latitude, c.longitude
           FROM lead_route_stops s
           JOIN crm_customers c ON c.id = s.lead_id
          WHERE s.route_id = $1::uuid
          ORDER BY s.position ASC`, [req.params.id]);
      return res.json({ route: r.rows[0], stops: stops.rows });
    } catch (err) {
      return res.status(500).json({ error: "read_failed", detail: "internal_error" });
    }
  });

  // ─── PATCH /api/leadgrid/routes/:id/stops/:stopId ─────────────────
  app.patch("/api/leadgrid/routes/:id/stops/:stopId", permExecute, async (req: Request, res: Response) => {
    const b = req.body as { status?: string; outcome?: string; notes?: string };
    const valid = ["pending", "arrived", "visited", "skipped", "no_answer"];
    if (!b.status || !valid.includes(b.status)) {
      return res.status(400).json({ error: "ugyldig_status", valid });
    }
    try {
      const r = await pool.query(
        `UPDATE lead_route_stops
            SET status = $1,
                outcome = COALESCE($2, outcome),
                notes = COALESCE($3, notes),
                arrived_at = CASE WHEN $1 = 'arrived' AND arrived_at IS NULL THEN NOW() ELSE arrived_at END,
                completed_at = CASE WHEN $1 IN ('visited','skipped','no_answer') THEN NOW() ELSE completed_at END
          WHERE id = $4::uuid AND route_id = $5::uuid
          RETURNING id::text`,
        [b.status, b.outcome ?? null, b.notes ?? null, req.params.stopId, req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "stopp_ikke_funnet" });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "update_failed", detail: "internal_error" });
    }
  });
}
