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
import {
  buildGoogleAdsOauthStart,
  handleGoogleAdsOauthCallback,
  createConversionAction,
} from "./client-ads-google-oauth.js";
import {
  listGa4Accounts,
  provisionGa4Property,
  getGscVerificationToken,
  verifyGscSite,
  addGscSite,
  submitAllSitemaps,
  fetchSitemapStatus,
  requestIndexingForUrls,
  listGtmAccounts,
  provisionGtmContainer,
  importActionsToGtm,
  diagnoseClientSetup,
} from "./client-google-suite.js";
import {
  generateAllPrompts,
  fetchLiveSiteContext,
  type TargetAgent,
} from "./client-ai-prompt-generator.js";
import { fetchClientInsights } from "./client-insights-service.js";
import {
  listLinkedinAdAccounts,
  provisionLinkedinInsightTag,
  createLinkedinConversion,
} from "./client-linkedin-suite.js";
import {
  listMetaAdAccounts,
  listMetaPixels,
  provisionMetaPixel,
  createMetaCustomConversion,
} from "./client-meta-suite.js";
import {
  buildTiktokAuthUrl,
  exchangeTiktokAuthCode,
  listTiktokAdvertisers,
  listTiktokPixels,
  provisionTiktokPixel,
  mapActionToTiktokEvent,
  listTiktokLeadForms,
  syncTiktokLeads,
  listTiktokAudiences,
  createTiktokAudience,
  fetchTiktokAttribution,
  syncCrmEventToTiktok,
  listTiktokCreatives,
  createTiktokSmartVideo,
  discoverTiktokCreators,
  listTiktokBusinessPlugins,
  installTiktokBusinessPlugin,
  listTiktokLinkedAccounts,
} from "./client-tiktok-suite.js";
import {
  buildAdsAuthUrl,
  exchangeAdsCodeForToken,
  upsertAdsOauthConnection,
  adsOauthClientCreds,
} from "./role-room-ads-oauth.js";
import crypto from "node:crypto";

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

  // ── POST /:id/request-approval ──────────────────────────────────
  // Producer sender Agent-anbefalinger til klient for godkjenning.
  // Setter approval_status='awaiting_client' + deadline + varsler klient.
  app.post("/api/admin-room/agent/ads/configs/:id/request-approval", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body ?? {}) as {
      message?: string;
      client_user_id?: string;
      management_fee_pct?: number;
    };
    const message = body.message?.trim().slice(0, 4000) || null;

    // Validér management fee — 0-100%. 20% er default i schema, forhandlet
    // hvis annen verdi enn 20.
    const feePct = Number.isFinite(body.management_fee_pct)
      ? Math.max(0, Math.min(100, Number(body.management_fee_pct)))
      : 20;
    const feeNegotiated = feePct !== 20;

    try {
      // Gjenbruk MATERIAL_REVIEW_BUSINESS_DAYS-konvensjonen (3 default).
      const reviewDays = Number(process.env.MATERIAL_REVIEW_BUSINESS_DAYS);
      const days = Number.isFinite(reviewDays) && reviewDays >= 1 && reviewDays <= 30
        ? Math.floor(reviewDays) : 3;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);

      const upd = await pool.query(
        `UPDATE client_ads_configs
           SET approval_status = 'awaiting_client',
               sent_for_approval_at = now(),
               sent_for_approval_by = $1,
               approval_message = $2,
               review_deadline = $3,
               management_fee_pct = $5::numeric,
               management_fee_negotiated = $6,
               updated_at = now()
           WHERE id = $4::uuid AND content_producer_user_id = $1
         RETURNING id::text, client_project_id::text, client_name, management_fee_pct`,
        [session.userId, message, deadline, req.params.id, feePct, feeNegotiated],
      );
      if (!upd.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = upd.rows[0];

      // Send notification til klient (via eksisterende notifications-tabell).
      // Sender til alle med 'client'/'client_reviewer'-rolle på prosjektet
      // (begrenset til oppgitt user-id hvis gitt).
      try {
        let clientUsers: { id: string }[] = [];
        if (body.client_user_id) {
          clientUsers = [{ id: body.client_user_id }];
        } else {
          // Best-effort: hent klient-reviewere via casting_user_roles hvis tabellen finnes
          const r = await pool.query(
            `SELECT DISTINCT u.id FROM users u
               WHERE u.id IN (
                 SELECT user_id FROM casting_user_roles
                  WHERE project_id = $1::uuid AND role IN ('client','client_reviewer')
               )`,
            [cfg.client_project_id],
          ).catch(() => ({ rows: [] }));
          clientUsers = r.rows;
        }

        for (const u of clientUsers) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, priority, action_url, action_text, metadata)
             VALUES ($1, 'ads_approval_requested', $2, $3, 'high', $4, 'Se anbefalinger', $5::jsonb)`,
            [
              u.id,
              `Ads-anbefalinger venter på godkjenning — ${cfg.client_name}`,
              message ?? `Innholdsprodusent har sendt ${cfg.client_name} nye Google Ads-anbefalinger til gjennomgang. Frist: ${deadline.toLocaleDateString('nb-NO')}.`,
              `/role-room/client-economy?config=${cfg.id}`,
              JSON.stringify({ config_id: cfg.id, deadline: deadline.toISOString() }),
            ],
          ).catch((e) => console.warn('[ads-approval-request] notification insert failed', e.message));
        }
      } catch (e) {
        console.warn('[ads-approval-request] notification dispatch best-effort failed', e);
      }

      return res.json({ success: true, configId: cfg.id, deadline: deadline.toISOString() });
    } catch (err) {
      console.error('[ads-request-approval] failed', err);
      return res.status(500).json({ error: 'Klarte ikke å sende til godkjenning' });
    }
  });

  // ── B2: GET /api/admin-room/agent/ads/oauth/google/start ─────────
  // Returner OAuth-URL som producer redirecter til for å koble Google Ads.
  app.get("/api/admin-room/agent/ads/oauth/google/start", (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const baseUrl = (process.env.PUBLIC_BACKEND_URL || `https://${req.get("host") ?? "creatorhub-backend-rtbl.onrender.com"}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/admin-room/agent/ads/oauth/google/callback`;
    const configId = typeof req.query.configId === "string" ? req.query.configId : undefined;

    const r = buildGoogleAdsOauthStart({
      userId: session.userId,
      configId,
      redirectUri,
    });
    if ("error" in r) return res.status(503).json({ error: r.error });
    return res.json({ authUrl: r.authUrl });
  });

  // ── B2: GET /api/admin-room/agent/ads/oauth/google/callback ──────
  app.get("/api/admin-room/agent/ads/oauth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const errorParam = typeof req.query.error === "string" ? req.query.error : null;

    if (errorParam) {
      return res.redirect(`/role-room/agent/ads?oauth_error=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !state) return res.status(400).send("Missing code/state");

    const baseUrl = (process.env.PUBLIC_BACKEND_URL || `https://${req.get("host") ?? "creatorhub-backend-rtbl.onrender.com"}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/admin-room/agent/ads/oauth/google/callback`;

    const result = await handleGoogleAdsOauthCallback(pool, { code, state, redirectUri });
    if (!result.success) {
      return res.redirect(`/role-room/agent/ads?oauth_error=${encodeURIComponent(result.error ?? "unknown")}`);
    }
    const cfgParam = result.configId ? `&config=${encodeURIComponent(result.configId)}` : "";
    return res.redirect(`/role-room/agent/ads?oauth_success=1${cfgParam}`);
  });

  // ── B3: POST /api/admin-room/agent/ads/configs/:id/sync-to-google ─
  // Auto-opprett alle godkjente actions i klientens Google Ads-konto
  // og oppdater client_ads_actions med AW-ID + label.
  app.post("/api/admin-room/agent/ads/configs/:id/sync-to-google", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, google_ads_customer_id, approval_status, client_name
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.approval_status !== "approved") {
        return res.status(412).json({ error: "Konfig må være godkjent av klient før sync" });
      }
      if (!cfg.google_ads_customer_id) {
        return res.status(412).json({
          error: "Klientens Google Ads customer-ID mangler. Spør klienten om deres 10-sifrede Google Ads-konto-ID.",
        });
      }

      const actionsR = await pool.query(
        `SELECT id::text, action_name, display_name, goal_category, default_value, currency
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE AND google_ads_label IS NULL
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      const created: Array<{ actionId: string; awLabel: string | null; awId: string | null }> = [];
      const failed: Array<{ actionId: string; error: string }> = [];

      for (const a of actionsR.rows) {
        const r = await createConversionAction(pool, {
          producerUserId: session.userId,
          clientCustomerId: cfg.google_ads_customer_id,
          action: {
            actionName: a.action_name,
            displayName: a.display_name,
            goalCategory: a.goal_category,
            defaultValue: Number(a.default_value ?? 0),
            currency: a.currency || "NOK",
          },
        });
        if (r.ok) {
          await pool.query(
            `UPDATE client_ads_actions
               SET google_ads_action_id = $1::bigint,
                   google_ads_label = $2,
                   google_ads_created_at = now(),
                   updated_at = now()
              WHERE id = $3::uuid`,
            [r.result.conversionActionId, r.result.awConversionLabel, a.id],
          );
          created.push({
            actionId: a.id,
            awLabel: r.result.awConversionLabel ?? null,
            awId: r.result.awConversionId ?? null,
          });
        } else {
          failed.push({ actionId: a.id, error: r.error });
        }
      }

      // Sett config sin AW-ID hvis vi fikk en (samme for alle actions i kontoen)
      const firstAwId = created.find((c) => c.awId)?.awId;
      if (firstAwId) {
        await pool.query(
          `UPDATE client_ads_configs
             SET google_ads_conversion_id = $1,
                 updated_at = now()
            WHERE id = $2::uuid`,
          [firstAwId, req.params.id],
        );
      }

      return res.json({
        success: failed.length === 0,
        created: created.length,
        failed: failed.length,
        details: { created, failed },
      });
    } catch (err) {
      console.error("[sync-to-google] failed", err);
      return res.status(500).json({ error: "Sync feilet", detail: String(err) });
    }
  });

  // ── PATCH /api/admin-room/agent/ads/configs/:id — set customer-ID ─
  // Producer registrerer klientens Google Ads customer-ID (10 sifre).
  app.patch("/api/admin-room/agent/ads/configs/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { google_ads_customer_id?: string };
    const customerId = body.google_ads_customer_id?.replace(/\D/g, "").slice(0, 10) || null;
    if (!customerId || customerId.length !== 10) {
      return res.status(400).json({ error: "google_ads_customer_id må være 10 sifre" });
    }
    try {
      const upd = await pool.query(
        `UPDATE client_ads_configs
           SET google_ads_customer_id = $1,
               updated_at = now()
          WHERE id = $2::uuid AND content_producer_user_id = $3
         RETURNING id::text`,
        [customerId, req.params.id, session.userId],
      );
      if (!upd.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Patch feilet" });
    }
  });

  // ── GET /api/role-room/ads-approvals/pending — for klient-portal ──
  app.get("/api/role-room/ads-approvals/pending", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const projectId = typeof req.query.clientProjectId === "string" ? req.query.clientProjectId : null;
    if (!projectId) return res.status(400).json({ error: "clientProjectId er påkrevd" });

    try {
      const cfgs = await pool.query(
        `SELECT id::text, client_name, client_website_url, business_type, business_summary,
                approval_status, sent_for_approval_at, approval_message, review_deadline,
                claude_analysis, management_fee_pct, management_fee_negotiated
           FROM client_ads_configs
          WHERE client_project_id = $1::uuid
            AND approval_status IN ('awaiting_client','revision_requested')
          ORDER BY sent_for_approval_at DESC`,
        [projectId],
      ).catch(() => ({ rows: [] }));

      // Hent actions per config
      const results: any[] = [];
      for (const c of cfgs.rows) {
        const actions = await pool.query(
          `SELECT id::text, action_name, display_name, goal_category, default_value,
                  currency, trigger_type, url_pattern, claude_reasoning
             FROM client_ads_actions
            WHERE config_id = $1::uuid AND is_active = TRUE
            ORDER BY created_at ASC`,
          [c.id],
        );
        results.push({ config: c, actions: actions.rows });
      }
      return res.json({ pending: results });
    } catch (err) {
      console.error('[ads-approvals/pending] failed', err);
      return res.status(500).json({ error: 'Klarte ikke å hente pending approvals' });
    }
  });

  // ── GET /api/role-room/ads/management-fee-summary?clientProjectId=
  // Returnerer månedens akkumulerte ads-spend + mgmt-fee for alle aktive
  // configs i klient-prosjektet. 0 hvis ingen spend-data ennå.
  app.get("/api/role-room/ads/management-fee-summary", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const projectId = typeof req.query.clientProjectId === "string" ? req.query.clientProjectId : null;
    if (!projectId) return res.status(400).json({ error: "clientProjectId er påkrevd" });

    try {
      // Hent alle godkjente configs (kan vises selv om spend = 0 ennå)
      const cfgs = await pool.query(
        `SELECT id::text, client_name, management_fee_pct, management_fee_negotiated, approval_status,
                google_ads_conversion_id, google_ads_customer_id
           FROM client_ads_configs
          WHERE client_project_id = $1::uuid
            AND is_active = TRUE
            AND approval_status = 'approved'
          ORDER BY created_at DESC`,
        [projectId],
      ).catch(() => ({ rows: [] }));

      // Foreløpig: spend = 0 inntil P2 (Google Ads API spend-sync) lander.
      // Da hentes spend per config fra client_ads_campaign_spend-tabellen.
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const summary = cfgs.rows.map((c) => ({
        config_id: c.id,
        client_name: c.client_name,
        management_fee_pct: Number(c.management_fee_pct),
        is_negotiated: !!c.management_fee_negotiated,
        spend_mtd_nok: 0,                // TODO: koble til client_ads_campaign_spend
        mgmt_fee_mtd_nok: 0,
        is_synced: !!c.google_ads_conversion_id,  // TRUE etter B3 OAuth + config
      }));

      const totalSpend = summary.reduce((a, s) => a + s.spend_mtd_nok, 0);
      const totalMgmtFee = summary.reduce((a, s) => a + s.mgmt_fee_mtd_nok, 0);

      return res.json({
        month_start: monthStart.toISOString().slice(0, 10),
        configs: summary,
        totals: {
          spend_mtd_nok: totalSpend,
          mgmt_fee_mtd_nok: totalMgmtFee,
        },
      });
    } catch (err) {
      console.error('[mgmt-fee-summary] failed', err);
      return res.status(500).json({ error: 'Klarte ikke å hente sammendrag' });
    }
  });

  // ── POST /api/role-room/ads-approvals/:configId/approve ──────────
  app.post("/api/role-room/ads-approvals/:configId/approve", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const upd = await pool.query(
        `UPDATE client_ads_configs
           SET approval_status = 'approved',
               client_decided_at = now(),
               client_decided_by_user_id = $1,
               updated_at = now()
           WHERE id = $2::uuid AND approval_status = 'awaiting_client'
         RETURNING id::text, content_producer_user_id, client_name`,
        [session.userId, req.params.configId],
      );
      if (!upd.rowCount) return res.status(404).json({ error: "Ikke funnet eller ikke ventende" });
      const cfg = upd.rows[0];

      // Varsle producer
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, action_url, action_text, metadata)
         VALUES ($1, 'ads_approval_granted', $2, $3, 'high', $4, 'Se config + sync', $5::jsonb)`,
        [
          cfg.content_producer_user_id,
          `Klient har godkjent — ${cfg.client_name}`,
          `Klienten har godkjent ads-anbefalingene. Neste steg: koble Google Ads via OAuth (B2/B3) eller installer tracking-koden manuelt på klientens side.`,
          `/role-room/agent/ads?config=${cfg.id}`,
          JSON.stringify({ config_id: cfg.id, decided_by: session.userId }),
        ],
      ).catch((e) => console.warn('[approve] notification insert failed', e.message));

      return res.json({ success: true });
    } catch (err) {
      console.error('[ads-approve] failed', err);
      return res.status(500).json({ error: 'Klarte ikke å godkjenne' });
    }
  });

  // ── POST /api/role-room/ads-approvals/:configId/reject ──────────
  app.post("/api/role-room/ads-approvals/:configId/reject", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { feedback?: string };
    const feedback = body.feedback?.trim().slice(0, 4000) || null;

    try {
      const upd = await pool.query(
        `UPDATE client_ads_configs
           SET approval_status = 'revision_requested',
               client_decided_at = now(),
               client_decided_by_user_id = $1,
               client_feedback = $2,
               updated_at = now()
           WHERE id = $3::uuid AND approval_status = 'awaiting_client'
         RETURNING id::text, content_producer_user_id, client_name`,
        [session.userId, feedback, req.params.configId],
      );
      if (!upd.rowCount) return res.status(404).json({ error: "Ikke funnet eller ikke ventende" });
      const cfg = upd.rows[0];

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, action_url, action_text, metadata)
         VALUES ($1, 'ads_revision_requested', $2, $3, 'high', $4, 'Se feedback', $5::jsonb)`,
        [
          cfg.content_producer_user_id,
          `Klient vil ha endringer — ${cfg.client_name}`,
          feedback ?? `Klienten har bedt om endringer i ads-anbefalingene. Sjekk Agent for detaljer.`,
          `/role-room/agent/ads?config=${cfg.id}`,
          JSON.stringify({ config_id: cfg.id, feedback }),
        ],
      ).catch((e) => console.warn('[reject] notification insert failed', e.message));

      return res.json({ success: true });
    } catch (err) {
      console.error('[ads-reject] failed', err);
      return res.status(500).json({ error: 'Klarte ikke å avvise' });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // O2 / O3 / O4 — Full Google-suite per klient
  // (GA4 + Search Console + Tag Manager). Bruker producerens MCC-OAuth
  // — utvidet scope-set i role-room-ads-oauth.ts dekker alle fire APIer.
  // ════════════════════════════════════════════════════════════════════

  // ─── GA4 ─────────────────────────────────────────────────────────
  // GET /api/admin-room/agent/ads/ga4/accounts — list producerens GA4-kontoer
  app.get("/api/admin-room/agent/ads/ga4/accounts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const r = await listGa4Accounts(pool, session.userId);
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ accounts: r.accounts });
  });

  // POST /api/admin-room/agent/ads/configs/:id/ga4/provision
  // Opprett GA4-property + web-data-stream → returnerer G-XXX
  app.post("/api/admin-room/agent/ads/configs/:id/ga4/provision", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { accountName?: string; industryCategory?: string };
    if (!body.accountName) return res.status(400).json({ error: "accountName påkrevd" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_name, client_website_url, ga4_property_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.ga4_property_id) {
        return res.status(409).json({ error: "GA4-property finnes allerede", ga4_property_id: cfg.ga4_property_id });
      }

      const r = await provisionGa4Property(pool, {
        producerUserId: session.userId,
        accountName: body.accountName,
        displayName: cfg.client_name,
        websiteUrl: cfg.client_website_url,
        industryCategory: body.industryCategory,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });

      await pool.query(
        `UPDATE client_ads_configs
           SET ga4_property_id = $1,
               ga4_measurement_id = $2,
               ga4_data_stream_id = $3,
               ga4_setup_completed_at = now(),
               updated_at = now()
          WHERE id = $4::uuid`,
        [r.propertyId, r.measurementId, r.dataStreamId, req.params.id],
      );

      return res.json({
        success: true,
        propertyId: r.propertyId,
        measurementId: r.measurementId,
        dataStreamId: r.dataStreamId,
      });
    } catch (err) {
      console.error("[ga4-provision] failed", err);
      return res.status(500).json({ error: "GA4-provision feilet", detail: String(err) });
    }
  });

  // ─── GSC ─────────────────────────────────────────────────────────
  // POST /api/admin-room/agent/ads/configs/:id/gsc/verify
  // 2-stegs: (a) ?step=token henter meta-tag, klient limer inn,
  //          (b) ?step=verify når Google har sett tagen.
  app.post("/api/admin-room/agent/ads/configs/:id/gsc/verify", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const step = req.query.step === "verify" ? "verify" : "token";

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_website_url, gsc_property_url
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      const siteUrl = cfg.gsc_property_url || cfg.client_website_url;

      if (step === "token") {
        const r = await getGscVerificationToken(pool, {
          producerUserId: session.userId,
          siteUrl,
          method: "META",
        });
        if (!r.ok) return res.status(503).json({ error: r.error });

        await pool.query(
          `UPDATE client_ads_configs
             SET gsc_property_url = $1,
                 gsc_verification_method = 'meta_tag',
                 gsc_verification_token = $2,
                 updated_at = now()
            WHERE id = $3::uuid`,
          [siteUrl, r.token, req.params.id],
        );
        return res.json({
          step: "token",
          token: r.token,
          method: r.method,
          metaTag: `<meta name="google-site-verification" content="${r.token.replace(/^.+content="/, "").replace(/" \/>$/, "")}" />`,
          instructions: "Legg meta-tagen i <head> på klientens nettside, så trykk 'Verifiser nå'.",
        });
      }

      // step === "verify"
      const v = await verifyGscSite(pool, {
        producerUserId: session.userId,
        siteUrl,
        method: "META",
      });
      if (!v.ok) return res.status(503).json({ error: v.error });

      // Etter verifisering: legg site til Search Console
      await addGscSite(pool, { producerUserId: session.userId, siteUrl });

      await pool.query(
        `UPDATE client_ads_configs
           SET gsc_verified_at = now(), updated_at = now()
          WHERE id = $1::uuid`,
        [req.params.id],
      );
      return res.json({ step: "verify", success: true, siteUrl });
    } catch (err) {
      console.error("[gsc-verify] failed", err);
      return res.status(500).json({ error: "GSC-verify feilet", detail: String(err) });
    }
  });

  // POST /api/admin-room/agent/ads/configs/:id/gsc/sitemap
  // Auto-discover + submit ALLE sitemaps (robots.txt → fallback-stier).
  // Trigger også Indexing API for høyprioriterte URL'er (conversion-sider).
  app.post("/api/admin-room/agent/ads/configs/:id/gsc/sitemap", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { extraSitemapUrls?: string[]; indexUrls?: string[] };

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_website_url, gsc_property_url, gsc_verified_at
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (!cfg.gsc_verified_at) {
        return res.status(412).json({ error: "Verifiser siten med Search Console først." });
      }
      const siteUrl = cfg.gsc_property_url || cfg.client_website_url;

      // 1) Discover + submit sitemaps
      const sitemap = await submitAllSitemaps(pool, {
        producerUserId: session.userId,
        siteUrl,
        websiteUrl: cfg.client_website_url,
        extraSitemapUrls: body.extraSitemapUrls,
      });

      // 2) Hent action-URL'er (conversion-sider) + request indexing
      let indexing: any = null;
      const urls: string[] = [];
      if (Array.isArray(body.indexUrls) && body.indexUrls.length > 0) {
        urls.push(...body.indexUrls);
      } else {
        const actionUrlsR = await pool.query(
          `SELECT DISTINCT url_pattern FROM client_ads_actions
            WHERE config_id = $1::uuid AND is_active = TRUE AND url_pattern IS NOT NULL`,
          [req.params.id],
        );
        // url_pattern kan være regex — vi sender bare hvis det ser ut som absolutt URL
        for (const row of actionUrlsR.rows) {
          if (typeof row.url_pattern === "string" && /^https?:\/\//i.test(row.url_pattern)) {
            urls.push(row.url_pattern);
          }
        }
      }
      if (urls.length > 0) {
        indexing = await requestIndexingForUrls(pool, { producerUserId: session.userId, urls });
      }

      if (sitemap.submitted.length > 0) {
        await pool.query(
          `UPDATE client_ads_configs
             SET gsc_sitemap_submitted_at = now(), updated_at = now()
            WHERE id = $1::uuid`,
          [req.params.id],
        );
      }

      return res.json({
        success: sitemap.ok,
        discovered: sitemap.discovered,
        discoverySource: sitemap.source,
        submitted: sitemap.submitted,
        indexing,
      });
    } catch (err) {
      console.error("[gsc-sitemap] failed", err);
      return res.status(500).json({ error: "GSC-sitemap-submit feilet", detail: String(err) });
    }
  });

  // GET /api/admin-room/agent/ads/configs/:id/setup/diagnose
  // Helsesjekk for HELE Google-stacken + andre trackere på klient-siten:
  //   HTML-stack: GA4-tag, Ads-tag, GTM-snippet, Meta/LI/TikTok-pixels,
  //   Consent Mode v2, JSON-LD, SEO basics, noindex-blokkere
  //   GSC: robots.txt, sitemap-discovery, verifisering, property, URL-inspection
  app.get("/api/admin-room/agent/ads/configs/:id/setup/diagnose", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cfgR = await pool.query(
        `SELECT client_website_url, ga4_measurement_id, gtm_container_public_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const expectedAw = process.env.GOOGLE_ADS_CONVERSION_ID || null;
      const r = await diagnoseClientSetup(pool, {
        producerUserId: session.userId,
        websiteUrl: cfgR.rows[0].client_website_url,
        expectedGa4MeasurementId: cfgR.rows[0].ga4_measurement_id,
        expectedAwConversionId: expectedAw,
        expectedGtmContainerId: cfgR.rows[0].gtm_container_public_id,
      });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "Diagnose feilet", detail: String(err) });
    }
  });

  // Bakover-kompat alias
  app.get("/api/admin-room/agent/ads/configs/:id/gsc/diagnose", async (req, res) => {
    req.url = req.url.replace("/gsc/diagnose", "/setup/diagnose");
    app._router.handle(req, res, () => {});
  });

  // ════════════════════════════════════════════════════════════════════
  // LinkedIn — speil av Google: OAuth → list accounts → Insight Tag →
  // Conversion Rules → Reporting (i insights). CAPI er gated på
  // Conversions API-godkjenning (UI viser "venter på review").
  // ════════════════════════════════════════════════════════════════════

  // OAuth-start: returnerer authUrl
  app.get("/api/admin-room/agent/ads/oauth/linkedin/start", (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const creds = adsOauthClientCreds("linkedin");
    if (!creds) return res.status(503).json({ error: "LINKEDIN_CLIENT_ID/SECRET ikke satt på server." });

    const baseUrl = (process.env.PUBLIC_BACKEND_URL || `https://${req.get("host") ?? "creatorhub-backend-rtbl.onrender.com"}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/admin-room/agent/ads/oauth/linkedin/callback`;
    const configId = typeof req.query.configId === "string" ? req.query.configId : "";
    const state = `${session.userId}.${configId}.${crypto.randomBytes(12).toString("hex")}`;
    const authUrl = buildAdsAuthUrl("linkedin", { clientId: creds.clientId, redirectUri, state });
    if (!authUrl) return res.status(503).json({ error: "Klarte ikke å bygge LinkedIn-auth-URL" });
    return res.json({ authUrl });
  });

  // OAuth-callback
  app.get("/api/admin-room/agent/ads/oauth/linkedin/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    if (!code || !state) return res.status(400).send("Missing code/state");

    const [userId, configId] = state.split(".");
    if (!userId) return res.status(400).send("Invalid state");

    const creds = adsOauthClientCreds("linkedin");
    if (!creds) return res.status(503).send("LinkedIn creds mangler");
    const baseUrl = (process.env.PUBLIC_BACKEND_URL || `https://${req.get("host") ?? "creatorhub-backend-rtbl.onrender.com"}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/admin-room/agent/ads/oauth/linkedin/callback`;

    try {
      const tokenResult = await exchangeAdsCodeForToken("linkedin", { ...creds, code, redirectUri });
      if (!tokenResult.refreshToken || !tokenResult.accessToken) {
        return res.redirect(`/role-room/agent/ads?oauth_error=linkedin_missing_refresh_token`);
      }
      await upsertAdsOauthConnection(pool, {
        userId,
        platform: "linkedin",
        refreshToken: tokenResult.refreshToken,
        accessToken: tokenResult.accessToken,
        expiresInSec: tokenResult.expiresInSec,
        scopes: ["r_ads", "r_ads_reporting", "rw_ads", "r_organization_admin"],
      });
      const cfgParam = configId ? `&config=${encodeURIComponent(configId)}` : "";
      return res.redirect(`/role-room/agent/ads?oauth_success=linkedin${cfgParam}`);
    } catch (err) {
      console.error("[linkedin-oauth] callback failed", err);
      return res.redirect(`/role-room/agent/ads?oauth_error=linkedin_${encodeURIComponent(String(err).slice(0, 80))}`);
    }
  });

  // List LinkedIn Ad Accounts
  app.get("/api/admin-room/agent/ads/linkedin/accounts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const r = await listLinkedinAdAccounts(pool, session.userId);
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ accounts: r.accounts });
  });

  // POST .../linkedin/provision-insight-tag — oppretter (eller henter) Insight Tag for klient
  app.post("/api/admin-room/agent/ads/configs/:id/linkedin/provision-insight-tag", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { adAccountUrn?: string };
    if (!body.adAccountUrn) return res.status(400).json({ error: "adAccountUrn påkrevd" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_name, client_website_url, linkedin_insight_tag_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.linkedin_insight_tag_id) {
        return res.status(409).json({ error: "Insight Tag finnes alt", linkedinInsightTagId: cfg.linkedin_insight_tag_id });
      }

      const r = await provisionLinkedinInsightTag(pool, {
        producerUserId: session.userId,
        adAccountUrn: body.adAccountUrn,
        clientName: cfg.client_name,
        websiteUrl: cfg.client_website_url,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });

      // Hent account-name også
      const accountName = body.adAccountUrn.split(":").pop() ?? null;

      await pool.query(
        `UPDATE client_ads_configs
           SET linkedin_account_urn = $1,
               linkedin_account_name = COALESCE(linkedin_account_name, $2),
               linkedin_insight_tag_id = $3,
               linkedin_setup_completed_at = now(),
               platforms_selected = ARRAY(SELECT DISTINCT unnest(platforms_selected || ARRAY['linkedin']::TEXT[])),
               updated_at = now()
          WHERE id = $4::uuid`,
        [body.adAccountUrn, accountName, r.insightTagId, req.params.id],
      );

      return res.json({
        success: true,
        insightTagId: r.insightTagId,
        partnerId: r.partnerId,
        tagSnippet: r.tagSnippet,
      });
    } catch (err) {
      console.error("[linkedin-provision] failed", err);
      return res.status(500).json({ error: "Provision feilet", detail: String(err) });
    }
  });

  // POST .../linkedin/sync-conversions — opprett conversion rules for alle godkjente actions
  app.post("/api/admin-room/agent/ads/configs/:id/linkedin/sync-conversions", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const cfgR = await pool.query(
        `SELECT linkedin_insight_tag_id, linkedin_account_urn, approval_status, client_name
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.approval_status !== "approved") {
        return res.status(412).json({ error: "Konfig må være approved før sync" });
      }
      if (!cfg.linkedin_insight_tag_id || !cfg.linkedin_account_urn) {
        return res.status(412).json({ error: "Opprett Insight Tag først." });
      }

      const actionsR = await pool.query(
        `SELECT id::text, action_name, display_name, goal_category, default_value,
                currency, trigger_type, url_pattern
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE AND linkedin_conversion_id IS NULL
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      const created: Array<{ actionId: string; conversionId: number }> = [];
      const failed: Array<{ actionId: string; error: string }> = [];

      for (const a of actionsR.rows) {
        const r = await createLinkedinConversion(pool, {
          producerUserId: session.userId,
          insightTagId: cfg.linkedin_insight_tag_id,
          adAccountUrn: cfg.linkedin_account_urn,
          action: {
            actionName: a.action_name,
            displayName: a.display_name,
            goalCategory: a.goal_category,
            defaultValue: Number(a.default_value ?? 0),
            currency: a.currency || "NOK",
            triggerType: a.trigger_type,
            urlPattern: a.url_pattern,
          },
        });
        if (r.ok) {
          await pool.query(
            `UPDATE client_ads_actions
                SET linkedin_conversion_id = $1::bigint,
                    linkedin_conversion_urn = $2,
                    linkedin_synced_at = now(),
                    updated_at = now()
              WHERE id = $3::uuid`,
            [r.conversionId, r.conversionUrn, a.id],
          );
          created.push({ actionId: a.id, conversionId: r.conversionId });
        } else {
          failed.push({ actionId: a.id, error: r.error });
        }
      }

      return res.json({ success: true, created, failed });
    } catch (err) {
      console.error("[linkedin-sync] failed", err);
      return res.status(500).json({ error: "Sync feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Meta (Facebook + Instagram) — Wave 2: Pixel + Custom Conversions
  // Gjenbruker Instagram OAuth-connection (samme scopes: ads_management m.fl.)
  // OBS: Meta App Review pending per scope — fungerer for app-admins nå.
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/meta/accounts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const r = await listMetaAdAccounts(pool, session.userId);
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ accounts: r.accounts });
  });

  app.get("/api/admin-room/agent/ads/meta/pixels", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const adAccountId = typeof req.query.adAccountId === "string" ? req.query.adAccountId : "";
    if (!adAccountId) return res.status(400).json({ error: "adAccountId påkrevd" });
    const r = await listMetaPixels(pool, { producerUserId: session.userId, adAccountId });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ pixels: r.pixels });
  });

  // POST .../meta/provision-pixel — opprett eller attach pixel for klient
  app.post("/api/admin-room/agent/ads/configs/:id/meta/provision-pixel", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { adAccountId?: string; existingPixelId?: string; pixelName?: string };
    if (!body.adAccountId) return res.status(400).json({ error: "adAccountId påkrevd" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_name, meta_pixel_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.meta_pixel_id) {
        return res.status(409).json({ error: "Pixel finnes alt", metaPixelId: cfg.meta_pixel_id });
      }

      // Hvis eksisterende pixel valgt: attach uten å lage ny
      let pixelId: string;
      let pixelName: string;
      let baseCode: string | null = null;
      if (body.existingPixelId) {
        pixelId = body.existingPixelId;
        pixelName = body.pixelName ?? `Existing: ${body.existingPixelId}`;
        baseCode = `<!-- Eksisterende Meta Pixel — ${body.existingPixelId} -->
<!-- Antar at klient allerede har dette installert. Hvis ikke, bruk install_meta_pixel-prompten. -->`;
      } else {
        const r = await provisionMetaPixel(pool, {
          producerUserId: session.userId,
          adAccountId: body.adAccountId,
          pixelName: body.pixelName ?? `RR-Agent: ${cfg.client_name}`,
        });
        if (!r.ok) return res.status(503).json({ error: r.error });
        pixelId = r.pixelId;
        pixelName = r.pixelName;
        baseCode = r.baseCode;
      }

      await pool.query(
        `UPDATE client_ads_configs
           SET meta_ad_account_id = $1,
               meta_pixel_id = $2,
               meta_pixel_name = $3,
               meta_setup_completed_at = now(),
               platforms_selected = ARRAY(SELECT DISTINCT unnest(platforms_selected || ARRAY['meta']::TEXT[])),
               updated_at = now()
          WHERE id = $4::uuid`,
        [body.adAccountId, pixelId, pixelName, req.params.id],
      );

      return res.json({
        success: true,
        pixelId,
        pixelName,
        baseCode,
      });
    } catch (err) {
      console.error("[meta-provision] failed", err);
      return res.status(500).json({ error: "Provision feilet", detail: String(err) });
    }
  });

  // POST .../meta/sync-conversions — opprett custom conversions per action
  app.post("/api/admin-room/agent/ads/configs/:id/meta/sync-conversions", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const cfgR = await pool.query(
        `SELECT meta_pixel_id, meta_ad_account_id, approval_status
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.approval_status !== "approved") {
        return res.status(412).json({ error: "Konfig må være approved før sync" });
      }
      if (!cfg.meta_pixel_id || !cfg.meta_ad_account_id) {
        return res.status(412).json({ error: "Sett opp Pixel først." });
      }

      const actionsR = await pool.query(
        `SELECT id::text, action_name, display_name, goal_category, default_value,
                currency, trigger_type, url_pattern
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE AND meta_custom_conversion_id IS NULL
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      const created: Array<{ actionId: string; conversionId: string; eventName: string }> = [];
      const failed: Array<{ actionId: string; error: string }> = [];

      for (const a of actionsR.rows) {
        const r = await createMetaCustomConversion(pool, {
          producerUserId: session.userId,
          adAccountId: cfg.meta_ad_account_id,
          pixelId: cfg.meta_pixel_id,
          action: {
            actionName: a.action_name,
            displayName: a.display_name,
            goalCategory: a.goal_category,
            defaultValue: Number(a.default_value ?? 0),
            currency: a.currency || "NOK",
            triggerType: a.trigger_type,
            urlPattern: a.url_pattern,
          },
        });
        if (r.ok) {
          await pool.query(
            `UPDATE client_ads_actions
                SET meta_custom_conversion_id = $1,
                    meta_event_name = $2,
                    meta_synced_at = now(),
                    updated_at = now()
              WHERE id = $3::uuid`,
            [r.customConversionId, r.eventName, a.id],
          );
          created.push({ actionId: a.id, conversionId: r.customConversionId, eventName: r.eventName });
        } else {
          failed.push({ actionId: a.id, error: r.error });
        }
      }

      return res.json({ success: true, created, failed });
    } catch (err) {
      console.error("[meta-sync] failed", err);
      return res.status(500).json({ error: "Sync feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok — Wave 3: Pixel + Events + Reporting
  // Bruker eget OAuth-flow (Business API) — NIKKE same som creator-OAuth.
  // Tokens lagres i role_room_ads_oauth_connections m/ platform='tiktok'.
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/oauth/tiktok/start", (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const baseUrl = (process.env.PUBLIC_BACKEND_URL || `https://${req.get("host") ?? ""}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/admin-room/agent/ads/oauth/tiktok/callback`;
    const configId = typeof req.query.configId === "string" ? req.query.configId : "";
    const state = `${session.userId}.${configId}.${crypto.randomBytes(12).toString("hex")}`;
    const authUrl = buildTiktokAuthUrl({ state, redirectUri });
    if (!authUrl) return res.status(503).json({ error: "TIKTOK_BUSINESS_APP_ID/SECRET ikke satt." });
    return res.json({ authUrl });
  });

  app.get("/api/admin-room/agent/ads/oauth/tiktok/callback", async (req, res) => {
    const authCode = typeof req.query.auth_code === "string" ? req.query.auth_code : typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    if (!authCode || !state) return res.status(400).send("Missing auth_code/state");

    const [userId, configId] = state.split(".");
    if (!userId) return res.status(400).send("Invalid state");

    try {
      const tokenResult = await exchangeTiktokAuthCode(authCode);
      if (!tokenResult) return res.redirect(`/role-room/agent/ads?oauth_error=tiktok_exchange_failed`);

      // Lagre i role_room_ads_oauth_connections (raw — TikTok tokens er long-lived).
      // NB: vi bruker SAMME tabell som Google/LinkedIn, så pool-spørringen skiller seg
      // litt fra resten siden TikTok ikke har refresh-token og expiry-felt.
      await pool.query(
        `INSERT INTO role_room_ads_oauth_connections
            (user_id, platform, access_token, refresh_token, token_expires_at,
             scopes, account_ref, connection_state, last_refreshed_at)
         VALUES ($1, 'tiktok', $2, '', NULL, $3, $4, 'connected', now())
         ON CONFLICT (user_id, platform) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             scopes = EXCLUDED.scopes,
             account_ref = EXCLUDED.account_ref,
             connection_state = 'connected',
             last_refreshed_at = now()`,
        [
          userId,
          tokenResult.accessToken,
          JSON.stringify(["advertiser.read", "pixel.read", "pixel.write", "ads.read"]),
          tokenResult.advertiserIds.join(","),
        ],
      );

      const cfgParam = configId ? `&config=${encodeURIComponent(configId)}` : "";
      return res.redirect(`/role-room/agent/ads?oauth_success=tiktok${cfgParam}`);
    } catch (err) {
      console.error("[tiktok-oauth] callback failed", err);
      return res.redirect(`/role-room/agent/ads?oauth_error=tiktok_${encodeURIComponent(String(err).slice(0, 80))}`);
    }
  });

  app.get("/api/admin-room/agent/ads/tiktok/advertisers", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const r = await listTiktokAdvertisers(pool, session.userId);
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ advertisers: r.advertisers });
  });

  app.get("/api/admin-room/agent/ads/tiktok/pixels", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const r = await listTiktokPixels(pool, { producerUserId: session.userId, advertiserId });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ pixels: r.pixels });
  });

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/provision-pixel", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { advertiserId?: string; existingPixelCode?: string; pixelName?: string };
    if (!body.advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_name, tiktok_pixel_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.tiktok_pixel_id) {
        return res.status(409).json({ error: "Pixel finnes alt", tiktokPixelId: cfg.tiktok_pixel_id });
      }

      let pixelCode: string;
      let pixelName: string;
      let baseCode: string;
      if (body.existingPixelCode) {
        pixelCode = body.existingPixelCode;
        pixelName = body.pixelName ?? `Existing: ${body.existingPixelCode}`;
        // Ekstraher snippet fra koden — bruker samme template som ny
        baseCode = `<!-- Eksisterende TikTok Pixel — ${body.existingPixelCode} -->
<!-- Antar at klient allerede har dette installert. -->`;
      } else {
        const r = await provisionTiktokPixel(pool, {
          producerUserId: session.userId,
          advertiserId: body.advertiserId,
          pixelName: body.pixelName ?? `RR-Agent: ${cfg.client_name}`,
        });
        if (!r.ok) return res.status(503).json({ error: r.error });
        pixelCode = r.pixelCode;
        pixelName = r.pixelName;
        baseCode = r.baseCode;
      }

      await pool.query(
        `UPDATE client_ads_configs
           SET tiktok_advertiser_id = $1,
               tiktok_pixel_id = $2,
               tiktok_pixel_name = $3,
               tiktok_setup_completed_at = now(),
               platforms_selected = ARRAY(SELECT DISTINCT unnest(platforms_selected || ARRAY['tiktok']::TEXT[])),
               updated_at = now()
          WHERE id = $4::uuid`,
        [body.advertiserId, pixelCode, pixelName, req.params.id],
      );

      return res.json({ success: true, pixelCode, pixelName, baseCode });
    } catch (err) {
      console.error("[tiktok-provision] failed", err);
      return res.status(500).json({ error: "Provision feilet", detail: String(err) });
    }
  });

  // Sync — TikTok-events er pixel-side, ikke API-opprettet
  // Vi lagrer event-mapping per action så AI-prompter kan bruke det.
  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/sync-events", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cfgR = await pool.query(
        `SELECT tiktok_pixel_id, approval_status
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.approval_status !== "approved") {
        return res.status(412).json({ error: "Konfig må være approved før sync" });
      }
      if (!cfg.tiktok_pixel_id) return res.status(412).json({ error: "Sett opp Pixel først." });

      const actionsR = await pool.query(
        `SELECT id::text, action_name, goal_category
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE AND tiktok_event_name IS NULL
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      const created: Array<{ actionId: string; eventName: string }> = [];
      for (const a of actionsR.rows) {
        const eventName = mapActionToTiktokEvent({
          goalCategory: a.goal_category,
          actionName: a.action_name,
        });
        await pool.query(
          `UPDATE client_ads_actions
              SET tiktok_event_id = $1,
                  tiktok_event_name = $2,
                  tiktok_synced_at = now(),
                  updated_at = now()
            WHERE id = $3::uuid`,
          [a.action_name, eventName, a.id],
        );
        created.push({ actionId: a.id, eventName });
      }
      return res.json({ success: true, created, failed: [] });
    } catch (err) {
      console.error("[tiktok-sync] failed", err);
      return res.status(500).json({ error: "Sync feilet", detail: String(err) });
    }
  });

  app.patch("/api/admin-room/agent/ads/configs/:id/tiktok/capi-token", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { capiToken?: string };
    if (!body.capiToken) return res.status(400).json({ error: "capiToken påkrevd" });
    await pool.query(
      `UPDATE client_ads_configs
          SET tiktok_capi_access_token = $1, updated_at = now()
        WHERE id = $2::uuid AND content_producer_user_id = $3`,
      [body.capiToken, req.params.id, session.userId],
    );
    return res.json({ success: true });
  });

  // PATCH .../meta/capi-token — lagre CAPI token (kryptert ved annet steg)
  app.patch("/api/admin-room/agent/ads/configs/:id/meta/capi-token", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { capiToken?: string };
    if (!body.capiToken) return res.status(400).json({ error: "capiToken påkrevd" });
    await pool.query(
      `UPDATE client_ads_configs
          SET meta_capi_access_token = $1, updated_at = now()
        WHERE id = $2::uuid AND content_producer_user_id = $3`,
      [body.capiToken, req.params.id, session.userId],
    );
    return res.json({ success: true });
  });

  // PATCH .../linkedin/capi-token — lagre CAPI access token (kryptert)
  // Krever LinkedIn Conversions API-godkjenning (Standard tier) — UI viser
  // "venter på review" til Daniel har den. Endpoint fungerer uansett —
  // bare token-en kommer ikke til nytte før produktet er godkjent.
  app.patch("/api/admin-room/agent/ads/configs/:id/linkedin/capi-token", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { capiToken?: string };
    if (!body.capiToken) return res.status(400).json({ error: "capiToken påkrevd" });
    // NB: vi lagrer rå-token her. Når kryptering går i produksjon, encrypte
    // før lagring (samme AES-256-GCM-pattern som refresh_token).
    await pool.query(
      `UPDATE client_ads_configs
          SET linkedin_capi_access_token = $1, updated_at = now()
        WHERE id = $2::uuid AND content_producer_user_id = $3`,
      [body.capiToken, req.params.id, session.userId],
    );
    return res.json({ success: true });
  });

  // GET /api/admin-room/agent/ads/configs/:id/insights?range=28d
  // Aggregert KPI-dashboard: GA4 + Google Ads + GSC + tracked events
  // + auto-genererte observasjoner. Brukes av ClientInsightsPanel.
  app.get("/api/admin-room/agent/ads/configs/:id/insights", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const rangeRaw = typeof req.query.range === "string" ? req.query.range : "28d";
    const rangeDays = Math.max(1, Math.min(365, parseInt(rangeRaw, 10) || 28));

    try {
      const insights = await fetchClientInsights(pool, {
        producerUserId: session.userId,
        configId: req.params.id,
        rangeDays,
      });
      if (!insights) return res.status(404).json({ error: "Config ikke funnet" });
      return res.json(insights);
    } catch (err) {
      console.error("[insights] failed", err);
      return res.status(500).json({ error: "Insights-henting feilet", detail: String(err) });
    }
  });

  // GET /api/admin-room/agent/ads/configs/:id/ai-prompts?target=loveable
  // Genererer 10 klar-til-paste prompter for klient's AI-kode-agent.
  // Hver prompt inneholder klient-spesifikke ID-er + tilpasses target-agenten
  // (Loveable / v0 / Bolt / Cursor / generic).
  app.get("/api/admin-room/agent/ads/configs/:id/ai-prompts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const target = (typeof req.query.target === "string" ? req.query.target : "loveable") as TargetAgent;
    if (!["loveable", "v0", "bolt", "cursor", "generic"].includes(target)) {
      return res.status(400).json({ error: "Ugyldig target — bruk loveable/v0/bolt/cursor/generic" });
    }

    try {
      const cfgR = await pool.query(
        `SELECT client_name, client_website_url, business_type, business_summary,
                ga4_measurement_id, gtm_container_public_id,
                linkedin_insight_tag_id, meta_pixel_id, tiktok_pixel_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];

      const actionsR = await pool.query(
        `SELECT action_name, display_name, google_ads_label, trigger_type,
                default_value, currency, url_pattern,
                linkedin_conversion_id, meta_custom_conversion_id, meta_event_name,
                tiktok_event_name
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE
          ORDER BY created_at ASC`,
        [req.params.id],
      );

      // LinkedIn partner-ID må hentes separat (det er ikke det samme som
      // insight tag ID — det er en numerisk verdi en grad lavere).
      // For prompt-bruk er insight_tag_id good enough — det er den klient
      // bruker i pixel-snippeten. Vi reuse her.
      const linkedinPartnerId = cfg.linkedin_insight_tag_id ?? null;

      // Hent ekte live-data fra klient-siten (best-effort, lite latens)
      const liveSite = await fetchLiveSiteContext(cfg.client_website_url).catch(() => undefined);

      const prompts = generateAllPrompts({
        clientName: cfg.client_name,
        websiteUrl: cfg.client_website_url,
        ga4MeasurementId: cfg.ga4_measurement_id,
        awConversionId: process.env.GOOGLE_ADS_CONVERSION_ID || null,
        gtmContainerId: cfg.gtm_container_public_id,
        linkedinPartnerId,
        metaPixelId: cfg.meta_pixel_id ?? null,
        tiktokPixelCode: cfg.tiktok_pixel_id ?? null,
        businessType: cfg.business_type,
        businessSummary: cfg.business_summary,
        actions: actionsR.rows.map((a) => ({
          actionName: a.action_name,
          displayName: a.display_name,
          label: a.google_ads_label,
          triggerType: a.trigger_type,
          defaultValue: Number(a.default_value ?? 0),
          currency: a.currency || "NOK",
          urlPattern: a.url_pattern,
          linkedinConversionId: a.linkedin_conversion_id ?? null,
          metaEventName: a.meta_event_name ?? null,
          metaCustomConversionId: a.meta_custom_conversion_id ?? null,
          tiktokEventName: a.tiktok_event_name ?? null,
        })),
        targetAgent: target,
        liveSite,
      });

      return res.json({ target, prompts });
    } catch (err) {
      console.error("[ai-prompts] failed", err);
      return res.status(500).json({ error: "Prompt-generering feilet", detail: String(err) });
    }
  });

  // GET /api/admin-room/agent/ads/configs/:id/gsc/status
  // Hent live sitemap-status (errors/warnings/lastDownloaded per sitemap).
  app.get("/api/admin-room/agent/ads/configs/:id/gsc/status", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const cfgR = await pool.query(
        `SELECT client_website_url, gsc_property_url
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const siteUrl = cfgR.rows[0].gsc_property_url || cfgR.rows[0].client_website_url;
      const r = await fetchSitemapStatus(pool, { producerUserId: session.userId, siteUrl });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json({ siteUrl, sitemaps: r.sitemaps });
    } catch (err) {
      return res.status(500).json({ error: "Status-hent feilet", detail: String(err) });
    }
  });

  // ─── GTM ─────────────────────────────────────────────────────────
  // GET /api/admin-room/agent/ads/gtm/accounts
  app.get("/api/admin-room/agent/ads/gtm/accounts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const r = await listGtmAccounts(pool, session.userId);
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ accounts: r.accounts });
  });

  // POST /api/admin-room/agent/ads/configs/:id/gtm/provision
  app.post("/api/admin-room/agent/ads/configs/:id/gtm/provision", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { accountId?: string };
    if (!body.accountId) return res.status(400).json({ error: "accountId påkrevd" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, client_name, client_website_url, gtm_container_public_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (cfg.gtm_container_public_id) {
        return res.status(409).json({ error: "GTM-container finnes allerede", gtm_container_public_id: cfg.gtm_container_public_id });
      }

      const domain = (() => {
        try { return new URL(cfg.client_website_url).hostname; } catch { return undefined; }
      })();
      const r = await provisionGtmContainer(pool, {
        producerUserId: session.userId,
        accountId: body.accountId,
        containerName: cfg.client_name,
        domainName: domain,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });

      await pool.query(
        `UPDATE client_ads_configs
           SET gtm_account_id = $1,
               gtm_container_id = $2,
               gtm_container_public_id = $3,
               gtm_setup_completed_at = now(),
               updated_at = now()
          WHERE id = $4::uuid`,
        [r.accountId, r.containerId, r.publicId, req.params.id],
      );

      return res.json({
        success: true,
        accountId: r.accountId,
        containerId: r.containerId,
        publicId: r.publicId,
      });
    } catch (err) {
      console.error("[gtm-provision] failed", err);
      return res.status(500).json({ error: "GTM-provision feilet", detail: String(err) });
    }
  });

  // POST /api/admin-room/agent/ads/configs/:id/gtm/import-tags
  // Importer alle godkjente conversion-actions som GTM-tags + triggers.
  // Forutsetter at sync-to-google har kjørt (AW-label trengs).
  app.post("/api/admin-room/agent/ads/configs/:id/gtm/import-tags", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const cfgR = await pool.query(
        `SELECT id::text, gtm_account_id, gtm_container_id, gtm_container_public_id
           FROM client_ads_configs
          WHERE id = $1::uuid AND content_producer_user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!cfgR.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      const cfg = cfgR.rows[0];
      if (!cfg.gtm_container_id) {
        return res.status(412).json({ error: "Opprett GTM-container først." });
      }

      const actionsR = await pool.query(
        `SELECT action_name, display_name, goal_category, default_value, currency,
                trigger_type, url_pattern, google_ads_label
           FROM client_ads_actions
          WHERE config_id = $1::uuid AND is_active = TRUE AND google_ads_label IS NOT NULL
          ORDER BY created_at ASC`,
        [req.params.id],
      );
      if (!actionsR.rowCount) {
        return res.status(412).json({
          error: "Ingen actions med Google Ads-label. Kjør 'Synk til Google Ads' først.",
        });
      }

      const awBaseId = process.env.GOOGLE_ADS_CONVERSION_ID || "AW-18197346774";

      const r = await importActionsToGtm(pool, {
        producerUserId: session.userId,
        accountId: cfg.gtm_account_id,
        containerId: cfg.gtm_container_id,
        awConversionId: awBaseId,
        actions: actionsR.rows.map((a) => ({
          actionName: a.action_name,
          displayName: a.display_name,
          label: a.google_ads_label,
          defaultValue: Number(a.default_value ?? 0),
          currency: a.currency || "NOK",
          triggerType: a.trigger_type,
          urlPattern: a.url_pattern,
        })),
      });
      if (!r.ok) return res.status(503).json({ error: r.error });

      return res.json({
        success: true,
        imported: r.imported,
        failed: r.failed,
        details: r.details,
        nextStep: "Lim GTM-snippet i klientens <head>/<body> — publiser deretter container fra GTM-UI.",
      });
    } catch (err) {
      console.error("[gtm-import] failed", err);
      return res.status(500).json({ error: "GTM-import feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Lead Management — /page/list/, /page/lead/list/
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/tiktok/lead-forms", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const r = await listTiktokLeadForms(pool, { producerUserId: session.userId, advertiserId });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ forms: r.forms });
  });

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/sync-leads", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as { advertiserId?: string; formId?: string; sinceMs?: number };
    if (!body.advertiserId || !body.formId) {
      return res.status(400).json({ error: "advertiserId + formId påkrevd" });
    }
    try {
      const r = await syncTiktokLeads(pool, {
        producerUserId: session.userId,
        advertiserId: body.advertiserId,
        formId: body.formId,
        configId: req.params.id !== "self" ? req.params.id : null,
        sinceMs: body.sinceMs,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json(r);
    } catch (err) {
      console.error("[tiktok-sync-leads] failed", err);
      return res.status(500).json({ error: "Lead-sync feilet", detail: String(err) });
    }
  });

  // GET leads for a config (or own marketing-cockpit if id='self')
  app.get("/api/admin-room/agent/ads/configs/:id/tiktok/leads", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const isSelf = req.params.id === "self";
    try {
      const r = await pool.query(
        `SELECT id::text, advertiser_id, form_id, form_name, tiktok_lead_id,
                email, phone, full_name, custom_fields,
                lead_created_at, synced_at, pushed_to_crm, status
           FROM tiktok_lead_records
          WHERE producer_user_id = $1::uuid
            AND ($2::boolean OR config_id = $3::uuid)
            AND ($2::boolean = FALSE OR config_id IS NULL)
          ORDER BY lead_created_at DESC NULLS LAST
          LIMIT 200`,
        [session.userId, isSelf, isSelf ? null : req.params.id],
      );
      return res.json({ leads: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "Kunne ikke hente leads", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Audience Management — /dmp/custom_audience/*
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/tiktok/audiences", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const r = await listTiktokAudiences(pool, { producerUserId: session.userId, advertiserId });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ audiences: r.audiences });
  });

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/create-audience", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as {
      advertiserId?: string;
      name?: string;
      sourceDescription?: string;
      identifiers?: Array<{ email?: string; phone?: string }>;
    };
    if (!body.advertiserId || !body.name || !Array.isArray(body.identifiers) || body.identifiers.length === 0) {
      return res.status(400).json({ error: "advertiserId + name + identifiers[] påkrevd" });
    }
    try {
      const r = await createTiktokAudience(pool, {
        producerUserId: session.userId,
        advertiserId: body.advertiserId,
        name: body.name,
        sourceDescription: body.sourceDescription,
        identifiers: body.identifiers,
        configId: req.params.id !== "self" ? req.params.id : null,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json(r);
    } catch (err) {
      console.error("[tiktok-create-audience] failed", err);
      return res.status(500).json({ error: "Audience-opprettelse feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Measurement — attribution-rapport
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/configs/:id/tiktok/attribution", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || "28", 10)));
    const force = req.query.force === "1";
    const isSelf = req.params.id === "self";

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    try {
      const r = await fetchTiktokAttribution(pool, {
        producerUserId: session.userId,
        advertiserId,
        startDate: fmt(start),
        endDate: fmt(end),
        configId: isSelf ? null : req.params.id,
        forceRefresh: force,
      });
      if (!r) return res.status(503).json({ error: "Klarte ikke å hente attribution" });
      return res.json({ ...r, days, startDate: fmt(start), endDate: fmt(end) });
    } catch (err) {
      console.error("[tiktok-attribution] failed", err);
      return res.status(500).json({ error: "Attribution-henting feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok CRM Event Management — server-side conversion-sync
  // ════════════════════════════════════════════════════════════════════

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/sync-crm-event", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as {
      advertiserId?: string;
      eventName?: string;
      eventTimeMs?: number;
      eventSource?: string;
      externalUserId?: string;
      rawEmail?: string;
      rawPhone?: string;
      eventValue?: number;
      eventCurrency?: string;
      customProperties?: Record<string, unknown>;
    };
    if (!body.advertiserId || !body.eventName) {
      return res.status(400).json({ error: "advertiserId + eventName påkrevd" });
    }
    try {
      const r = await syncCrmEventToTiktok(pool, {
        producerUserId: session.userId,
        advertiserId: body.advertiserId,
        eventName: body.eventName,
        eventTime: body.eventTimeMs ? new Date(body.eventTimeMs) : undefined,
        eventSource: body.eventSource,
        externalUserId: body.externalUserId,
        rawEmail: body.rawEmail,
        rawPhone: body.rawPhone,
        eventValue: body.eventValue,
        eventCurrency: body.eventCurrency,
        customProperties: body.customProperties,
        configId: req.params.id !== "self" ? req.params.id : null,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json(r);
    } catch (err) {
      console.error("[tiktok-crm-event] failed", err);
      return res.status(500).json({ error: "CRM-event-sync feilet", detail: String(err) });
    }
  });

  app.get("/api/admin-room/agent/ads/configs/:id/tiktok/crm-events", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const isSelf = req.params.id === "self";
    try {
      const r = await pool.query(
        `SELECT id::text, event_name, event_time, event_source, event_value,
                event_currency, delivery_status, delivered_at, attempt_count,
                last_error, created_at
           FROM tiktok_crm_event_log
          WHERE producer_user_id = $1::uuid
            AND ($2::boolean OR config_id = $3::uuid)
            AND ($2::boolean = FALSE OR config_id IS NULL)
          ORDER BY event_time DESC NULLS LAST
          LIMIT 100`,
        [session.userId, isSelf, isSelf ? null : req.params.id],
      );

      // Aggregert sammendrag (siste 7 dager)
      const summary = await pool.query(
        `SELECT delivery_status, COUNT(*)::int AS n
           FROM tiktok_crm_event_log
          WHERE producer_user_id = $1::uuid
            AND ($2::boolean OR config_id = $3::uuid)
            AND ($2::boolean = FALSE OR config_id IS NULL)
            AND event_time > NOW() - INTERVAL '7 days'
          GROUP BY delivery_status`,
        [session.userId, isSelf, isSelf ? null : req.params.id],
      );
      const counts: Record<string, number> = {};
      for (const row of summary.rows) counts[row.delivery_status] = row.n;
      return res.json({ events: r.rows, summary: counts });
    } catch (err) {
      return res.status(500).json({ error: "Kunne ikke hente events", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Creative Management
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/tiktok/creatives", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const assetType = typeof req.query.assetType === "string" ? req.query.assetType : undefined;
    const r = await listTiktokCreatives(pool, {
      producerUserId: session.userId,
      advertiserId,
      assetType: assetType as 'video' | 'image' | 'smart_video' | undefined,
    });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ assets: r.assets });
  });

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/smart-video", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as {
      advertiserId?: string;
      sourceMaterialId?: string;
      productInfo?: { name?: string; price?: string };
    };
    if (!body.advertiserId || !body.sourceMaterialId) {
      return res.status(400).json({ error: "advertiserId + sourceMaterialId påkrevd" });
    }
    try {
      const r = await createTiktokSmartVideo(pool, {
        producerUserId: session.userId,
        advertiserId: body.advertiserId,
        sourceMaterialId: body.sourceMaterialId,
        productInfo: body.productInfo,
        configId: req.params.id !== "self" ? req.params.id : null,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "Smart Video-generering feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Creator Marketplace
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/tiktok/creators", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const niche = typeof req.query.niche === "string" ? req.query.niche : undefined;
    const minF = req.query.minFollowers ? parseInt(req.query.minFollowers as string, 10) : undefined;
    const maxF = req.query.maxFollowers ? parseInt(req.query.maxFollowers as string, 10) : undefined;
    const force = req.query.force === "1";
    const r = await discoverTiktokCreators(pool, {
      producerUserId: session.userId,
      advertiserId,
      country,
      niche,
      minFollowers: minF,
      maxFollowers: maxF,
      forceRefresh: force,
    });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json(r);
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Business Plugin
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/tiktok/plugins", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const r = await listTiktokBusinessPlugins(pool, { producerUserId: session.userId, advertiserId });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ plugins: r.plugins });
  });

  app.post("/api/admin-room/agent/ads/configs/:id/tiktok/install-plugin", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body ?? {}) as {
      advertiserId?: string;
      pluginType?: string;
      pluginName?: string;
      domain?: string;
    };
    if (!body.advertiserId || !body.pluginType || !body.pluginName || !body.domain) {
      return res.status(400).json({ error: "advertiserId + pluginType + pluginName + domain påkrevd" });
    }
    try {
      const r = await installTiktokBusinessPlugin(pool, {
        producerUserId: session.userId,
        advertiserId: body.advertiserId,
        pluginType: body.pluginType,
        pluginName: body.pluginName,
        domain: body.domain,
        configId: req.params.id !== "self" ? req.params.id : null,
      });
      if (!r.ok) return res.status(503).json({ error: r.error });
      return res.json(r);
    } catch (err) {
      return res.status(500).json({ error: "Plugin-install feilet", detail: String(err) });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // TikTok Accounts — linked accounts per Business Center
  // ════════════════════════════════════════════════════════════════════

  app.get("/api/admin-room/agent/ads/configs/:id/tiktok/linked-accounts", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const advertiserId = typeof req.query.advertiserId === "string" ? req.query.advertiserId : "";
    if (!advertiserId) return res.status(400).json({ error: "advertiserId påkrevd" });
    const r = await listTiktokLinkedAccounts(pool, {
      producerUserId: session.userId,
      advertiserId,
      configId: req.params.id !== "self" ? req.params.id : null,
    });
    if (!r.ok) return res.status(503).json({ error: r.error });
    return res.json({ accounts: r.accounts });
  });
}
