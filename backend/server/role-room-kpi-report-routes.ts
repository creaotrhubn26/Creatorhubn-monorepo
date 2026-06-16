/**
 * role-room-kpi-report-routes.ts
 *
 * Periode-rapport (uke / måned / kvartal) over KPI-er per kanal, basert på
 * role_room_kpi_snapshots (plan → prosjekt-scoped). Samme rapport for BÅDE
 * innholdsmarkedsføreren (produsent-session) OG klienten (portal-token), med
 * kanal-indikasjon og endring mot forrige periode.
 *
 *   GET /api/role-room/kpi-report?projectId=&period=&channel=   (produsent)
 *   GET /api/client/portal/kpi-report?token=&period=&channel=   (klient)
 */

import type express from "express";
import type { Pool } from "pg";
import { resolveClientPortalSession } from "./role-room-client-portal";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomKpiReportRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type Period = "week" | "month" | "quarter";

interface MetricTriplet { value: number; prevValue: number; deltaPct: number | null }

const MONTHS_NB = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

function periodLabel(period: Period): string {
  const now = new Date();
  if (period === "month") return `${MONTHS_NB[now.getMonth()]} ${now.getFullYear()}`;
  if (period === "quarter") return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  // week: start (mandag) – nå
  const day = (now.getDay() + 6) % 7; // 0 = mandag
  const start = new Date(now); start.setDate(now.getDate() - day);
  return `${start.getDate()}.–${now.getDate()}. ${MONTHS_NB[now.getMonth()]}`;
}

function deltaPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

interface KpiReport {
  period: Period;
  periodLabel: string;
  channel: string;
  channels: string[];
  metrics: { visninger: MetricTriplet; rekkevidde: MetricTriplet; engasjement: MetricTriplet; reaksjoner: MetricTriplet };
  byChannel: Array<{ platform: string; visninger: number; engasjement: number }>;
  hasData: boolean;
}

async function buildKpiReport(
  pool: Pool,
  opts: { projectId: string; period: Period; channel: string | null; ownerUserId?: string | null },
): Promise<KpiReport> {
  const { projectId, period, channel } = opts;
  const interval = period === "week" ? "7 days" : period === "month" ? "1 month" : "3 months";
  const params: unknown[] = [projectId, period, interval];
  let extra = "";
  if (channel) { params.push(channel); extra += ` AND s.platform = $${params.length}`; }
  if (opts.ownerUserId) { params.push(opts.ownerUserId); extra += ` AND p.owner_user_id = $${params.length}`; }

  const sql = `
    WITH bounds AS (
      SELECT date_trunc($2, now()) AS cur_start,
             date_trunc($2, now()) - $3::interval AS prev_start
    )
    SELECT s.platform, s.metric,
           COALESCE(SUM(s.value) FILTER (WHERE s.captured_at >= b.cur_start), 0) AS cur_val,
           COALESCE(SUM(s.value) FILTER (WHERE s.captured_at >= b.prev_start AND s.captured_at < b.cur_start), 0) AS prev_val
      FROM role_room_kpi_snapshots s
      JOIN role_room_marketing_plans p ON p.id = s.plan_id
      CROSS JOIN bounds b
     WHERE p.project_id = $1
       AND s.captured_at >= b.prev_start${extra}
     GROUP BY s.platform, s.metric`;

  let rows: Array<{ platform: string; metric: string; cur_val: number; prev_val: number }> = [];
  try {
    const r = await pool.query(sql, params);
    rows = r.rows.map((x) => ({ platform: String(x.platform), metric: String(x.metric), cur_val: Number(x.cur_val) || 0, prev_val: Number(x.prev_val) || 0 }));
  } catch (err) {
    console.error("[kpi-report] query failed", err);
  }

  const sumBy = (metrics: string[], field: "cur_val" | "prev_val"): number =>
    rows.filter((r) => metrics.includes(r.metric)).reduce((a, r) => a + r[field], 0);

  // Visninger = impressions (fallback reach); Engasjement = engagement
  // (fallback likes+comments+shares+saves); Rekkevidde = reach; Reaksjoner = likes.
  const impCur = sumBy(["impressions"], "cur_val") || sumBy(["reach"], "cur_val");
  const impPrev = sumBy(["impressions"], "prev_val") || sumBy(["reach"], "prev_val");
  const engCur = sumBy(["engagement"], "cur_val") || sumBy(["likes", "comments", "shares", "saves"], "cur_val");
  const engPrev = sumBy(["engagement"], "prev_val") || sumBy(["likes", "comments", "shares", "saves"], "prev_val");
  const reachCur = sumBy(["reach"], "cur_val");
  const reachPrev = sumBy(["reach"], "prev_val");
  const likesCur = sumBy(["likes"], "cur_val");
  const likesPrev = sumBy(["likes"], "prev_val");

  const mt = (cur: number, prev: number): MetricTriplet => ({ value: cur, prevValue: prev, deltaPct: deltaPct(cur, prev) });

  const platforms = Array.from(new Set(rows.filter((r) => r.cur_val > 0).map((r) => r.platform)));
  const byChannel = platforms.map((platform) => {
    const pr = rows.filter((r) => r.platform === platform);
    const v = pr.filter((r) => ["impressions", "reach"].includes(r.metric)).reduce((a, r) => a + r.cur_val, 0);
    const e = (pr.filter((r) => r.metric === "engagement").reduce((a, r) => a + r.cur_val, 0))
      || pr.filter((r) => ["likes", "comments", "shares", "saves"].includes(r.metric)).reduce((a, r) => a + r.cur_val, 0);
    return { platform, visninger: v, engasjement: e };
  });

  return {
    period,
    periodLabel: periodLabel(period),
    channel: channel || "alle",
    channels: platforms,
    metrics: { visninger: mt(impCur, impPrev), rekkevidde: mt(reachCur, reachPrev), engasjement: mt(engCur, engPrev), reaksjoner: mt(likesCur, likesPrev) },
    byChannel,
    hasData: rows.some((r) => r.cur_val > 0),
  };
}

function parsePeriod(v: unknown): Period {
  return v === "month" || v === "quarter" ? v : v === "week" ? "week" : "month";
}

export function setupRoleRoomKpiReportRoutes(deps: RoleRoomKpiReportRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── Produsent ────────────────────────────────────────────────────────
  app.get("/api/role-room/kpi-report", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim() ? req.query.projectId.trim() : null;
    if (!projectId) return res.status(400).json({ error: "projectId kreves" });
    const period = parsePeriod(req.query.period);
    const channel = typeof req.query.channel === "string" && req.query.channel.trim() && req.query.channel !== "alle" ? req.query.channel.trim() : null;
    try {
      const report = await buildKpiReport(pool, { projectId, period, channel, ownerUserId: session.userId });
      return res.json({ report });
    } catch (err) {
      console.error("[kpi-report producer] failed", err);
      return res.status(500).json({ error: "Klarte ikke å bygge rapport" });
    }
  });

  // ── Klient (portal-token) ────────────────────────────────────────────
  app.get("/api/client/portal/kpi-report", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const portalSession = await resolveClientPortalSession(pool, token);
    if (!portalSession) return res.status(404).json({ error: "invalid_or_expired_token" });
    const period = parsePeriod(req.query.period);
    const channel = typeof req.query.channel === "string" && req.query.channel.trim() && req.query.channel !== "alle" ? req.query.channel.trim() : null;
    try {
      const report = await buildKpiReport(pool, { projectId: portalSession.projectId, period, channel });
      return res.json({ report });
    } catch (err) {
      console.error("[kpi-report client] failed", err);
      return res.status(500).json({ error: "Klarte ikke å bygge rapport" });
    }
  });
}
