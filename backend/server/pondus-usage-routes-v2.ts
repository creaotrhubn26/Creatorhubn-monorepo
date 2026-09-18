import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  assertPondusEntitled,
  canViewPondusAnalytics,
  isPondusTemplateVisible,
  resolvePondusAccess,
  sendPondusAccessError,
  type PondusAccessContext,
  type PondusSession,
} from "./pondus-access.js";

export interface PondusUsageRoutesV2Deps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => PondusSession | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = new Set(["used", "meeting_booked", "proposal_sent", "won", "lost", "no_answer"]);
const SOURCES = new Set(["ipad", "watch", "siri"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function accessFor(
  pool: Pool, req: Request, res: Response, session: PondusSession,
): Promise<PondusAccessContext | null> {
  try {
    const access = await resolvePondusAccess(pool, req, session);
    return await assertPondusEntitled(pool, access, res) ? access : null;
  } catch (error) {
    if (sendPondusAccessError(res, error)) return null;
    throw error;
  }
}

async function validateLeadScope(pool: Pool, leadId: string, organizationId: string | null) {
  if (!organizationId) return false;
  const result = await pool.query(
    `SELECT c.id
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id=c.project_id
      WHERE c.id=$1::uuid
        AND COALESCE(c.organization_id::text, cp.organization_id::text)=$2
      LIMIT 1`,
    [leadId, organizationId],
  );
  return result.rows.length > 0;
}

export function registerPondusUsageRoutesV2(deps: PondusUsageRoutesV2Deps): void {
  const { app, pool, requireUserSession } = deps;

  app.post("/api/leadgrid/pondus/templates/:id/usage", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = text(req.params.id);
    const usageSessionId = text(req.body?.usage_session_id ?? req.body?.usageSessionId);
    const outcome = text(req.body?.outcome) || "used";
    const leadId = text(req.body?.lead_id ?? req.body?.leadId) || null;
    const source = text(req.body?.source) || "ipad";
    const issues = [
      ...(!UUID.test(templateId) ? [{ path: "template_id", message: "Ugyldig mal-ID." }] : []),
      ...(!UUID.test(usageSessionId) ? [{ path: "usage_session_id", message: "En gyldig bruksøkt-ID er påkrevd." }] : []),
      ...(!OUTCOMES.has(outcome) ? [{ path: "outcome", message: "Ugyldig utfall." }] : []),
      ...(leadId && !UUID.test(leadId) ? [{ path: "lead_id", message: "Ugyldig lead-ID." }] : []),
      ...(!SOURCES.has(source) ? [{ path: "source", message: "Ugyldig kilde." }] : []),
    ];
    if (issues.length) return res.status(400).json({ error: "validation_failed", issues });
    try {
      const access = await accessFor(pool, req, res, session);
      if (!access) return;
      if (!access.organizationId) return res.status(400).json({ error: "organization_required" });
      if (!(await isPondusTemplateVisible(pool, templateId, access))) {
        return res.status(404).json({ error: "not_found" });
      }
      if (leadId && !(await validateLeadScope(pool, leadId, access.organizationId))) {
        return res.status(404).json({ error: "lead_not_found" });
      }

      if (outcome === "used") {
        const inserted = await pool.query(
          `INSERT INTO pondus_template_usage
            (usage_session_id, template_id, organization_id, user_id, lead_id, outcome, source)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'used',$6)
           ON CONFLICT (usage_session_id) DO NOTHING
           RETURNING id, usage_session_id, used_at, outcome`,
          [usageSessionId, templateId, access.organizationId, session.userId, leadId, source],
        );
        if (inserted.rows[0]) {
          return res.status(201).json({ usage: inserted.rows[0], idempotent: false });
        }
        const existing = await pool.query(
          `SELECT id, usage_session_id, used_at, outcome FROM pondus_template_usage
            WHERE usage_session_id=$1::uuid AND template_id=$2::uuid
              AND organization_id=$3 AND user_id=$4 LIMIT 1`,
          [usageSessionId, templateId, access.organizationId, session.userId],
        );
        if (!existing.rows[0]) return res.status(409).json({ error: "usage_session_conflict" });
        return res.status(200).json({ usage: existing.rows[0], idempotent: true });
      }

      const updated = await pool.query(
        `UPDATE pondus_template_usage
            SET outcome=$1, lead_id=COALESCE($2::uuid,lead_id),
                outcome_updated_at=NOW()
          WHERE usage_session_id=$3::uuid AND template_id=$4::uuid
            AND organization_id=$5 AND user_id=$6
          RETURNING id, usage_session_id, used_at, outcome`,
        [outcome, leadId, usageSessionId, templateId, access.organizationId, session.userId],
      );
      if (updated.rows[0]) return res.json({ usage: updated.rows[0], idempotent: true });

      // Et kort reconnect-vindu kan levere utfallet før den kølagte
      // "used"-handlingen. Opprett da samme eksakte økt direkte. Den senere
      // start-handlingen blir en idempotent no-op og overskriver ikke utfallet.
      const insertedOutcome = await pool.query(
        `INSERT INTO pondus_template_usage
          (usage_session_id, template_id, organization_id, user_id, lead_id,
           outcome, source, outcome_updated_at)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7,NOW())
         ON CONFLICT (usage_session_id) DO NOTHING
         RETURNING id, usage_session_id, used_at, outcome`,
        [usageSessionId, templateId, access.organizationId, session.userId, leadId, outcome, source],
      );
      if (insertedOutcome.rows[0]) {
        return res.status(201).json({ usage: insertedOutcome.rows[0], idempotent: false });
      }
      return res.status(409).json({ error: "usage_session_conflict" });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-usage-v2] write failed:", error);
      return res.status(500).json({ error: "pondus_usage_failed" });
    }
  });

  app.get("/api/leadgrid/pondus/usage/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const access = await accessFor(pool, req, res, session);
      if (!access) return;
      if (!access.organizationId) return res.status(400).json({ error: "organization_required" });
      const period = text(req.query.period);
      const periodDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
      const since = period === "ytd"
        ? "date_trunc('year',NOW())"
        : periodDays[period] ? `NOW() - INTERVAL '${periodDays[period]} days'` : null;
      const perTemplate = await pool.query(
        `SELECT template_id::text,
                COUNT(*)::int AS used_total,
                COUNT(*) FILTER (WHERE used_at::date=CURRENT_DATE)::int AS used_today,
                COUNT(*) FILTER (WHERE used_at>NOW()-INTERVAL '30 days')::int AS used_30d,
                COUNT(*) FILTER (WHERE outcome IN ('meeting_booked','won'))::int AS meetings,
                COUNT(*) FILTER (WHERE outcome!='used')::int AS known_outcomes,
                COUNT(*) FILTER (WHERE outcome!='used' AND outcome!='no_answer')::int AS responded,
                COUNT(*) FILTER (WHERE outcome='won')::int AS won,
                COUNT(*) FILTER (WHERE outcome IN ('won','lost'))::int AS decided
           FROM pondus_template_usage
          WHERE organization_id=$1 ${since ? `AND used_at>=${since}` : ""}
          GROUP BY template_id`, [access.organizationId],
      );
      const totals = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE used_at::date=CURRENT_DATE)::int AS used_today,
                COUNT(*) FILTER (WHERE used_at>NOW()-INTERVAL '30 days')::int AS used_30d,
                COUNT(DISTINCT user_id) FILTER (WHERE used_at>NOW()-INTERVAL '30 days')::int AS distinct_users_30d,
                COUNT(*) FILTER (WHERE outcome IN ('meeting_booked','won')
                                  AND used_at>NOW()-INTERVAL '30 days')::int AS meetings_30d
           FROM pondus_template_usage WHERE organization_id=$1`, [access.organizationId],
      );
      const ratio = (a: unknown, b: unknown) => Number(b) > 0
        ? Math.round((Number(a) / Number(b)) * 100) / 100 : 0;
      const total = totals.rows[0] ?? {};
      return res.json({
        templates: perTemplate.rows.map((row) => ({
          template_id: String(row.template_id), used_total: Number(row.used_total),
          used_today: Number(row.used_today), used_30d: Number(row.used_30d),
          meeting_rate: ratio(row.meetings, row.used_total),
          response_rate: ratio(row.responded, row.known_outcomes),
          conversion_rate: ratio(row.won, row.decided),
        })),
        totals: {
          used_today: Number(total.used_today ?? 0), used_30d: Number(total.used_30d ?? 0),
          distinct_users_30d: Number(total.distinct_users_30d ?? 0),
          meeting_rate_30d: ratio(total.meetings_30d, total.used_30d),
        },
      });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-usage-v2] stats failed:", error);
      return res.status(500).json({ error: "pondus_usage_stats_failed" });
    }
  });

  app.get("/api/leadgrid/pondus/templates/:id/usage-detail", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const templateId = text(req.params.id);
    if (!UUID.test(templateId)) return res.status(400).json({ error: "invalid_template_id" });
    try {
      const access = await accessFor(pool, req, res, session);
      if (!access) return;
      if (!access.organizationId) return res.status(400).json({ error: "organization_required" });
      if (!canViewPondusAnalytics(access)) {
        return res.status(403).json({ error: "analytics_permission_required" });
      }
      if (!(await isPondusTemplateVisible(pool, templateId, access, { includeDraftForManagers: true }))) {
        return res.status(404).json({ error: "not_found" });
      }
      const outcomes = await pool.query(
        `SELECT outcome, COUNT(*)::int AS n FROM pondus_template_usage
          WHERE template_id=$1::uuid AND organization_id=$2 GROUP BY outcome`,
        [templateId, access.organizationId],
      );
      const bySeller = await pool.query(
        `SELECT u.id AS user_id,
                COALESCE(NULLIF(TRIM(u.first_name||' '||COALESCE(u.last_name,'')),''),u.username,u.email) AS name,
                COUNT(*)::int AS used,
                COUNT(*) FILTER (WHERE pu.outcome IN ('meeting_booked','won'))::int AS meetings
           FROM pondus_template_usage pu JOIN users u ON u.id=pu.user_id
          WHERE pu.template_id=$1::uuid AND pu.organization_id=$2
          GROUP BY u.id,name ORDER BY used DESC LIMIT 20`,
        [templateId, access.organizationId],
      );
      const recent = await pool.query(
        `SELECT pu.usage_session_id, pu.used_at, pu.outcome, pu.source,
                COALESCE(NULLIF(TRIM(u.first_name||' '||COALESCE(u.last_name,'')),''),u.username,u.email) AS user_name
           FROM pondus_template_usage pu JOIN users u ON u.id=pu.user_id
          WHERE pu.template_id=$1::uuid AND pu.organization_id=$2
          ORDER BY pu.used_at DESC LIMIT 20`,
        [templateId, access.organizationId],
      );
      return res.json({
        outcomes: Object.fromEntries(outcomes.rows.map((row) => [row.outcome, Number(row.n)])),
        by_seller: bySeller.rows.map((row) => ({
          user_id: String(row.user_id), name: String(row.name),
          used: Number(row.used), meetings: Number(row.meetings),
        })),
        recent: recent.rows.map((row) => ({
          usage_session_id: row.usage_session_id, used_at: row.used_at,
          outcome: row.outcome, source: row.source, user_name: row.user_name,
        })),
      });
    } catch (error) {
      if (sendPondusAccessError(res, error)) return;
      console.error("[pondus-usage-v2] detail failed:", error);
      return res.status(500).json({ error: "pondus_usage_detail_failed" });
    }
  });
}
