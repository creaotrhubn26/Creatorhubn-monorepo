/**
 * role-room-casting-routes.ts
 *
 * Setup-funksjon for /api/role-room/casting/* endpoints — admin-tooling
 * for å manuelt trigge bakgrunns-sveep og lese status på:
 *   - Audition reminder-sweep (SMS/e-post-varsler til kandidater)
 *   - SMS invoice-sweep (Stripe-fakturering for SMS-varsler)
 *   - WhatsApp invoice-sweep (Stripe-fakturering for WhatsApp-varsler)
 *
 * 6 endpoints: 3 POST sweep + 3 GET status. Alle bruker
 * `requireAdminSession` (admin-rolle, ikke produkteier-låst som
 * Admin Room — bredere admin-tilgang).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomCastingRoutes } from "./role-room-casting-routes";
 *
 *   setupRoleRoomCastingRoutes({
 *     app, pool, requireAdminSession,
 *     getRoleRoomStripeClient, resolveStripeCustomerForCastingProject,
 *   });
 *
 * Mode-noter: ingen Role Room-modes påvirker disse endpoints. Dette er
 * admin-side tooling, ikke per-bruker-funksjonalitet, og kjøres uavhengig
 * av aktiv mode (Produksjonsteam/Innholdsprodusent/Utdanningsinstitusjon/
 * Dansestudio).
 */

import type express from "express";
import type { Pool } from "pg";
import type Stripe from "stripe";
import type { ProjectCustomerResolver } from "./casting-sms-invoice-runner.js";

import {
  runAuditionReminderSweep,
  readAuditionReminderStatus,
} from "./casting-reminder-runner.js";
import {
  runSmsInvoiceSweep,
  readSmsInvoiceStatus,
} from "./casting-sms-invoice-runner.js";
import {
  runWhatsAppInvoiceSweep,
  readWhatsAppInvoiceStatus,
} from "./casting-whatsapp-invoice-runner.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomCastingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  getRoleRoomStripeClient: () => Stripe | null;
  resolveStripeCustomerForCastingProject: ProjectCustomerResolver;
}

export function setupRoleRoomCastingRoutes(deps: RoleRoomCastingRoutesDeps): void {
  const {
    app,
    pool,
    requireAdminSession,
    getRoleRoomStripeClient,
    resolveStripeCustomerForCastingProject,
  } = deps;

  app.post("/api/role-room/casting/reminders/sweep", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }

    try {
      const summary = await runAuditionReminderSweep("manual", { pool });
      return res.json({ success: true, summary });
    } catch (error) {
      console.error("Error triggering audition reminder sweep:", error);
      return res.status(500).json({
        error: "Kunne ikke trigge audition-reminder-sweep.",
      });
    }
  });

  app.get("/api/role-room/casting/reminders/status", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }

    return res.json({
      success: true,
      summary: readAuditionReminderStatus(),
    });
  });

  app.post("/api/role-room/casting/sms-invoice/sweep", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      return res.status(503).json({
        error: "Stripe Billing er ikke konfigurert på serveren.",
      });
    }
    try {
      const summary = await runSmsInvoiceSweep("manual", {
        pool,
        stripe,
        resolveCustomer: resolveStripeCustomerForCastingProject,
      });
      return res.json({ success: true, summary });
    } catch (error) {
      console.error("Error triggering SMS invoice sweep:", error);
      return res.status(500).json({
        error: "Kunne ikke trigge SMS-faktura-sweep.",
      });
    }
  });

  app.get("/api/role-room/casting/sms-invoice/status", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }
    return res.json({ success: true, summary: readSmsInvoiceStatus() });
  });

  app.post("/api/role-room/casting/whatsapp-invoice/sweep", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const stripe = getRoleRoomStripeClient();
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "Stripe Billing er ikke konfigurert på serveren." });
    }
    try {
      const summary = await runWhatsAppInvoiceSweep("manual", {
        pool,
        stripe,
        resolveCustomer: resolveStripeCustomerForCastingProject,
      });
      return res.json({ success: true, summary });
    } catch (error) {
      console.error("WhatsApp invoice sweep failed:", error);
      return res
        .status(500)
        .json({ error: "Kunne ikke trigge WhatsApp-faktura-sweep." });
    }
  });

  app.get("/api/role-room/casting/whatsapp-invoice/status", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    return res.json({ success: true, summary: readWhatsAppInvoiceStatus() });
  });
}
