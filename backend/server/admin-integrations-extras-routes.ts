/**
 * admin-integrations-extras-routes.ts
 *
 * Plattform-gruppe: integrasjoner (oversikt + API-keys + webhooks + OAuth
 * + env-secrets-katalog). Stub-endpoints nå slik at IntegrationsTab kan
 * rendre uten 404. Senere kobles dette mot ekte integrations-/secrets-
 * tabeller.
 *
 * VIKTIG: env-secrets-endepunktet returnerer ALDRI verdier — kun keys.
 *
 * Endpoints:
 *   GET /api/admin/integrations/overview         — KPI
 *   GET /api/admin/integrations/keys             — API-nøkkel-katalog
 *   GET /api/admin/integrations/webhooks         — webhook-katalog
 *   GET /api/admin/integrations/oauth            — OAuth-klient-katalog
 *   GET /api/admin/env-secrets                   — kun keys, aldri values
 *   GET /api/admin/oauth/check-scopes?provider=  — granted/missing-scopes
 *   GET /api/admin/api-gateway/status            — gateway-status
 *
 * Alle krever requireAdminSession.
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminIntegrationsExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Whitelist over env-keys vi tillater å eksponere navnet på i admin.
// VIKTIG: alle verdier filtreres bort — vi returnerer KUN navnene.
const SAFE_ENV_KEY_PREFIXES = [
  "STRIPE_",
  "GOOGLE_",
  "META_",
  "TIDUM_",
  "B2_",
  "CLAUDE_",
  "ANTHROPIC_",
  "OPENAI_",
  "ELEVENLABS_",
  "RESEND_",
  "TWILIO_",
  "BANKID_",
  "AWS_",
  "R2_",
  "CLOUDFLARE_",
];

export function setupAdminIntegrationsExtrasRoutes(
  deps: AdminIntegrationsExtrasRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin/integrations/overview", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json({ totalIntegrations: 0, active: 0, broken: 0 });
    } catch (err) {
      console.error("[admin-integrations-extras] overview failed:", err);
      res.status(500).json({ error: "integrations_overview_failed" });
    }
  });

  app.get("/api/admin/integrations/keys", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // TODO: les fra integration_keys-tabell.
      res.json({ keys: [] });
    } catch (err) {
      console.error("[admin-integrations-extras] keys failed:", err);
      res.status(500).json({ error: "integration_keys_failed" });
    }
  });

  app.get("/api/admin/integrations/webhooks", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json({ webhooks: [] });
    } catch (err) {
      console.error("[admin-integrations-extras] webhooks failed:", err);
      res.status(500).json({ error: "integration_webhooks_failed" });
    }
  });

  app.get("/api/admin/integrations/oauth", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json({ clients: [] });
    } catch (err) {
      console.error("[admin-integrations-extras] oauth failed:", err);
      res.status(500).json({ error: "integration_oauth_failed" });
    }
  });

  app.get("/api/admin/env-secrets", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      // Returner KUN keys (navn) — ALDRI values.
      const keys = Object.keys(process.env)
        .filter((name) =>
          SAFE_ENV_KEY_PREFIXES.some((prefix) => name.startsWith(prefix)),
        )
        .sort()
        .map((name) => ({
          name,
          isSet: Boolean(process.env[name]),
          // value er bevisst utelatt; aldri eksponer i klartext.
        }));
      res.json({ secrets: keys });
    } catch (err) {
      console.error("[admin-integrations-extras] env-secrets failed:", err);
      res.status(500).json({ error: "env_secrets_failed" });
    }
  });

  app.get("/api/admin/oauth/check-scopes", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      const provider = typeof req.query.provider === "string"
        ? req.query.provider
        : "google";
      // TODO: kall faktisk provider sin tokeninfo for å hente granted scopes.
      res.json({
        provider,
        granted: [],
        missing: [],
      });
    } catch (err) {
      console.error("[admin-integrations-extras] check-scopes failed:", err);
      res.status(500).json({ error: "oauth_check_scopes_failed" });
    }
  });

  app.get("/api/admin/api-gateway/status", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;
      res.json({ status: "operational" });
    } catch (err) {
      console.error("[admin-integrations-extras] gateway-status failed:", err);
      res.status(500).json({ error: "api_gateway_status_failed" });
    }
  });
}
