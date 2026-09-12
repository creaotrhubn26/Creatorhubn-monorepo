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
import { assertAnyEntitled, checkAnyEntitlement, LEADGRID_GO_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";

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
  // «Min bil»-profil server-side (mig 0373) — så admin ser registrert (firma)bil.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_vehicles (
      user_id TEXT PRIMARY KEY,
      plate TEXT,
      display_name TEXT,
      fuel TEXT NOT NULL DEFAULT 'unknown',
      kind TEXT NOT NULL DEFAULT 'car',
      is_company_car BOOLEAN NOT NULL DEFAULT false,
      eu_control_due DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // EU-kontroll-kolonne for tabeller opprettet før 0374.
  await pool.query(`ALTER TABLE leadgrid_vehicles ADD COLUMN IF NOT EXISTS eu_control_due DATE`);
  // Kjøretøy-booking (delte firmabiler) — org-scopet (mig 0375).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_vehicle_bookings (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      vehicle_label TEXT NOT NULL,
      vehicle_plate TEXT,
      booked_by TEXT NOT NULL,
      booked_by_name TEXT,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_lg_vbookings_org ON leadgrid_vehicle_bookings (organization_id, start_at)`,
  );
  // Flåteregister: org-EIDE firmabiler (mig 0376) — sentralt registrert av
  // admin, i motsetning til leadgrid_vehicles (sjåførens egen «Min bil»).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_org_vehicles (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plate TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      fuel TEXT NOT NULL DEFAULT 'unknown',
      kind TEXT NOT NULL DEFAULT 'car',
      eu_control_due DATE,
      is_shared BOOLEAN NOT NULL DEFAULT true,
      assigned_user_id TEXT,
      assigned_user_name TEXT,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_orgveh_org_plate_active
       ON leadgrid_org_vehicles (organization_id, plate) WHERE status = 'active'`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_lg_orgveh_org_status ON leadgrid_org_vehicles (organization_id, status)`,
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

const htmlEsc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Bygg månedsrapport-e-post (HTML) fra turene. */
function buildReportHtml(monthLabel: string, rows: any[]): string {
  const business = rows.filter((r) => r.purpose === "business");
  const km = business.reduce((s, r) => s + Number(r.distance_km || 0), 0);
  const amount = business.reduce((s, r) => s + Number(r.mileage_amount || 0), 0);
  const tolls = rows.reduce((s, r) => s + Number(r.toll_amount || 0), 0);
  const unconfirmed = rows.filter((r) => r.purpose === "unconfirmed").length;
  const tripRows = rows
    .map((r) => {
      const d = new Date(r.start_date);
      const dato = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${dato}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${htmlEsc(r.start_place)} → ${htmlEsc(r.end_place)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${purposeLabel(r.purpose)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${Number(r.distance_km || 0).toFixed(1)} km</td>
      </tr>`;
    })
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111">
    <h2 style="color:#6a3fbf">Leadgrid Go — kjørebok ${htmlEsc(monthLabel)}</h2>
    <table style="width:100%;border-collapse:collapse;margin:14px 0">
      <tr>
        <td style="padding:10px;background:#f5f2fc;border-radius:8px;text-align:center">
          <div style="font-size:20px;font-weight:800">${Math.round(km)} km</div>
          <div style="font-size:11px;color:#666">Yrkeskjøring</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#eefaf3;border-radius:8px;text-align:center">
          <div style="font-size:20px;font-weight:800">${Math.round(amount)} kr</div>
          <div style="font-size:11px;color:#666">Kjøregodtgjørelse</div></td>
        <td style="width:8px"></td>
        <td style="padding:10px;background:#fdf2e8;border-radius:8px;text-align:center">
          <div style="font-size:20px;font-weight:800">${Math.round(tolls)} kr</div>
          <div style="font-size:11px;color:#666">Bom</div></td>
      </tr>
    </table>
    ${unconfirmed > 0 ? `<p style="color:#d97706;font-weight:600">⚠ ${unconfirmed} tur${unconfirmed === 1 ? "" : "er"} mangler formål — bekreft i appen før rapportering.</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:#666">
        <th style="padding:6px 10px">Dato</th><th style="padding:6px 10px">Rute</th>
        <th style="padding:6px 10px">Formål</th><th style="padding:6px 10px;text-align:right">Km</th>
      </tr></thead>
      <tbody>${tripRows || `<tr><td colspan="4" style="padding:14px;color:#999">Ingen turer denne måneden.</td></tr>`}</tbody>
    </table>
    <p style="font-size:11px;color:#999;margin-top:16px">Kjøreboka følger Skatteetatens dokumentasjonskrav. Full CSV kan eksporteres i Leadgrid-appen.</p>
  </div>`;
}

export function registerLeadgridTripsRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  // Session + entitlement-gate (Leadgrid Go = tilleggstjeneste). Fail-open:
  // orgs uten entitlement-rader forblir åpne (jf. checkAnyEntitlement).
  async function gate(req: Request, res: Response): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const ok = await assertAnyEntitled(pool, session.userId, LEADGRID_GO_FEATURE_KEYS, res);
    if (!ok) return null;
    return session;
  }

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
    const session = await gate(req, res);
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
    const session = await gate(req, res);
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
    const session = await gate(req, res);
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
    const session = await gate(req, res);
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
    const session = await gate(req, res);
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
    const session = await gate(req, res);
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
                COALESCE(up.display_name, u.email, om.user_id) AS name,
                v.display_name AS veh_name, v.plate AS veh_plate,
                v.is_company_car AS is_company_car, v.fuel AS veh_fuel,
                v.eu_control_due AS eu_control_due
           FROM organization_members om
           LEFT JOIN user_profiles up
             ON up.user_id = om.user_id AND up.organization_id = om.organization_id
           LEFT JOIN users u ON u.id = om.user_id
           LEFT JOIN leadgrid_vehicles v ON v.user_id = om.user_id
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
            // Registrert (firma)bil vinner over utledet fra turer.
            vehicle_name: m.veh_name ?? a?.vehicle_name ?? null,
            vehicle_plate: m.veh_plate ?? a?.vehicle_plate ?? null,
            is_company_car: m.is_company_car ?? false,
            vehicle_fuel: m.veh_fuel ?? null,
            eu_control_due: m.eu_control_due
              ? new Date(m.eu_control_due).toISOString().slice(0, 10) : null,
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
    const session = await gate(req, res);
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

  // ── POST /trips/report — send månedsrapport til callerens innboks ─
  // Cron-klar: samme motor kan kalles fra en månedlig jobb per bruker.
  app.post("/api/leadgrid/trips/report", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: "email_not_configured" });
    }
    try {
      await ensureSchema(pool);
      // Måned: ?month=YYYY-MM, ellers inneværende.
      const monthQ = String(req.query.month || "");
      const now = new Date();
      const [yy, mm] = /^\d{4}-\d{2}$/.test(monthQ)
        ? monthQ.split("-").map(Number)
        : [now.getUTCFullYear(), now.getUTCMonth() + 1];
      const start = new Date(Date.UTC(yy, mm - 1, 1));
      const end = new Date(Date.UTC(yy, mm, 1));
      const monthLabel = start.toLocaleDateString("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });

      const u = await pool.query<{ email: string | null }>(
        `SELECT email FROM users WHERE id = $1`,
        [session.userId],
      );
      const email = u.rows[0]?.email;
      if (!email) return res.status(400).json({ error: "no_email_on_user" });

      const r = await pool.query(
        `SELECT * FROM leadgrid_trips
          WHERE user_id = $1 AND start_date >= $2 AND start_date < $3
          ORDER BY start_date ASC`,
        [session.userId, start.toISOString(), end.toISOString()],
      );
      const html = buildReportHtml(monthLabel, r.rows);
      const result = await sendEmail({
        to: email,
        subject: `Leadgrid Go — kjørebok ${monthLabel}`,
        html,
        fromName: "Leadgrid Go",
      });
      if (!result.success) {
        return res.status(502).json({ error: "send_failed", detail: result.error });
      }
      return res.json({ sent: true, to: email, trips: r.rows.length });
    } catch (err) {
      console.warn("[leadgrid-trips] report failed:", (err as Error).message);
      return res.status(500).json({ error: "trips_report_failed" });
    }
  });

  // ── POST /trips/report/cron — månedlig batch (alle sjåfører) ──────
  // CRON-target: sender forrige måneds kjørebok til hver bruker som har turer.
  // Auth: x-cron-trigger-token (GitHub Actions cron). Ingen session.
  app.post("/api/leadgrid/trips/report/cron", async (req, res) => {
    const presented = String(req.headers["x-cron-trigger-token"] || "").trim();
    const expected = (process.env.CRON_TRIGGER_TOKEN || "").trim();
    if (!expected || presented !== expected) {
      return res.status(401).json({ error: "invalid_cron_token" });
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: "email_not_configured" });
    }
    try {
      await ensureSchema(pool);
      // Standard: forrige måned (cron kjører tidlig i ny måned). ?month overstyrer.
      const monthQ = String(req.query.month || "");
      const now = new Date();
      let yy = now.getUTCFullYear();
      let mm = now.getUTCMonth(); // 0-indeksert = forrige måned (1-indeksert-1)
      if (mm === 0) { mm = 12; yy -= 1; } // januar → desember i fjor
      if (/^\d{4}-\d{2}$/.test(monthQ)) {
        const [qy, qm] = monthQ.split("-").map(Number);
        yy = qy; mm = qm;
      }
      const start = new Date(Date.UTC(yy, mm - 1, 1));
      const end = new Date(Date.UTC(yy, mm, 1));
      const monthLabel = start.toLocaleDateString("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });

      // Brukere med turer i måneden.
      const users = await pool.query<{ user_id: string }>(
        `SELECT DISTINCT user_id FROM leadgrid_trips
          WHERE start_date >= $1 AND start_date < $2`,
        [start.toISOString(), end.toISOString()],
      );

      let sent = 0, skipped = 0, failed = 0;
      for (const { user_id } of users.rows) {
        // Respekter add-on-gating (fail-open).
        const ent = await checkAnyEntitlement(pool, user_id, LEADGRID_GO_FEATURE_KEYS);
        if (!ent.allowed) { skipped++; continue; }
        const u = await pool.query<{ email: string | null }>(
          `SELECT email FROM users WHERE id = $1`, [user_id],
        );
        const email = u.rows[0]?.email;
        if (!email) { skipped++; continue; }
        const r = await pool.query(
          `SELECT * FROM leadgrid_trips
            WHERE user_id = $1 AND start_date >= $2 AND start_date < $3
            ORDER BY start_date ASC`,
          [user_id, start.toISOString(), end.toISOString()],
        );
        const result = await sendEmail({
          to: email,
          subject: `Leadgrid Go — kjørebok ${monthLabel}`,
          html: buildReportHtml(monthLabel, r.rows),
          fromName: "Leadgrid Go",
        });
        if (result.success) sent++; else failed++;
        await new Promise((res2) => setTimeout(res2, 250)); // throttle SMTP
      }
      return res.json({ month: monthLabel, users: users.rows.length, sent, skipped, failed });
    } catch (err) {
      console.warn("[leadgrid-trips] cron report failed:", (err as Error).message);
      return res.status(500).json({ error: "cron_report_failed" });
    }
  });

  // ── POST /vehicle/profile — synk sjåførens «Min bil» server-side ──
  app.post("/api/leadgrid/vehicle/profile", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const b = req.body || {};
      const euDue = b.euControlDue ?? b.eu_control_due ?? null;
      await pool.query(
        `INSERT INTO leadgrid_vehicles (user_id, plate, display_name, fuel, kind, is_company_car, eu_control_due, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (user_id) DO UPDATE SET
           plate = EXCLUDED.plate, display_name = EXCLUDED.display_name,
           fuel = EXCLUDED.fuel, kind = EXCLUDED.kind,
           is_company_car = EXCLUDED.is_company_car,
           eu_control_due = COALESCE(EXCLUDED.eu_control_due, leadgrid_vehicles.eu_control_due),
           updated_at = now()`,
        [
          session.userId,
          b.plate ?? null, b.displayName ?? b.display_name ?? null,
          String(b.fuel ?? "unknown"), String(b.kind ?? "car"),
          b.isCompanyCar ?? b.is_company_car ?? false,
          euDue ? String(euDue).slice(0, 10) : null,
        ],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] vehicle profile failed:", (err as Error).message);
      return res.status(500).json({ error: "vehicle_profile_failed" });
    }
  });

  // ── GET /vehicle/fleet — org-ens firmabiler (til booking) ────────
  app.get("/api/leadgrid/vehicle/fleet", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT v.user_id, v.plate, v.display_name, v.fuel, v.eu_control_due,
                COALESCE(up.display_name, u.email, v.user_id) AS driver_name
           FROM leadgrid_vehicles v
           JOIN organization_members om ON om.user_id = v.user_id AND om.organization_id = $1
           LEFT JOIN user_profiles up ON up.user_id = v.user_id AND up.organization_id = $1
           LEFT JOIN users u ON u.id = v.user_id
          WHERE v.is_company_car = true`,
        [orgId],
      );
      return res.json({ vehicles: r.rows.map((x) => ({
        plate: x.plate, display_name: x.display_name, fuel: x.fuel,
        driver_name: x.driver_name,
        eu_control_due: x.eu_control_due ? new Date(x.eu_control_due).toISOString().slice(0, 10) : null,
      })) });
    } catch (err) {
      console.warn("[leadgrid-trips] fleet failed:", (err as Error).message);
      return res.status(500).json({ error: "fleet_failed" });
    }
  });

  // ── Flåteregister: org-eide firmabiler ───────────────────────────
  // Lesing: alle org-medlemmer m/ Go-entitlement (booking-velger + «Min bil»
  // trenger lista). Skriving: kun Go-admin (admin/salgssjef/leadgrid_go.admin).
  async function requireGoAdmin(res: Response, orgId: string, userId: string): Promise<boolean> {
    const { role, permissions } = await resolveEffectivePermissions(pool, orgId, userId);
    const ok =
      (role && GO_ADMIN_ROLES.has(role)) ||
      permissions.has("leadgrid_go.admin") ||
      permissions.has("teams.view");
    if (!ok) res.status(403).json({ error: "not_go_admin" });
    return ok;
  }

  const orgVehicleDto = (v: any) => ({
    id: v.id,
    plate: v.plate,
    display_name: v.display_name,
    fuel: v.fuel,
    kind: v.kind,
    eu_control_due: v.eu_control_due
      ? new Date(v.eu_control_due).toISOString().slice(0, 10) : null,
    is_shared: v.is_shared,
    assigned_user_id: v.assigned_user_id,
    assigned_user_name: v.assigned_user_name,
    note: v.note,
    status: v.status,
  });

  // GET /org-vehicles — aktiv flåte i innloggedes org.
  app.get("/api/leadgrid/org-vehicles", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT * FROM leadgrid_org_vehicles
          WHERE organization_id = $1 AND status = 'active'
          ORDER BY display_name, plate LIMIT 500`,
        [orgId],
      );
      return res.json({ vehicles: r.rows.map(orgVehicleDto) });
    } catch (err) {
      console.warn("[leadgrid-trips] org-vehicles list failed:", (err as Error).message);
      return res.status(500).json({ error: "org_vehicles_failed" });
    }
  });

  // POST /org-vehicles — registrer firmabil (Go-admin).
  app.post("/api/leadgrid/org-vehicles", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await requireGoAdmin(res, orgId, session.userId))) return;
      const b = req.body || {};
      const plate = String(b.plate ?? "").trim().toUpperCase().replace(/\s+/g, "");
      if (!plate || plate.length > 12) return res.status(400).json({ error: "invalid_plate" });
      // Tildelt sjåfør må være medlem av SAMME org (IDOR-vern: aldri stol på id-en alene).
      let assignedId: string | null = null;
      let assignedName: string | null = null;
      const rawAssigned = b.assignedUserId ?? b.assigned_user_id;
      if (rawAssigned) {
        const m = await pool.query(
          `SELECT om.user_id, COALESCE(up.display_name, u.email, om.user_id) AS name
             FROM organization_members om
             LEFT JOIN user_profiles up ON up.user_id = om.user_id AND up.organization_id = $1
             LEFT JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = $1 AND om.user_id = $2`,
          [orgId, String(rawAssigned)],
        );
        if (m.rowCount === 0) return res.status(400).json({ error: "assigned_not_in_org" });
        assignedId = m.rows[0].user_id;
        assignedName = m.rows[0].name;
      }
      const id = (globalThis.crypto as any).randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_org_vehicles
           (id, organization_id, plate, display_name, fuel, kind, eu_control_due,
            is_shared, assigned_user_id, assigned_user_name, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, orgId, plate, String(b.displayName ?? b.display_name ?? ""),
         String(b.fuel ?? "unknown"), String(b.kind ?? "car"),
         b.euControlDue ?? b.eu_control_due ?? null,
         assignedId == null ? (b.isShared ?? b.is_shared ?? true) : false,
         assignedId, assignedName, String(b.note ?? "")],
      );
      return res.json({ ok: true, id });
    } catch (err: any) {
      if (String(err?.code) === "23505") return res.status(409).json({ error: "plate_exists" });
      console.warn("[leadgrid-trips] org-vehicle create failed:", (err as Error).message);
      return res.status(500).json({ error: "org_vehicle_create_failed" });
    }
  });

  // PATCH /org-vehicles/:id — rediger/tildel/avregistrer (Go-admin).
  app.patch("/api/leadgrid/org-vehicles/:id", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await requireGoAdmin(res, orgId, session.userId))) return;
      const b = req.body || {};
      const sets: string[] = [];
      const params: any[] = [id, orgId];
      const push = (sql: string, val: any) => { params.push(val); sets.push(`${sql} = $${params.length}`); };
      if (b.displayName !== undefined || b.display_name !== undefined)
        push("display_name", String(b.displayName ?? b.display_name ?? ""));
      if (b.fuel !== undefined) push("fuel", String(b.fuel));
      if (b.kind !== undefined) push("kind", String(b.kind));
      if (b.euControlDue !== undefined || b.eu_control_due !== undefined)
        push("eu_control_due", b.euControlDue ?? b.eu_control_due ?? null);
      if (b.note !== undefined) push("note", String(b.note));
      if (b.status !== undefined && ["active", "retired"].includes(String(b.status)))
        push("status", String(b.status));
      const rawAssigned = b.assignedUserId ?? b.assigned_user_id;
      if (rawAssigned !== undefined) {
        if (rawAssigned === null || rawAssigned === "") {
          push("assigned_user_id", null); push("assigned_user_name", null);
          push("is_shared", b.isShared ?? b.is_shared ?? true);
        } else {
          const m = await pool.query(
            `SELECT om.user_id, COALESCE(up.display_name, u.email, om.user_id) AS name
               FROM organization_members om
               LEFT JOIN user_profiles up ON up.user_id = om.user_id AND up.organization_id = $1
               LEFT JOIN users u ON u.id = om.user_id
              WHERE om.organization_id = $1 AND om.user_id = $2`,
            [orgId, String(rawAssigned)],
          );
          if (m.rowCount === 0) return res.status(400).json({ error: "assigned_not_in_org" });
          push("assigned_user_id", m.rows[0].user_id);
          push("assigned_user_name", m.rows[0].name);
          push("is_shared", false);
        }
      } else if (b.isShared !== undefined || b.is_shared !== undefined) {
        push("is_shared", !!(b.isShared ?? b.is_shared));
      }
      if (sets.length === 0) return res.status(400).json({ error: "no_fields" });
      sets.push("updated_at = now()");
      const r = await pool.query(
        `UPDATE leadgrid_org_vehicles SET ${sets.join(", ")}
          WHERE id = $1 AND organization_id = $2`,   // org-scopet: aldri andres flåte
        params,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err: any) {
      if (String(err?.code) === "23505") return res.status(409).json({ error: "plate_exists" });
      console.warn("[leadgrid-trips] org-vehicle update failed:", (err as Error).message);
      return res.status(500).json({ error: "org_vehicle_update_failed" });
    }
  });

  // DELETE /org-vehicles/:id — avregistrer (soft, Go-admin).
  app.delete("/api/leadgrid/org-vehicles/:id", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      if (!(await requireGoAdmin(res, orgId, session.userId))) return;
      const r = await pool.query(
        `UPDATE leadgrid_org_vehicles SET status = 'retired', updated_at = now()
          WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
        [id, orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] org-vehicle retire failed:", (err as Error).message);
      return res.status(500).json({ error: "org_vehicle_retire_failed" });
    }
  });

  // ── GET /vehicle/bookings — kommende reservasjoner i org ─────────
  app.get("/api/leadgrid/vehicle/bookings", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const r = await pool.query(
        `SELECT * FROM leadgrid_vehicle_bookings
          WHERE organization_id = $1 AND status = 'active' AND end_at >= now()
          ORDER BY start_at ASC LIMIT 200`,
        [orgId],
      );
      return res.json({ bookings: r.rows.map((b) => ({
        id: b.id, vehicle_label: b.vehicle_label, vehicle_plate: b.vehicle_plate,
        booked_by: b.booked_by, booked_by_name: b.booked_by_name,
        start_at: isoNoMillis(b.start_at), end_at: isoNoMillis(b.end_at),
        purpose: b.purpose, is_mine: b.booked_by === session.userId,
      })) });
    } catch (err) {
      console.warn("[leadgrid-trips] bookings list failed:", (err as Error).message);
      return res.status(500).json({ error: "bookings_failed" });
    }
  });

  // ── POST /vehicle/bookings — reserver (konflikt-sjekk) ───────────
  app.post("/api/leadgrid/vehicle/bookings", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    try {
      await ensureSchema(pool);
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const b = req.body || {};
      let label = String(b.vehicleLabel ?? b.vehicle_label ?? "").trim();
      let plate = b.vehiclePlate ?? b.vehicle_plate ?? null;
      // Flåtebil: vehicleId slår opp label/plate fra org-flåten (verifisert
      // org-scopet + delt + aktiv) — fritekst beholdes som fallback.
      const vehicleId = b.vehicleId ?? b.vehicle_id;
      if (vehicleId) {
        if (!UUID_RE.test(String(vehicleId))) return res.status(400).json({ error: "invalid_vehicle_id" });
        const v = await pool.query(
          `SELECT plate, display_name, is_shared FROM leadgrid_org_vehicles
            WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
          [String(vehicleId), orgId],
        );
        if (v.rowCount === 0) return res.status(404).json({ error: "vehicle_not_found" });
        if (!v.rows[0].is_shared) return res.status(409).json({ error: "vehicle_not_shared" });
        label = v.rows[0].display_name || v.rows[0].plate;
        plate = v.rows[0].plate;
      }
      const startAt = b.startAt ?? b.start_at;
      const endAt = b.endAt ?? b.end_at;
      if (!label || !startAt || !endAt) return res.status(400).json({ error: "missing_fields" });
      if (new Date(endAt) <= new Date(startAt)) return res.status(400).json({ error: "end_before_start" });
      // Konflikt: overlappende aktiv reservasjon for samme bil (plate el. label).
      const conflict = await pool.query(
        `SELECT 1 FROM leadgrid_vehicle_bookings
          WHERE organization_id = $1 AND status = 'active'
            AND COALESCE(vehicle_plate, vehicle_label) = COALESCE($2, $3)
            AND tstzrange(start_at, end_at) && tstzrange($4, $5) LIMIT 1`,
        [orgId, plate, label, startAt, endAt],
      );
      if ((conflict.rowCount ?? 0) > 0) return res.status(409).json({ error: "time_conflict" });
      const id = (globalThis.crypto as any).randomUUID();
      await pool.query(
        `INSERT INTO leadgrid_vehicle_bookings
           (id, organization_id, vehicle_label, vehicle_plate, booked_by, booked_by_name, start_at, end_at, purpose)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, orgId, label, plate, session.userId, b.bookedByName ?? b.booked_by_name ?? null,
         startAt, endAt, String(b.purpose ?? "")],
      );
      return res.json({ ok: true, id });
    } catch (err) {
      console.warn("[leadgrid-trips] booking create failed:", (err as Error).message);
      return res.status(500).json({ error: "booking_create_failed" });
    }
  });

  // ── DELETE /vehicle/bookings/:id — kanseller egen reservasjon ────
  app.delete("/api/leadgrid/vehicle/bookings/:id", async (req, res) => {
    const session = await gate(req, res);
    if (!session) return;
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "invalid_id" });
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE leadgrid_vehicle_bookings SET status = 'cancelled'
          WHERE id = $1 AND booked_by = $2`,   // kun egen
        [id, session.userId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true });
    } catch (err) {
      console.warn("[leadgrid-trips] booking cancel failed:", (err as Error).message);
      return res.status(500).json({ error: "booking_cancel_failed" });
    }
  });
}
