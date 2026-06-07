/**
 * linkedin-prep-routes.ts
 *
 * Admin Room-endepunkter for Lead Sync + Conversions API klargjøring.
 * Eksponerer cron-targets + manuell trigger + statistikk.
 */

import type express from "express";
import type { Pool } from "pg";

import { pollLeadFormsDue } from "./linkedin-leadsync-service.js";
import {
  sendDueConversionEvents,
  queueConversionEvent,
  type ConversionEventType,
} from "./linkedin-conversions-service.js";

interface SessionLike { userId: string; email?: string }

export interface LinkedInPrepRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  isAdminEmail: (email: string | null | undefined) => boolean;
}

export function setupLinkedInPrepRoutes(deps: LinkedInPrepRoutesDeps): void {
  const { app, pool, getActiveSession, isAdminEmail } = deps;

  const guard = (req: express.Request, res: express.Response): SessionLike | null => {
    const session = getActiveSession(req);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "Admin Room kreves" }); return null; }
    return session;
  };

  // Cron-guard: aksepterer enten admin-session ELLER x-cron-trigger-token-header
  // som matcher CRON_TRIGGER_TOKEN env-var. Brukes av Render Cron Jobs.
  const cronGuard = (req: express.Request, res: express.Response): { source: "session" | "cron" } | null => {
    const tokenHeader = req.headers["x-cron-trigger-token"];
    const presentedToken = typeof tokenHeader === "string" ? tokenHeader.trim() : "";
    const expectedToken = (process.env.CRON_TRIGGER_TOKEN ?? "").trim();
    if (presentedToken && expectedToken && presentedToken === expectedToken) {
      return { source: "cron" };
    }
    if (presentedToken && !expectedToken) {
      res.status(503).json({ error: "CRON_TRIGGER_TOKEN er ikke konfigurert på serveren" });
      return null;
    }
    if (presentedToken && expectedToken && presentedToken !== expectedToken) {
      res.status(401).json({ error: "Ugyldig cron-trigger-token" });
      return null;
    }
    // Ingen token presented — falle tilbake til admin-session-guard
    const session = guard(req, res);
    return session ? { source: "session" } : null;
  };

  // ── GET /cockpit/linkedin/leadsync/status ────────────────────────
  app.get("/api/admin-room/cockpit/linkedin/leadsync/status", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const forms = await pool.query(
        `SELECT id::text, form_urn, form_name, active,
                last_polled_at, last_poll_status, last_poll_error,
                total_responses_fetched, total_leads_created,
                last_response_id, poll_interval_seconds
           FROM linkedin_lead_forms
          ORDER BY created_at DESC`,
      );
      const recent = await pool.query(
        `SELECT r.id::text, r.response_id, r.fetched_at, r.submitted_at,
                r.mapping_error,
                l.agency_name, l.contact_name, l.email
           FROM linkedin_lead_responses r
           LEFT JOIN agency_leads l ON l.id = r.agency_lead_id
          ORDER BY r.fetched_at DESC LIMIT 20`,
      );
      return res.json({ forms: forms.rows, recent_responses: recent.rows });
    } catch (err) {
      console.error("[linkedin/leadsync status]", err);
      return res.status(500).json({ error: "Status feilet" });
    }
  });

  // ── POST /cockpit/linkedin/leadsync/forms ────────────────────────
  app.post("/api/admin-room/cockpit/linkedin/leadsync/forms", async (req, res) => {
    if (!guard(req, res)) return;
    const body = (req.body ?? {}) as {
      form_urn?: string; form_name?: string;
      organization_urn?: string; campaign_urn?: string;
      field_mapping?: Record<string, string>;
    };
    if (!body.form_urn) return res.status(400).json({ error: "form_urn påkrevd" });
    try {
      const r = await pool.query(
        `INSERT INTO linkedin_lead_forms (
           form_urn, form_name, organization_urn, campaign_urn, field_mapping
         ) VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (form_urn) DO UPDATE
           SET form_name = EXCLUDED.form_name,
               organization_urn = EXCLUDED.organization_urn,
               campaign_urn = EXCLUDED.campaign_urn,
               field_mapping = EXCLUDED.field_mapping
         RETURNING id::text, form_urn, form_name`,
        [
          body.form_urn,
          body.form_name ?? null,
          body.organization_urn ?? null,
          body.campaign_urn ?? null,
          JSON.stringify(body.field_mapping ?? {}),
        ],
      );
      return res.status(201).json({ form: r.rows[0] });
    } catch (err) {
      console.error("[linkedin/leadsync forms POST]", err);
      return res.status(500).json({ error: "Lagring feilet" });
    }
  });

  // ── POST /cockpit/linkedin/leadsync/poll-now ─────────────────────
  // Aksepterer både admin-session OG cron-trigger-token (for Render Cron)
  app.post("/api/admin-room/cockpit/linkedin/leadsync/poll-now", async (req, res) => {
    if (!cronGuard(req, res)) return;
    try {
      const result = await pollLeadFormsDue(pool);
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[linkedin/leadsync poll-now]", err);
      return res.status(500).json({ error: "Polling feilet" });
    }
  });

  // ── GET /cockpit/linkedin/capi/status ────────────────────────────
  app.get("/api/admin-room/cockpit/linkedin/capi/status", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const counts = await pool.query(
        `SELECT send_status, COUNT(*)::int AS n
           FROM linkedin_conversion_events
          GROUP BY send_status`,
      );
      const recent = await pool.query(
        `SELECT id::text, event_type, event_name, send_status,
                occurred_at, sent_at, send_attempts, last_send_error,
                conversion_value_amount, conversion_value_currency
           FROM linkedin_conversion_events
          ORDER BY created_at DESC LIMIT 25`,
      );
      const eventTypeCounts = await pool.query(
        `SELECT event_type, COUNT(*)::int AS n
           FROM linkedin_conversion_events
          WHERE occurred_at > now() - interval '30 days'
          GROUP BY event_type`,
      );
      return res.json({
        status_counts: Object.fromEntries(counts.rows.map((c) => [c.send_status, c.n])),
        event_type_counts: Object.fromEntries(eventTypeCounts.rows.map((c) => [c.event_type, c.n])),
        recent: recent.rows,
      });
    } catch (err) {
      console.error("[linkedin/capi status]", err);
      return res.status(500).json({ error: "Status feilet" });
    }
  });

  // ── POST /cockpit/linkedin/capi/send-due ─────────────────────────
  // Cron-target — kjør pending-events. Aksepterer både admin-session
  // og cron-trigger-token (for Render Cron Jobs).
  app.post("/api/admin-room/cockpit/linkedin/capi/send-due", async (req, res) => {
    if (!cronGuard(req, res)) return;
    try {
      const result = await sendDueConversionEvents(pool);
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[linkedin/capi send-due]", err);
      return res.status(500).json({ error: "Send feilet" });
    }
  });

  // ── POST /cockpit/linkedin/capi/manual-event ─────────────────────
  // Manuell trigger — nyttig for å teste flyten
  app.post("/api/admin-room/cockpit/linkedin/capi/manual-event", async (req, res) => {
    if (!guard(req, res)) return;
    const body = (req.body ?? {}) as {
      event_type?: ConversionEventType;
      email?: string;
      value_amount?: number;
      value_currency?: string;
      conversion_urn?: string;
    };
    if (!body.event_type) return res.status(400).json({ error: "event_type påkrevd" });
    try {
      const eventId = await queueConversionEvent(pool, {
        eventType: body.event_type,
        eventName: "manual_test",
        email: body.email,
        valueAmount: body.value_amount,
        valueCurrency: body.value_currency ?? "NOK",
        conversionUrn: body.conversion_urn,
        sourceKind: "manual",
      });
      return res.status(201).json({ ok: true, event_id: eventId });
    } catch (err) {
      console.error("[linkedin/capi manual]", err);
      return res.status(500).json({ error: "Queue feilet" });
    }
  });
}
