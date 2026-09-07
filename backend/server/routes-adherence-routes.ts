/**
 * routes-adherence-routes.ts
 *
 * Route Adherence + MeMapPin tap-actions for Leadgrid iPad-klienten.
 *
 * Prefix: /api/leadgrid/routes/*
 *
 * Endepunkter (10 totalt):
 *   POST   /positions                       — batch-log posisjons-samples
 *   GET    /my-route?date=YYYY-MM-DD        — dagens rute for innlogget bruker
 *   POST   /assignments                     — opprett rute (salgssjef+)
 *   PATCH  /assignments/:id                 — oppdater status/stops
 *   POST   /assignments/:id/visits          — log at bruker ankom en stopp
 *   GET    /team-nearby?lat=&lon=&radius_km — team-medlemmer innen radius
 *   GET    /adherence-report                — daglig rapport m/ aggregater
 *   GET    /adherence-report/team-summary   — teamsammendrag (salgssjef+)
 *   POST   /leads/at-position               — opprett lead på bestemt koord
 *   DELETE /positions/before?date=          — cleanup gamle positions (job)
 *
 * Forutsetter mig 0358 som lager:
 *   - leadgrid_user_positions
 *   - leadgrid_route_assignments
 *   - leadgrid_route_visits
 *
 * REGISTRERES i backend/server/index.ts ved siden av
 * `registerSalesLeadershipRoutes({...})`:
 *
 *   import { registerRoutesAdherenceRoutes } from "./routes-adherence-routes";
 *   registerRoutesAdherenceRoutes({ app, pool, requireUserSession });
 *
 * Auth: alle endepunkter krever session. `assignments POST/PATCH` +
 * `team-summary` krever salgssjef+ rolle. `adherence-report` uten
 * `user_id`-param defaulter til egen data; med `user_id`-param krever
 * salgssjef+ (matcher isAdminLikeRole i sales-leadership-routes.ts).
 */

import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  assertAnyEntitledForOrganization,
  LEADGRID_GO_FEATURE_KEYS,
} from "./leadgrid-entitlement-guard.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface RoutesAdherenceDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

// ─────────────────────────────────────────────────────────────────
// Konstanter — adherence thresholds
// ─────────────────────────────────────────────────────────────────

/** Deviation < 200m regnes som on-route (matcher iPad-klient-logikk). */
const ON_ROUTE_THRESHOLD_M = 200;

/** Max samples per batch — matcher iPad-klient-batching. */
const MAX_POSITIONS_PER_BATCH = 100;

/** Cleanup default — 90 dager position-history holdes. */
const DEFAULT_POSITION_RETENTION_DAYS = 90;

const VALID_ASSIGNMENT_STATUS = new Set([
  "planned",
  "active",
  "completed",
  "skipped",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RouteStop = {
  lead_id: string;
  latitude: number;
  longitude: number;
  order_index: number;
  planned_arrival_time: string | null;
  planned_duration_min: number | null;
  notes: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────


function isSalesManagerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return (
    r === "sales_manager" ||
    r === "org_admin" ||
    r === "super_admin" ||
    r === "admin" ||
    r === "owner" ||
    r === "salgssjef" ||
    r === "teamleder"
  );
}

function canManageRoutes(
  session: SessionUser,
  project: LeadgridAccessibleProject,
): boolean {
  return isSalesManagerRole(session.role) || isSalesManagerRole(project.memberRole);
}

function readString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function requestedProjectId(req: Request): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const supplied = [
    body.project_id,
    body.projectId,
    req.query.project_id,
    req.query.projectId,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(supplied)];
  return unique.length === 1 && unique[0].length <= 255 ? unique[0] : "";
}

function requestIdempotencyKey(req: Request): string {
  const raw = req.headers["idempotency-key"];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return value.length >= 8 && value.length <= 200 ? value : "";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

async function resolveProjectScope(
  req: Request,
  res: Response,
  pool: Pool,
  session: SessionUser,
): Promise<LeadgridAccessibleProject | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return null;
  }
  try {
    const project = await loadAccessibleLeadgridProject(
      pool,
      projectId,
      session.userId,
    );
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    const entitled = await assertAnyEntitledForOrganization(
      pool,
      project.organizationId,
      LEADGRID_GO_FEATURE_KEYS,
      res,
    );
    return entitled ? project : null;
  } catch (error) {
    console.error("[routes-adherence] project scope failed:", error);
    res.status(500).json({
      error: "project_scope_failed",
      detail: "internal_error",
    });
    return null;
  }
}

/**
 * Haversine-distanse mellom to koordinater (meter). Brukt til
 * team-nearby-filter + deviation-fallback.
 */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Beregn nærmeste avstand fra et punkt til et rute-linjestykke definert av
 * en sekvens av stopp-koordinater. Bruker segment-projection i (lat, lon)-
 * rommet med approksimert equirectangular-scaling — presist nok for
 * urban skala (< 1 km). Returnerer avstand i meter.
 */
function distanceToRoutePolyline(
  lat: number,
  lon: number,
  stops: Array<{ latitude: number; longitude: number }>,
): number {
  if (stops.length === 0) return Number.POSITIVE_INFINITY;
  if (stops.length === 1) {
    return haversineMeters(lat, lon, stops[0].latitude, stops[0].longitude);
  }
  let minDistM = Number.POSITIVE_INFINITY;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const metersPerDegLat = 111_320;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    // Project into local flat plane (meters).
    const ax = 0;
    const ay = 0;
    const bx = (b.longitude - a.longitude) * metersPerDegLat * cosLat;
    const by = (b.latitude - a.latitude) * metersPerDegLat;
    const px = (lon - a.longitude) * metersPerDegLat * cosLat;
    const py = (lat - a.latitude) * metersPerDegLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distM = Math.hypot(px - cx, py - cy);
    if (distM < minDistM) minDistM = distM;
  }
  return minDistM;
}

/**
 * Parse stops-JSONB til typed array. Filtrerer bort ugyldig-formede
 * entries (uten lat/lon).
 */
function parseStops(
  raw: unknown,
): RouteStop[] {
  if (!Array.isArray(raw)) return [];
  const out: RouteStop[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown> | undefined;
    if (!s || typeof s !== "object") continue;
    const lat = toNum(s.latitude);
    const lon = toNum(s.longitude);
    if (lat === null || lon === null) continue;
    out.push({
      lead_id: readString(s.lead_id, `stop_${i}`),
      latitude: lat,
      longitude: lon,
      order_index:
        typeof s.order_index === "number" ? s.order_index : i,
      planned_arrival_time:
        typeof s.planned_arrival_time === "string"
          ? s.planned_arrival_time
          : null,
      planned_duration_min:
        typeof s.planned_duration_min === "number"
          ? s.planned_duration_min
          : null,
      notes: typeof s.notes === "string" ? s.notes : null,
    });
  }
  return out.sort((a, b) => a.order_index - b.order_index);
}

function parseRequestedStops(raw: unknown): RouteStop[] | null {
  if (!Array.isArray(raw)) return null;
  for (const value of raw) {
    const candidate = value as Record<string, unknown> | undefined;
    const leadId = readString(candidate?.lead_id).trim();
    const lat = toNum(candidate?.latitude);
    const lon = toNum(candidate?.longitude);
    if (
      !leadId
      || leadId.length > 255
      || lat === null
      || lon === null
      || !isValidCoordinate(lat, lon)
    ) {
      return null;
    }
  }
  return parseStops(raw).map((stop) => ({
    ...stop,
    lead_id: stop.lead_id.trim(),
  }));
}

async function uuidStopsBelongToProject(
  pool: Pool,
  project: LeadgridAccessibleProject,
  stops: RouteStop[],
): Promise<boolean> {
  const ids = [...new Set(
    stops
      .map((stop) => stop.lead_id)
      .filter((id) => UUID_PATTERN.test(id))
      .map((id) => id.toLowerCase()),
  )];
  if (ids.length === 0) return true;
  const result = await pool.query<{ id: string }>(
    `SELECT id::text
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND id = ANY($3::uuid[])`,
    [project.organizationId, project.id, ids],
  );
  return new Set(
    result.rows.map((row) => row.id.toLowerCase()),
  ).size === ids.length;
}

// ─────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────
export function registerRoutesAdherenceRoutes(
  deps: RoutesAdherenceDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // ───────────────────────────────────────────────────────────────
  // POST /positions — batch-log posisjons-samples
  //
  // Body: { samples: [{ lat, lon, speed, heading, sampledAt }] }
  //
  // Idempotent på (user_id, sampled_at) — dedup-index sørger for at
  // re-tries ikke doblet-inserter (ON CONFLICT DO NOTHING).
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/routes/positions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const body = (req.body ?? {}) as { samples?: unknown };
    const samples = Array.isArray(body.samples) ? body.samples : [];
    if (samples.length === 0) {
      return res.json({ inserted: 0, project_id: project.id });
    }
    if (samples.length > MAX_POSITIONS_PER_BATCH) {
      return res.status(400).json({
        error: "batch_too_large",
        detail: `max ${MAX_POSITIONS_PER_BATCH} samples per batch`,
      });
    }
    try {
      const validSamples: Array<{
        latitude: number;
        longitude: number;
        speed_mps: number | null;
        heading_deg: number | null;
        sampled_at: string;
      }> = [];
      for (const raw of samples) {
        const sample = raw as Record<string, unknown>;
        const lat = toNum(sample.lat);
        const lon = toNum(sample.lon);
        const sampledAt = readString(sample.sampledAt);
        if (
          lat === null
          || lon === null
          || !isValidCoordinate(lat, lon)
          || !sampledAt
          || Number.isNaN(Date.parse(sampledAt))
        ) continue;
        validSamples.push({
          latitude: lat,
          longitude: lon,
          speed_mps: toNum(sample.speed),
          heading_deg: toNum(sample.heading),
          sampled_at: sampledAt,
        });
      }
      if (validSamples.length === 0) {
        return res.json({ inserted: 0, project_id: project.id });
      }
      // One set-based write keeps foreground GPS flushes cheap even at the
      // maximum batch size. The scoped unique key makes network retry safe.
      const result = await pool.query(
        `WITH samples AS (
           SELECT latitude, longitude, speed_mps, heading_deg, sampled_at
             FROM jsonb_to_recordset($4::jsonb) AS sample(
               latitude double precision,
               longitude double precision,
               speed_mps double precision,
               heading_deg double precision,
               sampled_at timestamptz
             )
         )
         INSERT INTO leadgrid_user_positions
           (organization_id, project_id, user_id, latitude, longitude,
            speed_mps, heading_deg, sampled_at, source)
         SELECT $1::uuid, $2, $3, latitude, longitude, speed_mps, heading_deg,
                sampled_at, 'ios'
           FROM samples
         ON CONFLICT (organization_id, project_id, user_id, sampled_at)
         DO NOTHING
         RETURNING id`,
        [
          project.organizationId,
          project.id,
          session.userId,
          JSON.stringify(validSamples),
        ],
      );
      return res.json({
        inserted: result.rowCount ?? result.rows.length,
        project_id: project.id,
      });
    } catch (error) {
      console.error("[routes-adherence] positions POST failed:", error);
      return res.status(500).json({
        error: "positions_save_failed",
        detail: "internal_error",
      });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET /my-route?date=YYYY-MM-DD — dagens rute for innlogget bruker
  //
  // Returnerer: { assignment, visits, progress, next_stop, eta_next_min }
  //   - assignment kan være null hvis ingen rute er tildelt i dag
  //   - progress: { completed, remaining, on_route_pct, avg_deviation_m }
  //   - next_stop: neste ubesøkte stopp (order_index)
  //   - eta_next_min: null hvis vi ikke har live position; ellers grov
  //                   distanse/hastighet-estimat
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/routes/my-route", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const date =
      readString(req.query.date) || new Date().toISOString().slice(0, 10);
    if (!isDateOnly(date)) {
      return res.status(400).json({ error: "invalid_date" });
    }
    try {
      const asnRes = await pool.query(
        `SELECT id, organization_id, project_id, user_id, route_date, name,
                stops, total_stops, status, created_at, updated_at
           FROM leadgrid_route_assignments
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND user_id = $3
            AND route_date = $4::date
          ORDER BY created_at DESC
          LIMIT 1`,
        [project.organizationId, project.id, session.userId, date],
      );
      const asn = asnRes.rows[0] as Record<string, unknown> | undefined;
      if (!asn) {
        return res.json({
          project_id: project.id,
          assignment: null,
          visits: [],
          progress: {
            completed: 0,
            remaining: 0,
            on_route_pct: 0,
            avg_deviation_m: 0,
          },
          next_stop: null,
          eta_next_min: null,
        });
      }
      const stops = parseStops(asn.stops);
      const visitsRes = await pool.query(
        `SELECT id, organization_id, project_id, assignment_id, stop_lead_id,
                arrived_at, left_at,
                actual_latitude, actual_longitude,
                deviation_from_planned_m, was_on_route, notes
           FROM leadgrid_route_visits
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND assignment_id = $3::uuid
          ORDER BY arrived_at ASC`,
        [project.organizationId, project.id, asn.id],
      );
      const visits = visitsRes.rows;
      const visitedLeadIds = new Set(
        visits.map((v) => String((v as Record<string, unknown>).stop_lead_id)),
      );

      const completed = visits.length;
      const remaining = Math.max(0, stops.length - completed);
      const onRouteCount = visits.filter(
        (v) => (v as Record<string, unknown>).was_on_route,
      ).length;
      const onRoutePct =
        visits.length > 0 ? Math.round((onRouteCount * 100) / visits.length) : 0;
      const totalDev = visits.reduce((sum, v) => {
        const d = (v as Record<string, unknown>).deviation_from_planned_m;
        return sum + (typeof d === "number" ? d : 0);
      }, 0);
      const avgDev = visits.length > 0 ? Math.round(totalDev / visits.length) : 0;

      const nextStop =
        stops.find((s) => !visitedLeadIds.has(s.lead_id)) ?? null;

      // Grovt ETA-estimat: distanse fra siste posisjon til neste stopp / hastighet.
      let etaNextMin: number | null = null;
      if (nextStop) {
        const posRes = await pool.query<{
          latitude: number;
          longitude: number;
          speed_mps: number | null;
        }>(
          `SELECT latitude, longitude, speed_mps
             FROM leadgrid_user_positions
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND user_id = $3
            ORDER BY sampled_at DESC
            LIMIT 1`,
          [project.organizationId, project.id, session.userId],
        );
        const pos = posRes.rows[0];
        if (pos) {
          const distM = haversineMeters(
            pos.latitude,
            pos.longitude,
            nextStop.latitude,
            nextStop.longitude,
          );
          // Speed-fallback: 30 km/t (~8.3 m/s) i by-kjøring hvis speed_mps
          // mangler eller er 0 (stille).
          const speed =
            pos.speed_mps && pos.speed_mps > 1.0 ? pos.speed_mps : 8.3;
          etaNextMin = Math.round(distM / speed / 60);
        }
      }

      return res.json({
        project_id: project.id,
        assignment: {
          id: asn.id,
          organization_id: asn.organization_id,
          project_id: asn.project_id,
          user_id: asn.user_id,
          route_date: asn.route_date,
          name: asn.name,
          stops,
          total_stops: asn.total_stops,
          status: asn.status,
          created_at: asn.created_at,
          updated_at: asn.updated_at,
        },
        visits,
        progress: {
          completed,
          remaining,
          on_route_pct: onRoutePct,
          avg_deviation_m: avgDev,
        },
        next_stop: nextStop,
        eta_next_min: etaNextMin,
      });
    } catch (err) {
      console.error("[routes-adherence] my-route GET failed:", err);
      return res
        .status(500)
        .json({ error: "my_route_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST /assignments — opprett rute (salgssjef+)
  //
  // Body: { user_id, route_date, name, stops }
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/routes/assignments", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    if (!canManageRoutes(session, project)) {
      return res.status(403).json({ error: "forbidden", detail: "sales_manager_required" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const userId = readString(body.user_id).trim();
    const routeDate = readString(body.route_date);
    const name = readString(body.name).trim() || "Rute";
    const stops = parseRequestedStops(body.stops);
    const idempotencyKey = requestIdempotencyKey(req);
    if (!userId || !isDateOnly(routeDate)) {
      return res.status(400).json({
        error: "user_id_and_valid_route_date_required",
      });
    }
    if (!stops) {
      return res.status(400).json({ error: "invalid_stops" });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ error: "idempotency_key_required" });
    }
    try {
      const assigneeProject = userId === session.userId
        ? project
        : await loadAccessibleLeadgridProject(pool, project.id, userId);
      if (
        !assigneeProject
        || assigneeProject.organizationId !== project.organizationId
      ) {
        return res.status(400).json({ error: "assignee_not_in_project" });
      }
      if (!(await uuidStopsBelongToProject(pool, project, stops))) {
        return res.status(400).json({
          error: "route_stop_lead_not_in_project",
        });
      }
      const requestHash = sha256(JSON.stringify({
        organizationId: project.organizationId,
        projectId: project.id,
        userId,
        routeDate,
        name,
        stops,
      }));
      const inserted = await pool.query(
        `INSERT INTO leadgrid_route_assignments
           (org_id, organization_id, project_id, user_id, route_date, name,
            stops, total_stops, status, created_by, idempotency_key,
            request_hash, created_at, updated_at)
         VALUES ($1::uuid, $1::uuid, $2, $3, $4::date, $5, $6::jsonb, $7,
                 'planned', $8, $9, $10, NOW(), NOW())
         ON CONFLICT (organization_id, project_id, idempotency_key)
           WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id, organization_id, project_id, user_id, route_date, name,
                   stops, total_stops, status, created_at, updated_at`,
        [
          project.organizationId,
          project.id,
          userId,
          routeDate,
          name,
          JSON.stringify(stops),
          stops.length,
          session.userId,
          idempotencyKey,
          requestHash,
        ],
      );
      let row = inserted.rows[0] as Record<string, unknown> | undefined;
      let responseStatus = 201;
      if (!row) {
        const existing = await pool.query(
          `SELECT id, organization_id, project_id, user_id, route_date, name,
                  stops, total_stops, status, created_at, updated_at,
                  request_hash
             FROM leadgrid_route_assignments
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [project.organizationId, project.id, idempotencyKey],
        );
        row = existing.rows[0] as Record<string, unknown> | undefined;
        if (!row || row.request_hash !== requestHash) {
          return res.status(409).json({ error: "idempotency_key_conflict" });
        }
        delete row.request_hash;
        responseStatus = 200;
      }
      return res.status(responseStatus).json({
        ...row,
        stops: parseStops(row.stops),
      });
    } catch (error) {
      console.error("[routes-adherence] assignments POST failed:", error);
      return res.status(500).json({
        error: "assignment_create_failed",
        detail: "internal_error",
      });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PATCH /assignments/:id — oppdater status/stops
  // ───────────────────────────────────────────────────────────────
  app.patch("/api/leadgrid/routes/assignments/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const id = readString(req.params.id);
    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({ error: "invalid_assignment_id" });
    }
    // Tillat oppdatering av egen rute (status: active/completed/skipped),
    // eller salgssjef+ for full redigering.
    const isManager = canManageRoutes(session, project);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = readString(body.status);
    const name = readString(body.name);
    const stopsRaw = body.stops;

    if (status && !VALID_ASSIGNMENT_STATUS.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    try {
      const existing = await pool.query<{ user_id: string }>(
        `SELECT user_id
           FROM leadgrid_route_assignments
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
          LIMIT 1`,
        [project.organizationId, project.id, id],
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "assignment_not_found" });
      }
      const owner = existing.rows[0].user_id;
      if (owner !== session.userId && !isManager) {
        return res.status(403).json({ error: "forbidden" });
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (status) {
        sets.push(`status = $${i++}`);
        vals.push(status);
      }
      if (name && isManager) {
        sets.push(`name = $${i++}`);
        vals.push(name);
      }
      if (stopsRaw !== undefined && isManager) {
        const stops = parseRequestedStops(stopsRaw);
        if (!stops) {
          return res.status(400).json({ error: "invalid_stops" });
        }
        if (!(await uuidStopsBelongToProject(pool, project, stops))) {
          return res.status(400).json({
            error: "route_stop_lead_not_in_project",
          });
        }
        sets.push(`stops = $${i++}::jsonb`);
        vals.push(JSON.stringify(stops));
        sets.push(`total_stops = $${i++}`);
        vals.push(stops.length);
      }
      if (sets.length === 0) {
        return res.status(400).json({ error: "no_fields_to_update" });
      }
      sets.push(`updated_at = NOW()`);
      const orgIndex = i++;
      vals.push(project.organizationId);
      const projectIndex = i++;
      vals.push(project.id);
      const idIndex = i;
      vals.push(id);
      const r = await pool.query(
        `UPDATE leadgrid_route_assignments SET ${sets.join(", ")}
          WHERE organization_id = $${orgIndex}::uuid
            AND project_id = $${projectIndex}
            AND id = $${idIndex}::uuid
          RETURNING id, organization_id, project_id, user_id, route_date,
                    name, stops, total_stops, status, created_at, updated_at`,
        vals,
      );
      const row = r.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return res.status(404).json({ error: "assignment_not_found" });
      }
      return res.json({
        ...row,
        stops: parseStops(row.stops),
      });
    } catch (error) {
      console.error("[routes-adherence] assignments PATCH failed:", error);
      return res.status(500).json({
        error: "assignment_update_failed",
        detail: "internal_error",
      });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST /assignments/:id/visits — log at bruker ankom en stopp
  //
  // Backend beregner deviation_from_planned_m (via Haversine mot rute-
  // polylinjen) og setter was_on_route (< ON_ROUTE_THRESHOLD_M).
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/routes/assignments/:id/visits", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const id = readString(req.params.id);
    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({ error: "invalid_assignment_id" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const stopLeadId = readString(body.stop_lead_id).trim();
    const actualLat = toNum(body.actual_lat);
    const actualLon = toNum(body.actual_lon);
    const notes = readString(body.notes).trim() || null;
    const idempotencyKey = requestIdempotencyKey(req);
    if (
      !stopLeadId
      || actualLat === null
      || actualLon === null
      || !isValidCoordinate(actualLat, actualLon)
    ) {
      return res
        .status(400)
        .json({ error: "stop_lead_id_and_actual_lat_lon_required" });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ error: "idempotency_key_required" });
    }
    try {
      // Hent rute-stopp for deviation-beregning.
      const asnRes = await pool.query<{ user_id: string; stops: unknown }>(
        `SELECT user_id, stops
           FROM leadgrid_route_assignments
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
          LIMIT 1`,
        [project.organizationId, project.id, id],
      );
      if (asnRes.rows.length === 0) {
        return res.status(404).json({ error: "assignment_not_found" });
      }
      const asn = asnRes.rows[0];
      if (asn.user_id !== session.userId && !canManageRoutes(session, project)) {
        return res.status(403).json({ error: "forbidden" });
      }
      const stops = parseStops(asn.stops);
      const stop = stops.find((candidate) => candidate.lead_id === stopLeadId);
      if (!stop) {
        return res.status(400).json({ error: "stop_not_in_assignment" });
      }
      if (!(await uuidStopsBelongToProject(pool, project, [stop]))) {
        return res.status(400).json({
          error: "route_stop_lead_not_in_project",
        });
      }
      const deviation = Math.round(
        distanceToRoutePolyline(actualLat, actualLon, stops),
      );
      const wasOnRoute = deviation < ON_ROUTE_THRESHOLD_M;
      const requestHash = sha256(JSON.stringify({
        organizationId: project.organizationId,
        projectId: project.id,
        assignmentId: id,
        stopLeadId,
        actualLat,
        actualLon,
        notes,
      }));
      const inserted = await pool.query(
        `INSERT INTO leadgrid_route_visits
           (organization_id, project_id, assignment_id, stop_lead_id,
            arrived_at, actual_latitude, actual_longitude,
            deviation_from_planned_m, was_on_route, notes,
            idempotency_key, request_hash)
         VALUES ($1::uuid, $2, $3::uuid, $4, NOW(), $5, $6, $7, $8, $9,
                 $10, $11)
         ON CONFLICT (organization_id, project_id, idempotency_key)
           WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id, organization_id, project_id, assignment_id,
                   stop_lead_id, arrived_at, left_at,
                   actual_latitude, actual_longitude, deviation_from_planned_m,
                   was_on_route, notes`,
        [
          project.organizationId,
          project.id,
          id,
          stopLeadId,
          actualLat,
          actualLon,
          deviation,
          wasOnRoute,
          notes,
          idempotencyKey,
          requestHash,
        ],
      );
      let row = inserted.rows[0] as Record<string, unknown> | undefined;
      let responseStatus = 201;
      if (!row) {
        const replay = await pool.query(
          `SELECT id, organization_id, project_id, assignment_id,
                  stop_lead_id, arrived_at, left_at, actual_latitude,
                  actual_longitude, deviation_from_planned_m, was_on_route,
                  notes, request_hash
             FROM leadgrid_route_visits
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND idempotency_key = $3
            LIMIT 1`,
          [project.organizationId, project.id, idempotencyKey],
        );
        row = replay.rows[0] as Record<string, unknown> | undefined;
        if (!row || row.request_hash !== requestHash) {
          return res.status(409).json({ error: "idempotency_key_conflict" });
        }
        delete row.request_hash;
        responseStatus = 200;
      }
      return res.status(responseStatus).json(row);
    } catch (error) {
      console.error("[routes-adherence] visits POST failed:", error);
      return res.status(500).json({
        error: "visit_log_failed",
        detail: "internal_error",
      });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET /team-nearby?lat=&lon=&radius_km=5
  //
  // Team-medlemmer m/ siste kjent posisjon innen radius. Bruker Haversine
  // etter grov bbox-prefilter (fort nok for < 100 medlemmer). Kun for
  // salgssjef+ eller for medlemmer i samme org.
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/routes/team-nearby", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const lat = toNum(req.query.lat);
    const lon = toNum(req.query.lon);
    const radiusKm = toNum(req.query.radius_km) ?? 5;
    if (lat === null || lon === null || !isValidCoordinate(lat, lon)) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }
    if (radiusKm <= 0 || radiusKm > 50) {
      return res.status(400).json({ error: "invalid_radius" });
    }
    try {
      // Resolve the full authorized project audience in one query. This avoids
      // one ACL round trip per position while preserving explicit revokes.
      const audience = await pool.query<{ user_id: string }>(
        `SELECT DISTINCT candidate.user_id
           FROM (
             SELECT p.created_by AS user_id
               FROM leadgrid_projects p
              WHERE p.id = $2 AND p.organization_id = $1::uuid
             UNION ALL
             SELECT pm.user_id
               FROM leadgrid_project_members pm
              WHERE pm.organization_id = $1::uuid AND pm.project_id = $2
             UNION ALL
             SELECT om.user_id
               FROM organization_members om
              WHERE om.organization_id = $1::uuid
                AND NOT EXISTS (
                  SELECT 1
                    FROM leadgrid_user_permission_overrides denied
                   WHERE denied.organization_id = om.organization_id
                     AND denied.user_id = om.user_id
                     AND denied.permission_key = 'projects.view_all'
                     AND denied.effect = 'revoke'
                )
                AND (
                  om.role = 'admin'
                  OR EXISTS (
                    SELECT 1 FROM role_permissions defaults
                     WHERE defaults.role = om.role
                       AND defaults.permission_key = 'projects.view_all'
                  )
                  OR EXISTS (
                    SELECT 1
                      FROM leadgrid_user_permission_overrides granted
                     WHERE granted.organization_id = om.organization_id
                       AND granted.user_id = om.user_id
                       AND granted.permission_key = 'projects.view_all'
                       AND granted.effect = 'grant'
                  )
                )
           ) candidate
          WHERE candidate.user_id IS NOT NULL`,
        [project.organizationId, project.id],
      );
      const userIds = audience.rows.map((row) => String(row.user_id));
      if (!userIds.includes(session.userId)) userIds.push(session.userId);
      if (userIds.length === 0) {
        return res.json({ project_id: project.id, members: [] });
      }

      // For hver bruker: siste kjente posisjon i dette prosjektet. Missing
      // schema fails visibly; silently returning an empty team hides drift.
      const posRes = await pool.query<{
          user_id: string;
          latitude: number;
          longitude: number;
          sampled_at: string;
          speed_mps: number | null;
        }>(
        `SELECT DISTINCT ON (user_id)
                user_id, latitude, longitude, sampled_at, speed_mps
           FROM leadgrid_user_positions
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND user_id = ANY($3::varchar[])
          ORDER BY user_id, sampled_at DESC`,
        [project.organizationId, project.id, userIds],
      );

      const usersRes = await pool.query<{
        id: string;
        name: string | null;
        email: string;
        role: string | null;
      }>(
        `SELECT u.id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS name,
                u.email,
                u.role
           FROM users u
          WHERE u.id = ANY($1::varchar[])`,
        [userIds],
      );
      const userByIdMap = new Map<
        string,
        { name: string | null; email: string; role: string | null }
      >();
      for (const u of usersRes.rows) {
        userByIdMap.set(u.id, {
          name: u.name,
          email: u.email,
          role: u.role,
        });
      }

      const radiusM = radiusKm * 1000;
      const members = posRes.rows
        .map((p) => {
          const distM = haversineMeters(lat, lon, p.latitude, p.longitude);
          if (distM > radiusM) return null;
          const u = userByIdMap.get(p.user_id);
          const speed = p.speed_mps ?? 0;
          const status = speed > 1.0 ? "moving" : "idle";
          return {
            user_id: p.user_id,
            name: u?.name ?? p.user_id,
            email: u?.email ?? null,
            role: u?.role ?? "Selger",
            latitude: p.latitude,
            longitude: p.longitude,
            distance_m: Math.round(distM),
            last_seen_at: p.sampled_at,
            status,
            speed_mps: speed,
          };
        })
        .filter(
          (m): m is NonNullable<typeof m> =>
            m !== null && m.user_id !== session.userId,
        )
        .sort((a, b) => a.distance_m - b.distance_m);

      return res.json({ project_id: project.id, members });
    } catch (err) {
      console.error("[routes-adherence] team-nearby GET failed:", err);
      return res
        .status(500)
        .json({ error: "team_nearby_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET /adherence-report?user_id=&from=&to=
  //
  // Daglig rapport m/ aggregater. Vanlig bruker ser bare egen data;
  // salgssjef+ kan sette user_id-param for hvilken som helst medlem.
  // Returnerer array av daglige rader.
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/routes/adherence-report", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    const requestedUserId = readString(req.query.user_id);
    const isManager = canManageRoutes(session, project);
    const userId =
      requestedUserId && requestedUserId !== session.userId
        ? isManager
          ? requestedUserId
          : null
        : session.userId;
    if (!userId) {
      return res.status(403).json({ error: "forbidden" });
    }
    const from =
      readString(req.query.from) ||
      new Date(Date.now() - 30 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
    const to = readString(req.query.to) || new Date().toISOString().slice(0, 10);
    if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
    try {
      if (userId !== session.userId) {
        const targetAccess = await loadAccessibleLeadgridProject(
          pool,
          project.id,
          userId,
        );
        if (!targetAccess || targetAccess.organizationId !== project.organizationId) {
          return res.status(404).json({ error: "project_member_not_found" });
        }
      }
      const r = await pool.query(
        `SELECT a.route_date,
                a.id AS assignment_id,
                a.name,
                a.total_stops,
                COUNT(v.id)::int AS completed_stops,
                COALESCE(AVG(v.deviation_from_planned_m), 0)::int AS avg_deviation_m,
                CASE WHEN COUNT(v.id) > 0
                  THEN ROUND(
                    (COUNT(v.id) FILTER (WHERE v.was_on_route)::numeric
                     * 100 / COUNT(v.id)::numeric)
                  )::int
                  ELSE 0 END AS on_route_pct,
                COALESCE(
                  AVG(EXTRACT(EPOCH FROM (v.left_at - v.arrived_at)) / 60), 0
                )::int AS avg_time_at_stop_min
           FROM leadgrid_route_assignments a
           LEFT JOIN leadgrid_route_visits v
             ON v.organization_id = a.organization_id
            AND v.project_id = a.project_id
            AND v.assignment_id = a.id
          WHERE a.organization_id = $1::uuid
            AND a.project_id = $2
            AND a.user_id = $3
            AND a.route_date BETWEEN $4::date AND $5::date
          GROUP BY a.id, a.route_date, a.name, a.total_stops
          ORDER BY a.route_date DESC`,
        [project.organizationId, project.id, userId, from, to],
      );
      // Overall aggregates over hele perioden.
      let totalOnRoutePct = 0;
      let totalAvgDev = 0;
      let totalCompleted = 0;
      let totalStops = 0;
      for (const row of r.rows) {
        totalOnRoutePct += Number(row.on_route_pct ?? 0);
        totalAvgDev += Number(row.avg_deviation_m ?? 0);
        totalCompleted += Number(row.completed_stops ?? 0);
        totalStops += Number(row.total_stops ?? 0);
      }
      const days = r.rows.length || 1;
      return res.json({
        project_id: project.id,
        user_id: userId,
        from,
        to,
        days: r.rows.length,
        summary: {
          avg_on_route_pct: Math.round(totalOnRoutePct / days),
          avg_deviation_m: Math.round(totalAvgDev / days),
          completed_stops_pct: totalStops > 0
            ? Math.round((totalCompleted * 100) / totalStops)
            : 0,
        },
        daily: r.rows,
      });
    } catch (err) {
      console.error("[routes-adherence] adherence-report GET failed:", err);
      return res
        .status(500)
        .json({ error: "adherence_report_failed", detail: String("internal_error") });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // GET /adherence-report/team-summary?date=
  //
  // Salgssjef+ ser rangert liste av teamet sortert etter compliance
  // (best → verst). Brukes av RouteAdherenceDashboardView.
  // ───────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/routes/adherence-report/team-summary", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    if (!canManageRoutes(session, project)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const date = readString(req.query.date) || new Date().toISOString().slice(0, 10);
    if (!isDateOnly(date)) {
      return res.status(400).json({ error: "invalid_date" });
    }
    try {
      const r = await pool.query(
        `SELECT a.user_id,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS name,
                u.email,
                u.role,
                COUNT(DISTINCT a.id)::int AS assignments,
                SUM(a.total_stops)::int AS total_stops,
                COUNT(v.id)::int AS completed_stops,
                COALESCE(AVG(v.deviation_from_planned_m), 0)::int AS avg_deviation_m,
                CASE WHEN COUNT(v.id) > 0
                  THEN ROUND(
                    (COUNT(v.id) FILTER (WHERE v.was_on_route)::numeric
                     * 100 / COUNT(v.id)::numeric)
                  )::int
                  ELSE 0 END AS on_route_pct
           FROM leadgrid_route_assignments a
           LEFT JOIN leadgrid_route_visits v
             ON v.organization_id = a.organization_id
            AND v.project_id = a.project_id
            AND v.assignment_id = a.id
           LEFT JOIN users u ON u.id = a.user_id
          WHERE a.organization_id = $1::uuid
            AND a.project_id = $2
            AND a.route_date = $3::date
          GROUP BY a.user_id, u.first_name, u.last_name, u.email, u.role
          ORDER BY on_route_pct DESC, avg_deviation_m ASC`,
        [project.organizationId, project.id, date],
      );
      // Aggregate summary
      let totalOn = 0;
      let totalDev = 0;
      let totalCompleted = 0;
      let totalStops = 0;
      for (const row of r.rows) {
        totalOn += Number(row.on_route_pct ?? 0);
        totalDev += Number(row.avg_deviation_m ?? 0);
        totalCompleted += Number(row.completed_stops ?? 0);
        totalStops += Number(row.total_stops ?? 0);
      }
      const n = r.rows.length || 1;
      return res.json({
        project_id: project.id,
        date,
        members: r.rows,
        summary: {
          member_count: r.rows.length,
          avg_on_route_pct: Math.round(totalOn / n),
          avg_deviation_m: Math.round(totalDev / n),
          completed_stops_pct:
            totalStops > 0 ? Math.round((totalCompleted * 100) / totalStops) : 0,
        },
      });
    } catch (err) {
      console.error("[routes-adherence] team-summary GET failed:", err);
      return res
        .status(500)
        .json({ error: "team_summary_failed", detail: String("internal_error") });
    }
  });

  // Legacy Nearby-Places lead creation bypassed project isolation and
  // Discovery V2 attestation. Keep it authenticated, but fail closed.
  app.post("/api/leadgrid/routes/leads/at-position", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    return res.status(410).json({
      error: "legacy_position_lead_creation_retired",
      message:
        "Opprett lead fra kartet eller godkjenn en kandidat i prosjektbundet Discovery V2.",
      replacement: "/api/leadgrid/projects/:projectId/discovery/profiles",
    });
  });

  // ───────────────────────────────────────────────────────────────
  // DELETE /positions/before?date= — cleanup gamle positions (job)
  //
  // Kun salgssjef+ eller super_admin. Default retention: 90 dager.
  // ───────────────────────────────────────────────────────────────
  app.delete("/api/leadgrid/routes/positions/before", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await resolveProjectScope(req, res, pool, session);
    if (!project) return;
    if (!canManageRoutes(session, project)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const date =
      readString(req.query.date) ||
      new Date(Date.now() - DEFAULT_POSITION_RETENTION_DAYS * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
    if (!isDateOnly(date)) {
      return res.status(400).json({ error: "invalid_date" });
    }
    try {
      const r = await pool.query(
        `DELETE FROM leadgrid_user_positions
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND sampled_at < $3::date
          RETURNING id`,
        [project.organizationId, project.id, date],
      );
      return res.json({
        project_id: project.id,
        deleted: r.rowCount ?? 0,
        before: date,
      });
    } catch (err) {
      console.error("[routes-adherence] positions DELETE failed:", err);
      return res
        .status(500)
        .json({ error: "positions_cleanup_failed", detail: String("internal_error") });
    }
  });
}
