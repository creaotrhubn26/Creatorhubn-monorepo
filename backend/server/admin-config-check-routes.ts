/**
 * admin-config-check-routes.ts — Slice 9X.58
 *
 * Admin-endepunkt som rapporterer hva som er konfigurert vs. mangler på
 * prod. Hjelper Daniel å verifisere Stripe/Gmail/migrations uten å måtte
 * lure på hvilke env-vars som er satt.
 *
 * GET /api/admin/config-check
 *   → { status: 'ready' | 'partial' | 'broken', checks: {...}, missing: [...] }
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type express from "express";

export interface AdminConfigCheckDeps {
  app: express.Application;
  pool: any;
  requireAdminSession: (req: any, res: any) => any;
}

async function tableExists(pool: any, tableName: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables WHERE table_name = $1
       ) AS exists`,
      [tableName],
    );
    return r.rows[0]?.exists === true;
  } catch {
    return false;
  }
}

export function setupAdminConfigCheckRoutes(deps: AdminConfigCheckDeps): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/config-check", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      // Env-vars — fortell IKKE verdiene, bare om de er satt (sikkerhet)
      const stripeSecretSet = !!(
        process.env.CREATORHUB_STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_API_KEY
      );
      const stripeWebhookSecretSet = !!process.env.CREATORHUB_STRIPE_WEBHOOK_SECRET;
      const enterprisePriceMonthlySet = !!process.env.CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE;
      const enterprisePriceYearlySet = !!process.env.CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE_YEARLY;
      const gmailUserSet = !!(process.env.GMAIL_USER || process.env.GOOGLE_WORKSPACE_EMAIL);
      const gmailPassSet = !!process.env.GMAIL_APP_PASSWORD;
      const anthropicSet = !!process.env.ANTHROPIC_API_KEY;
      // Slice 9X.70 — GA4 server-side Measurement Protocol
      const ga4MeasurementIdSet = !!(process.env.GA4_MEASUREMENT_ID
        || process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
        || process.env.VITE_GA4_MEASUREMENT_ID);
      const ga4ApiSecretSet = !!process.env.GA4_API_SECRET;

      // Schema-sjekker (idempotent ensure-schema gjør disse trygge selv om de
      // ennå ikke er kjørt, men vi vil se hva som er der nå)
      const [
        prototypeTesterInvites,
        testerEnterpriseOffers,
        adminNotifications,
        weddingAssistants,
        inviteRequests,
        analyticsEvents,
        marketplaceAppConfig,
        marketplaceInstallations,
        aiUsageLog,
      ] = await Promise.all([
        tableExists(pool, "prototype_tester_invites"),
        tableExists(pool, "tester_enterprise_offers"),
        tableExists(pool, "admin_notifications"),
        tableExists(pool, "wedding_assistants"),
        tableExists(pool, "invite_requests"),
        tableExists(pool, "analytics_events"),
        tableExists(pool, "marketplace_app_config"),
        tableExists(pool, "marketplace_installations"),
        tableExists(pool, "ai_usage_log"),
      ]);

      const checks = {
        stripe: {
          secretKey: stripeSecretSet,
          webhookSecret: stripeWebhookSecretSet,
          enterprisePriceMonthly: enterprisePriceMonthlySet,
          enterprisePriceYearly: enterprisePriceYearlySet,
        },
        mail: {
          gmailUser: gmailUserSet,
          gmailPass: gmailPassSet,
        },
        ai: {
          anthropic: anthropicSet,
        },
        ga4: {
          measurementId: ga4MeasurementIdSet,
          apiSecret: ga4ApiSecretSet,
        },
        schema: {
          prototype_tester_invites: prototypeTesterInvites,
          tester_enterprise_offers: testerEnterpriseOffers,
          admin_notifications: adminNotifications,
          wedding_assistants: weddingAssistants,
          invite_requests: inviteRequests,
          analytics_events: analyticsEvents,
          marketplace_app_config: marketplaceAppConfig,
          marketplace_installations: marketplaceInstallations,
          ai_usage_log: aiUsageLog,
        },
      };

      // Beregn samlestatus + liste over mangler med klare meldinger
      const missing: Array<{ key: string; severity: "critical" | "warning"; message: string }> = [];
      if (!stripeSecretSet) missing.push({ key: "CREATORHUB_STRIPE_SECRET_KEY", severity: "critical", message: "Stripe-API kan ikke kalles — Checkout vil feile" });
      if (!stripeWebhookSecretSet) missing.push({ key: "CREATORHUB_STRIPE_WEBHOOK_SECRET", severity: "critical", message: "Stripe webhooks blir avvist — tester→Enterprise-konvertering brytes ved siste steg" });
      if (!enterprisePriceMonthlySet) missing.push({ key: "CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE", severity: "critical", message: "Tester→Enterprise Checkout vil returnere 503 (mangler price-ID)" });
      if (!enterprisePriceYearlySet) missing.push({ key: "CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE_YEARLY", severity: "warning", message: "Årlig Enterprise-pris ikke konfigurert — bare månedlig fungerer" });
      if (!gmailUserSet || !gmailPassSet) missing.push({ key: "GMAIL_USER + GMAIL_APP_PASSWORD", severity: "critical", message: "NDA- og Enterprise-tilbud-e-poster sendes IKKE (cron logger bare advarsel)" });
      if (!anthropicSet) missing.push({ key: "ANTHROPIC_API_KEY", severity: "warning", message: "Brief-AI-sammendrag returnerer 503" });
      if (!prototypeTesterInvites) missing.push({ key: "TABLE prototype_tester_invites", severity: "warning", message: "Tabell finnes ikke — opprettes automatisk ved første API-kall" });
      if (!testerEnterpriseOffers) missing.push({ key: "TABLE tester_enterprise_offers", severity: "warning", message: "Tabell finnes ikke — opprettes automatisk ved første cron-sweep" });
      if (!adminNotifications) missing.push({ key: "TABLE admin_notifications", severity: "warning", message: "Tabell finnes ikke — opprettes automatisk ved første POST" });
      if (!ga4MeasurementIdSet) missing.push({ key: "GA4_MEASUREMENT_ID", severity: "warning", message: "Server-side Stripe-events sendes IKKE til GA4 (frontend-events fungerer fortsatt)" });
      if (!ga4ApiSecretSet) missing.push({ key: "GA4_API_SECRET", severity: "warning", message: "Server-side Measurement Protocol kan ikke autentiseres mot GA4" });
      if (!analyticsEvents) missing.push({ key: "TABLE analytics_events", severity: "warning", message: "Admin Analytics Hub viser ingen lokale events — opprettes automatisk ved første event" });
      if (!marketplaceAppConfig) missing.push({ key: "TABLE marketplace_app_config", severity: "warning", message: "Migration 0127 må kjøres — marketplace bruker hardkodet fallback inntil videre" });
      if (!marketplaceInstallations) missing.push({ key: "TABLE marketplace_installations", severity: "warning", message: "Kan ikke spore hvem som har installert hvilke apper" });
      if (!aiUsageLog) missing.push({ key: "TABLE ai_usage_log", severity: "warning", message: "Migration 0128 må kjøres — AI cost-dashboard viser ingen tall" });

      const criticalCount = missing.filter((m) => m.severity === "critical").length;
      const status: "ready" | "partial" | "broken" =
        criticalCount === 0 && missing.length === 0
          ? "ready"
          : criticalCount === 0
            ? "partial"
            : "broken";

      res.json({
        status,
        checks,
        missing,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("GET /admin/config-check:", err);
      res.status(500).json({ error: err?.message || "Kunne ikke kjøre config-check" });
    }
  });
}
