/**
 * partner-webhook-service.ts
 *
 * Webhook-utsendelse til partner-endpoints med HMAC-SHA256-signering.
 *
 * Events vi sender:
 *   - customer.created
 *   - customer.updated
 *   - customer.needs_changed
 *   - customer.score_changed
 *   - deliverable.completed
 *   - focus_request.created
 *   - partnership.approved
 *   - intent_agreement.signed
 *
 * Sikkerhet:
 *   - Hver endpoint har sin egen signing_secret (per-endpoint).
 *   - Payload signeres med HMAC-SHA256(secret, JSON-body).
 *   - Headers: X-Leadgrid-Signature: sha256=<hex>
 *              X-Leadgrid-Event: <event_type>
 *              X-Leadgrid-Delivery: <event_id>
 *              X-Leadgrid-Timestamp: <unix>
 *
 * Retry-logikk:
 *   - 1. attempt: umiddelbart (fire-and-forget)
 *   - 2. attempt: etter 30s hvis 5xx/timeout
 *   - 3. attempt: etter 5 min
 *   - 4. attempt: etter 30 min
 *   - 5. attempt: etter 4 timer
 *   - 6. attempt: etter 24 timer
 *   - Etter 6 mislykkede attempts → endpoint auto-disabled.
 *   - 4xx (utenom 408/429) regnes som permanent feil — ingen retry.
 */

import type { Pool } from "pg";
import crypto from "crypto";

const MAX_ATTEMPTS = 6;
const RETRY_DELAYS_MS = [
  30_000,                  // attempt 2: 30s
  5 * 60 * 1000,           // attempt 3: 5 min
  30 * 60 * 1000,          // attempt 4: 30 min
  4 * 60 * 60 * 1000,      // attempt 5: 4t
  24 * 60 * 60 * 1000,     // attempt 6: 24t
];

interface WebhookEvent {
  /** Unik per event — brukes for dedup hos mottaker */
  eventId: string;
  eventType: string;
  /** Payload — det partneren vil se */
  data: Record<string, unknown>;
  /** Filter — bare endpoints som matcher partner_id ELLER org_id får leveranse */
  organizationId?: string;
  partnerId?: string;
}

export function signPayload(secret: string, body: string, timestamp: number): string {
  const signed = `${timestamp}.${body}`;
  return crypto.createHmac("sha256", secret).update(signed).digest("hex");
}

export async function deliverWebhook(
  pool: Pool,
  event: WebhookEvent,
): Promise<{ scheduled: number; skipped: number }> {
  // Finn alle endpoints som matcher event + org/partner
  const endpointsR = await pool.query<{
    id: string; url: string; signing_secret: string; events: string[];
    consecutive_failures: number;
  }>(
    `SELECT id, url, signing_secret, events, consecutive_failures
       FROM partner_webhook_endpoints
      WHERE is_active = TRUE
        AND auto_disabled_at IS NULL
        AND (
          ($1::uuid IS NOT NULL AND organization_id = $1)
          OR
          ($2::uuid IS NOT NULL AND partner_id = $2)
        )
        AND (events = '{}' OR $3 = ANY(events))`,
    [event.organizationId ?? null, event.partnerId ?? null, event.eventType],
  );

  let scheduled = 0;
  for (const ep of endpointsR.rows) {
    // Lag delivery-attempt-rad (planlagt umiddelbart)
    await pool.query(
      `INSERT INTO webhook_delivery_attempts
        (endpoint_id, event_type, event_id, payload, attempt_number, scheduled_at)
       VALUES ($1, $2, $3, $4, 1, now())
       ON CONFLICT (endpoint_id, event_id, attempt_number) DO NOTHING`,
      [ep.id, event.eventType, event.eventId, JSON.stringify(event.data)],
    );
    scheduled++;
  }

  // Fire delivery (fire-and-forget — caller venter ikke)
  void processPendingDeliveries(pool).catch((e) =>
    console.error("[webhook] processPending failed", e),
  );

  return { scheduled, skipped: 0 };
}

/**
 * Prosesser alle pending + retry-due attempts.
 * Kalles av webhook-cron + auto etter deliverWebhook.
 */
export async function processPendingDeliveries(pool: Pool): Promise<{
  processed: number; succeeded: number; failed: number; auto_disabled: number;
}> {
  const results = { processed: 0, succeeded: 0, failed: 0, auto_disabled: 0 };

  // Hent pending + retry-klare (max 50 ad gangen)
  const dueR = await pool.query<{
    id: string; endpoint_id: string; event_type: string; event_id: string;
    payload: any; attempt_number: number;
    url: string; signing_secret: string; consecutive_failures: number;
  }>(
    `SELECT a.id, a.endpoint_id, a.event_type, a.event_id, a.payload, a.attempt_number,
            e.url, e.signing_secret, e.consecutive_failures
       FROM webhook_delivery_attempts a
       JOIN partner_webhook_endpoints e ON e.id = a.endpoint_id
      WHERE a.attempted_at IS NULL
        AND a.scheduled_at <= now()
        AND e.is_active = TRUE
        AND e.auto_disabled_at IS NULL
      ORDER BY a.scheduled_at ASC
      LIMIT 50`,
  );

  for (const att of dueR.rows) {
    results.processed++;
    const start = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(att.payload);
    const signature = signPayload(att.signing_secret, body, timestamp);

    let status = 0;
    let responseBody = "";
    let success = false;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const r = await fetch(att.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Leadgrid-Signature": `sha256=${signature}`,
          "X-Leadgrid-Event": att.event_type,
          "X-Leadgrid-Delivery": att.event_id,
          "X-Leadgrid-Timestamp": String(timestamp),
          "User-Agent": "Leadgrid-Webhook/1.0",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      status = r.status;
      responseBody = (await r.text()).slice(0, 2000);
      success = status >= 200 && status < 300;
    } catch (e: any) {
      errorMessage = e.message ?? String(e);
      if (e.name === "AbortError") status = 408;
    }

    const durationMs = Date.now() - start;

    // Bestem retry
    const isPermanentFailure = status >= 400 && status < 500 && status !== 408 && status !== 429;
    const canRetry = !success && !isPermanentFailure && att.attempt_number < MAX_ATTEMPTS;
    const nextRetryAt = canRetry
      ? new Date(Date.now() + RETRY_DELAYS_MS[att.attempt_number - 1])
      : null;

    // Oppdater attempt-rad
    await pool.query(
      `UPDATE webhook_delivery_attempts
          SET attempted_at = now(),
              response_status = $1,
              response_body = $2,
              duration_ms = $3,
              success = $4,
              error_message = $5,
              next_retry_at = $6
        WHERE id = $7`,
      [status, responseBody, durationMs, success, errorMessage, nextRetryAt, att.id],
    );

    if (success) {
      results.succeeded++;
      await pool.query(
        `UPDATE partner_webhook_endpoints
            SET last_delivery_at = now(),
                last_success_at = now(),
                consecutive_failures = 0
          WHERE id = $1`,
        [att.endpoint_id],
      );
    } else {
      results.failed++;
      const newFailures = att.consecutive_failures + 1;
      const shouldDisable = newFailures >= 10;
      await pool.query(
        `UPDATE partner_webhook_endpoints
            SET last_delivery_at = now(),
                last_failure_at = now(),
                consecutive_failures = $1,
                auto_disabled_at = $2
          WHERE id = $3`,
        [newFailures, shouldDisable ? new Date() : null, att.endpoint_id],
      );
      if (shouldDisable) results.auto_disabled++;

      // Planlegg neste retry
      if (canRetry && nextRetryAt) {
        await pool.query(
          `INSERT INTO webhook_delivery_attempts
            (endpoint_id, event_type, event_id, payload, attempt_number, scheduled_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (endpoint_id, event_id, attempt_number) DO NOTHING`,
          [
            att.endpoint_id, att.event_type, att.event_id,
            JSON.stringify(att.payload), att.attempt_number + 1, nextRetryAt,
          ],
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Hjelpere for å fyre webhooks fra andre routes
// ---------------------------------------------------------------------------

export async function fireCustomerCreated(
  pool: Pool, customerId: string, organizationId: string,
): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT id::text, name, website_url, email, status, lead_status,
              ai_opportunity_score, created_at::text
         FROM crm_customers WHERE id::text = $1`,
      [customerId],
    );
    if (r.rows.length === 0) return;
    await deliverWebhook(pool, {
      eventId: crypto.randomUUID(),
      eventType: "customer.created",
      data: { customer: r.rows[0] },
      organizationId,
    });
  } catch (e) {
    console.error("[webhook fireCustomerCreated]", e);
  }
}

export async function fireScoreChanged(
  pool: Pool, customerId: string, organizationId: string,
  oldScore: number | null, newScore: number,
): Promise<void> {
  try {
    await deliverWebhook(pool, {
      eventId: crypto.randomUUID(),
      eventType: "customer.score_changed",
      data: {
        customer_id: customerId,
        old_score: oldScore,
        new_score: newScore,
        delta: oldScore != null ? newScore - oldScore : null,
      },
      organizationId,
    });
  } catch (e) { console.error("[webhook fireScoreChanged]", e); }
}

export async function fireFocusRequestCreated(
  pool: Pool, focusRequestId: string, organizationId: string,
): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT id::text, customer_id::text, need_type, status,
              client_note, created_at::text
         FROM client_focus_requests WHERE id = $1`,
      [focusRequestId],
    );
    if (r.rows.length === 0) return;
    await deliverWebhook(pool, {
      eventId: crypto.randomUUID(),
      eventType: "focus_request.created",
      data: { focus_request: r.rows[0] },
      organizationId,
    });
  } catch (e) { console.error("[webhook fireFocusRequestCreated]", e); }
}

export async function fireIntentSigned(
  pool: Pool, intentId: string, partnerId: string | null,
): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT id::text, title, agreement_class, partner_type,
              signer_email, signer_name, signed_at::text
         FROM partner_intent_agreements WHERE id = $1`,
      [intentId],
    );
    if (r.rows.length === 0) return;
    await deliverWebhook(pool, {
      eventId: crypto.randomUUID(),
      eventType: "intent_agreement.signed",
      data: { agreement: r.rows[0] },
      partnerId: partnerId ?? undefined,
    });
  } catch (e) { console.error("[webhook fireIntentSigned]", e); }
}
