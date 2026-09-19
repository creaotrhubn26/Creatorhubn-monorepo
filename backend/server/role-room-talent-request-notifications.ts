import crypto from "node:crypto";
import type { Pool } from "pg";

import {
  sendTalentRequestAgencyNotification,
  type TalentRequestAgencyNotificationKind,
} from "./role-room-partnerships-emails.js";

const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 5;
const BATCH_LIMIT = 50;

interface ClaimedDelivery {
  id: string;
  talent_request_id: string;
  notification_kind: TalentRequestAgencyNotificationKind;
  attempts: number;
}

interface DeliveryContext {
  request_id: string;
  notification_kind: TalentRequestAgencyNotificationKind;
  requested_by_user_id: string | null;
  response_deadline: string;
  agency_name: string;
  agency_email: string | null;
  project_name: string;
  role_name: string;
  talent_display_name: string;
}

export interface TalentRequestNotificationSweepSummary {
  expired: number;
  enqueued48h: number;
  enqueued24h: number;
  enqueuedOverdue: number;
  claimed: number;
  sent: number;
  failed: number;
  cancelled: number;
  dryRun: boolean;
}

/**
 * Enqueue a cancellation notice in the same durable ledger as deadline
 * reminders. The unique request/kind constraint makes repeated calls safe.
 */
export async function enqueueTalentRequestCancellation(pool: Pool, requestId: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO partnership_talent_request_deliveries
       (talent_request_id, notification_kind, status, available_at)
     VALUES ($1::uuid, 'cancelled', 'pending', now())
     ON CONFLICT (talent_request_id, notification_kind) DO NOTHING
     RETURNING id`,
    [requestId],
  );
  return Boolean(result.rows[0]);
}

/** Stop deadline reminders as soon as the request reaches a terminal state. */
export async function cancelOutstandingTalentRequestDeliveries(pool: Pool, requestId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE partnership_talent_request_deliveries
        SET status = 'cancelled', claim_token = NULL, lease_until = NULL,
            last_error = NULL
      WHERE talent_request_id = $1::uuid
        AND notification_kind <> 'cancelled'
        AND status IN ('pending', 'processing', 'failed')`,
    [requestId],
  );
  return result.rowCount ?? 0;
}

export async function runTalentRequestNotificationSweep(
  pool: Pool,
  options: { dryRun?: boolean; limit?: number; onlyRequestId?: string } = {},
): Promise<TalentRequestNotificationSweepSummary> {
  const dryRun = options.dryRun === true;
  const limit = Math.max(1, Math.min(BATCH_LIMIT, options.limit ?? BATCH_LIMIT));
  const summary: TalentRequestNotificationSweepSummary = {
    expired: 0,
    enqueued48h: 0,
    enqueued24h: 0,
    enqueuedOverdue: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    dryRun,
  };

  if (dryRun) {
    const preview = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status IN ('pending','acknowledged')
             AND response_deadline > now() + interval '24 hours'
             AND response_deadline <= now() + interval '48 hours'
         )::int AS due_48h,
         COUNT(*) FILTER (
           WHERE status IN ('pending','acknowledged')
             AND response_deadline > now()
             AND response_deadline <= now() + interval '24 hours'
         )::int AS due_24h,
         COUNT(*) FILTER (
           WHERE status IN ('pending','acknowledged','expired')
             AND response_deadline <= now()
         )::int AS overdue
       FROM partnership_talent_requests
      WHERE ($1::uuid IS NULL OR id = $1::uuid)`,
      [options.onlyRequestId ?? null],
    );
    summary.enqueued48h = Number(preview.rows[0]?.due_48h ?? 0);
    summary.enqueued24h = Number(preview.rows[0]?.due_24h ?? 0);
    summary.enqueuedOverdue = Number(preview.rows[0]?.overdue ?? 0);
    return summary;
  }

  const expired = await pool.query(
    `UPDATE partnership_talent_requests
        SET status = 'expired', updated_at = now()
      WHERE status IN ('pending','acknowledged')
        AND response_deadline <= now()
        AND ($1::uuid IS NULL OR id = $1::uuid)`,
    [options.onlyRequestId ?? null],
  );
  summary.expired = expired.rowCount ?? 0;

  summary.enqueued48h = await materializeDeadlineDeliveries(pool, "deadline_48h", options.onlyRequestId);
  summary.enqueued24h = await materializeDeadlineDeliveries(pool, "deadline_24h", options.onlyRequestId);
  summary.enqueuedOverdue = await materializeDeadlineDeliveries(pool, "deadline_overdue", options.onlyRequestId);

  const cancelled = await pool.query(
    `UPDATE partnership_talent_request_deliveries d
        SET status = 'cancelled', claim_token = NULL, lease_until = NULL,
            last_error = NULL
       FROM partnership_talent_requests r
      WHERE r.id = d.talent_request_id
        AND d.status IN ('pending','processing','failed')
        AND ($1::uuid IS NULL OR r.id = $1::uuid)
        AND (
          (d.notification_kind = 'cancelled' AND r.status <> 'cancelled')
          OR (d.notification_kind = 'deadline_48h'
              AND (
                r.status NOT IN ('pending','acknowledged')
                OR r.response_deadline <= now() + interval '24 hours'
                OR r.response_deadline > now() + interval '48 hours'
              ))
          OR (d.notification_kind = 'deadline_24h'
              AND (
                r.status NOT IN ('pending','acknowledged')
                OR r.response_deadline <= now()
                OR r.response_deadline > now() + interval '24 hours'
              ))
          OR (d.notification_kind = 'deadline_overdue'
              AND (r.status <> 'expired' OR r.response_deadline > now()))
        )`,
    [options.onlyRequestId ?? null],
  );
  summary.cancelled += cancelled.rowCount ?? 0;

  const claimToken = crypto.randomUUID();
  const claimedResult = await pool.query<ClaimedDelivery>(
    `WITH claimable AS (
       SELECT d.id
         FROM partnership_talent_request_deliveries d
        WHERE d.attempts < $1
          AND d.available_at <= now()
          AND ($2::uuid IS NULL OR d.talent_request_id = $2::uuid)
          AND (
            d.status IN ('pending','failed')
            OR (d.status = 'processing' AND d.lease_until < now())
          )
        ORDER BY d.available_at ASC, d.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $3
     )
     UPDATE partnership_talent_request_deliveries d
        SET status = 'processing', attempts = d.attempts + 1,
            claim_token = $4::uuid, claimed_at = now(),
            lease_until = now() + ($5 || ' minutes')::interval,
            last_error = NULL
       FROM claimable
      WHERE d.id = claimable.id
     RETURNING d.id::text, d.talent_request_id::text,
               d.notification_kind, d.attempts`,
    [MAX_ATTEMPTS, options.onlyRequestId ?? null, limit, claimToken, String(LEASE_MINUTES)],
  );
  summary.claimed = claimedResult.rows.length;

  for (const delivery of claimedResult.rows) {
    const contextResult = await pool.query<DeliveryContext>(
      `SELECT r.id::text AS request_id,
              $2::text AS notification_kind,
              r.requested_by_user_id,
              r.response_deadline::text,
              a.name AS agency_name,
              a.contact_email AS agency_email,
              proj.name AS project_name,
              cr.name AS role_name,
              t.display_name AS talent_display_name
         FROM partnership_talent_requests r
         JOIN partnership_project_invitations i ON i.id = r.invitation_id
         JOIN agency_production_partnerships p ON p.id = i.partnership_id
         JOIN agency_orgs a ON a.id = p.agency_org_id
         JOIN casting_projects proj ON proj.id = i.casting_project_id
         JOIN casting_roles cr ON cr.id = r.casting_role_id
        JOIN talents t ON t.id = r.talent_id
        WHERE r.id = $1::uuid
          AND (
            ($2::text = 'cancelled' AND r.status = 'cancelled')
            OR (
              $2::text IN ('deadline_48h','deadline_24h','deadline_overdue')
              AND i.status = 'accepted'
              AND p.status = 'accepted'
              AND p.paused_at IS NULL
              AND (i.expires_at IS NULL OR i.expires_at > now())
              AND EXISTS (
                SELECT 1
                  FROM talent_consent_registry c
                 WHERE c.talent_id = r.talent_id
                   AND c.partner_type = a.type
                   AND c.partner_ref = a.id::text
                   AND c.status = 'granted'
                   AND (c.expires_at IS NULL OR c.expires_at > now())
                   AND c.scope IN ('basic_profile', 'full_profile')
              )
              AND (
                ($2::text = 'deadline_48h'
                  AND r.status IN ('pending','acknowledged')
                  AND r.response_deadline > now() + interval '24 hours'
                  AND r.response_deadline <= now() + interval '48 hours')
                OR ($2::text = 'deadline_24h'
                  AND r.status IN ('pending','acknowledged')
                  AND r.response_deadline > now()
                  AND r.response_deadline <= now() + interval '24 hours')
                OR ($2::text = 'deadline_overdue'
                  AND r.status = 'expired' AND r.response_deadline <= now())
              )
            )
          )
        LIMIT 1`,
      [delivery.talent_request_id, delivery.notification_kind],
    );
    const context = contextResult.rows[0];
    if (!context?.agency_email) {
      await markDeliveryCancelled(pool, delivery.id, claimToken, context ? "agency_email_missing" : "request_no_longer_eligible");
      summary.cancelled += 1;
      continue;
    }

    try {
      const result = await sendTalentRequestAgencyNotification(pool, {
        notificationKind: delivery.notification_kind,
        requestId: context.request_id,
        agencyName: context.agency_name,
        projectName: context.project_name,
        roleName: context.role_name,
        talentDisplayName: context.talent_display_name,
        responseDeadline: context.response_deadline,
        recipientEmail: context.agency_email,
        sentByUserId: context.requested_by_user_id,
      });
      if (result.sent) {
        await pool.query(
          `UPDATE partnership_talent_request_deliveries
              SET status = 'sent', sent_at = now(), claim_token = NULL,
                  lease_until = NULL, last_error = NULL
            WHERE id = $1::uuid AND status = 'processing' AND claim_token = $2::uuid`,
          [delivery.id, claimToken],
        );
        summary.sent += 1;
      } else {
        await markDeliveryFailed(pool, delivery, claimToken, result.reason ?? "send_failed");
        summary.failed += 1;
      }
    } catch (error) {
      await markDeliveryFailed(
        pool,
        delivery,
        claimToken,
        error instanceof Error ? error.message : String(error),
      );
      summary.failed += 1;
    }
  }

  return summary;
}

async function materializeDeadlineDeliveries(
  pool: Pool,
  kind: Exclude<TalentRequestAgencyNotificationKind, "cancelled">,
  onlyRequestId?: string,
): Promise<number> {
  const timePredicate = kind === "deadline_48h"
    ? "r.response_deadline > now() + interval '24 hours' AND r.response_deadline <= now() + interval '48 hours'"
    : kind === "deadline_24h"
      ? "r.response_deadline > now() AND r.response_deadline <= now() + interval '24 hours'"
      : "r.response_deadline <= now()";
  const statuses = kind === "deadline_overdue"
    ? "('expired')"
    : "('pending','acknowledged')";
  const result = await pool.query(
    `INSERT INTO partnership_talent_request_deliveries
       (talent_request_id, notification_kind, status, available_at)
     SELECT r.id, $1, 'pending', now()
       FROM partnership_talent_requests r
      WHERE r.status IN ${statuses}
        AND ${timePredicate}
        AND ($2::uuid IS NULL OR r.id = $2::uuid)
     ON CONFLICT (talent_request_id, notification_kind) DO NOTHING
     RETURNING id`,
    [kind, onlyRequestId ?? null],
  );
  return result.rowCount ?? 0;
}

async function markDeliveryCancelled(
  pool: Pool,
  deliveryId: string,
  claimToken: string,
  reason: string,
): Promise<void> {
  await pool.query(
    `UPDATE partnership_talent_request_deliveries
        SET status = 'cancelled', claim_token = NULL, lease_until = NULL,
            last_error = $3
      WHERE id = $1::uuid AND status = 'processing' AND claim_token = $2::uuid`,
    [deliveryId, claimToken, reason.slice(0, 1000)],
  );
}

async function markDeliveryFailed(
  pool: Pool,
  delivery: ClaimedDelivery,
  claimToken: string,
  reason: string,
): Promise<void> {
  const terminal = delivery.attempts >= MAX_ATTEMPTS;
  await pool.query(
    `UPDATE partnership_talent_request_deliveries
        SET status = 'failed', claim_token = NULL, lease_until = NULL,
            available_at = CASE
              WHEN $4::boolean THEN available_at
              ELSE now() + (LEAST(240, 15 * power(2, GREATEST(0, attempts - 1))) || ' minutes')::interval
            END,
            last_error = $3
      WHERE id = $1::uuid AND status = 'processing' AND claim_token = $2::uuid`,
    [delivery.id, claimToken, reason.slice(0, 1000), terminal],
  );
}
