/**
 * role-room-billing-admin-routes.ts
 *
 * Setup-funksjon for de 2 admin-tooling-endpointene under
 * /api/role-room/billing/reminders/* — status og manuell trigger av
 * reminder-sweep for betalings-/aktiverings-remindere.
 *
 * 2 endpoints:
 *   GET  /reminders/status   — leser current sweep-status + konfig
 *   POST /reminders/trigger  — kjører sweep umiddelbart (admin override)
 *
 * Tilgang: requireAdminSession (admin/owner/super_admin).
 *
 * De øvrige 7 billing-endpointene (checkout-session, session-status,
 * account, manage, retry-payment, activate, webhook) blir værende i
 * index.ts inntil en større service-laget-refactor kan håndtere Stripe-
 * state-fragmenteringen samlet (~45 delte helpers — utenfor scope for
 * en enkelt-commit-ekstrakt).
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupRoleRoomBillingAdminRoutes } from "./role-room-billing-admin-routes";
 *
 *   setupRoleRoomBillingAdminRoutes({
 *     app,
 *     requireAdminSession,
 *     readRoleRoomCommercialReminderStatus,
 *     runRoleRoomCommercialReminderSweep,
 *     isRoleRoomReminderRunnerEnabled,
 *     ROLE_ROOM_REMINDER_INTERVAL_MS,
 *     ROLE_ROOM_PAYMENT_REMINDER_HOURS,
 *     ROLE_ROOM_ACTIVATION_REMINDER_HOURS,
 *     ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS,
 *     ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS,
 *   });
 */

import type express from "express";

export interface RoleRoomCommercialReminderStatusSnapshot {
  reason: string;
  startedAt: string | null;
  finishedAt: string | null;
  isRunning: boolean;
  paymentCandidates: number;
  paymentRemindersSent: number;
  activationCandidates: number;
  activationRemindersSent: number;
  failures: number;
  skipped: number;
  notes: unknown[];
}

export interface RoleRoomBillingAdminRoutesDeps {
  app: express.Application;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => unknown;
  readRoleRoomCommercialReminderStatus: () => Promise<
    RoleRoomCommercialReminderStatusSnapshot | null | undefined
  >;
  runRoleRoomCommercialReminderSweep: (
    reason: "manual" | "startup" | "interval",
  ) => Promise<unknown>;
  isRoleRoomReminderRunnerEnabled: () => boolean;
  ROLE_ROOM_REMINDER_INTERVAL_MS: number;
  ROLE_ROOM_PAYMENT_REMINDER_HOURS: readonly number[];
  ROLE_ROOM_ACTIVATION_REMINDER_HOURS: readonly number[];
  ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS: number;
  ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS: number;
}

export function setupRoleRoomBillingAdminRoutes(
  deps: RoleRoomBillingAdminRoutesDeps,
): void {
  const {
    app,
    requireAdminSession,
    readRoleRoomCommercialReminderStatus,
    runRoleRoomCommercialReminderSweep,
    isRoleRoomReminderRunnerEnabled,
    ROLE_ROOM_REMINDER_INTERVAL_MS,
    ROLE_ROOM_PAYMENT_REMINDER_HOURS,
    ROLE_ROOM_ACTIVATION_REMINDER_HOURS,
    ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS,
    ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS,
  } = deps;

  app.get("/api/role-room/billing/reminders/status", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }

    try {
      const status = await readRoleRoomCommercialReminderStatus();
      return res.json({
        success: true,
        enabled: isRoleRoomReminderRunnerEnabled(),
        intervalMinutes: Math.round(ROLE_ROOM_REMINDER_INTERVAL_MS / 60000),
        paymentReminderHours: ROLE_ROOM_PAYMENT_REMINDER_HOURS,
        activationReminderHours: ROLE_ROOM_ACTIVATION_REMINDER_HOURS,
        repeatPaymentReminderHours: ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS,
        repeatActivationReminderHours: ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS,
        status:
          status || {
            reason: "manual",
            startedAt: null,
            finishedAt: null,
            isRunning: false,
            paymentCandidates: 0,
            paymentRemindersSent: 0,
            activationCandidates: 0,
            activationRemindersSent: 0,
            failures: 0,
            skipped: 0,
            notes: [],
          },
      });
    } catch (error) {
      console.error("Error reading Role Room reminder status:", error);
      return res.status(500).json({
        error: "Kunne ikke lese reminder-status for The Role Room.",
      });
    }
  });

  app.post("/api/role-room/billing/reminders/trigger", async (req, res) => {
    if (!requireAdminSession(req, res)) {
      return;
    }

    try {
      const summary = await runRoleRoomCommercialReminderSweep("manual");
      return res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error("Error triggering Role Room reminder sweep:", error);
      return res.status(500).json({
        error: "Kunne ikke trigge reminder-sweep for The Role Room.",
      });
    }
  });
}
