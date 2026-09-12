// Admin storage-cost-routes — gjør Cloudflare-kost synlig per bruker
// i admin-dashbordet.
//
// Tre endepunkter:
//   GET /api/admin/storage-cost/preview?storageGB=N
//       — kost-/margin-overslag for en gitt storage-cap. Brukes i edit-dialogen.
//   GET /api/admin/users/:userId/storage-cost
//       — per-bruker kost: usedBytes, plan, månedlig kost, margin.
//   GET /api/admin/users-storage-overview?limit=N&sort=cost|usage
//       — flat liste over alle brukere med storage-bruk + kost (paginert).
//
// Bruker storage-cost-model.ts som sannhets-kilde for kost/marginer.

import express from "express";
import type { Pool } from "pg";
import {
  calculateStorageCostBreakdown,
  costNokPerGbMonth,
} from "./storage-cost-model.js";
import { getStorageStatus } from "./storage-quota-service.js";

const USD_TO_NOK_FALLBACK = 10.5;
const usdToNok = (usd: number): number => {
  const env = process.env.STORAGE_COST_NOK_PER_USD;
  const rate = env ? parseFloat(env) : USD_TO_NOK_FALLBACK;
  return usd * (Number.isFinite(rate) && rate > 0 ? rate : USD_TO_NOK_FALLBACK);
};

// Hent AI-kost (siste 30d) for en bruker.
const fetchAiCostUsd30d = async (
  pool: Pool,
  userId: string,
): Promise<number> => {
  try {
    const r = await pool.query<{ cost_usd: string | number | null }>(
      `SELECT COALESCE(SUM(cost_usd), 0)::float AS cost_usd
         FROM ai_usage_log
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'`,
      [userId],
    );
    return Number(r.rows[0]?.cost_usd ?? 0);
  } catch {
    return 0;
  }
};

const fetchAiCostsForUsers = async (
  pool: Pool,
  userIds: string[],
): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  try {
    const r = await pool.query<{
      user_id: string;
      cost_usd: string | number | null;
    }>(
      `SELECT user_id, COALESCE(SUM(cost_usd), 0)::float AS cost_usd
         FROM ai_usage_log
        WHERE user_id = ANY($1::text[])
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY user_id`,
      [userIds],
    );
    for (const row of r.rows) {
      map.set(row.user_id, Number(row.cost_usd ?? 0));
    }
  } catch {
    // tom map = ingen AI-kost vises
  }
  return map;
};

export interface AdminStorageCostRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

const GIB = 1024 * 1024 * 1024;

export function setupAdminStorageCostRoutes(
  deps: AdminStorageCostRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // GET /api/admin/storage-cost/preview?storageGB=50
  // Returnerer kost-/margin-overslag for en hypotetisk plan med X GB.
  app.get("/api/admin/storage-cost/preview", async (req, res) => {
    const adminSession = requireAdminSession(req, res);
    if (!adminSession) return;

    const storageGBRaw = req.query.storageGB;
    const storageGB = parseFloat(String(storageGBRaw ?? "0"));
    if (!Number.isFinite(storageGB) || storageGB < 0) {
      return res.status(400).json({
        success: false,
        error: "invalid_storage_gb",
      });
    }

    const breakdown = calculateStorageCostBreakdown(storageGB);
    res.json({
      success: true,
      breakdown,
    });
  });

  // GET /api/admin/users/:userId/storage-cost
  // Returnerer { tier, usedBytes, monthlyCostNok, monthlyPriceNok,
  // creatorHubMarginNok, marginFraction } for en bruker.
  app.get(
    "/api/admin/users/:userId/storage-cost",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const { userId } = req.params;

      try {
        const status = await getStorageStatus(pool, userId);

        // Defensiv kolonnesjekk for subscriptions — schema drift'er mellom
        // miljøer (Neon-prod bruker `tier_id`, ikke `plan_type`).
        const colCheck = await pool.query<{ column_name: string }>(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_name = 'subscriptions'
              AND column_name IN (
                'plan_type', 'plan_id', 'subscription_plan_id', 'tier_id',
                'amount', 'status', 'stripe_subscription_id',
                'stripe_storage_meter_item_id', 'created_at'
              )`,
        );
        const subCols = new Set(colCheck.rows.map((row) => row.column_name));
        const planCol =
          subCols.has("plan_type")
            ? "plan_type"
            : subCols.has("plan_id")
              ? "plan_id"
              : subCols.has("subscription_plan_id")
                ? "subscription_plan_id"
                : subCols.has("tier_id")
                  ? "tier_id"
                  : null;
        const planSelect = planCol
          ? `${planCol} AS plan_type`
          : "'unknown'::text AS plan_type";
        const amountSelect = subCols.has("amount") ? "amount" : "NULL::numeric AS amount";
        const stripeSubSelect = subCols.has("stripe_subscription_id")
          ? "stripe_subscription_id"
          : "NULL::text AS stripe_subscription_id";
        const meterSelect = subCols.has("stripe_storage_meter_item_id")
          ? "stripe_storage_meter_item_id"
          : "NULL::text AS stripe_storage_meter_item_id";
        const statusFilter = subCols.has("status")
          ? "AND status IN ('active', 'trialing')"
          : "";
        const orderBy = subCols.has("created_at") ? "ORDER BY created_at DESC" : "";

        // Slå opp månedlig pris fra subscriptions-raden (eller fallback 0)
        const sub = await pool.query<{
          plan_type: string;
          amount: string | number | null;
          stripe_subscription_id: string | null;
          stripe_storage_meter_item_id: string | null;
        }>(
          `SELECT ${planSelect}, ${amountSelect}, ${stripeSubSelect}, ${meterSelect}
             FROM subscriptions
            WHERE user_id = $1
              ${statusFilter}
            ${orderBy}
            LIMIT 1`,
          [userId],
        );
        const planType = sub.rows[0]?.plan_type ?? "unknown";
        const monthlyPriceNok = sub.rows[0]?.amount
          ? Number(sub.rows[0].amount)
          : 0;

        const usedGB = status.usedBytes / GIB;
        const costPerGb = costNokPerGbMonth();
        const storageCostNok = Math.round(usedGB * costPerGb * 100) / 100;

        const aiCostUsd30d = await fetchAiCostUsd30d(pool, userId);
        const aiCostNok30d = Math.round(usdToNok(aiCostUsd30d) * 100) / 100;

        const totalCostNok = Math.round((storageCostNok + aiCostNok30d) * 100) / 100;
        const creatorHubMarginNok =
          Math.round((monthlyPriceNok - totalCostNok) * 100) / 100;
        const marginFraction =
          monthlyPriceNok > 0 ? creatorHubMarginNok / monthlyPriceNok : 0;

        res.json({
          success: true,
          userId,
          planType,
          tier: status.user.tier,
          usedBytes: status.usedBytes,
          usedGB: Math.round(usedGB * 100) / 100,
          limitBytes: status.user.storageLimitBytes,
          limitGB: Math.round(status.user.storageLimitBytes / GIB),
          overageBytes: status.overageBytes,
          overageGB: status.overageGB,
          monthlyPriceNok,
          // Detaljert kost-breakdown
          storageCostNok,
          aiCostNok30d,
          aiCostUsd30d: Math.round(aiCostUsd30d * 100) / 100,
          totalCostNok,
          creatorHubMarginNok,
          marginFraction,
          // Til Stripe-billing
          stripeSubscriptionId: sub.rows[0]?.stripe_subscription_id ?? null,
          stripeStorageMeterItemId:
            sub.rows[0]?.stripe_storage_meter_item_id ?? null,
        });
      } catch (err: any) {
        console.error("[admin-storage-cost] user cost failed:", err);
        res.status(500).json({
          success: false,
          error: "cost_lookup_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );

  // GET /api/admin/users-storage-overview?limit=50&sort=cost
  // Returnerer en flat liste med alle brukere som har storage-bruk.
  // Sortering: cost (default), usage, margin.
  app.get(
    "/api/admin/users-storage-overview",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;

      const limit = Math.min(
        500,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const sort = String(req.query.sort ?? "cost");

      try {
        // Aggregert spørring som joiner subscriptions + user_storage_consumption.
        // LEFT JOIN slik at brukere uten upload ennå også vises hvis de har sub.
        //
        // Defensiv kolonnesjekk: produksjons-DB-er har drift'et og
        // mangler `plan_type` (krasjet med
        // 'column "plan_type" does not exist'). Vi sjekker
        // information_schema og fall tilbake til `tier_id`/`plan_id`/literal
        // 'unknown' hvis kolonnen ikke finnes — slik at admin-overviewet
        // ikke krasjer på miljøer med schema-drift.
        //
        // Sjekker også `stripe_subscription_id` og `amount`/`status` siden
        // de mangler i enkelte miljøer (Neon-prod har bare `tier_id`-baserte
        // subscriptions per 2026-06-07).
        const colCheck = await pool.query<{ column_name: string }>(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_name = 'subscriptions'
              AND column_name IN (
                'plan_type',
                'plan_id',
                'subscription_plan_id',
                'tier_id',
                'amount',
                'status',
                'stripe_subscription_id',
                'stripe_storage_meter_item_id',
                'created_at'
              )`,
        );
        const subCols = new Set(colCheck.rows.map((row) => row.column_name));

        // Velger først tilgjengelig kolonne for plan-konseptet.
        const pickPlanCol = (): string | null => {
          if (subCols.has("plan_type")) return "plan_type";
          if (subCols.has("plan_id")) return "plan_id";
          if (subCols.has("subscription_plan_id")) return "subscription_plan_id";
          if (subCols.has("tier_id")) return "tier_id";
          return null;
        };
        const planCol = pickPlanCol();
        // Outer SELECT refererer alltid `s.plan_type` (det aliasede navnet
        // fra den laterale subqueryen). Inner velger faktisk kolonne (eller
        // literal) AS plan_type.
        const planExpr = "s.plan_type";
        const planInner = planCol
          ? `${planCol} AS plan_type`
          : "'unknown'::text AS plan_type";

        // Outer expressions refererer alltid de aliasede navnene som inner
        // returnerer. Inner velger faktisk kolonne (eller literal) AS alias.
        const meterExpr = "s.stripe_storage_meter_item_id";
        const meterInner = subCols.has("stripe_storage_meter_item_id")
          ? "stripe_storage_meter_item_id"
          : "NULL::text AS stripe_storage_meter_item_id";

        const stripeSubExpr = "s.stripe_subscription_id";
        const stripeSubInner = subCols.has("stripe_subscription_id")
          ? "stripe_subscription_id"
          : "NULL::text AS stripe_subscription_id";

        const amountExpr = "s.amount";
        const amountInner = subCols.has("amount") ? "amount" : "NULL::numeric AS amount";

        const statusExpr = "s.status";
        const statusInner = subCols.has("status") ? "status" : "NULL::text AS status";

        // WHERE-clausul og ORDER BY i den laterale subqueryen må også være
        // defensive — hvis `status` eller `created_at` ikke finnes lar vi
        // hver av filtrene falle til 1=1 / vilkårlig ordering.
        const statusFilter = subCols.has("status")
          ? "AND s2.status IN ('active', 'trialing')"
          : "";
        const orderBy = subCols.has("created_at")
          ? "ORDER BY s2.created_at DESC"
          : "";

        const r = await pool.query<{
          user_id: string;
          plan_type: string | null;
          amount: string | number | null;
          status: string | null;
          stripe_subscription_id: string | null;
          stripe_storage_meter_item_id: string | null;
          total_bytes: string | number | null;
          last_updated: string | null;
        }>(
          `SELECT
             u.user_id AS user_id,
             ${planExpr},
             ${amountExpr},
             ${statusExpr},
             ${stripeSubExpr},
             ${meterExpr},
             u.total_bytes,
             u.last_updated
           FROM user_storage_consumption u
           LEFT JOIN LATERAL (
             SELECT ${planInner}, ${amountInner}, ${statusInner}, ${stripeSubInner},
                    ${meterInner}
               FROM subscriptions s2
              WHERE s2.user_id = u.user_id
                ${statusFilter}
              ${orderBy}
              LIMIT 1
           ) s ON true`,
        );

        const costPerGb = costNokPerGbMonth();

        // Hent AI-kost siste 30d per bruker i én spørring
        const userIds = r.rows.map((row) => row.user_id);
        const aiCostMap = await fetchAiCostsForUsers(pool, userIds);

        const rows = r.rows.map((row) => {
          const usedBytes = Number(row.total_bytes ?? 0);
          const usedGB = usedBytes / GIB;
          const monthlyPriceNok = row.amount ? Number(row.amount) : 0;
          const storageCostNok = Math.round(usedGB * costPerGb * 100) / 100;
          const aiCostUsd = aiCostMap.get(row.user_id) ?? 0;
          const aiCostNok = Math.round(usdToNok(aiCostUsd) * 100) / 100;
          const totalCostNok = Math.round((storageCostNok + aiCostNok) * 100) / 100;
          const margin = Math.round((monthlyPriceNok - totalCostNok) * 100) / 100;
          return {
            userId: row.user_id,
            planType: row.plan_type ?? "unknown",
            subscriptionStatus: row.status,
            usedBytes,
            usedGB: Math.round(usedGB * 100) / 100,
            monthlyPriceNok,
            storageCostNok,
            aiCostNok30d: aiCostNok,
            totalCostNok,
            creatorHubMarginNok: margin,
            marginFraction:
              monthlyPriceNok > 0 ? margin / monthlyPriceNok : 0,
            lastUpdated: row.last_updated,
            stripeSubscriptionId: row.stripe_subscription_id,
            stripeStorageMeterItemId: row.stripe_storage_meter_item_id,
          };
        });

        const sortKey = (() => {
          if (sort === "usage") return (r: typeof rows[number]) => -r.usedBytes;
          if (sort === "margin")
            return (r: typeof rows[number]) => r.creatorHubMarginNok;
          if (sort === "loss")
            return (r: typeof rows[number]) => r.creatorHubMarginNok;
          if (sort === "ai")
            return (r: typeof rows[number]) => -r.aiCostNok30d;
          return (r: typeof rows[number]) => -r.totalCostNok;
        })();
        rows.sort((a, b) => sortKey(a) - sortKey(b));

        const totals = rows.reduce(
          (acc, r) => {
            acc.usedBytes += r.usedBytes;
            acc.monthlyPriceNok += r.monthlyPriceNok;
            acc.storageCostNok += r.storageCostNok;
            acc.aiCostNok30d += r.aiCostNok30d;
            acc.totalCostNok += r.totalCostNok;
            acc.creatorHubMarginNok += r.creatorHubMarginNok;
            return acc;
          },
          {
            usedBytes: 0,
            monthlyPriceNok: 0,
            storageCostNok: 0,
            aiCostNok30d: 0,
            totalCostNok: 0,
            creatorHubMarginNok: 0,
          },
        );

        res.json({
          success: true,
          totalUsers: rows.length,
          totals: {
            usedGB: Math.round((totals.usedBytes / GIB) * 100) / 100,
            monthlyPriceNok: Math.round(totals.monthlyPriceNok * 100) / 100,
            storageCostNok: Math.round(totals.storageCostNok * 100) / 100,
            aiCostNok30d: Math.round(totals.aiCostNok30d * 100) / 100,
            totalCostNok: Math.round(totals.totalCostNok * 100) / 100,
            creatorHubMarginNok:
              Math.round(totals.creatorHubMarginNok * 100) / 100,
            marginFraction:
              totals.monthlyPriceNok > 0
                ? totals.creatorHubMarginNok / totals.monthlyPriceNok
                : 0,
          },
          rows: rows.slice(0, limit),
        });
      } catch (err: any) {
        console.error("[admin-storage-cost] overview failed:", err);
        res.status(500).json({
          success: false,
          error: "overview_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );
}
