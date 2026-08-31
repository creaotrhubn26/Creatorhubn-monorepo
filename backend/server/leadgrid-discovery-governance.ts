import type { Pool, PoolClient } from "pg";

export const DEFAULT_MAX_ACTIVE_AUTO_PROFILES_PER_ORG = 5;
export const DEFAULT_ORG_MONTHLY_CANDIDATE_BUDGET = 500;

function boundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

export function maxActiveAutoProfilesPerOrganization(
  env: Record<string, string | undefined> = process.env,
): number {
  return boundedPositiveInteger(
    env.LEADGRID_DISCOVERY_MAX_AUTO_PROFILES_PER_ORG,
    DEFAULT_MAX_ACTIVE_AUTO_PROFILES_PER_ORG,
    100,
  );
}

export function organizationMonthlyCandidateBudget(
  env: Record<string, string | undefined> = process.env,
): number {
  return boundedPositiveInteger(
    env.LEADGRID_DISCOVERY_ORG_MONTHLY_CANDIDATE_BUDGET,
    DEFAULT_ORG_MONTHLY_CANDIDATE_BUDGET,
    1_000_000,
  );
}

export class DiscoveryGovernanceError extends Error {
  readonly code: "auto_profile_limit_reached" | "capacity_reservation_conflict";
  readonly status = 409;

  constructor(
    code: "auto_profile_limit_reached" | "capacity_reservation_conflict",
  ) {
    super(
      code === "auto_profile_limit_reached"
        ? "For mange aktive automatiske Discovery-profiler."
        : "Discovery-kapasiteten er allerede reservert med et annet omfang.",
    );
    this.name = "DiscoveryGovernanceError";
    this.code = code;
  }
}

/**
 * Establishes the single lock order used by every profile create/update path:
 * organization governance lock before any profile row lock.
 */
export async function lockAutoDiscoveryProfileGovernance(
  client: Pick<PoolClient, "query">,
  organizationId: string,
): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `leadgrid-discovery-auto-profiles|${organizationId}`,
  ]);
}

/**
 * Must run inside the caller's transaction. The organization advisory lock
 * prevents two concurrent profile creates/enables from both passing the cap.
 */
export async function assertAutoDiscoveryProfileCapacity(
  client: Pick<PoolClient, "query">,
  input: { organizationId: string; excludeProfileId?: string | null },
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const maximum = maxActiveAutoProfilesPerOrganization(env);
  await lockAutoDiscoveryProfileGovernance(client, input.organizationId);
  const count = await client.query<{ count: number | string }>(
    `SELECT COUNT(*)::int AS count
       FROM leadgrid_discovery_profiles
      WHERE organization_id = $1::uuid
        AND status = 'active'
        AND auto_discover_enabled = TRUE
        AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [input.organizationId, input.excludeProfileId ?? null],
  );
  if (Number(count.rows[0]?.count ?? 0) >= maximum) {
    throw new DiscoveryGovernanceError("auto_profile_limit_reached");
  }
}

function utcMonthStart(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("invalid_usage_month");
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export interface DiscoveryCapacityReservation {
  allowed: boolean;
  replayed: boolean;
  monthStart: string;
  candidateBudget: number;
}

type CapacityClient = Pick<PoolClient, "query">;

/** Transaction-scoped primitive used by run creation/confirmation. */
export async function reserveDiscoveryMonthlyCapacityInTransaction(
  client: CapacityClient,
  input: {
    organizationId: string;
    idempotencyKey: string;
    requestedCandidates: number;
    at?: Date;
  },
  env: Record<string, string | undefined> = process.env,
): Promise<DiscoveryCapacityReservation> {
  const at = input.at ?? new Date();
  const monthStart = utcMonthStart(at);
  const candidateBudget = organizationMonthlyCandidateBudget(env);
  if (
    !Number.isInteger(input.requestedCandidates) ||
    input.requestedCandidates < 1 ||
    input.requestedCandidates > 60
  ) {
    throw new Error("invalid_capacity_reservation");
  }
  if (input.requestedCandidates > candidateBudget) {
    return { allowed: false, replayed: false, monthStart, candidateBudget };
  }

  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `leadgrid-discovery-budget|${input.organizationId}|${monthStart}`,
  ]);
  const existing = await client.query<{
    month_start: Date | string;
    reserved_candidates: number;
  }>(
    `SELECT month_start, reserved_candidates
       FROM leadgrid_discovery_capacity_reservations
      WHERE organization_id = $1::uuid
        AND idempotency_key = $2
      FOR UPDATE`,
    [input.organizationId, input.idempotencyKey],
  );
  if (existing.rows[0]) {
    if (
      Number(existing.rows[0].reserved_candidates) !==
        input.requestedCandidates ||
      utcMonthStart(new Date(existing.rows[0].month_start)) !== monthStart
    ) {
      throw new DiscoveryGovernanceError("capacity_reservation_conflict");
    }
    return { allowed: true, replayed: true, monthStart, candidateBudget };
  }

  const usage = await client.query(
    `INSERT INTO leadgrid_discovery_monthly_usage (
        organization_id, month_start, reserved_candidates,
        run_count, candidate_limit
      ) VALUES ($1::uuid, $2::date, $3, 1, $4)
      ON CONFLICT (organization_id, month_start) DO UPDATE SET
        reserved_candidates =
          leadgrid_discovery_monthly_usage.reserved_candidates
          + EXCLUDED.reserved_candidates,
        run_count = leadgrid_discovery_monthly_usage.run_count + 1,
        candidate_limit = EXCLUDED.candidate_limit,
        updated_at = NOW()
      WHERE leadgrid_discovery_monthly_usage.reserved_candidates
            + EXCLUDED.reserved_candidates
            <= EXCLUDED.candidate_limit
      RETURNING reserved_candidates`,
    [
      input.organizationId,
      monthStart,
      input.requestedCandidates,
      candidateBudget,
    ],
  );
  if ((usage.rowCount ?? 0) !== 1) {
    return { allowed: false, replayed: false, monthStart, candidateBudget };
  }
  await client.query(
    `INSERT INTO leadgrid_discovery_capacity_reservations (
        organization_id, idempotency_key, month_start, reserved_candidates
      ) VALUES ($1::uuid, $2, $3::date, $4)`,
    [
      input.organizationId,
      input.idempotencyKey,
      monthStart,
      input.requestedCandidates,
    ],
  );
  return { allowed: true, replayed: false, monthStart, candidateBudget };
}

/**
 * Reserves organization capacity exactly once for a durable idempotency key.
 * The transaction-level advisory lock makes the usage increment and
 * reservation insert atomic across scheduler instances.
 */
export async function reserveDiscoveryMonthlyCapacity(
  pool: Pool,
  input: {
    organizationId: string;
    idempotencyKey: string;
    requestedCandidates: number;
    at?: Date;
  },
  env: Record<string, string | undefined> = process.env,
): Promise<DiscoveryCapacityReservation> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reservation = await reserveDiscoveryMonthlyCapacityInTransaction(
      client,
      input,
      env,
    );
    if (!reservation.allowed) {
      await client.query("ROLLBACK");
      return reservation;
    }
    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function bindDiscoveryCapacityReservation(
  pool: CapacityClient,
  input: { organizationId: string; idempotencyKey: string; runId: string },
): Promise<void> {
  const bound = await pool.query(
    `UPDATE leadgrid_discovery_capacity_reservations
        SET run_id = COALESCE(run_id, $3::uuid)
      WHERE organization_id = $1::uuid
        AND idempotency_key = $2
        AND (run_id IS NULL OR run_id = $3::uuid)`,
    [input.organizationId, input.idempotencyKey, input.runId],
  );
  if ((bound.rowCount ?? 0) !== 1) {
    throw new DiscoveryGovernanceError("capacity_reservation_conflict");
  }
}

export async function releaseDiscoveryMonthlyCapacity(
  pool: Pool,
  input: { organizationId: string; idempotencyKey: string },
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const removed = await client.query<{
      month_start: Date | string;
      reserved_candidates: number;
    }>(
      `DELETE FROM leadgrid_discovery_capacity_reservations
        WHERE organization_id = $1::uuid
          AND idempotency_key = $2
          AND run_id IS NULL
        RETURNING month_start, reserved_candidates`,
      [input.organizationId, input.idempotencyKey],
    );
    const row = removed.rows[0];
    if (row) {
      await client.query(
        `UPDATE leadgrid_discovery_monthly_usage
            SET reserved_candidates = GREATEST(
                  0, reserved_candidates - $3
                ),
                run_count = GREATEST(0, run_count - 1),
                updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND month_start = $2::date`,
        [
          input.organizationId,
          utcMonthStart(new Date(row.month_start)),
          row.reserved_candidates,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
