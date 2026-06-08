/**
 * client-ads-routes.ts
 *
 * Backend-routes for multi-tenant Google Ads conversion-tracking (B0-B6).
 *
 * Endepunkter:
 *   POST /api/admin-room/agent/ads/analyze
 *     Trigger Site Discovery + Claude-forslag for klient-URL.
 *
 *   POST /api/admin-room/agent/ads/configs
 *     Lagre review-bekreftet config + foreslåtte actions for senere
 *     OAuth-tilkobling og auto-opprett i Google Ads.
 *
 *   GET /api/admin-room/agent/ads/configs
 *     Liste alle configs for innholdsprodusent (med statuser).
 *
 *   GET /api/admin-room/agent/ads/configs/:id
 *     Detalj inkl. actions.
 *
 *   PATCH /api/admin-room/agent/ads/configs/:id/actions/:actionId
 *     Tilpass én action før Google-Ads-opprettelse.
 *
 *   DELETE /api/admin-room/agent/ads/configs/:id/actions/:actionId
 *     Fjern action før opprettelse.
 *
 *   POST /api/admin-room/agent/ads/configs/:id/actions
 *     Legg til manuell action.
 */

import type express from "express";
import type { Pool } from "pg";
import { discoverClientSite, type DiscoveryResult, type SuggestedAction } from "./client-ads-discovery-service.js";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface ClientAdsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const GOAL_CATEGORIES = new Set([
  "purchase","add_to_cart","begin_checkout",
  "submit_lead_form","book_appointment","sign_up","subscribe",
  "request_quote","contact","page_view","outbound_click","other",
]);

const TRIGGER_TYPES = new Set([
  "page_load","form_submit","click","event","outbound","manual",
]);

export function setupClientAdsRoutes(deps: ClientAdsRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── POST /api/admin-room/agent/ads/analyze ──────────────────────
  app.post("/api/admin-room/agent/ads/analyze", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as { url?: string; client_name?: string; client_project_id?: string };
    const url = (body.url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Gyldig URL er påkrevd (må starte med http:// eller https://)" });
    }

    try {
      const result = await discoverClientSite({ url, clientName: body.client_name });
      return res.json({ success: true, result });
    } catch (err) {
      console.error("[client-ads/analyze] failed", err);
      return res.status(500).json({
        error: "Klarte ikke å analysere klientens nettside",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── POST /api/admin-room/agent/ads/configs ──────────────────────
  // Lagre review-bekreftet config + actions for senere OAuth/opprettelse.
  app.post("/api/admin-room/agent/ads/configs", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      client_project_id?: string;
      client_name?: string;
      client_website_url?: string;
      analysis?: DiscoveryResult;
      actions?: SuggestedAction[];
    };

    const clientProjectId = body.client_project_id?.trim();
    const clientName = body.client_name?.trim();
    const url = body.client_website_url?.trim();
    if (!clientProjectId || !clientName || !url || !body.actions) {
      return res.status(400).json({
        error: "client_project_id, client_name, client_website_url og actions er påkrevd",
      });
    }

    try {
      // Upsert config
      const cfgRes = await pool.query(
        `INSERT INTO client_ads_configs (
           client_project_id, content_producer_user_id, client_name, client_website_url,
           business_type, business_subcategory, claude_analysis, detected_gtag_id,
           detected_gtm_id, site_analyzed_at
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, now()
         )
         ON CONFLICT (client_project_id, content_producer_user_id) DO UPDATE
           SET client_name = EXCLUDED.client_name,
               client_website_url = EXCLUDED.client_website_url,
               business_type = EXCLUDED.business_type,
               business_subcategory = EXCLUDED.business_subcategory,
               claude_analysis = EXCLUDED.claude_analysis,
               detected_gtag_id = EXCLUDED.detected_gtag_id,
               detected_gtm_id = EXCLUDED.detected_gtm_id,
               site_analyzed_at = now(),
               updated_at = now()
         RETURNING id::text`,
        [
          clientProjectId, session.userId, clientName, url,
          body.analysis?.business_type ?? null,
          body.analysis?.business_subcategory ?? null,
          JSON.stringify(body.analysis ?? {}),
          body.analysis?.detected_gtag_id ?? null,
          body.analysis?.detected_gtm_id ?? null,
        ],
      );
      const configId = cfgRes.rows[0].id as string;

      // Wipe + reinsert actions (idempotent ved repeated review)
      await pool.query(`DELETE FROM client_ads_actions WHERE config_id = $1::uuid`, [configId]);

      for (const a of body.actions) {
        if (!GOAL_CATEGORIES.has(a.goal_category)) continue;
        if (!TRIGGER_TYPES.has(a.trigger_type)) continue;
        await pool.query(
          `INSERT INTO client_ads_actions (
             config_id, action_name, display_name, goal_category,
             default_value, currency, trigger_type, url_pattern, trigger_config,
             suggested_by_claude, claude_reasoning
           ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
          [
            configId, a.action_name, a.display_name, a.goal_category,
            a.default_value ?? null, a.currency ?? "NOK",
            a.trigger_type, a.url_pattern ?? null, JSON.stringify(a.trigger_config ?? {}),
            true, a.claude_reasoning ?? null,
          ],
        );
      }

      return res.json({ success: true, configId });
    } catch (err) {
      console.error("[client-ads/configs POST] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre config", detail: String(err) });
    }
  });

  // ── GET /api/admin-room/agent/ads/configs ───────────────────────
  app.get("/api/admin-room/agent/ads/configs", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT
           c.id::text, c.client_project_id::text, c.client_name, c.client_website_url,
           c.business_type, c.business_subcategory, c.google_ads_conversion_id,
           c.oauth_connected_at, c.tracking_method, c.tracking_deployed_at,
           c.is_active, c.setup_completed_at, c.created_at,
           (SELECT COUNT(*)::int FROM client_ads_actions a WHERE a.config_id = c.id AND a.is_active) AS action_count,
           (SELECT COUNT(*)::int FROM client_ads_actions a WHERE a.config_id = c.id AND a.google_ads_label IS NOT NULL) AS deployed_action_count
         FROM client_ads_configs c
         WHERE c.content_producer_user_id = $1
         ORDER BY c.created_at DESC
         LIMIT 200`,
        [session.userId],
      );
      return res.json({ configs: r.rows });
    } catch (err) {
      console.error("[client-ads/configs GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente configs" });
    }
  });

  // ── GET /api/admin-room/agent/ads/configs/:id ───────────────────
  app.get("/api/admin-room/agent/ads/configs/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cfg = await pool.query(
        `SELECT * FROM client_ads_configs
           WHERE id = $1::uuid AND content_producer_user_id = $2
           LIMIT 1`,
        [req.params.id, session.userId],
      );
      if (!cfg.rowCount) return res.status(404).json({ error: "Ikke funnet" });

      const actions = await pool.query(
        `SELECT * FROM client_ads_actions
           WHERE config_id = $1::uuid
           ORDER BY created_at ASC`,
        [req.params.id],
      );
      return res.json({ config: cfg.rows[0], actions: actions.rows });
    } catch (err) {
      console.error("[client-ads/configs/:id GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente config" });
    }
  });
}
