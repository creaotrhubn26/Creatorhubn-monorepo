/**
 * role-room-billing-routes.ts
 *
 * Role Room commercial-access billing — Stripe-tunge endepunkter for
 * "Innholdsprodusent" og "Produksjonsteam" abonnementer (admin-invite
 * approval-flyt + checkout + webhook + reminder-sweep).
 *
 * Ekstraksjons-plan (start 2026-05-26, fra [[project-next-session-priorities]]):
 *
 *   • Chunk 1A (denne fila) — rene typer/konstanter/pure helpere.
 *     Etablerer modulen og dep-injection-mønsteret uten å berøre Stripe-IO.
 *   • Chunk 1B — async/DB-helpere (read/write/sync record, send-email, ensureAccess,
 *     runReminderSweep). Krever pool-injeksjon.
 *   • Chunk 2 — flytt de 6 endepunktene + webhook fra index.ts og fyll
 *     setupRoleRoomBillingRoutes med dem.
 *   • Chunk 3 — oppdater cross-file-imports i auth-routes, billing-admin og
 *     commercial-access-routes til å peke hit i stedet for index.ts.
 *
 * Tester se chunk 1B+; chunk 1A er rene helpere/typer som allerede dekkes av
 * eksisterende index.ts-bruk.
 */

import type express from "express";
import type { Pool } from "pg";

// ─── Stripe storage-key-prefixer ──────────────────────────────────────────
export const ROLE_ROOM_STRIPE_CHECKOUT_RECORD_PREFIX =
  "role-room:billing:checkout-session:";
export const ROLE_ROOM_STRIPE_SUBSCRIPTION_RECORD_PREFIX =
  "role-room:billing:subscription:";

// ─── Typer ────────────────────────────────────────────────────────────────

export type RoleRoomCommercialPersona = "production_team" | "content_producer";

export type RoleRoomCommercialAccessPayloadMember = {
  name: string;
  email: string;
  roleId: string;
  roleLabel: string | null;
  isLeader: boolean;
};

export type RoleRoomCommercialAccessResult = {
  persona: RoleRoomCommercialPersona;
  organizationNumber: string;
  companyName: string;
  plan: ReturnType<typeof getRoleRoomCommercialPlan>;
  teamLead: RoleRoomCommercialAccessPayloadMember;
  members: RoleRoomCommercialAccessPayloadMember[];
  monthlyTotalExVat: number;
  paymentCompleted: boolean;
  requestIds: string[];
  requests: Record<string, unknown>[];
};

export type RoleRoomCommercialCheckoutSessionRecord = {
  sessionId: string;
  requestIds: string[];
  organizationNumber: string;
  companyName: string;
  persona: RoleRoomCommercialPersona;
  planId: string;
  planName: string;
  teamLeadEmail: string;
  memberEmails: string[];
  monthlyTotalExVat: number;
  seatPriceExVat: number;
  billableSeatCount: number;
  paymentCompleted: boolean;
  checkoutStatus: "created" | "completed" | "payment_failed";
  paymentTimestamp: string | null;
  transactionId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoleRoomCommercialActivationStatus = "pending_approval" | "approved";
export type RoleRoomCommercialBillingStatus =
  | "pending_payment"
  | "active"
  | "payment_failed";

export type RoleRoomCommercialReminderDeliverySummary = {
  sent: boolean;
  reason: string | null;
  accepted: string[];
  provider: string | null;
  messageId: string | null;
};

export type RoleRoomCommercialReminderSweepSummary = {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  paymentCandidates: number;
  paymentRemindersSent: number;
  activationCandidates: number;
  activationRemindersSent: number;
  failures: number;
  skipped: number;
  notes: string[];
};

// ─── Pure helpere (ingen DB, ingen Stripe-IO) ──────────────────────────────

export function normalizeRoleRoomCommercialPersona(
  value: unknown,
): RoleRoomCommercialPersona | null {
  // Case-sensitiv match — speiler tidligere oppførsel (toAdminString → equals).
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "production_team" || trimmed === "content_producer"
    ? (trimmed as RoleRoomCommercialPersona)
    : null;
}

export function splitRoleRoomContactName(name: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

export function getRoleRoomCommercialPlan(persona: RoleRoomCommercialPersona) {
  if (persona === "production_team") {
    return {
      planId: "role-room-production-team",
      planName: "Produksjonsteam",
      personaLabel: "Produksjonsteam",
      seatPriceExVat: 795,
      minimumSeats: 3,
    };
  }

  return {
    planId: "role-room-content-producer",
    planName: "Innholdsprodusent",
    personaLabel: "Innholdsprodusent",
    seatPriceExVat: 495,
    minimumSeats: 1,
  };
}

export function roleRoomCommercialCheckoutSessionKey(sessionId: string): string {
  return `${ROLE_ROOM_STRIPE_CHECKOUT_RECORD_PREFIX}${sessionId}`;
}

export function roleRoomCommercialSubscriptionKey(subscriptionId: string): string {
  return `${ROLE_ROOM_STRIPE_SUBSCRIPTION_RECORD_PREFIX}${subscriptionId}`;
}

// ─── Setup-funksjon (endepunkter + webhook lander her i chunk 2) ──────────

export interface RoleRoomBillingRoutesDeps {
  app: express.Application;
  pool: Pool;
}

export function setupRoleRoomBillingRoutes(_deps: RoleRoomBillingRoutesDeps): void {
  // No-op skeleton. Chunk 2 vil flytte de 6 endepunktene + Stripe-webhooken
  // fra backend/server/index.ts:916-1030 + 31542-32680 inn hit.
}
