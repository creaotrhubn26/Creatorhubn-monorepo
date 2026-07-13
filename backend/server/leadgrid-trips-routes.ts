/**
 * leadgrid-trips-routes.ts
 *
 * Leadgrid Go — elektronisk kjørebok (backend-persistens + eksport).
 * Auto-loggede kjøreturer synkes fra iPad; føreren attesterer formål.
 *
 *   GET    /api/leadgrid/trips?from=&to=      — listе callerens turer
 *   POST   /api/leadgrid/trips                — upsert én tur (id fra klient)
 *   POST   /api/leadgrid/trips/sync           — bulk-upsert (batch fra iPad)
 *   PATCH  /api/leadgrid/trips/:id            — oppdater formål/notat
 *   DELETE /api/leadgrid/trips/:id            — slett
 *   GET    /api/leadgrid/trips/export.csv?from=&to=  — Skatteetaten-CSV
 *
 * 🔒 IDOR: HVER spørring filtrerer `WHERE user_id = <caller-session>`. Kjøreboka
 * er personlig (ingen org-deling). requireUserSession beviser innlogging.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

// Roller som administrerer Leadgrid Go-dashbordet (ser hele teamet). Org
// tildeler disse via team-styring; i tillegg respekteres en eksplisitt
// `leadgrid_go.admin`-permission for finkorning senere.
const GO_ADMIN_ROLES = new Set(["admin", "salgssjef"]);

const VALID_PURPOSES = new Set(["unconfirmed", "business", "commute", "privateUse"]);

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  // Separate statements (ikke batch — batch-CREATE kan kollidere, jf. workspace-audit).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_trips (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      start_place TEXT NOT NULL DEFAULT '',
      end_place TEXT NOT NULL DEFAULT '',
      start_lat DOUBLE PRECISION,
      start_lon DOUBLE PRECISION,
      end_lat DOUBLE PRECISION,
      end_lon DOUBLE PRECISION,
      distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
      vehicle_name TEXT,
      vehicle_plate TEXT,
      purpose TEXT NOT NULL DEFAULT 'unconfirmed',
      note TEXT NOT NULL DEFAULT '',
      mileage_amount DOUBLE PRECISION,
      toll_amount DOUBLE PRECISION,
      source TEXT NOT NULL DEFAULT 'auto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_leadgrid_trips_user_start ON leadgrid_trips (user_id, start_date DESC)`,
  );
  schemaReady = true;
}

// Swift `.iso8601` godtar IKKE fraksjonssekunder → strip «.000Z».
const isoNoMillis = (v: any): string | null =>
  v == null ? null : new Date(v).toISOString().replace(/\.\d{3}Z$/, "Z");

const rowToDto = (r: any) => ({
  id: r.id,
  start_date: isoNoMillis(r.start_date),
  end_date: isoNoMillis(r.end_date),
  start_place: r.start_place,
  end_place: r.end_place,
  start_lat: r.start_lat,
  start_lon: r.start_lon,
  end_lat: r.end_lat,
  end_lon: r.end_lon,
  distance_km: r.distance_km,
  vehicle_name: r.vehicle_name,
  vehicle_plate: r.vehicle_plate,
  purpose: r.purpose,
  note: r.note,
  mileage_amount: r.mileage_amount,
  toll_amount: r.toll_amount,
  source: r.source,
});

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

const emptyTotals = () => ({ drivers: 0, active_drivers: 0, km: 0, amount: 0, tolls: 0, unconfirmed: 0 });

function purposeLabel(p: string): string {
  switch (p) {
    case "business": return "Firma";
    case "commute": return "Arbeidsreise";
    case "privateUse": return "Privat";
    default: return "Ikke bekreftet";
  }
}
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function registerLeadgridTripsRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  // Upsert én tur (delt av POST /trips og /trips/sync).
  async function upsertTrip(userId: string, t: any): Promise<void> {
    if (!t?.id || !UUID_RE.test(String(t.id))) return;
    const purpose = VALID_PURPOSES.has(t.purpose) ? t.purpose : "unconfirmed";
    await pool.query(
      `INSERT INTO leadgrid_trips
         (id, user_id, start_date, end_date, start_place, end_place,
          start_lat, start_lon, end_lat, end_lon, distance_km,
          vehicle_name, vehicle_plate, purpose, note, mileage_amount, toll_amount, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         purpose = EXCLUDED.purpose,
         note = EXCLUDED.note,
         vehicle_name = EXCLUDED.vehicle_name,
         vehicle_plate = EXCLUDED.vehicle_plate,
         updated_at = now()
       WHERE leadgrid_trips.user_id = $2`,   // IDOR: kan bare oppdatere egne
      [
        t.id, userId, t.startDate ?? t.start_date, t.endDate ?? t.end_date,
        t.startPlace ?? t.start_place ?? "", t.endPlace ?? t.end_place ?? "",
        t.startLat ?? t.start_lat ?? null, t.startLon ?? t.start_lon ?? null,
        t.endLat ?? t.end_lat ?? null, t.endLon ?? t.end_lon ?? null,
        t.distanceKm ?? t.distance_km ?? 0,
        t.vehicleName ?? t.vehicle_name ?? null, t.vehiclePlate ?? t.vehicle_plate ?? null,
        purpose, t.note ?? "", t.mileageAmount ?? t.mileage_amount ?? null,
        t.tollAmount ?? t.toll_amount ?? null, t.source ?? "auto",
      ],
    );
  }

  // ── GET /trips ──────────────────────────────────────────────────
  app.get("/api/leadgrid/trips", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const from = String(req.query.from || "");
      const to = String(req.query.to || "");
      const params: any[] = [session.userId];
      let where = "user_id = $1";
      if (from) { params.push(from); where += ` AND start_date >= $${params.length}`; }
      if (to) { params.push(to); where += ` AND start_date <= $${params.length}`; }
      const r = await pool.query(
        `SELECT * FROM leadgrid_trips WHERE ${where} ORDER BY start_date DESC LIMIT 1000`,
        params,
      );
      return res.json({ trips: r.rows.map(rowToDto) });
    } catch (err) {
      console.warn("[leadgrid-trips] list failed:", (err as Error).message);
      return res.status(500).json({ error: "trips_list_failed" });
    }
  });

  // ── POST /trips (upsert én) ─────────────────────────────────────
  app.post("/api/leadgrid/trips", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      await upsertTrip(session.userId, req.body || {});
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] upsert failed:", (err as Error).message);
      return res.status(500).json({ error: "trip_upsert_failed" });
    }
  });

  // ── POST /trips/sync (bulk) ─────────────────────────────────────
  app.post("/api/leadgrid/trips/sync", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const trips: any[] = Array.isArray(req.body?.trips) ? req.body.trips : [];
      for (const t of trips.slice(0, 500)) await upsertTrip(session.userId, t);
      const r = await pool.query(
        `SELECT * FROM leadgrid_trips WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1000`,
        [session.userId],
      );
      return res.json({ ok: true, trips: r.rows.map(rowToDto) });
    } catch (err) {
      console.warn("[leadgrid-trips] sync failed:", (err as Error).message);
      return res.status(500).json({ error: "trips_sync_failed" });
    }
  });

  // ── PATCH /trips/:id (formål/notat) ─────────────────────────────
  app.patch("/api/leadgrid/trips/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    const purpose = req.body?.purpose;
    if (purpose != null && !VALID_PURPOSES.has(purpose)) {
      return res.status(400).json({ error: "invalid_purpose" });
    }
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE leadgrid_trips SET
           purpose = COALESCE($3, purpose),
           note = COALESCE($4, note),
           updated_at = now()
         WHERE id = $1 AND user_id = $2`,   // IDOR-gate
        [id, session.userId, purpose ?? null, req.body?.note ?? null],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] patch failed:", (err as Error).message);
      return res.status(500).json({ error: "trip_patch_failed" });
    }
  });

  // ── DELETE /trips/:id ───────────────────────────────────────────
  app.delete("/api/leadgrid/trips/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      await ensureSchema(pool);
      await pool.query(`DELETE FROM leadgrid_trips WHERE id = $1 AND user_id = $2`, [
        id, session.userId,
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] delete failed:", (err as Error).message);
      return res.status(500).json({ error: "trip_delete_failed" });
    }
  });

  // ── GET /trips/team — admin-oversikt over hele teamet (org-scopet) ─
  app.get("/api/leadgrid/trips/team", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { role, permissions } = await resolveEffectivePermissions(pool, orgId, session.userId);
      const isGoAdmin =
        (role && GO_ADMIN_ROLES.has(role)) ||
        permissions.has("leadgrid_go.admin") ||
        permissions.has("teams.view");
      if (!isGoAdmin) return res.status(403).json({ error: "not_go_admin" });

      // Teammedlemmer + visningsnavn.
      const mem = await pool.query(
        `SELECT om.user_id, om.role,
                COALESCE(up.display_name, u.email, om.user_id) AS name
           FROM organization_members om
           LEFT JOIN user_profiles up
             ON up.user_id = om.user_id AND up.organization_id = om.organization_id
           LEFT JOIN users u ON u.id = om.user_id
          WHERE om.organization_id = $1`,
        [orgId],
      );
      const memberIds: string[] = mem.rows.map((r) => r.user_id);
      if (memberIds.length === 0) return res.json({ role, drivers: [], totals: emptyTotals() });

      const from = String(req.query.from || "");
      const to = String(req.query.to || "");
      const params: any[] = [memberIds];
      let dateWhere = "";
      if (from) { params.push(from); dateWhere += ` AND start_date >= $${params.length}`; }
      if (to) { params.push(to); dateWhere += ` AND start_date <= $${params.length}`; }

      const agg = await pool.query(
        `SELECT user_id,
                COUNT(*)::int AS trips,
                COALESCE(SUM(distance_km),0) AS km,
                COALESCE(SUM(CASE WHEN purpose='business' THEN distance_km ELSE 0 END),0) AS business_km,
                COALESCE(SUM(CASE WHEN purpose='business' THEN COALESCE(mileage_amount,0) ELSE 0 END),0) AS amount,
                COALESCE(SUM(COALESCE(toll_amount,0)),0) AS tolls,
                COUNT(*) FILTER (WHERE purpose='unconfirmed')::int AS unconfirmed,
                MAX(vehicle_name) AS vehicle_name,
                MAX(vehicle_plate) AS vehicle_plate,
                MAX(start_date) AS last_trip
           FROM leadgrid_trips
          WHERE user_id = ANY($1)${dateWhere}
          GROUP BY user_id`,
        params,
      );
      const byUser = new Map<string, any>(agg.rows.map((r) => [r.user_id, r]));
      const drivers = mem.rows
        .map((m) => {
          const a = byUser.get(m.user_id);
          return {
            user_id: m.user_id,
            name: m.name,
            role: m.role,
            trips: a?.trips ?? 0,
            km: Number(a?.km ?? 0),
            business_km: Number(a?.business_km ?? 0),
            amount: Number(a?.amount ?? 0),
            tolls: Number(a?.tolls ?? 0),
            unconfirmed: a?.unconfirmed ?? 0,
            vehicle_name: a?.vehicle_name ?? null,
            vehicle_plate: a?.vehicle_plate ?? null,
            last_trip: a?.last_trip ? isoNoMillis(a.last_trip) : null,
          };
        })
        .sort((x, y) => y.business_km - x.business_km);

      const totals = {
        drivers: drivers.length,
        active_drivers: drivers.filter((d) => d.trips > 0).length,
        km: drivers.reduce((s, d) => s + d.business_km, 0),
        amount: drivers.reduce((s, d) => s + d.amount, 0),
        tolls: drivers.reduce((s, d) => s + d.tolls, 0),
        unconfirmed: drivers.reduce((s, d) => s + d.unconfirmed, 0),
      };
      return res.json({ role, drivers, totals });
    } catch (err) {
      console.warn("[leadgrid-trips] team failed:", (err as Error).message);
      return res.status(500).json({ error: "trips_team_failed" });
    }
  });

  // ── GET /trips/export.csv (Skatteetaten-format) ─────────────────
  app.get("/api/leadgrid/trips/export.csv", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const from = String(req.query.from || "");
      const to = String(req.query.to || "");
      const params: any[] = [session.userId];
      let where = "user_id = $1";
      if (from) { params.push(from); where += ` AND start_date >= $${params.length}`; }
      if (to) { params.push(to); where += ` AND start_date <= $${params.length}`; }
      const r = await pool.query(
        `SELECT * FROM leadgrid_trips WHERE ${where} ORDER BY start_date ASC`,
        params,
      );
      const headers = [
        "Dato", "Fra", "Til", "Formål", "Km", "Kjøretøy",
        "Kjøregodtgjørelse (kr)", "Bom (kr)", "Notat",
      ];
      const lines = [headers.join(";")];
      for (const t of r.rows) {
        const d = new Date(t.start_date);
        const dato = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
        lines.push([
          dato, t.start_place, t.end_place, purposeLabel(t.purpose),
          (t.distance_km ?? 0).toFixed(1).replace(".", ","),
          [t.vehicle_name, t.vehicle_plate].filter(Boolean).join(" "),
          t.mileage_amount != null ? Number(t.mileage_amount).toFixed(2).replace(".", ",") : "",
          t.toll_amount != null ? Number(t.toll_amount).toFixed(2).replace(".", ",") : "",
          t.note ?? "",
        ].map(csvCell).join(";"));
      }
      const csv = "﻿" + lines.join("\r\n");  // BOM → Excel-NO leser æøå
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kjorebok.csv"`);
      return res.send(csv);
    } catch (err) {
      console.warn("[leadgrid-trips] export failed:", (err as Error).message);
      return res.status(500).json({ error: "trips_export_failed" });
    }
  });
}
