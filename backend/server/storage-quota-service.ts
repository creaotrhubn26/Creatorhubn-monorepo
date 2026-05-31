// Storage-quota-service — sentralt knutepunkt for å:
//   1. Slå opp brukerens plan-tier og storage-grense
//   2. Sjekke om en upload kan tillates (kvote-enforcement)
//   3. Registrere bytes i `user_storage_consumption` ledger
//   4. Pushe metered usage til Stripe når brukeren overskrider grensen
//
// Plan-grenser er hardkodet her for nå (samme grenser som
// platformSubscriptionPlans i index.ts). Når den definisjonen er hentet
// ut av index.ts kan vi importere derfra.

import type { Pool } from "pg";

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

export async function getUserPlan(
  pool: Pool,
  userId: string,
): Promise<UserPlanInfo> {
  try {
    const r = await pool.query<{
      plan_type: string;
      stripe_subscription_id: string | null;
      stripe_storage_meter_item_id: string | null;
    }>(
      `SELECT plan_type, stripe_subscription_id, stripe_storage_meter_item_id
         FROM subscriptions
        WHERE user_id = $1
          AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId],
    );
    if ((r.rowCount ?? 0) === 0) {
      return {
        tier: "unknown",
        storageLimitBytes: PLAN_STORAGE_GB.unknown * GIB,
        allowsOverage: false,
        stripeSubscriptionId: null,
        stripeStorageMeterItemId: null,
      };
    }
    const row = r.rows[0];
    const tier = normalizePlanTier(row.plan_type);
    return {
      tier,
      storageLimitBytes: PLAN_STORAGE_GB[tier] * GIB,
      allowsOverage: PLAN_ALLOWS_OVERAGE[tier],
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

export const STORAGE_QUOTA_INTERNAL = {
  PLAN_STORAGE_GB,
  PLAN_ALLOWS_OVERAGE,
  normalizePlanTier,
  GIB,
};
