import type { Pool } from "pg";

export const LEADGRID_STORAGE_ADDON_BYTES = 100 * 1024 * 1024 * 1024;

export interface LeadgridOrganizationStorageStatus {
  organizationId: string;
  planKey: string;
  includedBytes: number;
  addonQuantity: number;
  addonBytes: number;
  capacityBytes: number;
  usedBytes: number;
  reservedBytes: number;
  availableBytes: number;
  fileCount: number;
}

export async function getLeadgridOrganizationStorageStatus(
  pool: Pool,
  organizationId: string,
): Promise<LeadgridOrganizationStorageStatus | null> {
  const result = await pool.query<{
    organization_id: string;
    plan_key: string;
    included_bytes: string | number;
    addon_quantity: string | number;
    used_bytes: string | number;
    reserved_bytes: string | number;
    file_count: string | number;
  }>(
    `SELECT organization.id::text AS organization_id,
            organization.plan AS plan_key,
            COALESCE(plan.included_storage_bytes, 2147483648) AS included_bytes,
            COALESCE(billing.storage_addon_quantity, 0) AS addon_quantity,
            COALESCE(usage.used_bytes, 0) AS used_bytes,
            COALESCE(usage.reserved_bytes, 0) AS reserved_bytes,
            COALESCE(usage.file_count, 0) AS file_count
       FROM organizations organization
       LEFT JOIN plan_limits plan ON plan.plan_key = organization.plan
       LEFT JOIN leadgrid_org_billing billing
         ON billing.organization_id = organization.id
       LEFT JOIN leadgrid_org_storage_usage usage
         ON usage.organization_id = organization.id
      WHERE organization.id = $1::uuid
      LIMIT 1`,
    [organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const includedBytes = Number(row.included_bytes);
  const addonQuantity = Number(row.addon_quantity);
  const addonBytes = addonQuantity * LEADGRID_STORAGE_ADDON_BYTES;
  const capacityBytes = includedBytes + addonBytes;
  const usedBytes = Number(row.used_bytes);
  const reservedBytes = Number(row.reserved_bytes);
  return {
    organizationId: row.organization_id,
    planKey: row.plan_key,
    includedBytes,
    addonQuantity,
    addonBytes,
    capacityBytes,
    usedBytes,
    reservedBytes,
    availableBytes: Math.max(0, capacityBytes - usedBytes - reservedBytes),
    fileCount: Number(row.file_count),
  };
}

export async function recordLeadgridActualEgress(input: {
  pool: Pool;
  organizationId: string;
  bytes: number;
  sourceProvider: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  billable?: boolean;
  billingProvider?: string;
}): Promise<boolean> {
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 0) {
    throw new Error("Leadgrid egress bytes must be a non-negative safe integer");
  }
  if (!input.idempotencyKey.trim()) {
    throw new Error("Leadgrid egress idempotency key is required");
  }
  const billingProvider = input.billingProvider?.trim() || null;
  if (input.billable === true && !billingProvider) {
    throw new Error("A billing provider is required for billable Leadgrid egress");
  }
  const inserted = await input.pool.query<{ inserted: boolean }>(
    `WITH usage AS (
       INSERT INTO leadgrid_usage_events (
         organization_id, metric, quantity, billable, source_provider,
         idempotency_key, metadata
       ) VALUES ($1::uuid, 'egress_bytes', $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (organization_id, idempotency_key) DO NOTHING
       RETURNING id, billable
     ), queued AS (
       INSERT INTO leadgrid_usage_exports (usage_event_id, billing_provider)
       SELECT id, $7 FROM usage WHERE billable = TRUE AND $7::text IS NOT NULL
       ON CONFLICT (usage_event_id, billing_provider) DO NOTHING
       RETURNING usage_event_id
     )
     SELECT EXISTS(SELECT 1 FROM usage) AS inserted`,
    [
      input.organizationId,
      input.bytes,
      input.billable === true,
      input.sourceProvider,
      input.idempotencyKey,
      JSON.stringify(input.metadata ?? {}),
      billingProvider,
    ],
  );
  return inserted.rows[0]?.inserted === true;
}

export interface LeadgridUsageExporter {
  readonly provider: string;
  exportEgress(input: {
    organizationId: string;
    bytes: number;
    occurredAt: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  }): Promise<{ providerEventId: string }>;
}

/**
 * Provider-neutral outbox consumer. Implementations may target Stripe or a
 * future billing vendor, but the ledger itself never contains vendor meter
 * identifiers. Exporters must honor the supplied stable idempotency key.
 */
export async function processNextLeadgridUsageExport(
  pool: Pool,
  exporter: LeadgridUsageExporter,
): Promise<"exported" | "empty" | "failed"> {
  const provider = exporter.provider.trim();
  if (!provider) throw new Error("Leadgrid usage exporter provider is required");
  const claimed = await pool.query<{
    export_id: string;
    usage_event_id: string;
    organization_id: string;
    quantity: string | number;
    occurred_at: string;
    metadata: Record<string, unknown>;
  }>(
    `UPDATE leadgrid_usage_exports export
        SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
       FROM leadgrid_usage_events usage
      WHERE export.id = (
        SELECT candidate.id
          FROM leadgrid_usage_exports candidate
         WHERE candidate.billing_provider = $1
           AND candidate.status IN ('pending', 'processing')
           AND candidate.next_attempt_at <= NOW()
           AND (
             candidate.status = 'pending'
             OR candidate.updated_at < NOW() - INTERVAL '10 minutes'
           )
         ORDER BY candidate.created_at, candidate.id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
        AND usage.id = export.usage_event_id
      RETURNING export.id::text AS export_id,
                usage.id::text AS usage_event_id,
                usage.organization_id::text,
                usage.quantity,
                usage.occurred_at::text,
                usage.metadata`,
    [provider],
  );
  const row = claimed.rows[0];
  if (!row) return "empty";
  try {
    const delivered = await exporter.exportEgress({
      organizationId: row.organization_id,
      bytes: Number(row.quantity),
      occurredAt: row.occurred_at,
      idempotencyKey: `leadgrid-egress:${row.usage_event_id}`,
      metadata: row.metadata ?? {},
    });
    if (!delivered.providerEventId?.trim()) {
      throw new Error("Leadgrid usage exporter returned no provider event id");
    }
    await pool.query(
      `UPDATE leadgrid_usage_exports
          SET status = 'exported', provider_event_id = $2,
              exported_at = NOW(), last_error = NULL, updated_at = NOW()
        WHERE id = $1::uuid AND status = 'processing'`,
      [row.export_id, delivered.providerEventId],
    );
    return "exported";
  } catch (error) {
    await pool.query(
      `UPDATE leadgrid_usage_exports
          SET status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END,
              next_attempt_at = NOW() + INTERVAL '5 minutes',
              last_error = $2, updated_at = NOW()
        WHERE id = $1::uuid`,
      [row.export_id, String(error instanceof Error ? error.message : error).slice(0, 1000)],
    );
    return "failed";
  }
}

export function leadgridStoragePersistenceError(error: unknown): {
  status: number;
  code: string;
} | null {
  const message = String(
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error,
  );
  if (message.includes("leadgrid_storage_access_disabled")) {
    return { status: 403, code: "leadgrid_storage_access_disabled" };
  }
  if (message.includes("leadgrid_storage_quota_exceeded")) {
    return { status: 413, code: "leadgrid_storage_quota_exceeded" };
  }
  if (message.includes("leadgrid_storage_plan_missing")) {
    return { status: 503, code: "leadgrid_storage_plan_missing" };
  }
  return null;
}
