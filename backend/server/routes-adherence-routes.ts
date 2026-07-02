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

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

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

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Returnerer organization_id for innlogget bruker. Faller til userId hvis
 * brukeren ikke er medlem av en enterprise-org (matcher solo-owner-mønster
 * i sales-leadership-routes.ts).
 */
async function resolveOrgIdForUser(
  pool: Pool,
  userId: string,
): Promise<string> {
  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id
         FROM enterprise_team_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at DESC NULLS LAST
        LIMIT 1`,
      [userId],
    );
    const orgId = r.rows[0]?.organization_id;
    if (orgId) return String(orgId);
  } catch {
    // Tabell mangler eller spørring feilet — fall til userId-modell.
  }
  return userId;
}

function isSalesManagerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return (
    r === "sales_manager" ||
    r === "org_admin" ||
    r === "super_admin" ||
    r === "admin" ||
    r === "owner"
  );
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
): Array<{
  lead_id: string;
  latitude: number;
  longitude: number;
  order_index: number;
  planned_arrival_time: string | null;
  planned_duration_min: number | null;
  notes: string | null;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    lead_id: string;
    latitude: number;
    longitude: number;
    order_index: number;
    planned_arrival_time: string | null;
    planned_duration_min: number | null;
    notes: string | null;
  }> = [];
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

/**
 * Reverse-geocode via Google Places (best-effort). Faller til
 * lat/lon-basert placeholder-navn hvis Places-key mangler eller
 * spørring feiler. Returnerer et rimelig lead-navn + adresse.
 */
async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ name: string; address: string | null; place_id: string | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return {
      name: `Nytt lead (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      address: null,
      place_id: null,
    };
  }
  try {
    // Google Places Nearby Search API — plukker nærmeste "establishment".
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lon}&rankby=distance` +
      `&type=establishment&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Places API status ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{ name?: string; vicinity?: string; place_id?: string }>;
    };
    const first = data.results?.[0];
    if (first?.name) {
      return {
        name: first.name,
        address: first.vicinity ?? null,
        place_id: first.place_id ?? null,
      };
    }
  } catch (err) {
    console.warn("[routes-adherence] reverse-geocode failed:", (err as Error).message);
  }
  return {
    name: `Nytt lead (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    address: null,
    place_id: null,
  };
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
    const body = (req.body ?? {}) as { samples?: unknown };
    const samples = Array.isArray(body.samples) ? body.samples : [];
    if (samples.length === 0) return res.json({ inserted: 0 });
    if (samples.length > MAX_POSITIONS_PER_BATCH) {
      return res.status(400).json({
        error: "batch_too_large",
        detail: `max ${MAX_POSITIONS_PER_BATCH} samples per batch`,
      });
    }
    try {
      let inserted = 0;
      for (const raw of samples) {
        const s = raw as Record<string, unknown>;
        const lat = toNum(s.lat);
        const lon = toNum(s.lon);
        const sampledAt = readString(s.sampledAt);
        if (lat === null || lon === null || !sampledAt) continue;
        const speed = toNum(s.speed);
        const heading = toNum(s.heading);
        try {
          const r = await pool.query(
            `INSERT INTO leadgrid_user_positions
               (user_id, latitude, longitude, speed_mps, heading_deg, sampled_at, source)
             VALUES ($1, $2, $3, $4, $5, $6, 'ios')
             ON CONFLICT (user_id, sampled_at) DO NOTHING
             RETURNING id`,
            [session.userId, lat, lon, speed, heading, sampledAt],
          );
          if (r.rowCount && r.rowCount > 0) inserted += 1;
        } catch (err) {
          // Ikke abort hele batch på én dårlig row.
          console.warn(
            "[routes-adherence] position insert failed:",
            (err as Error).message,
          );
        }
      }
      return res.json({ inserted });
    } catch (err) {
      console.error("[routes-adherence] positions POST failed:", err);
      return res
        .status(500)
        .json({ error: "positions_save_failed", detail: String((err as Error).message) });
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
    const date =
      readString(req.query.date) || new Date().toISOString().slice(0, 10);
    try {
      const asnRes = await pool.query(
        `SELECT id, org_id, user_id, route_date, name, stops, total_stops, status,
                created_at, updated_at
           FROM leadgrid_route_assignments
          WHERE user_id = $1 AND route_date = $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [session.userId, date],
      );
      const asn = asnRes.rows[0] as Record<string, unknown> | undefined;
      if (!asn) {
        return res.json({
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
        `SELECT id, stop_lead_id, arrived_at, left_at,
                actual_latitude, actual_longitude,
                deviation_from_planned_m, was_on_route, notes
           FROM leadgrid_route_visits
          WHERE assignment_id = $1
          ORDER BY arrived_at ASC`,
        [asn.id],
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
            WHERE user_id = $1
            ORDER BY sampled_at DESC
            LIMIT 1`,
          [session.userId],
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
        assignment: {
          id: asn.id,
          org_id: asn.org_id,
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
        .json({ error: "my_route_failed", detail: String((err as Error).message) });
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
    if (!isSalesManagerRole(session.role)) {
      return res.status(403).json({ error: "forbidden", detail: "sales_manager_required" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const userId = readString(body.user_id);
    const routeDate = readString(body.route_date);
    const name = readString(body.name) || "Rute";
    const stops = parseStops(body.stops);
    if (!userId || !routeDate) {
      return res.status(400).json({ error: "user_id_and_route_date_required" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      const r = await pool.query(
        `INSERT INTO leadgrid_route_assignments
           (org_id, user_id, route_date, name, stops, total_stops, status,
            created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'planned', $7, NOW(), NOW())
         RETURNING id, org_id, user_id, route_date, name, stops, total_stops,
                   status, created_at, updated_at`,
        [orgId, userId, routeDate, name, JSON.stringify(stops), stops.length, session.userId],
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.status(201).json({
        ...row,
        stops: parseStops(row.stops),
      });
    } catch (err) {
      console.error("[routes-adherence] assignments POST failed:", err);
      return res
        .status(500)
        .json({ error: "assignment_create_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // PATCH /assignments/:id — oppdater status/stops
  // ───────────────────────────────────────────────────────────────
  app.patch("/api/leadgrid/routes/assignments/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = readString(req.params.id);
    if (!id) return res.status(400).json({ error: "id_required" });
    // Tillat oppdatering av egen rute (status: active/completed/skipped),
    // eller salgssjef+ for full redigering.
    const isManager = isSalesManagerRole(session.role);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = readString(body.status);
    const name = readString(body.name);
    const stopsRaw = body.stops;

    if (status && !VALID_ASSIGNMENT_STATUS.has(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    try {
      const existing = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM leadgrid_route_assignments WHERE id = $1 LIMIT 1`,
        [id],
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
      if (Array.isArray(stopsRaw) && isManager) {
        const stops = parseStops(stopsRaw);
        sets.push(`stops = $${i++}::jsonb`);
        vals.push(JSON.stringify(stops));
        sets.push(`total_stops = $${i++}`);
        vals.push(stops.length);
      }
      if (sets.length === 0) {
        return res.status(400).json({ error: "no_fields_to_update" });
      }
      sets.push(`updated_at = NOW()`);
      vals.push(id);
      const r = await pool.query(
        `UPDATE leadgrid_route_assignments SET ${sets.join(", ")}
          WHERE id = $${i}
          RETURNING id, org_id, user_id, route_date, name, stops, total_stops,
                    status, created_at, updated_at`,
        vals,
      );
      const row = r.rows[0] as Record<string, unknown>;
      return res.json({
        ...row,
        stops: parseStops(row.stops),
      });
    } catch (err) {
      console.error("[routes-adherence] assignments PATCH failed:", err);
      return res
        .status(500)
        .json({ error: "assignment_update_failed", detail: String((err as Error).message) });
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
    const id = readString(req.params.id);
    if (!id) return res.status(400).json({ error: "id_required" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const stopLeadId = readString(body.stop_lead_id);
    const actualLat = toNum(body.actual_lat);
    const actualLon = toNum(body.actual_lon);
    const notes = readString(body.notes) || null;
    if (!stopLeadId || actualLat === null || actualLon === null) {
      return res
        .status(400)
        .json({ error: "stop_lead_id_and_actual_lat_lon_required" });
    }
    try {
      // Hent rute-stopp for deviation-beregning.
      const asnRes = await pool.query<{ user_id: string; stops: unknown }>(
        `SELECT user_id, stops FROM leadgrid_route_assignments WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (asnRes.rows.length === 0) {
        return res.status(404).json({ error: "assignment_not_found" });
      }
      const asn = asnRes.rows[0];
      if (asn.user_id !== session.userId && !isSalesManagerRole(session.role)) {
        return res.status(403).json({ error: "forbidden" });
      }
      const stops = parseStops(asn.stops);
      const deviation = Math.round(
        distanceToRoutePolyline(actualLat, actualLon, stops),
      );
      const wasOnRoute = deviation < ON_ROUTE_THRESHOLD_M;

      const r = await pool.query(
        `INSERT INTO leadgrid_route_visits
           (assignment_id, stop_lead_id, arrived_at, actual_latitude,
            actual_longitude, deviation_from_planned_m, was_on_route, notes)
         VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
         RETURNING id, assignment_id, stop_lead_id, arrived_at, left_at,
                   actual_latitude, actual_longitude, deviation_from_planned_m,
                   was_on_route, notes`,
        [id, stopLeadId, actualLat, actualLon, deviation, wasOnRoute, notes],
      );
      return res.status(201).json(r.rows[0]);
    } catch (err) {
      console.error("[routes-adherence] visits POST failed:", err);
      return res
        .status(500)
        .json({ error: "visit_log_failed", detail: String((err as Error).message) });
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
    const lat = toNum(req.query.lat);
    const lon = toNum(req.query.lon);
    const radiusKm = toNum(req.query.radius_km) ?? 5;
    if (lat === null || lon === null) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    try {
      // Hent team-medlemmer i org-en.
      let userIds: string[] = [];
      if (orgId !== session.userId) {
        const t = await pool.query<{ user_id: string }>(
          `SELECT DISTINCT user_id
             FROM enterprise_team_members
            WHERE organization_id = $1
              AND status = 'active'
              AND user_id IS NOT NULL`,
          [orgId],
        ).catch(() => ({ rows: [] as Array<{ user_id: string }> }));
        userIds = t.rows.map((r) => String(r.user_id));
      }
      if (!userIds.includes(session.userId)) userIds.push(session.userId);
      if (userIds.length === 0) return res.json({ members: [] });

      // For hver bruker: siste kjent posisjon + navn/rolle. Kun de innenfor radius.
      const posRes = await pool.query<{
        user_id: string;
        latitude: number;
        longitude: number;
        sampled_at: string;
        speed_mps: number | null;
      }>(
        `SELECT DISTINCT ON (user_id) user_id, latitude, longitude, sampled_at, speed_mps
           FROM leadgrid_user_positions
          WHERE user_id = ANY($1::varchar[])
          ORDER BY user_id, sampled_at DESC`,
        [userIds],
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

      return res.json({ members });
    } catch (err) {
      console.error("[routes-adherence] team-nearby GET failed:", err);
      return res
        .status(500)
        .json({ error: "team_nearby_failed", detail: String((err as Error).message) });
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
    const requestedUserId = readString(req.query.user_id);
    const isManager = isSalesManagerRole(session.role);
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
    try {
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
           LEFT JOIN leadgrid_route_visits v ON v.assignment_id = a.id
          WHERE a.user_id = $1
            AND a.route_date BETWEEN $2 AND $3
          GROUP BY a.id, a.route_date, a.name, a.total_stops
          ORDER BY a.route_date DESC`,
        [userId, from, to],
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
        .json({ error: "adherence_report_failed", detail: String((err as Error).message) });
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
    if (!isSalesManagerRole(session.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const date = readString(req.query.date) || new Date().toISOString().slice(0, 10);
    const orgId = await resolveOrgIdForUser(pool, session.userId);
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
           LEFT JOIN leadgrid_route_visits v ON v.assignment_id = a.id
           LEFT JOIN users u ON u.id = a.user_id
          WHERE a.org_id = $1
            AND a.route_date = $2
          GROUP BY a.user_id, u.first_name, u.last_name, u.email, u.role
          ORDER BY on_route_pct DESC, avg_deviation_m ASC`,
        [orgId, date],
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
        .json({ error: "team_summary_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // POST /leads/at-position — opprett lead på bestemt koordinat
  //
  // Body: { lat, lon, org_id? }
  // Reverse-geocoder via Google Places + returnerer nytt lead-id.
  // Klienten redirecter til AddLeadSheet med lead-id prefilled.
  // ───────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/routes/leads/at-position", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const lat = toNum(body.lat);
    const lon = toNum(body.lon);
    if (lat === null || lon === null) {
      return res.status(400).json({ error: "lat_and_lon_required" });
    }
    const orgId = readString(body.org_id) || (await resolveOrgIdForUser(pool, session.userId));
    try {
      const geo = await reverseGeocode(lat, lon);
      // Insert i crm_customers — samme mønster som eksisterende lead-oppretting.
      // Vi bruker minimalt sett med kolonner som er trygt å inserte fra map-flyten.
      // Fix 2026-07-02: Postgres feilet med `inconsistent types deduced for
      // parameter $2` fordi samme parameter ble brukt til både owner_user_id
      // (TEXT) og assigned_user_id (VARCHAR(255)). To forskjellige kolonne-
      // typer + samme placeholder = ingen entydig type-inferens.
      // Fix: separate parametere + eksplisitt cast per kolonne.
      const r = await pool.query<{ id: string }>(
        `INSERT INTO crm_customers
           (name, owner_user_id, assigned_user_id, latitude, longitude,
            address, google_place_id, lead_source, pipeline_stage, created_at, updated_at)
         VALUES ($1, $2::text, $3::varchar, $4, $5, $6, $7, 'map_drop', 'new', NOW(), NOW())
         RETURNING id`,
        [geo.name, session.userId, session.userId, lat, lon, geo.address, geo.place_id],
      );
      const leadId = r.rows[0]?.id;
      return res.status(201).json({
        lead_id: leadId,
        name: geo.name,
        address: geo.address,
        google_place_id: geo.place_id,
        latitude: lat,
        longitude: lon,
        org_id: orgId,
      });
    } catch (err) {
      console.error("[routes-adherence] leads/at-position failed:", err);
      return res
        .status(500)
        .json({ error: "lead_create_failed", detail: String((err as Error).message) });
    }
  });

  // ───────────────────────────────────────────────────────────────
  // DELETE /positions/before?date= — cleanup gamle positions (job)
  //
  // Kun salgssjef+ eller super_admin. Default retention: 90 dager.
  // ───────────────────────────────────────────────────────────────
  app.delete("/api/leadgrid/routes/positions/before", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isSalesManagerRole(session.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const date =
      readString(req.query.date) ||
      new Date(Date.now() - DEFAULT_POSITION_RETENTION_DAYS * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
    try {
      const r = await pool.query(
        `DELETE FROM leadgrid_user_positions
          WHERE sampled_at < $1
          RETURNING id`,
        [date],
      );
      return res.json({ deleted: r.rowCount ?? 0, before: date });
    } catch (err) {
      console.error("[routes-adherence] positions DELETE failed:", err);
      return res
        .status(500)
        .json({ error: "positions_cleanup_failed", detail: String((err as Error).message) });
    }
  });
}
