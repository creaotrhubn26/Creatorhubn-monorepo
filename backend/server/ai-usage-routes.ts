/**
 * ai-usage-routes — Slice 9X.71
 *
 * Admin-endpoints for å analysere AI-kostnader på tvers av CreatorHub.
 * Leser fra ai_usage_log (migration 0128).
 *
 * Endepunkter:
 *   GET /api/admin/ai-usage/overview        — KPIer, top features, modell-fordeling, daglig trend
 *   GET /api/admin/ai-usage/by-user         — kostnader per bruker
 *   GET /api/admin/ai-usage/recent          — siste 50 kall (debug)
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

type RequireAdminSession = (req: Request, res: Response, next: NextFunction) => void;

export function registerAIUsageRoutes(
  app: Express,
  pool: Pool,
  requireAdminSession: RequireAdminSession,
) {
  // ─── Hovedoversikt for admin AI cost-dashboard ──────────────────
  app.get("/api/admin/ai-usage/overview", requireAdminSession, async (_req, res) => {
    const result: any = {
      totals: {
        last24h: { calls: 0, costUsd: 0, tokens: 0 },
        last7d:  { calls: 0, costUsd: 0, tokens: 0 },
        last30d: { calls: 0, costUsd: 0, tokens: 0 },
      },
      byFeature: [],
      byModel: [],
      byDay: [],
      cacheStats: { readTokens: 0, writeTokens: 0, savingsUsd: 0 },
      errorRate: 0,
    };

    try {
      // Totals
      const totalsResult = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS calls_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   AS calls_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')  AS calls_30d,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) AS cost_24h,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),   0) AS cost_7d,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),  0) AS cost_30d,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) AS tokens_24h,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),   0) AS tokens_7d,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),  0) AS tokens_30d
        FROM ai_usage_log
      `);
      const t = totalsResult.rows[0];
      result.totals = {
        last24h: { calls: +t.calls_24h, costUsd: +t.cost_24h, tokens: +t.tokens_24h },
        last7d:  { calls: +t.calls_7d,  costUsd: +t.cost_7d,  tokens: +t.tokens_7d  },
        last30d: { calls: +t.calls_30d, costUsd: +t.cost_30d, tokens: +t.tokens_30d },
      };

      // Per feature (siste 30 dager)
      const featureResult = await pool.query(`
        SELECT feature,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd,
               COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
               COALESCE(AVG(duration_ms), 0) AS avg_duration_ms
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY feature
          ORDER BY cost_usd DESC
          LIMIT 20
      `);
      result.byFeature = featureResult.rows.map((r: any) => ({
        feature: r.feature,
        calls: +r.calls,
        costUsd: +r.cost_usd,
        tokens: +r.tokens,
        avgDurationMs: Math.round(+r.avg_duration_ms),
      }));

      // Per modell (siste 30 dager)
      const modelResult = await pool.query(`
        SELECT model,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd,
               COALESCE(SUM(input_tokens), 0) AS input_tokens,
               COALESCE(SUM(output_tokens), 0) AS output_tokens
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY model
          ORDER BY cost_usd DESC
      `);
      result.byModel = modelResult.rows.map((r: any) => ({
        model: r.model,
        calls: +r.calls,
        costUsd: +r.cost_usd,
        inputTokens: +r.input_tokens,
        outputTokens: +r.output_tokens,
      }));

      // Per dag (siste 30 dager, for trend-chart)
      const dailyResult = await pool.query(`
        SELECT DATE(created_at) AS day,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd,
               COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY day ASC
      `);
      result.byDay = dailyResult.rows.map((r: any) => ({
        day: r.day,
        calls: +r.calls,
        costUsd: +r.cost_usd,
        tokens: +r.tokens,
      }));

      // Cache-statistikk (besparelser fra prompt caching)
      const cacheResult = await pool.query(`
        SELECT
          COALESCE(SUM(cache_read_tokens), 0) AS read_tokens,
          COALESCE(SUM(cache_write_tokens), 0) AS write_tokens
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '30 days'
      `);
      const cache = cacheResult.rows[0];
      const readTokens = +cache.read_tokens;
      const writeTokens = +cache.write_tokens;
      // Sonnet-pris brukt som approksimasjon for besparelse-estimat
      const savingsUsd = (readTokens * (3.0 - 0.3)) / 1_000_000;
      result.cacheStats = { readTokens, writeTokens, savingsUsd };

      // Error rate (siste 7 dager)
      const errorResult = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE success = FALSE) AS errors,
          COUNT(*) AS total
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '7 days'
      `);
      const er = errorResult.rows[0];
      result.errorRate = +er.total > 0 ? +er.errors / +er.total : 0;
    } catch (err: any) {
      if (err?.code === '42P01') {
        result.error = 'Tabellen ai_usage_log finnes ikke ennå — kjør migration 0128.';
      } else {
        result.error = err.message;
      }
    }

    res.json(result);
  });

  // ─── Per bruker (kostnader fordelt) ────────────────────────────
  app.get("/api/admin/ai-usage/by-user", requireAdminSession, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT user_id,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd,
               COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
               COUNT(DISTINCT feature) AS features_used,
               MAX(created_at) AS last_call_at
          FROM ai_usage_log
          WHERE created_at > NOW() - INTERVAL '30 days'
            AND user_id IS NOT NULL
          GROUP BY user_id
          ORDER BY cost_usd DESC
          LIMIT 100
      `);
      res.json({
        success: true,
        data: result.rows.map((r: any) => ({
          userId: r.user_id,
          calls: +r.calls,
          costUsd: +r.cost_usd,
          tokens: +r.tokens,
          featuresUsed: +r.features_used,
          lastCallAt: r.last_call_at,
        })),
      });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ success: true, data: [] });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Bruker: sitt eget forbruk (synlig i settings) ─────────────
  // Markup-faktor brukes til å regne ut hva kunden betaler vs vår kost.
  // Default 2.5x — overstyres med AI_CUSTOMER_MARKUP env-var.
  const MARKUP = parseFloat(process.env.AI_CUSTOMER_MARKUP || '2.5');
  const USD_TO_NOK = parseFloat(process.env.USD_NOK_RATE || '11');
  app.get("/api/me/ai-usage", async (req, res) => {
    const userId = (req.headers["x-user-id"] as string) || (req as any).session?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'unauthorized' });

    const result: any = {
      userId,
      totals: {
        last24h: { calls: 0, costUsd: 0, tokens: 0 },
        last7d:  { calls: 0, costUsd: 0, tokens: 0 },
        last30d: { calls: 0, costUsd: 0, tokens: 0 },
      },
      byFeature: [],
      byDay: [],
      recent: [],
    };

    try {
      const totals = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS calls_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   AS calls_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')  AS calls_30d,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) AS cost_24h,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),   0) AS cost_7d,
          COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),  0) AS cost_30d,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) AS tokens_24h,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),   0) AS tokens_7d,
          COALESCE(SUM(input_tokens + output_tokens) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'),  0) AS tokens_30d
          FROM ai_usage_log
          WHERE user_id = $1
      `, [userId]);
      const t = totals.rows[0];
      result.totals = {
        last24h: { calls: +t.calls_24h, costUsd: +t.cost_24h, tokens: +t.tokens_24h },
        last7d:  { calls: +t.calls_7d,  costUsd: +t.cost_7d,  tokens: +t.tokens_7d  },
        last30d: { calls: +t.calls_30d, costUsd: +t.cost_30d, tokens: +t.tokens_30d },
      };

      // Slice 9X.71 — kunde-vendt fakturering: vår-kost × markup × USD→NOK
      result.customerBilling = {
        markupFactor: MARKUP,
        usdToNokRate: USD_TO_NOK,
        monthlyEstimateUsd: +t.cost_30d * MARKUP,
        monthlyEstimateNok: +t.cost_30d * MARKUP * USD_TO_NOK,
        last30dActualNok: +t.cost_30d * MARKUP * USD_TO_NOK,
      };

      const features = await pool.query(`
        SELECT feature,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd,
               COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
          FROM ai_usage_log
          WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY feature
          ORDER BY cost_usd DESC
          LIMIT 10
      `, [userId]);
      result.byFeature = features.rows.map((r: any) => ({
        feature: r.feature,
        calls: +r.calls,
        costUsd: +r.cost_usd,
        tokens: +r.tokens,
      }));

      const daily = await pool.query(`
        SELECT DATE(created_at) AS day,
               COUNT(*) AS calls,
               COALESCE(SUM(cost_usd), 0) AS cost_usd
          FROM ai_usage_log
          WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY day ASC
      `, [userId]);
      result.byDay = daily.rows.map((r: any) => ({
        day: r.day,
        calls: +r.calls,
        costUsd: +r.cost_usd,
      }));

      const recent = await pool.query(`
        SELECT model, feature, input_tokens, output_tokens, cost_usd, success, created_at
          FROM ai_usage_log
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 20
      `, [userId]);
      result.recent = recent.rows.map((r: any) => ({
        model: r.model,
        feature: r.feature,
        inputTokens: +r.input_tokens,
        outputTokens: +r.output_tokens,
        costUsd: +r.cost_usd,
        success: r.success,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      if (err?.code !== '42P01') console.error('[me/ai-usage] failed:', err.message);
      // Returnerer tomt-skeleton selv ved feil — UI viser "ingen data ennå"
    }

    res.json(result);
  });

  // ─── Siste 50 kall (debug) ─────────────────────────────────────
  app.get("/api/admin/ai-usage/recent", requireAdminSession, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, model, feature, route, user_id,
               input_tokens, output_tokens, cost_usd,
               duration_ms, success, error_code, created_at
          FROM ai_usage_log
          ORDER BY created_at DESC
          LIMIT 50
      `);
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      if (err?.code === '42P01') return res.json({ success: true, data: [] });
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
