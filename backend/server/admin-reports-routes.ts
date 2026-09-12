/**
 * admin-reports-routes.ts
 *
 * Rapporter-fanen (ReportsPanel.tsx) er død (404) før denne wirer.
 * Aggregerer ekte data fra users + casting_projects +
 * photographer_client_galleries + projects + payments/subscriptions.
 *
 * Endpoints:
 *   GET  /api/admin/reports?range=7d|30d|90d|1y          — overview + monthlyData + topProducts
 *   GET  /api/admin/business-intelligence?range=...      — revenue/mrr/CLV/professionStats
 *   GET  /api/admin/reports/export?format=csv|xlsx|pdf   — CSV-stub eller 501 for PDF/XLSX
 *
 * UI-shape (forventet av ReportsPanel.tsx):
 *   reports → { overview: { totalRevenue, totalProjects, totalUsers,
 *                averageProjectValue, growthRate, topProfession },
 *               monthlyData: [{ month, revenue, projects, users }],
 *               // bonus (task-spec):
 *               summary, byPeriod, topProducts }
 *   bi → { professionStats: [{ profession, users, projects, revenue, growthRate }],
 *          revenue, customerLifetimeValue, churnRate, mrr,
 *          acquisitionByChannel, retentionCohorts }
 *
 * Alle krever requireAdminSession. Defensiv mot manglende kolonner/tabeller.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminReportsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Defensive schema helpers (samme mønster som admin-customers-routes) ──
async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_name = $1
            AND table_schema = 'public'
       ) AS exists`,
      [table],
    );
    return Boolean(r.rows[0]?.exists);
  } catch {
    return false;
  }
}

async function columnsOf(pool: Pool, table: string): Promise<Set<string>> {
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = $1
          AND table_schema = 'public'`,
      [table],
    );
    return new Set(r.rows.map((row) => row.column_name));
  } catch {
    return new Set();
  }
}

interface RangeSpec {
  raw: string;
  days: number;
  // ISO-strings — periodEnd er nå, periodStart er nå - days, previousStart er
  // nå - 2*days (brukes for delta-beregning).
  periodStart: Date;
  periodEnd: Date;
  previousStart: Date;
}

function parseRange(value: unknown): RangeSpec {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "30d";
  const map: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
    "1y": 365,
  };
  const days = map[raw] ?? 30;
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - days * 86_400_000);
  const previousStart = new Date(now.getTime() - 2 * days * 86_400_000);
  return { raw, days, periodStart, periodEnd, previousStart };
}

function nokRound(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function monthLabel(d: Date): string {
  // "jan 2026"
  return d.toLocaleString("nb-NO", { month: "short", year: "numeric" });
}

/**
 * Aggregert revenue. Bruker `payments`-tabellen (status=completed/succeeded)
 * hvis den finnes — ellers 0. Defensiv mot manglende kolonner.
 */
async function aggregateRevenue(
  pool: Pool,
  from: Date,
  to: Date,
): Promise<number> {
  if (!(await tableExists(pool, "payments"))) return 0;
  const cols = await columnsOf(pool, "payments");
  if (!cols.has("amount")) return 0;
  const dateCol = cols.has("payment_date")
    ? "payment_date"
    : cols.has("processed_at")
      ? "processed_at"
      : cols.has("created_at")
        ? "created_at"
        : null;
  if (!dateCol) return 0;
  const statusFilter = cols.has("status")
    ? "AND COALESCE(status, '') IN ('completed', 'succeeded', 'paid', 'success')"
    : "";
  try {
    const r = await pool.query<{ s: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS s
         FROM payments
        WHERE ${dateCol} >= $1
          AND ${dateCol} <  $2
          ${statusFilter}`,
      [from.toISOString(), to.toISOString()],
    );
    return nokRound(Number(r.rows[0]?.s ?? 0));
  } catch (err) {
    console.warn("[admin-reports] revenue agg failed:", err);
    return 0;
  }
}

async function countUsersInRange(
  pool: Pool,
  from: Date,
  to: Date,
): Promise<number> {
  if (!(await tableExists(pool, "users"))) return 0;
  const cols = await columnsOf(pool, "users");
  if (!cols.has("created_at")) {
    // Faller tilbake til total-count hvis vi ikke har created_at.
    try {
      const r = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM users`,
      );
      return Number(r.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM users
        WHERE created_at >= $1 AND created_at < $2`,
      [from.toISOString(), to.toISOString()],
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (err) {
    console.warn("[admin-reports] users count failed:", err);
    return 0;
  }
}

async function countTotalUsers(pool: Pool): Promise<number> {
  if (!(await tableExists(pool, "users"))) return 0;
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM users`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

async function countProjectsInRange(
  pool: Pool,
  from: Date,
  to: Date,
): Promise<number> {
  let total = 0;
  for (const t of ["casting_projects", "photographer_client_galleries", "projects"]) {
    if (!(await tableExists(pool, t))) continue;
    const cols = await columnsOf(pool, t);
    const dateCol = cols.has("created_at")
      ? "created_at"
      : cols.has("createdAt")
        ? "createdAt"
        : null;
    try {
      if (dateCol) {
        const r = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n
             FROM ${t}
            WHERE ${dateCol} >= $1 AND ${dateCol} < $2`,
          [from.toISOString(), to.toISOString()],
        );
        total += Number(r.rows[0]?.n ?? 0);
      } else {
        const r = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM ${t}`,
        );
        total += Number(r.rows[0]?.n ?? 0);
      }
    } catch (err) {
      console.warn(`[admin-reports] project count failed for ${t}:`, err);
    }
  }
  return total;
}

async function countActiveSubscriptions(pool: Pool): Promise<number> {
  if (!(await tableExists(pool, "subscriptions"))) return 0;
  const cols = await columnsOf(pool, "subscriptions");
  const statusFilter = cols.has("status")
    ? "WHERE COALESCE(status, '') IN ('active', 'trialing')"
    : "";
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM subscriptions ${statusFilter}`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (err) {
    console.warn("[admin-reports] active subs failed:", err);
    return 0;
  }
}

/**
 * Beregner MRR: SUM(amount) fra aktive subscriptions normalisert til måned.
 * billing_cycle: monthly = amount, yearly = amount/12, weekly = amount*4.33.
 */
async function calculateMrr(pool: Pool): Promise<number> {
  if (!(await tableExists(pool, "subscriptions"))) return 0;
  const cols = await columnsOf(pool, "subscriptions");
  if (!cols.has("amount")) return 0;
  const statusFilter = cols.has("status")
    ? "WHERE COALESCE(status, '') IN ('active', 'trialing')"
    : "";
  try {
    const r = await pool.query<{ amount: string | null; cycle: string | null }>(
      `SELECT amount::text AS amount,
              ${cols.has("billing_cycle") ? "billing_cycle" : "NULL::text"} AS cycle
         FROM subscriptions
         ${statusFilter}`,
    );
    let mrr = 0;
    for (const row of r.rows) {
      const a = Number(row.amount ?? 0);
      if (!Number.isFinite(a)) continue;
      const c = String(row.cycle ?? "monthly").toLowerCase();
      if (c.startsWith("year") || c === "annual" || c === "annually") {
        mrr += a / 12;
      } else if (c.startsWith("week")) {
        mrr += a * 4.33;
      } else {
        mrr += a;
      }
    }
    return nokRound(mrr);
  } catch (err) {
    console.warn("[admin-reports] mrr calc failed:", err);
    return 0;
  }
}

/**
 * Lag månedlig trendlinje for `range.days` siste dager, bucket'et per måned.
 * Returnerer nyeste først.
 */
async function buildMonthlyTrend(
  pool: Pool,
  range: RangeSpec,
): Promise<Array<{ month: string; revenue: number; projects: number; users: number }>> {
  // Bestem antall måneder å vise basert på range.
  const monthsBack = Math.max(1, Math.ceil(range.days / 30));
  const buckets: Array<{ month: string; from: Date; to: Date }> = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: monthLabel(from), from, to });
  }

  const out: Array<{ month: string; revenue: number; projects: number; users: number }> = [];
  for (const b of buckets) {
    const [revenue, projects, users] = await Promise.all([
      aggregateRevenue(pool, b.from, b.to),
      countProjectsInRange(pool, b.from, b.to),
      countUsersInRange(pool, b.from, b.to),
    ]);
    out.push({ month: b.month, revenue, projects, users });
  }
  return out;
}

/**
 * Profesjonsbidrag: SUM users/projects/revenue per profession.
 * Bruker `users.profession`. Revenue aggregates fra payments.user_id → users.profession.
 */
async function buildProfessionStats(
  pool: Pool,
  range: RangeSpec,
): Promise<Array<{ profession: string; users: number; projects: number; revenue: number; growthRate: number }>> {
  if (!(await tableExists(pool, "users"))) return [];
  const userCols = await columnsOf(pool, "users");
  if (!userCols.has("profession")) return [];

  // 1) users per profession (totalt, ikke per range — tidsserie gir lite mening når
  //    de fleste users er gamle).
  const byProfession = new Map<
    string,
    { users: number; projects: number; revenue: number; previousRevenue: number }
  >();
  try {
    const r = await pool.query<{ profession: string | null; n: string }>(
      `SELECT COALESCE(profession, 'unknown') AS profession,
              COUNT(*)::text AS n
         FROM users
        GROUP BY COALESCE(profession, 'unknown')`,
    );
    for (const row of r.rows) {
      const p = row.profession ?? "unknown";
      const existing = byProfession.get(p) ?? {
        users: 0,
        projects: 0,
        revenue: 0,
        previousRevenue: 0,
      };
      existing.users = Number(row.n ?? 0);
      byProfession.set(p, existing);
    }
  } catch (err) {
    console.warn("[admin-reports] profession users failed:", err);
  }

  // 2) projects per profession — join via casting_projects.created_by → users.id (når mulig).
  for (const t of ["casting_projects", "photographer_client_galleries", "projects"]) {
    if (!(await tableExists(pool, t))) continue;
    const cols = await columnsOf(pool, t);
    const userCol = cols.has("created_by")
      ? "created_by"
      : cols.has("photographer_id")
        ? "photographer_id"
        : cols.has("user_id")
          ? "user_id"
          : null;
    if (!userCol) continue;
    try {
      const r = await pool.query<{ profession: string | null; n: string }>(
        `SELECT COALESCE(u.profession, 'unknown') AS profession,
                COUNT(*)::text AS n
           FROM ${t} p
           LEFT JOIN users u ON u.id::text = p.${userCol}::text
          GROUP BY COALESCE(u.profession, 'unknown')`,
      );
      for (const row of r.rows) {
        const p = row.profession ?? "unknown";
        const existing = byProfession.get(p) ?? {
          users: 0,
          projects: 0,
          revenue: 0,
          previousRevenue: 0,
        };
        existing.projects += Number(row.n ?? 0);
        byProfession.set(p, existing);
      }
    } catch (err) {
      console.warn(`[admin-reports] projects-by-profession failed for ${t}:`, err);
    }
  }

  // 3) revenue per profession (current + previous period) — join payments.user_id → users.
  if (await tableExists(pool, "payments")) {
    const payCols = await columnsOf(pool, "payments");
    const dateCol = payCols.has("payment_date")
      ? "payment_date"
      : payCols.has("processed_at")
        ? "processed_at"
        : payCols.has("created_at")
          ? "created_at"
          : null;
    if (payCols.has("amount") && payCols.has("user_id") && dateCol) {
      const statusFilter = payCols.has("status")
        ? "AND COALESCE(p.status, '') IN ('completed', 'succeeded', 'paid', 'success')"
        : "";
      const fetchPeriod = async (from: Date, to: Date) => {
        try {
          const r = await pool.query<{ profession: string | null; s: string | null }>(
            `SELECT COALESCE(u.profession, 'unknown') AS profession,
                    COALESCE(SUM(p.amount), 0)::text AS s
               FROM payments p
               LEFT JOIN users u ON u.id::text = p.user_id::text
              WHERE p.${dateCol} >= $1 AND p.${dateCol} < $2
                ${statusFilter}
              GROUP BY COALESCE(u.profession, 'unknown')`,
            [from.toISOString(), to.toISOString()],
          );
          return r.rows;
        } catch (err) {
          console.warn("[admin-reports] revenue-by-profession failed:", err);
          return [];
        }
      };

      const current = await fetchPeriod(range.periodStart, range.periodEnd);
      for (const row of current) {
        const p = row.profession ?? "unknown";
        const existing = byProfession.get(p) ?? {
          users: 0,
          projects: 0,
          revenue: 0,
          previousRevenue: 0,
        };
        existing.revenue = nokRound(Number(row.s ?? 0));
        byProfession.set(p, existing);
      }
      const previous = await fetchPeriod(range.previousStart, range.periodStart);
      for (const row of previous) {
        const p = row.profession ?? "unknown";
        const existing = byProfession.get(p) ?? {
          users: 0,
          projects: 0,
          revenue: 0,
          previousRevenue: 0,
        };
        existing.previousRevenue = nokRound(Number(row.s ?? 0));
        byProfession.set(p, existing);
      }
    }
  }

  const out: Array<{
    profession: string;
    users: number;
    projects: number;
    revenue: number;
    growthRate: number;
  }> = [];
  for (const [profession, v] of byProfession.entries()) {
    const growthRate =
      v.previousRevenue > 0
        ? Math.round(((v.revenue - v.previousRevenue) / v.previousRevenue) * 100)
        : v.revenue > 0
          ? 100
          : 0;
    out.push({
      profession,
      users: v.users,
      projects: v.projects,
      revenue: v.revenue,
      growthRate,
    });
  }
  // Topp-omsetning først.
  out.sort((a, b) => b.revenue - a.revenue || b.users - a.users);
  return out;
}

/**
 * Top-produkter: SUM revenue per plan_type fra subscriptions, eller per
 * payment_type fra payments hvis subscriptions er tom.
 */
async function buildTopProducts(
  pool: Pool,
  range: RangeSpec,
): Promise<Array<{ name: string; revenue: number; units: number }>> {
  const out: Array<{ name: string; revenue: number; units: number }> = [];

  if (await tableExists(pool, "subscriptions")) {
    const cols = await columnsOf(pool, "subscriptions");
    if (cols.has("plan_type") && cols.has("amount")) {
      const statusFilter = cols.has("status")
        ? "WHERE COALESCE(status, '') IN ('active', 'trialing')"
        : "";
      try {
        const r = await pool.query<{ name: string; s: string; n: string }>(
          `SELECT COALESCE(plan_type, 'unknown') AS name,
                  COALESCE(SUM(amount), 0)::text AS s,
                  COUNT(*)::text AS n
             FROM subscriptions
             ${statusFilter}
            GROUP BY COALESCE(plan_type, 'unknown')
            ORDER BY SUM(amount) DESC NULLS LAST
            LIMIT 10`,
        );
        for (const row of r.rows) {
          out.push({
            name: String(row.name ?? "unknown"),
            revenue: nokRound(Number(row.s ?? 0)),
            units: Number(row.n ?? 0),
          });
        }
      } catch (err) {
        console.warn("[admin-reports] subscriptions top-products failed:", err);
      }
    }
  }

  if (out.length === 0 && (await tableExists(pool, "payments"))) {
    const cols = await columnsOf(pool, "payments");
    if (cols.has("payment_type") && cols.has("amount")) {
      const dateCol = cols.has("payment_date")
        ? "payment_date"
        : cols.has("created_at")
          ? "created_at"
          : null;
      const dateFilter = dateCol
        ? `WHERE ${dateCol} >= $1 AND ${dateCol} < $2`
        : "";
      const params = dateCol
        ? [range.periodStart.toISOString(), range.periodEnd.toISOString()]
        : [];
      try {
        const r = await pool.query<{ name: string; s: string; n: string }>(
          `SELECT COALESCE(payment_type, 'unknown') AS name,
                  COALESCE(SUM(amount), 0)::text AS s,
                  COUNT(*)::text AS n
             FROM payments
             ${dateFilter}
            GROUP BY COALESCE(payment_type, 'unknown')
            ORDER BY SUM(amount) DESC NULLS LAST
            LIMIT 10`,
          params,
        );
        for (const row of r.rows) {
          out.push({
            name: String(row.name ?? "unknown"),
            revenue: nokRound(Number(row.s ?? 0)),
            units: Number(row.n ?? 0),
          });
        }
      } catch (err) {
        console.warn("[admin-reports] payments top-products failed:", err);
      }
    }
  }
  return out;
}

export function setupAdminReportsRoutes(deps: AdminReportsRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  // ── GET /api/admin/reports?range=30d ─────────────────────────────
  // Returnerer både UI-shape (overview + monthlyData) og task-spec-shape
  // (summary + byPeriod + topProducts), slik at begge fungerer.
  app.get("/api/admin/reports", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const range = parseRange(req.query.range);

      const [
        totalRevenue,
        previousRevenue,
        totalUsers,
        totalProjects,
        activeSubscriptions,
        monthlyData,
        topProducts,
        professionStats,
      ] = await Promise.all([
        aggregateRevenue(pool, range.periodStart, range.periodEnd),
        aggregateRevenue(pool, range.previousStart, range.periodStart),
        countTotalUsers(pool),
        countProjectsInRange(pool, range.periodStart, range.periodEnd),
        countActiveSubscriptions(pool),
        buildMonthlyTrend(pool, range),
        buildTopProducts(pool, range),
        buildProfessionStats(pool, range),
      ]);

      const totalCustomers = totalUsers;
      const growthRate =
        previousRevenue > 0
          ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
          : totalRevenue > 0
            ? 100
            : 0;
      const averageProjectValue =
        totalProjects > 0 ? nokRound(totalRevenue / totalProjects) : 0;
      const topProfession = professionStats[0]?.profession || "professional";

      res.json({
        // UI-shape (ReportsPanel.tsx)
        overview: {
          totalRevenue,
          totalProjects,
          totalUsers,
          averageProjectValue,
          growthRate,
          topProfession,
        },
        monthlyData,
        // task-spec-shape (bonus — bakoverkompatibelt for nye konsumenter)
        summary: {
          totalRevenue,
          totalCustomers,
          totalProjects,
          activeSubscriptions,
        },
        byPeriod: monthlyData,
        topProducts,
        range: range.raw,
      });
    } catch (err) {
      console.error("[admin-reports] /api/admin/reports failed:", err);
      res.status(500).json({ error: "admin_reports_failed" });
    }
  });

  // ── GET /api/admin/business-intelligence?range=30d ───────────────
  app.get("/api/admin/business-intelligence", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const range = parseRange(req.query.range);

      const [currentRevenue, previousRevenue, mrr, professionStats, totalUsers] =
        await Promise.all([
          aggregateRevenue(pool, range.periodStart, range.periodEnd),
          aggregateRevenue(pool, range.previousStart, range.periodStart),
          calculateMrr(pool),
          buildProfessionStats(pool, range),
          countTotalUsers(pool),
        ]);

      const delta =
        previousRevenue > 0
          ? Math.round(
              ((currentRevenue - previousRevenue) / previousRevenue) * 100,
            )
          : currentRevenue > 0
            ? 100
            : 0;

      const customerLifetimeValue =
        totalUsers > 0 ? nokRound(currentRevenue / totalUsers) : 0;

      // Churn rate: regn ut fra subscription_change_history hvis tilgjengelig,
      // ellers 0 (vi har ikke nok signal i utviklingsmiljø).
      let churnRate = 0;
      if (await tableExists(pool, "subscription_change_history")) {
        const cols = await columnsOf(pool, "subscription_change_history");
        const dateCol = cols.has("created_at")
          ? "created_at"
          : cols.has("changed_at")
            ? "changed_at"
            : null;
        if (dateCol && cols.has("new_status")) {
          try {
            const [cancelRows, activeRows] = await Promise.all([
              pool.query<{ n: string }>(
                `SELECT COUNT(*)::text AS n
                   FROM subscription_change_history
                  WHERE ${dateCol} >= $1 AND ${dateCol} < $2
                    AND new_status IN ('canceled', 'cancelled')`,
                [range.periodStart.toISOString(), range.periodEnd.toISOString()],
              ),
              pool.query<{ n: string }>(
                `SELECT COUNT(*)::text AS n FROM subscriptions
                  WHERE COALESCE(status, '') IN ('active', 'trialing')`,
              ),
            ]);
            const canceled = Number(cancelRows.rows[0]?.n ?? 0);
            const active = Number(activeRows.rows[0]?.n ?? 0);
            if (active > 0) {
              churnRate = Math.round((canceled / active) * 1000) / 10;
            }
          } catch (err) {
            console.warn("[admin-reports] churn calc failed:", err);
          }
        }
      }

      res.json({
        // UI-shape (ReportsPanel.tsx → BiResponse.professionStats)
        professionStats,
        // task-spec-shape (bonus)
        revenue: {
          current: currentRevenue,
          previousPeriod: previousRevenue,
          delta,
        },
        customerLifetimeValue,
        churnRate,
        mrr,
        acquisitionByChannel: [],
        retentionCohorts: [],
        range: range.raw,
      });
    } catch (err) {
      console.error("[admin-reports] /api/admin/business-intelligence failed:", err);
      res.status(500).json({ error: "admin_business_intelligence_failed" });
    }
  });

  // ── GET /api/admin/reports/export?format=csv|xlsx|pdf ────────────
  // CSV-stub er funksjonell — XLSX/PDF returnerer 501 (rendring krever
  // dedikerte avhengigheter som tilhører eget PR).
  app.get("/api/admin/reports/export", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      const format = typeof req.query.format === "string"
        ? req.query.format.toLowerCase()
        : "csv";
      const range = parseRange(req.query.range);

      if (format !== "csv") {
        return res.status(501).json({
          error: "export_not_implemented",
          message: `Export format '${format}' is not implemented yet`,
          supportedFormats: ["csv"],
        });
      }

      // Bygg en minimal CSV med samme aggregater som /reports.
      const [totalRevenue, totalUsers, totalProjects, activeSubscriptions, monthly] =
        await Promise.all([
          aggregateRevenue(pool, range.periodStart, range.periodEnd),
          countTotalUsers(pool),
          countProjectsInRange(pool, range.periodStart, range.periodEnd),
          countActiveSubscriptions(pool),
          buildMonthlyTrend(pool, range),
        ]);

      const lines: string[] = [];
      lines.push("section,key,value");
      lines.push(`summary,range,${range.raw}`);
      lines.push(`summary,totalRevenue,${totalRevenue}`);
      lines.push(`summary,totalCustomers,${totalUsers}`);
      lines.push(`summary,totalProjects,${totalProjects}`);
      lines.push(`summary,activeSubscriptions,${activeSubscriptions}`);
      lines.push("");
      lines.push("monthly,month,revenue,projects,users");
      for (const m of monthly) {
        lines.push(`monthly,${m.month},${m.revenue},${m.projects},${m.users}`);
      }
      const csv = lines.join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="admin-reports-${range.raw}.csv"`,
      );
      res.status(200).send(csv);
    } catch (err) {
      console.error("[admin-reports] export failed:", err);
      res.status(500).json({ error: "admin_reports_export_failed" });
    }
  });
}
