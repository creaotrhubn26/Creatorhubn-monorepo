/**
 * Meta / Instagram Graph API webhook handling.
 *
 * Meta POSTs events to our webhook URL for subscribed fields (mentions,
 * comment updates, publish status for reels, permission changes, etc.).
 * Each request carries an `X-Hub-Signature-256` header with
 * `sha256=<hmac>` where the HMAC is computed over the raw request body
 * using the app secret. We verify this before touching the payload —
 * unsigned requests must be rejected so an attacker can't forge events
 * against our endpoint.
 *
 * Note on deauthorization: the canonical signal is the Deauthorize
 * Callback URL (signed_request format, separate endpoint) configured
 * in the Meta App Dashboard. Webhook-delivered `permissions`-change
 * events are a supporting signal but can't be mapped cleanly to a
 * specific connection today (we don't store Meta's user id on the
 * connection row). We log them here; the next token refresh attempt
 * will mark the connection expired via ensureFreshConnection's error
 * path, so the UI stops attempting publishes either way.
 */

import crypto from 'crypto';

/**
 * Verify Meta's X-Hub-Signature-256 over `rawBody` using `appSecret`.
 * Uses timing-safe comparison so a slow-leak attacker can't learn the
 * signature byte-by-byte. Returns false (never throws) on any malformed
 * input — the caller should treat that as a 401 rejection.
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | string[] | undefined,
  appSecret: string,
): boolean {
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length).trim();
  if (provided.length !== 64) return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  // Buffer.from with invalid hex silently truncates, so guard the
  // length before timingSafeEqual (it throws on mismatched len).
  if (providedBuf.length !== expectedBuf.length) return false;
  try {
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

export interface MetaWebhookChange {
  field?: string;
  value?: unknown;
}

export interface MetaWebhookEntry {
  id?: string;
  time?: number;
  uid?: string;
  changes?: MetaWebhookChange[];
  changed_fields?: string[];
}

export interface MetaWebhookEvent {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export function parseMetaWebhookEvent(rawBody: Buffer): MetaWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody.toString('utf8'));
    if (parsed && typeof parsed === 'object') return parsed as MetaWebhookEvent;
    return null;
  } catch {
    return null;
  }
}

/**
 * Summarise an event for logging: one line with object + fields seen.
 * We don't dump the full JSON because some Meta events carry text that
 * shouldn't go to stdout in production.
 */
export function summariseEvent(event: MetaWebhookEvent): string {
  const entries = event.entry ?? [];
  const fields = new Set<string>();
  for (const e of entries) {
    for (const c of e.changes ?? []) if (c.field) fields.add(c.field);
    for (const f of e.changed_fields ?? []) fields.add(f);
  }
  return `object=${event.object ?? '?'} entries=${entries.length} fields=[${Array.from(fields).join(',')}]`;
}
