/**
 * webhook-emitter.ts
 *
 * Fire-and-forget HMAC-signerte webhooks for Leadgrid Intelligence Engine.
 *
 * Bruk:
 *   await emitWebhook(pool, "lead.scored", { lead_id, score, prob, ... }, orgId);
 *
 * Det:
 *   1) Sjekker at eventKey finnes i webhook_event_types
 *   2) Henter aktive abonnementer for orgId (leadgrid_webhook_subscriptions)
 *      som lytter på dette eventet (events @> ARRAY[event_key])
 *   3) HMAC-SHA256 signerer JSON-bodyen med subscription.signing_secret
 *   4) POST async i parallell; ved feil legges leveringen i
 *      webhook_delivery_queue for retry (av en separat retry-cron).
 *
 * Headers:
 *   X-Leadgrid-Event       — eventKey
 *   X-Leadgrid-Delivery-Id — UUID per leveranse
 *   X-Leadgrid-Timestamp   — ms-epoch ved signering
 *   X-Leadgrid-Signature   — `sha256=<hex(hmac(secret, ts + "." + body))>`
 *   Content-Type           — application/json
 *
 * Mottakeren kan re-beregne signaturen og avvise meldinger med mer
 * enn ~5 minutter skew. Vi loggene IKKE secret-hashen.
 */

import { createHmac, randomUUID } from "node:crypto";
import type { Pool } from "pg";

interface SubscriptionRow {
  id: string;
  url: string;
  signing_secret: string;
  events: string[];
}

/**
 * Beregn signatur: HMAC-SHA256 over `${timestamp}.${body}` med secret.
 * Returneres som `sha256=<hex>` (Stripe-stil).
 */
export function computeSignature(
  secret: string,
  timestampMs: number,
  body: string,
): string {
  const h = createHmac("sha256", secret);
  h.update(`${timestampMs}.${body}`);
  return `sha256=${h.digest("hex")}`;
}

async function fetchSubscriptions(
  pool: Pool,
  organizationId: string,
  eventKey: string,
): Promise<SubscriptionRow[]> {
  try {
    const r = await pool.query<SubscriptionRow>(
      `SELECT id::text, url, signing_secret, events
         FROM leadgrid_webhook_subscriptions
        WHERE organization_id = $1::uuid
          AND is_active = TRUE
          AND events @> ARRAY[$2]::text[]`,
      [organizationId, eventKey],
    );
    return r.rows;
  } catch (err) {
    // Migration ikke kjørt ennå? Tøm liste — vi vil ikke krasje
    console.warn("[webhook-emitter] fetchSubscriptions failed:", err);
    return [];
  }
}

async function ensureEventTypeKnown(pool: Pool, eventKey: string): Promise<boolean> {
  try {
    const r = await pool.query<{ event_key: string }>(
      `SELECT event_key FROM webhook_event_types WHERE event_key = $1 AND is_active = TRUE`,
      [eventKey],
    );
    return r.rows.length > 0;
  } catch {
    return true;
  }
}

async function enqueueRetry(
  pool: Pool,
  args: {
    subscriptionId: string;
    eventKey: string;
    payload: unknown;
    deliveryId: string;
    lastError?: string;
    lastStatusCode?: number;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO webhook_delivery_queue
         (subscription_id, event_key, payload, delivery_id, status,
          attempts, last_attempt_at, last_status_code, last_error,
          next_retry_at)
       VALUES ($1::uuid, $2, $3::jsonb, $4::uuid, 'failed',
               1, NOW(), $5, $6, NOW() + INTERVAL '5 minutes')`,
      [
        args.subscriptionId,
        args.eventKey,
        JSON.stringify(args.payload),
        args.deliveryId,
        args.lastStatusCode ?? null,
        args.lastError ?? null,
      ],
    );
  } catch (err) {
    console.warn("[webhook-emitter] enqueueRetry failed:", err);
  }
}

async function updateSubscriptionStatus(
  pool: Pool,
  subscriptionId: string,
  statusCode: number,
  ok: boolean,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE leadgrid_webhook_subscriptions
          SET last_delivered_at = NOW(),
              last_status_code = $2,
              failure_count = CASE WHEN $3 THEN 0 ELSE failure_count + 1 END
        WHERE id = $1::uuid`,
      [subscriptionId, statusCode, ok],
    );
  } catch (err) {
    console.warn("[webhook-emitter] updateSubscriptionStatus failed:", err);
  }
}

async function deliverOne(
  pool: Pool,
  sub: SubscriptionRow,
  eventKey: string,
  payload: unknown,
): Promise<void> {
  const deliveryId = randomUUID();
  const ts = Date.now();
  const body = JSON.stringify({
    event: eventKey,
    delivery_id: deliveryId,
    occurred_at: new Date(ts).toISOString(),
    data: payload,
  });
  const signature = computeSignature(sub.signing_secret, ts, body);

  try {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 8000);
    const resp = await fetch(sub.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Leadgrid-Event": eventKey,
        "X-Leadgrid-Delivery-Id": deliveryId,
        "X-Leadgrid-Timestamp": String(ts),
        "X-Leadgrid-Signature": signature,
      },
      body,
      signal: ctl.signal,
    });
    clearTimeout(tm);

    if (!resp.ok) {
      await updateSubscriptionStatus(pool, sub.id, resp.status, false);
      await enqueueRetry(pool, {
        subscriptionId: sub.id,
        eventKey,
        payload,
        deliveryId,
        lastError: `http_${resp.status}`,
        lastStatusCode: resp.status,
      });
      return;
    }
    await updateSubscriptionStatus(pool, sub.id, resp.status, true);
  } catch (err) {
    await updateSubscriptionStatus(pool, sub.id, 0, false);
    await enqueueRetry(pool, {
      subscriptionId: sub.id,
      eventKey,
      payload,
      deliveryId,
      lastError: String(err).slice(0, 500),
    });
  }
}

/**
 * Emit en webhook for én org. Webhook-feil må ALDRI velte hovedflyten.
 * Returnerer ikke før alle abonnementer er forsøkt; kjør gjerne i
 * `void emitWebhook(...)` fra et call site som ikke vil blokkere.
 */
export async function emitWebhook(
  pool: Pool,
  eventKey: string,
  payload: unknown,
  organizationId: string,
): Promise<void> {
  try {
    await ensureEventTypeKnown(pool, eventKey);
    const subs = await fetchSubscriptions(pool, organizationId, eventKey);
    if (subs.length === 0) return;
    await Promise.all(subs.map((s) => deliverOne(pool, s, eventKey, payload)));
  } catch (err) {
    console.warn("[webhook-emitter] emitWebhook failed:", err);
  }
}
