// leadgrid-mileage-approval-routes.ts
//
// Kjøregodtgjørelse-godkjenning for Leadgrid (Salgssjef-cockpit →
// «Kjøregodtgjørelse»-arket). Egen Leadgrid-tabell (mig 0405), speiler
// utgifts-/kjøregodtgjørelse-mønsteret men Leadgrid-scoped.
//
// Flyt:
//   - Selgeren sender inn et krav (fra kjørebok el. manuelt).
//   - Salgssjefen (admin-like rolle) ser org-ens ventende krav, godkjenner
//     enkeltvis eller alle, og eksporterer til lønn (CSV).
//
// Endepunkter (alle under /api/leadgrid/mileage):
//   POST  /claims                 (selger: send inn krav for seg selv)
//   GET   /mine                   (selger: egne krav)
//   GET   /pending                (leder: org-ens ventende)
//   GET   /recent                 (leder: org-ens godkjente/utbetalte)
//   POST  /claims/:id/approve     (leder: godkjenn ett krav → approved)
//   POST  /approve-all            (leder: godkjenn alle ventende)
//   GET   /export.csv             (leder: CSV til lønn)
//
// Belt-and-suspenders ensureTable() self-healer (samme som software-expenses)
// i tilfelle migrasjonen henger på Render.

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface LeadgridMileageApprovalRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function isManagerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === "admin" || r === "super_admin" || r === "owner" || r === "sales_manager";
}

function fmtDate(d: unknown): string {
  if (!d) return "";
  const dt = new Date(String(d));
  if (isNaN(dt.getTime())) return String(d);
  return dt.toISOString().slice(0, 10);
}

// Serialiser en rad til camelCase DTO (iPad leser dette direkte).
function toClaimDTO(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    organizationId: String(row.organization_id ?? ""),
    sellerUserId: String(row.seller_user_id ?? ""),
    sellerName: (row.seller_name as string | null) ?? null,
    tripDate: fmtDate(row.trip_date),
    routeText: (row.route_text as string | null) ?? null,
    km: Number(row.km ?? 0),
    amountNok: Number(row.amount_nok ?? 0),
    status: String(row.status ?? "pending"),
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : null,
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export function registerLeadgridMileageApprovalRoutes(
  deps: LeadgridMileageApprovalRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  let ensured = false;
  async function ensureTable(): Promise<void> {
    if (ensured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leadgrid_mileage_claims (
        id               SERIAL PRIMARY KEY,
        organization_id  VARCHAR(255) NOT NULL,
        seller_user_id   VARCHAR(255) NOT NULL,
        seller_name      VARCHAR(255),
        trip_date        DATE NOT NULL,
        route_text       VARCHAR(500),
        km               NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_nok       NUMERIC(12,2) NOT NULL DEFAULT 0,
        status           VARCHAR(16) NOT NULL DEFAULT 'pending',
        approved_by      VARCHAR(255),
        approved_at      TIMESTAMPTZ,
        note             TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_mileage_claims_org_idx ON leadgrid_mileage_claims (organization_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS leadgrid_mileage_claims_seller_idx ON leadgrid_mileage_claims (seller_user_id)`);
    ensured = true;
  }

  // ── Selger: send inn krav ──────────────────────────────────────────────
  app.post("/api/leadgrid/mileage/claims", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const km = Number(b.km);
      if (!Number.isFinite(km) || km <= 0) {
        return res.status(400).json({ error: "invalid_km" });
      }
      // Amount: bruk oppgitt beløp, ellers 5 kr/km (Skatteetaten-sats speiles
      // i klienten; her stoler vi på klient-beregnet beløp med fallback).
      const amount = Number.isFinite(Number(b.amountNok)) && Number(b.amountNok) > 0
        ? Number(b.amountNok)
        : Math.round(km * 5);
      const tripDate = fmtDate(b.tripDate) || new Date().toISOString().slice(0, 10);
      const routeText = typeof b.routeText === "string" ? b.routeText.slice(0, 500) : null;
      const note = typeof b.note === "string" ? b.note.slice(0, 1000) : null;
      const { rows } = await pool.query(
        `INSERT INTO leadgrid_mileage_claims
           (organization_id, seller_user_id, seller_name, trip_date, route_text, km, amount_nok, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
         RETURNING *`,
        [orgId, session.userId, session.name || null, tripDate, routeText, km, amount, note],
      );
      return res.json({ claim: toClaimDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-mileage] claim create failed:", err);
      return res.status(500).json({ error: "claim_create_failed" });
    }
  });

  // ── Selger: egne krav ──────────────────────────────────────────────────
  app.get("/api/leadgrid/mileage/mine", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      await ensureTable();
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_mileage_claims
          WHERE seller_user_id = $1
          ORDER BY trip_date DESC, created_at DESC
          LIMIT 200`,
        [session.userId],
      );
      return res.json({ claims: rows.map(toClaimDTO) });
    } catch (err) {
      console.error("[leadgrid-mileage] mine failed:", err);
      return res.status(500).json({ error: "mine_failed" });
    }
  });

  // ── Leder: org-ens ventende ────────────────────────────────────────────
  app.get("/api/leadgrid/mileage/pending", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_mileage_claims
          WHERE organization_id = $1 AND status = 'pending'
          ORDER BY trip_date DESC, created_at DESC`,
        [orgId],
      );
      const claims = rows.map(toClaimDTO);
      const totalKm = claims.reduce((s, c) => s + c.km, 0);
      const totalNok = claims.reduce((s, c) => s + c.amountNok, 0);
      return res.json({ claims, totalKm, totalNok, count: claims.length });
    } catch (err) {
      console.error("[leadgrid-mileage] pending failed:", err);
      return res.status(500).json({ error: "pending_failed" });
    }
  });

  // ── Leder: org-ens godkjente/utbetalte (historikk) ─────────────────────
  app.get("/api/leadgrid/mileage/recent", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_mileage_claims
          WHERE organization_id = $1 AND status IN ('approved','paid')
          ORDER BY approved_at DESC NULLS LAST, trip_date DESC
          LIMIT 100`,
        [orgId],
      );
      return res.json({ claims: rows.map(toClaimDTO) });
    } catch (err) {
      console.error("[leadgrid-mileage] recent failed:", err);
      return res.status(500).json({ error: "recent_failed" });
    }
  });

  // ── Leder: godkjenn ett krav ───────────────────────────────────────────
  app.post("/api/leadgrid/mileage/claims/:id/approve", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const { rows } = await pool.query(
        `UPDATE leadgrid_mileage_claims
            SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND organization_id = $3 AND status = 'pending'
          RETURNING *`,
        [session.userId, id, orgId],
      );
      if (rows.length === 0) return res.status(404).json({ error: "not_found_or_not_pending" });
      return res.json({ claim: toClaimDTO(rows[0]) });
    } catch (err) {
      console.error("[leadgrid-mileage] approve failed:", err);
      return res.status(500).json({ error: "approve_failed" });
    }
  });

  // ── Leder: godkjenn ALLE ventende ──────────────────────────────────────
  app.post("/api/leadgrid/mileage/approve-all", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `UPDATE leadgrid_mileage_claims
            SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
          WHERE organization_id = $2 AND status = 'pending'
          RETURNING *`,
        [session.userId, orgId],
      );
      return res.json({ approved: rows.length, claims: rows.map(toClaimDTO) });
    } catch (err) {
      console.error("[leadgrid-mileage] approve-all failed:", err);
      return res.status(500).json({ error: "approve_all_failed" });
    }
  });

  // ── Leder: CSV-eksport til lønn ────────────────────────────────────────
  app.get("/api/leadgrid/mileage/export.csv", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!isManagerRole(session.role)) {
      return res.status(403).json({ error: "manager_role_required" });
    }
    try {
      await ensureTable();
      const orgId = await resolveOrgIdForUser(pool, session.userId);
      const { rows } = await pool.query(
        `SELECT * FROM leadgrid_mileage_claims
          WHERE organization_id = $1 AND status IN ('approved','paid')
          ORDER BY trip_date DESC`,
        [orgId],
      );
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = "Selger;Dato;Rute;KM;Beløp NOK;Status";
      const lines = rows.map((r) => {
        const c = toClaimDTO(r);
        return [c.sellerName ?? "", c.tripDate, c.routeText ?? "", c.km, c.amountNok, c.status]
          .map(esc)
          .join(";");
      });
      const csv = [header, ...lines].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kjoregodtgjorelse.csv"`);
      return res.send(csv);
    } catch (err) {
      console.error("[leadgrid-mileage] export failed:", err);
      return res.status(500).json({ error: "export_failed" });
    }
  });
}
