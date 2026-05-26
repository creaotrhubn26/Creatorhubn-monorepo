/**
 * role-room-billing-routes.ts
 *
 * Role Room commercial-access billing — Stripe-tunge endepunkter for
 * "Innholdsprodusent" og "Produksjonsteam" abonnementer (admin-invite
 * approval-flyt + checkout + webhook + reminder-sweep).
 *
 * Ekstraksjons-plan (start 2026-05-26, fra [[project-next-session-priorities]]):
 *
 *   • Chunk 1A (bdfb6442) — rene typer + 5 pure helpere.
 *   • Chunk 1B (denne) — env/URL/token/reminder-pure helpere + reminder-konstanter +
 *     module-state for Stripe-client. Fortsatt ingen DB-IO.
 *   • Chunk 1C — async/DB-helpere (read/write/sync record, send-email, ensureAccess,
 *     runReminderSweep). Krever pool-injeksjon.
 *   • Chunk 2 — flytt de 6 endepunktene + webhook fra index.ts og fyll
 *     setupRoleRoomBillingRoutes med dem.
 *   • Chunk 3 — oppdater cross-file-imports i auth-routes, billing-admin og
 *     commercial-access-routes til å peke hit i stedet for index.ts.
 */

import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";

// Inlinet fra index.ts så modulen står på egne ben uten sirkulær import.
function normalizeMailConfigValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toAdminString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

// ─── Env-baserte config-helpere ───────────────────────────────────────────

export function getRoleRoomStripeSecretKey(): string {
  return normalizeMailConfigValue(
    process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY,
  );
}

export function getRoleRoomStripeWebhookSecret(): string {
  return normalizeMailConfigValue(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getRoleRoomStripePriceId(persona: RoleRoomCommercialPersona): string {
  if (persona === "production_team") {
    return normalizeMailConfigValue(
      process.env.ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM,
    );
  }
  return normalizeMailConfigValue(
    process.env.ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER,
  );
}

export function getDefaultRoleRoomPublicOrigin(): string {
  return (
    normalizeMailConfigValue(process.env.ROLE_ROOM_PUBLIC_URL) ||
    normalizeMailConfigValue(process.env.PUBLIC_APP_URL) ||
    "https://theroleroom.com"
  );
}

export function normalizeRoleRoomBrowserOrigin(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return getDefaultRoleRoomPublicOrigin();
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return getDefaultRoleRoomPublicOrigin();
    }
    return parsed.origin;
  } catch {
    return getDefaultRoleRoomPublicOrigin();
  }
}

// ─── Reminder-konfigurasjon ───────────────────────────────────────────────

export function parseRoleRoomReminderHours(
  value: unknown,
  fallback: number[],
): number[] {
  const normalized = normalizeMailConfigValue(value);
  const parsed = normalized
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.floor(entry));
  return parsed.length > 0 ? parsed : [...fallback];
}

export function isRoleRoomReminderRunnerEnabled(): boolean {
  const normalized = normalizeMailConfigValue(
    process.env.ROLE_ROOM_REMINDERS_ENABLED,
  ).toLowerCase();
  return !["0", "false", "off", "no"].includes(normalized);
}

export const ROLE_ROOM_STRIPE_PRODUCT_TAX_CODE = "txcd_10103001";
export const ROLE_ROOM_ACTIVATION_REQUIRED_JOURNEY_STATUS =
  "role_room_activation_required";
export const ROLE_ROOM_ACTIVATED_JOURNEY_STATUS = "role_room_access_activated";
export const ROLE_ROOM_ACTIVATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const ROLE_ROOM_PAYMENT_REMINDER_HOURS = parseRoleRoomReminderHours(
  process.env.ROLE_ROOM_PAYMENT_REMINDER_HOURS,
  [2, 24, 72, 168],
);
export const ROLE_ROOM_ACTIVATION_REMINDER_HOURS = parseRoleRoomReminderHours(
  process.env.ROLE_ROOM_ACTIVATION_REMINDER_HOURS,
  [24, 72, 168],
);
export const ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS =
  parseRoleRoomReminderHours(
    process.env.ROLE_ROOM_PAYMENT_REMINDER_REPEAT_HOURS,
    [168],
  )[0] || 168;
export const ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS =
  parseRoleRoomReminderHours(
    process.env.ROLE_ROOM_ACTIVATION_REMINDER_REPEAT_HOURS,
    [168],
  )[0] || 168;
export const ROLE_ROOM_REMINDER_INTERVAL_MS =
  Math.max(
    15,
    Number.parseInt(
      normalizeMailConfigValue(process.env.ROLE_ROOM_REMINDER_INTERVAL_MINUTES) ||
        "60",
      10,
    ) || 60,
  ) *
  60 *
  1000;
export const ROLE_ROOM_REMINDER_STATUS_COMPAT_KEY =
  "role-room:billing:reminders:status";

// ─── URL-buildere ─────────────────────────────────────────────────────────

export function buildRoleRoomCheckoutReturnUrl(input: {
  browserOrigin: string;
  returnPath?: string | null;
  status: "success" | "cancel";
  includeSessionId?: boolean;
}): string {
  const rawPath =
    typeof input.returnPath === "string" && input.returnPath.trim().startsWith("/")
      ? input.returnPath.trim()
      : "/";
  const url = new URL(rawPath, input.browserOrigin);
  url.searchParams.set("rrCheckout", input.status);
  if (input.includeSessionId) {
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  } else {
    url.searchParams.delete("session_id");
  }
  return url
    .toString()
    .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

export function buildRoleRoomBillingReturnUrl(input: {
  browserOrigin: string;
  returnPath?: string | null;
}): string {
  const rawPath =
    typeof input.returnPath === "string" && input.returnPath.trim().startsWith("/")
      ? input.returnPath.trim()
      : "/";
  const url = new URL(rawPath, input.browserOrigin);
  url.searchParams.set("rrBilling", "updated");
  return url.toString();
}

export function buildRoleRoomActivationUrl(input: {
  token: string;
  browserOrigin?: string | null;
  returnPath?: string | null;
}): string {
  const browserOrigin =
    normalizeRoleRoomBrowserOrigin(input.browserOrigin) ||
    getDefaultRoleRoomPublicOrigin();
  const rawPath =
    typeof input.returnPath === "string" && input.returnPath.trim().startsWith("/")
      ? input.returnPath.trim()
      : "/";
  const url = new URL("/api/role-room/billing/activate", browserOrigin);
  url.searchParams.set("token", input.token);
  url.searchParams.set("browserOrigin", browserOrigin);
  url.searchParams.set("returnPath", rawPath);
  return url.toString();
}

export function buildRoleRoomActivationReturnUrl(input: {
  browserOrigin?: string | null;
  returnPath?: string | null;
  status: "success" | "error";
  message?: string | null;
}): string {
  const browserOrigin =
    normalizeRoleRoomBrowserOrigin(input.browserOrigin) ||
    getDefaultRoleRoomPublicOrigin();
  const rawPath =
    typeof input.returnPath === "string" && input.returnPath.trim().startsWith("/")
      ? input.returnPath.trim()
      : "/";
  const url = new URL(rawPath, browserOrigin);
  url.searchParams.set("rrActivation", input.status);
  if (input.message) {
    url.searchParams.set("rrActivationMessage", input.message);
  } else {
    url.searchParams.delete("rrActivationMessage");
  }
  return url.toString();
}

// ─── Token + rolle-sjekker ────────────────────────────────────────────────

export function hashRoleRoomActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRoleRoomActivationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isRoleRoomClientReviewerRole(value: unknown): boolean {
  const normalized = toAdminString(value);
  return normalized === "client" || normalized === "client_reviewer";
}

export function isRoleRoomCommercialLoginIntent(input: {
  loginAs?: unknown;
  requestedRole?: unknown;
}): boolean {
  const loginAs = toAdminString(input.loginAs);
  if (loginAs === "production_team") {
    return true;
  }
  if (loginAs === "content_producer") {
    return !isRoleRoomClientReviewerRole(input.requestedRole);
  }
  return false;
}

// ─── Reminder-helpere (pure) ──────────────────────────────────────────────

export function shouldSendRoleRoomReminder(input: {
  anchorAt?: string | null;
  lastSentAt?: string | null;
  sentCount?: number | null;
  thresholdHours: number[];
  repeatHours: number;
}): boolean {
  const anchorTime = Date.parse(String(input.anchorAt || ""));
  if (!Number.isFinite(anchorTime) || anchorTime <= 0) {
    return false;
  }

  const count = Math.max(0, Math.floor(input.sentCount || 0));
  const now = Date.now();
  if (count < input.thresholdHours.length) {
    return now - anchorTime >= input.thresholdHours[count] * 60 * 60 * 1000;
  }

  const lastSentTime = Date.parse(String(input.lastSentAt || ""));
  if (!Number.isFinite(lastSentTime) || lastSentTime <= 0) {
    return false;
  }

  return now - lastSentTime >= input.repeatHours * 60 * 60 * 1000;
}

export function buildRoleRoomCommercialReminderSummary(
  reason: "startup" | "interval" | "manual",
): RoleRoomCommercialReminderSweepSummary {
  const startedAt = new Date().toISOString();
  return {
    reason,
    startedAt,
    finishedAt: startedAt,
    isRunning: true,
    paymentCandidates: 0,
    paymentRemindersSent: 0,
    activationCandidates: 0,
    activationRemindersSent: 0,
    failures: 0,
    skipped: 0,
    notes: [],
  };
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
