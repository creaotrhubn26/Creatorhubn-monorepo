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
}
