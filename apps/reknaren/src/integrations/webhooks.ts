/**
 * Webhooks for det åpne integrasjonslaget: utgående hendelser til registrerte
 * endepunkter, HMAC-signert og med leveranselogg + retry. Hendelsen produseres
 * som en bivirkning av en domenehandling (emitEvent), leveres best-effort med en
 * gang, og etterlevering/gjenforsøk skjer via cron-drenering (deliverPending).
 *
 * Signatur: header `X-Reknaren-Signature: sha256=<hmac>` over råkroppen, med
 * endepunktets delte hemmelighet — mottaker verifiserer at kroppen er uendret.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Actor } from '../audit/audit.js';
import { recordAuditEvent } from '../audit/audit.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { newId } from '../shared/ids.js';

/** Hendelser eksterne systemer kan abonnere på. */
export const WEBHOOK_EVENTS = [
  'invoice.issued',
  'invoice.paid',
  'journal_entry.posted',
  'document.received',
  'saft.exported',
  'vat_report.ready',
  'recurring.due',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_ATTEMPTS = 6;
const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 360]; // minutter mellom forsøk

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Verifiser en innkommende signatur (til bruk i mottaker/dokumentasjon + test). */
export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = signPayload(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface WebhookDto {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  active: boolean;
  createdAt: string;
}

function validateEvents(events: string[]): WebhookEvent[] {
  const valid = new Set<string>(WEBHOOK_EVENTS);
  const out: WebhookEvent[] = [];
  for (const e of events) {
    if (!valid.has(e)) throw new ValidationError(`Ukjent hendelse: ${e}`);
    out.push(e as WebhookEvent);
  }
  if (out.length === 0) throw new ValidationError('Minst én hendelse kreves.');
  return out;
}

export async function createWebhook(
  db: Db,
  params: { organizationId: string; actor: Actor; url: string; events: string[]; description?: string },
): Promise<{ webhook: WebhookDto; secret: string }> {
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new ValidationError('Ugyldig URL.');
  }
  if (parsed.protocol !== 'https:') throw new ValidationError('Webhook-URL må bruke https.');
  const events = validateEvents(params.events);
  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const id = newId();
  await withTransaction(db, async (client) => {
    await client.query(
      `INSERT INTO webhook_endpoints (id, organization_id, url, secret, events, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, params.organizationId, params.url, secret, events, params.description ?? null, params.actor.userId],
    );
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'webhook.created',
      entityType: 'webhook_endpoint',
      entityId: id,
      newValue: { url: params.url, events },
    });
  });
  return {
    webhook: { id, url: params.url, events, description: params.description ?? null, active: true, createdAt: new Date().toISOString() },
    secret,
  };
}

export async function listWebhooks(db: Db, organizationId: string): Promise<WebhookDto[]> {
  const rows = (
    await db.query(
      `SELECT id, url, events, description, active, created_at FROM webhook_endpoints
       WHERE organization_id = $1 AND active ORDER BY created_at DESC`,
      [organizationId],
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    events: r.events ?? [],
    description: r.description ?? null,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function deleteWebhook(db: Db, params: { organizationId: string; actor: Actor; webhookId: string }): Promise<void> {
  await withTransaction(db, async (client) => {
    const res = await client.query(
      `UPDATE webhook_endpoints SET active = false WHERE id = $1 AND organization_id = $2 AND active`,
      [params.webhookId, params.organizationId],
    );
    if ((res.rowCount ?? 0) === 0) throw new NotFoundError('Webhook finnes ikke.');
    await recordAuditEvent(client, {
      organizationId: params.organizationId,
      actor: params.actor,
      action: 'webhook.deleted',
      entityType: 'webhook_endpoint',
      entityId: params.webhookId,
    });
  });
}

/** Produser en hendelse: legg pending leveranser for alle aktive abonnenter. */
export async function emitEvent(
  db: Db,
  params: { organizationId: string; event: WebhookEvent; data: Record<string, unknown> },
): Promise<number> {
  const endpoints = (
    await db.query(
      `SELECT id FROM webhook_endpoints WHERE organization_id = $1 AND active AND $2 = ANY(events)`,
      [params.organizationId, params.event],
    )
  ).rows;
  if (endpoints.length === 0) return 0;
  const payload = {
    event: params.event,
    organizationId: params.organizationId,
    data: params.data,
  };
  for (const ep of endpoints) {
    await db.query(
      `INSERT INTO webhook_deliveries (id, organization_id, endpoint_id, event, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [newId(), params.organizationId, ep.id, params.event, JSON.stringify(payload)],
    );
  }
  return endpoints.length;
}

/**
 * Best-effort umiddelbar levering + gjenforsøk. Plukker forfalte leveranser
 * (pending/failed med next_attempt_at ≤ nå), signerer og POST-er. Ved feil:
 * øk attempts og planlegg neste forsøk (eksponentiell backoff), eller merk
 * failed permanent etter MAX_ATTEMPTS.
 */
export async function deliverPending(
  db: Db,
  opts: { fetchImpl?: FetchLike; limit?: number; nowIso?: string } = {},
): Promise<{ attempted: number; delivered: number; failed: number }> {
  const fetchImpl = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike));
  const due = (
    await db.query(
      `SELECT d.id, d.endpoint_id, d.payload, d.attempts, e.url, e.secret
       FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.status IN ('pending','failed') AND d.next_attempt_at <= now() AND d.attempts < $1 AND e.active
       ORDER BY d.next_attempt_at ASC LIMIT $2`,
      [MAX_ATTEMPTS, opts.limit ?? 50],
    )
  ).rows;

  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    const body = typeof d.payload === 'string' ? d.payload : JSON.stringify(d.payload);
    const attempt = Number(d.attempts) + 1;
    let ok = false;
    let responseStatus: number | null = null;
    let responseBody = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetchImpl(d.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Reknaren-Webhooks/1.0',
          'x-reknaren-event': JSON.parse(body).event ?? '',
          'x-reknaren-signature': signPayload(d.secret, body),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      responseStatus = res.status;
      responseBody = (await res.text().catch(() => '')).slice(0, 500);
      ok = res.status >= 200 && res.status < 300;
    } catch (err) {
      responseBody = (err as Error).message.slice(0, 500);
    }

    if (ok) {
      delivered++;
      await db.query(
        `UPDATE webhook_deliveries SET status='delivered', attempts=$2, last_attempt_at=now(), response_status=$3, response_body=$4 WHERE id=$1`,
        [d.id, attempt, responseStatus, responseBody],
      );
    } else {
      failed++;
      const permanent = attempt >= MAX_ATTEMPTS;
      const backoffMin = RETRY_BACKOFF_MIN[Math.min(attempt - 1, RETRY_BACKOFF_MIN.length - 1)]!;
      await db.query(
        `UPDATE webhook_deliveries
         SET status = $5, attempts=$2, last_attempt_at=now(), response_status=$3, response_body=$4,
             next_attempt_at = now() + ($6 || ' minutes')::interval
         WHERE id=$1`,
        [d.id, attempt, responseStatus, responseBody, permanent ? 'failed' : 'pending', permanent ? 0 : backoffMin],
      );
    }
  }
  return { attempted: due.length, delivered, failed };
}

export interface DeliveryDto {
  id: string;
  event: string;
  status: string;
  attempts: number;
  url: string;
  responseStatus: number | null;
  createdAt: string;
  lastAttemptAt: string | null;
}

export async function listDeliveries(db: Db, organizationId: string, limit = 50): Promise<DeliveryDto[]> {
  const rows = (
    await db.query(
      `SELECT d.id, d.event, d.status, d.attempts, e.url, d.response_status, d.created_at, d.last_attempt_at
       FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.organization_id = $1 ORDER BY d.created_at DESC LIMIT $2`,
      [organizationId, limit],
    )
  ).rows;
  return rows.map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    attempts: Number(r.attempts),
    url: r.url,
    responseStatus: r.response_status ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    lastAttemptAt: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : null,
  }));
}

/** Send en test-hendelse til ett endepunkt (leverer med en gang). */
export async function testWebhook(
  db: Db,
  params: { organizationId: string; webhookId: string; fetchImpl?: FetchLike },
): Promise<{ delivered: boolean }> {
  const ep = (
    await db.query(`SELECT id FROM webhook_endpoints WHERE id = $1 AND organization_id = $2 AND active`, [
      params.webhookId,
      params.organizationId,
    ])
  ).rows[0];
  if (!ep) throw new NotFoundError('Webhook finnes ikke.');
  await db.query(
    `INSERT INTO webhook_deliveries (id, organization_id, endpoint_id, event, payload)
     VALUES ($1,$2,$3,'ping',$4)`,
    [newId(), params.organizationId, params.webhookId, JSON.stringify({ event: 'ping', organizationId: params.organizationId, data: { message: 'Test fra Reknaren' } })],
  );
  const opts: { fetchImpl?: FetchLike; limit: number } = { limit: 5 };
  if (params.fetchImpl) opts.fetchImpl = params.fetchImpl;
  const res = await deliverPending(db, opts);
  return { delivered: res.delivered > 0 };
}

/** Fyr av best-effort levering uten å blokkere forespørselen. */
export function kickDelivery(db: Db): void {
  void deliverPending(db).catch(() => undefined);
}
