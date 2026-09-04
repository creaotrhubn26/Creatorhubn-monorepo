import type { Pool } from "pg";

type Queryable = Pick<Pool, "query">;

export type CommissionInput = {
  revenueNok: number;
  recurringRevenueNok: number;
  qualifiedActivities: number;
  activeModels: string[];
  config: Record<string, unknown>;
};

export type CommissionBreakdown = {
  commissionNok: number;
  effectiveRate: number;
  modelsApplied: string[];
  modelsIgnored: string[];
  components: Record<string, number>;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rateValue(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value, fallback);
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, normalized));
}

function normalizedModel(model: string): string {
  const aliases: Record<string, string> = {
    flat: "base_percentage",
    perActivity: "per_activity",
    teamPool: "team_pool",
    hybridBase: "hybrid",
    margin: "gross_margin",
  };
  return aliases[model] ?? model;
}

/** Pure calculation used by the route and unit tests. */
export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const revenue = Math.max(0, finiteNumber(input.revenueNok, 0));
  const recurringRevenue = Math.max(0, finiteNumber(input.recurringRevenueNok, 0));
  const activities = Math.max(0, Math.floor(finiteNumber(input.qualifiedActivities, 0)));
  const models = [...new Set(input.activeModels.map(normalizedModel))];
  const cfg = objectValue(input.config);
  const components: Record<string, number> = {};
  const applied: string[] = [];
  const ignored: string[] = [];

  if (models.includes("base_percentage")) {
    const base = objectValue(cfg.base_percentage);
    const rate = rateValue(base.rate ?? cfg.flatRate ?? cfg.flat_rate, 0.10);
    components.base_percentage = revenue * rate;
    applied.push("base_percentage");
  }

  if (models.includes("tiered")) {
    const rawBands = Array.isArray(cfg.tieredBands)
      ? cfg.tieredBands
      : Array.isArray(cfg.tiered_bands)
        ? cfg.tiered_bands
        : [];
    const bands = rawBands
      .map((raw) => objectValue(raw))
      .map((band) => ({
        from: Math.max(0, finiteNumber(band.fromK ?? band.from_k, 0) * 1_000),
        rate: rateValue(band.pct, 0),
      }))
      .sort((a, b) => a.from - b.from);
    if (bands.length > 0) {
      let amount = 0;
      for (let index = 0; index < bands.length; index += 1) {
        const band = bands[index];
        const next = bands[index + 1]?.from ?? revenue;
        const taxable = Math.max(0, Math.min(revenue, next) - band.from);
        amount += taxable * band.rate;
      }
      components.tiered = amount;
      applied.push("tiered");
    } else {
      ignored.push("tiered");
    }
  }

  if (models.includes("recurring")) {
    const recurring = objectValue(cfg.recurring);
    const rate = rateValue(recurring.pct ?? cfg.recurringPct ?? cfg.recurring_pct, 0.10);
    const months = Math.min(36, Math.max(1, finiteNumber(
      recurring.months ?? cfg.recurringMonths ?? cfg.recurring_months,
      1,
    )));
    components.recurring = recurringRevenue * rate * months;
    applied.push("recurring");
  }

  if (models.includes("per_activity")) {
    const perActivity = objectValue(cfg.per_activity);
    const amount = Math.max(0, finiteNumber(
      perActivity.amount_nok ?? perActivity.amountNok ?? cfg.perActivityNok ?? cfg.per_activity_nok,
      0,
    ));
    components.per_activity = activities * amount;
    applied.push("per_activity");
  }

  if (models.includes("hybrid")) {
    const hybrid = objectValue(cfg.hybrid);
    const threshold = Math.max(0, finiteNumber(
      hybrid.deal_threshold_nok ?? hybrid.dealThresholdNok ??
        finiteNumber(cfg.hybridDealThresholdK ?? cfg.hybrid_deal_threshold_k, 0) * 1_000,
      0,
    ));
    const rate = rateValue(hybrid.rate ?? objectValue(cfg.base_percentage).rate, 0.10);
    components.hybrid = Math.max(0, revenue - threshold) * rate;
    applied.push("hybrid");
  }

  // Accelerator multiplies revenue-based variable components after the
  // threshold is reached. It never multiplies per-activity payouts.
  if (models.includes("accelerator")) {
    const accelerator = objectValue(cfg.accelerator);
    const target = Math.max(0, finiteNumber(
      accelerator.target_nok ?? accelerator.targetNok ??
        finiteNumber(cfg.monthlyTargetK ?? cfg.monthly_target_k, 0) * 1_000,
      0,
    ));
    const multiplier = Math.max(1, finiteNumber(
      accelerator.multiplier ?? cfg.acceleratorMult ?? cfg.accelerator_mult,
      1,
    ));
    if (target > 0 && revenue >= target && multiplier > 1) {
      const variableKeys = ["base_percentage", "tiered", "recurring", "hybrid"];
      const variable = variableKeys.reduce((sum, key) => sum + (components[key] ?? 0), 0);
      components.accelerator = variable * (multiplier - 1);
      applied.push("accelerator");
    } else {
      components.accelerator = 0;
      applied.push("accelerator");
    }
  }

  // These models require deal-level facts that the current CRM does not
  // persist. They are surfaced as ignored instead of fabricating payouts.
  for (const model of ["spiff", "split", "gross_margin", "team_pool"]) {
    if (models.includes(model)) ignored.push(model);
  }

  const total = Object.values(components).reduce((sum, value) => sum + value, 0);
  return {
    commissionNok: Math.round(total),
    effectiveRate: revenue > 0 ? total / revenue : 0,
    modelsApplied: applied,
    modelsIgnored: ignored,
    components: Object.fromEntries(
      Object.entries(components).map(([key, value]) => [key, Math.round(value)]),
    ),
  };
}

type ContestRow = {
  id: string;
  kpi: string;
  starts_at: string | null;
  ends_at: string | null;
  kpi_config: Record<string, unknown> | null;
};

function contestScore(kpi: string, row: Record<string, unknown>): number {
  const key = kpi.toLowerCase();
  if (["closed_revenue", "revenue", "won_revenue"].includes(key)) return Number(row.closed_revenue ?? 0);
  if (["deals_closed", "won_deals"].includes(key)) return Number(row.deals_closed ?? 0);
  if (["discovery_calls", "meetings_booked"].includes(key)) return Number(row.meetings_booked ?? 0);
  if (["demos_held", "demos_booked"].includes(key)) return Number(row.demos_held ?? 0);
  if (["pipeline_value_created", "pipeline_built"].includes(key)) return Number(row.pipeline_created ?? 0);
  if (["average_deal_value", "avg_deal_value"].includes(key)) return Number(row.average_deal_value ?? 0);
  if (["activities", "activity_count", "volume"].includes(key)) return Number(row.activity_count ?? 0);
  if (["dorsalg_won", "doors_won"].includes(key)) return Number(row.dorsalg_won ?? 0);
  return Number(row.closed_revenue ?? 0);
}

/**
 * Recomputes every eligible member from authoritative CRM/Dørsalg facts and
 * upserts the contest snapshot. This is called on create, refresh and close.
 */
export async function refreshContestParticipants(
  db: Queryable,
  organizationId: string,
  contestId: string,
): Promise<number> {
  const contestResult = await db.query<ContestRow>(
    `SELECT id::text, kpi, starts_at, ends_at, kpi_config
       FROM sales_contests
      WHERE id = $1::uuid AND organization_id = $2::uuid
      LIMIT 1`,
    [contestId, organizationId],
  );
  const contest = contestResult.rows[0];
  if (!contest) throw new Error("contest_not_found");

  const config = objectValue(contest.kpi_config);
  const configuredIds = Array.isArray(config.user_ids)
    ? config.user_ids.filter((value): value is string => typeof value === "string")
    : Array.isArray(config.userIds)
      ? config.userIds.filter((value): value is string => typeof value === "string")
      : [];

  const scoreResult = await db.query<Record<string, unknown>>(
    `WITH eligible AS (
       SELECT om.user_id::text AS user_id,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, om.user_id::text) AS user_name,
              u.email AS user_email
         FROM organization_members om
         LEFT JOIN users u ON u.id = om.user_id::text
        WHERE om.organization_id = $1::uuid
          AND om.role IN ('owner','admin','salgssjef','teamleder','salgskonsulent','promotor','member')
          AND (cardinality($5::text[]) = 0 OR om.user_id::text = ANY($5::text[]))
     ), customer_stats AS (
       SELECT c.assigned_user_id::text AS user_id,
              COUNT(*) FILTER (
                WHERE (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) >= $3::timestamptz
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) <= $4::timestamptz
              )::int AS deals_closed,
              COALESCE(SUM(COALESCE(c.won_amount_oere::numeric / 100.0, c.deal_amount, 0)) FILTER (
                WHERE (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) >= $3::timestamptz
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) <= $4::timestamptz
              ), 0)::float8 AS closed_revenue,
              COALESCE(SUM(COALESCE(c.deal_amount, 0)) FILTER (
                WHERE c.created_at >= $3::timestamptz AND c.created_at <= $4::timestamptz
              ), 0)::float8 AS pipeline_created,
              COALESCE(AVG(COALESCE(c.won_amount_oere::numeric / 100.0, c.deal_amount, 0)) FILTER (
                WHERE (c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won')
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) >= $3::timestamptz
                  AND COALESCE(c.won_at, c.deal_stage_changed_at, c.updated_at, c.created_at) <= $4::timestamptz
              ), 0)::float8 AS average_deal_value
         FROM crm_customers c
        WHERE c.organization_id = $1::uuid
          AND c.archived_at IS NULL
          AND c.assigned_user_id IS NOT NULL
        GROUP BY c.assigned_user_id
     ), activity_stats AS (
       SELECT la.user_id::text AS user_id,
              COUNT(*)::int AS activity_count,
              COUNT(*) FILTER (WHERE la.activity_type = 'meeting_scheduled')::int AS meetings_booked,
              COUNT(*) FILTER (
                WHERE la.metadata->>'kind' IN ('demo','demo_held','demo_booked')
                   OR la.metadata->>'activity' IN ('demo','demo_held','demo_booked')
              )::int AS demos_held
         FROM crm_lead_activities la
         JOIN crm_customers c ON c.id = la.customer_id
        WHERE c.organization_id = $1::uuid
          AND la.created_at >= $3::timestamptz
          AND la.created_at <= $4::timestamptz
          AND la.user_id IS NOT NULL
        GROUP BY la.user_id
     ), door_stats AS (
       SELECT seller_user_id::text AS user_id, COUNT(*)::int AS dorsalg_won
         FROM leadgrid_dorsalg_sales
        WHERE org_id = $2
          AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz
        GROUP BY seller_user_id
     )
     SELECT e.user_id, e.user_name, e.user_email,
            COALESCE(c.deals_closed, 0) AS deals_closed,
            COALESCE(c.closed_revenue, 0) AS closed_revenue,
            COALESCE(c.pipeline_created, 0) AS pipeline_created,
            COALESCE(c.average_deal_value, 0) AS average_deal_value,
            COALESCE(a.activity_count, 0) AS activity_count,
            COALESCE(a.meetings_booked, 0) AS meetings_booked,
            COALESCE(a.demos_held, 0) AS demos_held,
            COALESCE(d.dorsalg_won, 0) AS dorsalg_won
       FROM eligible e
       LEFT JOIN customer_stats c USING (user_id)
       LEFT JOIN activity_stats a USING (user_id)
       LEFT JOIN door_stats d USING (user_id)`,
    [
      organizationId,
      organizationId,
      contest.starts_at ?? "1970-01-01T00:00:00.000Z",
      contest.ends_at ?? "9999-12-31T23:59:59.999Z",
      configuredIds,
    ],
  );

  for (const row of scoreResult.rows) {
    const score = Math.max(0, contestScore(contest.kpi, row));
    await db.query(
      `INSERT INTO sales_contest_participants
         (contest_id, user_id, score, user_name, user_email, last_updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, NOW())
       ON CONFLICT (contest_id, user_id) DO UPDATE SET
         score = EXCLUDED.score,
         user_name = EXCLUDED.user_name,
         user_email = EXCLUDED.user_email,
         last_updated_at = NOW()`,
      [contestId, row.user_id, score, row.user_name, row.user_email],
    );
  }
  await db.query(
    `DELETE FROM sales_contest_participants
      WHERE contest_id = $1::uuid
        AND NOT (user_id = ANY($2::text[]))`,
    [contestId, scoreResult.rows.map((row) => String(row.user_id))],
  );
  return scoreResult.rows.length;
}
