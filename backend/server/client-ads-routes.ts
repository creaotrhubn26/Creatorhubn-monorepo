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
}
