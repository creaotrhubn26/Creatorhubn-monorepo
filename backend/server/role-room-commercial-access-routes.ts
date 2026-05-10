/**
 * role-room-commercial-access-routes.ts
 *
 * Setup-funksjon for /api/role-room/commercial-access endpoint —
 * onboarding-flyt for produksjonsteam og innholdsprodusenter (BRREG-
 * verifisering, plan-valg, team-medlem-registrering).
 *
 * 1 endpoint: POST /commercial-access
 *
 * Tjenestelaget (`ensureRoleRoomCommercialAccess`) blir værende i
 * index.ts pga. omfattende interne avhengigheter (BRREG-lookup, invite-
 * request-management, plan-config, payment-state-tracking osv.) og
 * passes via deps. Error-klassen er ekstraktert til egen fil for
 * delt tilgang mellom service og route.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomCommercialAccessRoutes } from "./role-room-commercial-access-routes";
 *
 *   setupRoleRoomCommercialAccessRoutes({
 *     app,
 *     ensureRoleRoomCommercialAccess,
 *   });
 *
 * Mode-noter: persona-feltet på input ('production_team' eller
 * 'content_producer') styrer plan-valg — dette er tett knyttet til
 * Role Room-modes (Produksjonsteam og Innholdsprodusent) men implementert
 * som persona-validering, ikke mode-branching.
 */

import type express from "express";

import { RoleRoomCommercialAccessError } from "./role-room-commercial-access-error";

interface CommercialAccessResult {
  organizationNumber: string;
  companyName: string;
  plan: { planId: string; planName: string };
  monthlyTotalExVat: number;
  paymentCompleted: boolean;
  members: Array<unknown>;
  teamLead: { email: string };
}

export interface RoleRoomCommercialAccessRoutesDeps {
  app: express.Application;
  ensureRoleRoomCommercialAccess: (input: {
    persona: unknown;
    organizationNumber: unknown;
    companyName?: unknown;
    teamMembers?: unknown;
  }) => Promise<CommercialAccessResult>;
}

export function setupRoleRoomCommercialAccessRoutes(
  deps: RoleRoomCommercialAccessRoutesDeps,
): void {
  const { app, ensureRoleRoomCommercialAccess } = deps;

  app.post("/api/role-room/commercial-access", async (req, res) => {
    try {
      const access = await ensureRoleRoomCommercialAccess({
        persona: req.body?.persona,
        organizationNumber: req.body?.organizationNumber,
        companyName: req.body?.companyName,
        teamMembers: req.body?.teamMembers,
      });

      return res.status(201).json({
        success: true,
        organizationNumber: access.organizationNumber,
        companyName: access.companyName,
        planId: access.plan.planId,
        planName: access.plan.planName,
        monthlyTotalExVat: access.monthlyTotalExVat,
        paymentCompleted: access.paymentCompleted,
        membersRegistered: access.members.length,
        teamLeadEmail: access.teamLead.email,
      });
    } catch (error) {
      console.error("Error creating Role Room commercial access requests:", error);
      if (error instanceof RoleRoomCommercialAccessError) {
        return res.status(error.statusCode).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        error: "Kunne ikke opprette Role Room-tilgangsforespørselen.",
      });
    }
  });
}
