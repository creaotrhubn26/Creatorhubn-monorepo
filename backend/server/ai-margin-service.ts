/**
 * ai-margin-service.ts — Fase A av «soft-cap + overage»-bygget for AI-margin.
 *
 * Kontekst: AI-kall (Claude) er i dag UBEGRENSET og UFAKTURERT på alle betalte
 * CreatorHub-planer, inkl. Enterprise (3990 kr/mnd). En tung konto kan spise
 * hele marginen. `ai_usage_log` logger allerede kost per kall (cost_usd) +
 * organization_id — men tallet brukes aldri til synlighet eller håndhevelse.
 *
 * DENNE modulen er READ-ONLY: den aggregerer faktisk AI-kost per organisasjon
 * så super-admin kan SE hvem som nærmer seg ulønnsomt forbruk — FØR vi
 * bygger enforcement (Fase B) og Stripe metered-overage (Fase C). Ingen
 * mutasjon, ingen Stripe-skriv, ingen blokkering av kall her.
 *
 * USD→NOK og alarmterskel er env-konfigurerbare (tunes uten deploy via env).
 */

import type { Pool } from "pg";

/** Omtrentlig USD→NOK for å vise kost i kroner. Tunes via env ved store kurssvingninger. */
const USD_TO_NOK = Number(process.env.AI_USD_TO_NOK) || 10.5;

/** Org med månedlig AI-kost (NOK) over denne terskelen flagges som margin-risiko. */
const MARGIN_ALERT_NOK = Number(process.env.AI_MARGIN_ALERT_NOK) || 500;

export interface OrgAiSpend {
  organizationId: string | null;
  orgName: string | null;
  planKey: string | null;
  costUsd: number;
  costNok: number;
  calls: number;
  /** true hvis costNok >= MARGIN_ALERT_NOK i vinduet. */
  atRisk: boolean;
}

export interface AiMarginSummary {
  windowDays: number;
  usdToNok: number;
  alertThresholdNok: number;
  totalCostUsd: number;
  totalCostNok: number;
  totalCalls: number;
  distinctOrgs: number;
  orgsAtRisk: number;
  /** Kost fra rader vi ikke klarte å knytte til én org (multi-org bruker / ikke-backfillet). */
  unattributedCostNok: number;
  generatedAt: string;
}

export interface AiMarginReport {
  summary: AiMarginSummary;
  topConsumers: OrgAiSpend[];
}

/**
 * Aggregerer AI-kost per org for et rullerende vindu (default 30 dager).
 * Org utledes fra `ai_usage_log.organization_id`, med fallback til
 * `organization_members` for brukere som tilhører NØYAKTIG én org (samme
 * logikk som backfillen i mig 0313). Rader uten org-attribusjon summeres
 * som "unattributed" i summary (ikke tapt, bare ikke per-org).
 */
export async function computeAiMargin(
  pool: Pool,
  opts: { windowDays?: number; limit?: number } = {},
): Promise<AiMarginReport> {
  const windowDays = opts.windowDays ?? 30;
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Per-org aggregat (attribuert). unattributed håndteres i summary-spørringen.
  const perOrg = await pool.query<{
    organization_id: string | null;
    org_name: string | null;
    plan_key: string | null;
    cost_usd: string;
    calls: string;
  }>(
    `WITH member_org AS (
       SELECT user_id, MIN(organization_id) AS org_id
         FROM organization_members
        GROUP BY user_id
       HAVING COUNT(*) = 1
     ),
     usage AS (
       SELECT COALESCE(a.organization_id, m.org_id) AS org_id,
              SUM(a.cost_usd)::numeric AS cost_usd,
              COUNT(*)                 AS calls
         FROM ai_usage_log a
         LEFT JOIN member_org m ON m.user_id = a.user_id
        WHERE a.created_at >= $1
          AND COALESCE(a.organization_id, m.org_id) IS NOT NULL
        GROUP BY COALESCE(a.organization_id, m.org_id)
     )
     SELECT u.org_id AS organization_id,
            o.name   AS org_name,
            o.plan   AS plan_key,
            u.cost_usd,
            u.calls
       FROM usage u
       LEFT JOIN organizations o ON o.id = u.org_id
      ORDER BY u.cost_usd DESC NULLS LAST
      LIMIT $2`,
    [since.toISOString(), limit],
  );

  // Globalt sammendrag: totalkost, antall kall, distinkte orgs, samt
  // uattribuert kost (rader uten org selv etter member-fallback).
  const summaryR = await pool.query<{
    total_cost_usd: string;
    total_calls: string;
    distinct_orgs: string;
    unattributed_cost_usd: string;
  }>(
    `WITH member_org AS (
       SELECT user_id, MIN(organization_id) AS org_id
         FROM organization_members
        GROUP BY user_id
       HAVING COUNT(*) = 1
     ),
     resolved AS (
       SELECT COALESCE(a.organization_id, m.org_id) AS org_id,
              a.cost_usd
         FROM ai_usage_log a
         LEFT JOIN member_org m ON m.user_id = a.user_id
        WHERE a.created_at >= $1
     )
     SELECT
       COALESCE(SUM(cost_usd), 0)                                  AS total_cost_usd,
       COUNT(*)                                                    AS total_calls,
       COUNT(DISTINCT org_id)                                      AS distinct_orgs,
       COALESCE(SUM(cost_usd) FILTER (WHERE org_id IS NULL), 0)    AS unattributed_cost_usd
       FROM resolved`,
    [since.toISOString()],
  );

  const topConsumers: OrgAiSpend[] = perOrg.rows.map((r) => {
    const costUsd = Number(r.cost_usd) || 0;
    const costNok = round2(costUsd * USD_TO_NOK);
    return {
      organizationId: r.organization_id,
      orgName: r.org_name,
      planKey: r.plan_key,
      costUsd: round2(costUsd),
      costNok,
      calls: Number(r.calls) || 0,
      atRisk: costNok >= MARGIN_ALERT_NOK,
    };
  });

  const s = summaryR.rows[0] ?? {
    total_cost_usd: "0", total_calls: "0", distinct_orgs: "0", unattributed_cost_usd: "0",
  };
  const totalCostUsd = Number(s.total_cost_usd) || 0;

  const summary: AiMarginSummary = {
    windowDays,
    usdToNok: USD_TO_NOK,
    alertThresholdNok: MARGIN_ALERT_NOK,
    totalCostUsd: round2(totalCostUsd),
    totalCostNok: round2(totalCostUsd * USD_TO_NOK),
    totalCalls: Number(s.total_calls) || 0,
    distinctOrgs: Number(s.distinct_orgs) || 0,
    orgsAtRisk: topConsumers.filter((o) => o.atRisk).length,
    unattributedCostNok: round2((Number(s.unattributed_cost_usd) || 0) * USD_TO_NOK),
    generatedAt: new Date().toISOString(),
  };

  return { summary, topConsumers };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
