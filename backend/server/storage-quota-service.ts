// Storage-quota-service — sentralt knutepunkt for å:
//   1. Slå opp brukerens plan-tier og storage-grense
//   2. Sjekke om en upload kan tillates (kvote-enforcement)
//   3. Registrere bytes i `user_storage_consumption` ledger
//   4. Pushe metered usage til Stripe når brukeren overskrider grensen
//
// Plan-grenser leses fra compat-override-store (samme som
// `platformSubscriptionPlans` i index.ts redigerer fra admin-UI).
// Hardkodede defaults under brukes hvis admin ikke har lagret en override.

import type { Pool } from "pg";

// Samme nøkkel/tabell som index.ts compatStoreGet bruker — vi peker
// direkte mot legacy_compat_store her for å unngå et sirkulært import
// til index.ts.
const LEGACY_COMPAT_TABLE_NAME = "legacy_compat_store";
const COMPAT_PLATFORM_SUBSCRIPTION_PLAN_OVERRIDES_STORE_KEY =
  "platform_subscription_plan_overrides";

const GIB = 1024 * 1024 * 1024;

export type PlanTier =
  | "prototype"
  | "basic"
  | "professional"
  | "premium"
  | "enterprise"
  | "trial"
  | "unknown";

const PLAN_STORAGE_GB: Record<PlanTier, number> = {
  prototype: 2,
  trial: 10, // trials får samme som basic
  basic: 10,
  professional: 50,
  premium: 250,
  enterprise: 1000,
  unknown: 2, // anonyme/manglende sub → free-tier-grenser
};

// Hvilke planer tillater overforbruk mot metered Stripe-pris?
// Enterprise og premium har storage-overage på (om Stripe price-id er satt).
// Prototype/basic er HARDE kapper — bruker må oppgradere.
const PLAN_ALLOWS_OVERAGE: Record<PlanTier, boolean> = {
  prototype: false,
  trial: false,
  basic: false,
  professional: true,
  premium: true,
  enterprise: true,
  unknown: false,
};

export interface UserPlanInfo {
  tier: PlanTier;
  storageLimitBytes: number;
  allowsOverage: boolean;
  stripeSubscriptionId: string | null;
  stripeStorageMeterItemId: string | null;
}

export interface StorageStatus {
  user: UserPlanInfo;
  usedBytes: number;
  freeBytes: number; // negative ved overage
  usedFraction: number; // 0–1+
  overageBytes: number; // 0 hvis under grense
  overageGB: number;
}

export interface CanUploadResult {
  ok: boolean;
  reason?:
    | "plan_limit_reached_no_overage"
    | "subscription_not_found"
    | "internal_error";
  message?: string;
  status: StorageStatus;
}

const normalizePlanTier = (raw: string | null | undefined): PlanTier => {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();
  if (lower in PLAN_STORAGE_GB) return lower as PlanTier;
  // Mapping av aliases — vanlig at f.eks. "creator_basic" eller "pro"
  // brukes løst rundt i koden
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("premium") || lower.includes("studio")) return "premium";
  if (
    lower.includes("professional") ||
    lower.includes("pro") ||
    lower === "creator_pro"
  ) {
    return "professional";
  }
  if (lower.includes("basic")) return "basic";
  if (lower.includes("trial")) return "trial";
  if (lower.includes("free") || lower.includes("prototype")) return "prototype";
  return "unknown";
};

interface PlanOverridesShape {
  [planSlug: string]: {
    maxStorageGB?: number | null;
    allowsStorageOverage?: boolean | null;
    storageOveragePricePerGbNok?: number | null;
  };
}

let overridesCache: {
  loadedAt: number;
  data: PlanOverridesShape;
} | null = null;
const OVERRIDES_CACHE_TTL_MS = 60_000;

const loadPlanOverrides = async (
  pool: Pool,
): Promise<PlanOverridesShape> => {
  if (
    overridesCache &&
    Date.now() - overridesCache.loadedAt < OVERRIDES_CACHE_TTL_MS
  ) {
    return overridesCache.data;
  }
  try {
    const r = await pool.query<{ store_value: PlanOverridesShape | null }>(
      `SELECT store_value FROM ${LEGACY_COMPAT_TABLE_NAME} WHERE store_key = $1 LIMIT 1`,
      [COMPAT_PLATFORM_SUBSCRIPTION_PLAN_OVERRIDES_STORE_KEY],
    );
    const data = r.rows[0]?.store_value ?? {};
    overridesCache = { loadedAt: Date.now(), data };
    return data;
  } catch {
    overridesCache = { loadedAt: Date.now(), data: {} };
    return {};
  }
};

export const clearStorageQuotaPlanCache = (): void => {
  overridesCache = null;
};

const getEffectivePlanLimits = async (
  pool: Pool,
  planSlug: string,
): Promise<{ storageGB: number; allowsOverage: boolean; overagePriceNok: number | null }> => {
  const overrides = await loadPlanOverrides(pool);
  const tier = normalizePlanTier(planSlug);
  const slugLower = planSlug.toLowerCase().trim();
  const override = overrides[slugLower] || overrides[tier] || {};

  const storageGB =
    typeof override.maxStorageGB === "number"
      ? override.maxStorageGB
      : PLAN_STORAGE_GB[tier];
  const allowsOverage =
    typeof override.allowsStorageOverage === "boolean"
      ? override.allowsStorageOverage
      : PLAN_ALLOWS_OVERAGE[tier];
  const overagePriceNok =
    typeof override.storageOveragePricePerGbNok === "number"
      ? override.storageOveragePricePerGbNok
      : null;

  return { storageGB, allowsOverage, overagePriceNok };
};

// Schema-drift guard: Neon-prod's `subscriptions` table has no `plan_type`
// column (it uses `tier_id`), so a hardcoded `SELECT plan_type` throws
// `column "plan_type" does not exist` on every call — silently degrading
// every user to the "unknown" plan and spamming the error log. Detect the
// real columns once and alias them, mirroring admin-storage-cost-routes.ts.
let subscriptionColCache:
  | { planCol: string | null; hasStripeSub: boolean; hasMeter: boolean }
  | null = null;

async function resolveSubscriptionColumns(pool: Pool): Promise<{
  planCol: string | null;
  hasStripeSub: boolean;
  hasMeter: boolean;
}> {
  if (subscriptionColCache) return subscriptionColCache;
  try {
    const r = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'subscriptions'
          AND column_name IN (
            'plan_type', 'plan_id', 'subscription_plan_id', 'tier_id',
            'stripe_subscription_id', 'stripe_storage_meter_item_id'
          )`,
    );
    const cols = new Set(r.rows.map((row) => row.column_name));
    const planCol = cols.has("plan_type")
      ? "plan_type"
      : cols.has("plan_id")
        ? "plan_id"
        : cols.has("subscription_plan_id")
          ? "subscription_plan_id"
          : cols.has("tier_id")
            ? "tier_id"
            : null;
    subscriptionColCache = {
      planCol,
      hasStripeSub: cols.has("stripe_subscription_id"),
      hasMeter: cols.has("stripe_storage_meter_item_id"),
    };
  } catch {
    subscriptionColCache = { planCol: null, hasStripeSub: false, hasMeter: false };
  }
  return subscriptionColCache;
}

export async function getUserPlan(
  pool: Pool,
  userId: string,
): Promise<UserPlanInfo> {
  try {
    const cols = await resolveSubscriptionColumns(pool);
    const planSel = cols.planCol
      ? `${cols.planCol} AS plan_type`
      : `'unknown'::text AS plan_type`;
    const subSel = cols.hasStripeSub
      ? "stripe_subscription_id"
      : "NULL::text AS stripe_subscription_id";
    const meterSel = cols.hasMeter
      ? "stripe_storage_meter_item_id"
      : "NULL::text AS stripe_storage_meter_item_id";
    const r = await pool.query<{
      plan_type: string;
      stripe_subscription_id: string | null;
      stripe_storage_meter_item_id: string | null;
    }>(
      `SELECT ${planSel}, ${subSel}, ${meterSel}
         FROM subscriptions
        WHERE user_id = $1
          AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId],
    );
    if ((r.rowCount ?? 0) === 0) {
      const eff = await getEffectivePlanLimits(pool, "unknown");
      return {
        tier: "unknown",
        storageLimitBytes: eff.storageGB * GIB,
        allowsOverage: eff.allowsOverage,
        stripeSubscriptionId: null,
        stripeStorageMeterItemId: null,
      };
    }
    const row = r.rows[0];
    const tier = normalizePlanTier(row.plan_type);
    const eff = await getEffectivePlanLimits(pool, row.plan_type);
    return {
      tier,
      storageLimitBytes: eff.storageGB * GIB,
      allowsOverage: eff.allowsOverage,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeStorageMeterItemId: row.stripe_storage_meter_item_id,
    };
  } catch (err) {
    console.error("[storage-quota] getUserPlan failed:", err);
    return {
      tier: "unknown",
      storageLimitBytes: PLAN_STORAGE_GB.unknown * GIB,
      allowsOverage: false,
      stripeSubscriptionId: null,
      stripeStorageMeterItemId: null,
    };
  }
}

export async function getStorageStatus(
  pool: Pool,
  userId: string,
): Promise<StorageStatus> {
  const user = await getUserPlan(pool, userId);
  const usage = await pool
    .query<{ total_bytes: string }>(
      `SELECT total_bytes FROM user_storage_consumption WHERE user_id = $1`,
      [userId],
    )
    .catch(() => null);
  const usedBytes = usage?.rows?.[0]?.total_bytes
    ? Number(usage.rows[0].total_bytes)
    : 0;
  const freeBytes = user.storageLimitBytes - usedBytes;
  const overageBytes = freeBytes < 0 ? -freeBytes : 0;
  return {
    user,
    usedBytes,
    freeBytes,
    usedFraction: user.storageLimitBytes > 0
      ? usedBytes / user.storageLimitBytes
      : 0,
    overageBytes,
    overageGB: Math.ceil(overageBytes / GIB),
  };
}

export async function canUserUpload(
  pool: Pool,
  userId: string,
  additionalBytes: number,
): Promise<CanUploadResult> {
  const status = await getStorageStatus(pool, userId);
  const projectedTotal = status.usedBytes + additionalBytes;

  // Under grensen — alltid OK
  if (projectedTotal <= status.user.storageLimitBytes) {
    return { ok: true, status };
  }

  // Over grensen — kun OK hvis planen tillater overage
  if (status.user.allowsOverage) {
    return { ok: true, status };
  }

  const limitGB = Math.round(status.user.storageLimitBytes / GIB);
  const usedGB = (status.usedBytes / GIB).toFixed(2);
  const newGB = (additionalBytes / GIB).toFixed(2);
  return {
    ok: false,
    reason: "plan_limit_reached_no_overage",
    message:
      `Lagringen er full. Planen din (${status.user.tier}) inkluderer ${limitGB} GB. ` +
      `Du har brukt ${usedGB} GB, og denne uploaden er ${newGB} GB. ` +
      `Oppgrader for å fortsette eller slett gamle filer.`,
    status,
  };
}

export async function recordStorageUsage(
  pool: Pool,
  userId: string,
  bytes: number,
  backend: "filesystem" | "r2" | "cloudflare_stream",
  reason: string,
  relatedResourceId?: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const r = await pool.query<{ apply_storage_consumption_delta: string }>(
    `SELECT apply_storage_consumption_delta($1, $2, $3, $4, $5, $6::jsonb) AS apply_storage_consumption_delta`,
    [
      userId,
      bytes,
      backend,
      reason,
      relatedResourceId ?? null,
      JSON.stringify(metadata),
    ],
  );
  return Number(r.rows[0]?.apply_storage_consumption_delta || 0);
}

// Push usage til Stripe metered subscription-item.
// Action='set' overskriver kvanteten; vi pusher overage-gigabyte avrundet
// oppover slik at brukeren betaler for hver påbegynt GB.
export async function pushStorageUsageToStripe(
  pool: Pool,
  userId: string,
): Promise<{
  pushed: boolean;
  reason?: string;
  overageGB?: number;
}> {
  const stripeKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.CREATORHUB_STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY;
  if (!stripeKey) {
    return { pushed: false, reason: "stripe_not_configured" };
  }

  const status = await getStorageStatus(pool, userId);
  if (!status.user.allowsOverage) {
    return { pushed: false, reason: "plan_does_not_allow_overage" };
  }
  if (!status.user.stripeStorageMeterItemId) {
    return { pushed: false, reason: "no_metered_item_on_subscription" };
  }
  if (status.overageBytes <= 0) {
    return { pushed: false, reason: "no_overage" };
  }

  const overageGB = status.overageGB;

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    // Bruk createUsageRecord med action='set' for å rapportere aktuell
    // overage-mengde. Hvis brukeren har lastet ned filer er overage
    // mindre — set overskriver så Stripe alltid har siste tilstand.
    // @ts-ignore — Stripe types kan være eldre, dette er metered-API
    await (stripe as any).subscriptionItems.createUsageRecord(
      status.user.stripeStorageMeterItemId,
      {
        quantity: overageGB,
        timestamp: Math.floor(Date.now() / 1000),
        action: "set",
      },
    );

    await pool.query(
      `UPDATE user_storage_consumption
          SET last_stripe_sync_at = now(),
              last_synced_overage_gb = $2
        WHERE user_id = $1`,
      [userId, overageGB],
    );

    return { pushed: true, overageGB };
  } catch (err: any) {
    console.error("[storage-quota] Stripe usage push failed:", err);
    return {
      pushed: false,
      reason: `stripe_error: ${String(err?.message || err).slice(0, 200)}`,
    };
  }
}

/**
 * Sikre at en Pro/Premium/Enterprise-subscription har et metered
 * storage-overage-item attachet. Trygg å kalle gjentatt — idempotent.
 *
 * Brukes:
 *   - Etter webhook-handling i dance-billing-service når en sub blir 'active'
 *   - Fra admin-backfill-endepunktet for eksisterende subscriptions
 *
 * Krever env-var STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK (Stripe-pris med
 * recurring.usage_type='metered'). Hvis ikke satt → no-op.
 *
 * Returnerer status så caller kan logge.
 */
export async function ensureStorageMeterAttached(
  pool: Pool,
  userId: string,
  planSlug: string,
  stripeSubscriptionId: string | null,
): Promise<{
  attached: boolean;
  itemId?: string;
  reason?: string;
}> {
  if (!stripeSubscriptionId) {
    return { attached: false, reason: "no_stripe_subscription" };
  }

  const tier = normalizePlanTier(planSlug);
  if (!PLAN_ALLOWS_OVERAGE[tier]) {
    return { attached: false, reason: "plan_does_not_need_overage" };
  }

  const stripeKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.CREATORHUB_STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY;
  if (!stripeKey) {
    return { attached: false, reason: "stripe_not_configured" };
  }

  const overagePriceId = process.env.STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK?.trim();
  if (!overagePriceId) {
    return { attached: false, reason: "overage_price_not_configured" };
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const subscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      { expand: ["items.data.price"] },
    );

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing" &&
      subscription.status !== "past_due"
    ) {
      return {
        attached: false,
        reason: `subscription_not_billable: ${subscription.status}`,
      };
    }

    const items = subscription.items?.data ?? [];
    const existing = items.find(
      (i: any) =>
        typeof i.price?.id === "string" && i.price.id === overagePriceId,
    );

    let itemId: string;
    if (existing) {
      itemId = existing.id;
    } else {
      const created = await (stripe as any).subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: overagePriceId,
        // metered prices skal ikke ha quantity ved create — quantity
        // settes via createUsageRecord ved hver upload
        proration_behavior: "none",
      });
      itemId = created.id;
    }

    // Lagre item-id på subscription-raden så pushStorageUsageToStripe
    // finner den.
    await pool.query(
      `UPDATE subscriptions
          SET stripe_storage_meter_item_id = $2,
              updated_at = now()
        WHERE user_id = $1 AND stripe_subscription_id = $3`,
      [userId, itemId, stripeSubscriptionId],
    );

    return { attached: true, itemId };
  } catch (err: any) {
    console.error("[storage-quota] ensureStorageMeterAttached failed:", err);
    return {
      attached: false,
      reason: `stripe_error: ${String(err?.message || err).slice(0, 200)}`,
    };
  }
}

export const STORAGE_QUOTA_INTERNAL = {
  PLAN_STORAGE_GB,
  PLAN_ALLOWS_OVERAGE,
  normalizePlanTier,
  GIB,
};
