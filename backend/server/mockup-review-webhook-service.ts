import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Pool } from "pg";

export const MOCKUP_WEBHOOK_EVENTS = [
  "review.created", "comment.created", "comment.resolved", "version.created",
  "review.approved", "review.changes_requested",
] as const;
export type MockupWebhookEvent = typeof MOCKUP_WEBHOOK_EVENTS[number];

function privateV4(address: string): boolean {
  const p = address.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}
function privateAddress(address: string): boolean {
  if (isIP(address) === 4) return privateV4(address);
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") ||
      value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
  }
  return true;
}
interface SafeTarget { url: URL; address: string; family: number }
async function resolveSafeTarget(value: string): Promise<SafeTarget> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("ugyldig_url"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("kun_https_tillatt");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || privateAddress(host)) throw new Error("privat_adresse_ikke_tillatt");
  const answers = await lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => privateAddress(answer.address))) throw new Error("privat_adresse_ikke_tillatt");
  url.hash = "";
  return { url, address: answers[0].address, family: answers[0].family };
}
export async function validateMockupWebhookUrl(value: string): Promise<string> {
  return (await resolveSafeTarget(value)).url.toString();
}
export function createMockupWebhookSecret(): string {
  return "mws_" + randomBytes(32).toString("base64url");
}
export function signMockupWebhook(secret: string, timestamp: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}
interface Subscription { id: string; url: string; signing_secret: string }

function postPinned(target: SafeTarget, headers: Record<string, string>, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => callback(null, target.address, target.family);
    const req = httpsRequest({
      protocol: "https:", hostname: target.url.hostname, port: 443,
      path: target.url.pathname + target.url.search, method: "POST", headers,
      servername: target.url.hostname, lookup: pinnedLookup, timeout: 8_000,
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode || 0));
    });
    req.once("timeout", () => req.destroy(new Error("timeout")));
    req.once("error", reject);
    req.end(body);
  });
}
async function deliver(pool: Pool, subscription: Subscription, eventKey: MockupWebhookEvent, data: Record<string, unknown>): Promise<void> {
  const deliveryId = randomUUID(), timestamp = String(Date.now());
  const body = JSON.stringify({ id: deliveryId, event: eventKey, occurredAt: new Date(Number(timestamp)).toISOString(), data });
  let status = "failed", statusCode: number | null = null, error: string | null = null;
  try {
    const target = await resolveSafeTarget(subscription.url);
    statusCode = await postPinned(target, {
      "content-type": "application/json", "content-length": String(Buffer.byteLength(body)),
      "x-mockup-event": eventKey, "x-mockup-delivery-id": deliveryId, "x-mockup-timestamp": timestamp,
      "x-mockup-signature": signMockupWebhook(subscription.signing_secret, timestamp, body),
    }, body);
    status = statusCode >= 200 && statusCode < 300 ? "delivered" : "failed";
    if (status === "failed") error = "http_" + statusCode;
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 500) : "delivery_failed";
  }
  await pool.query(
    `INSERT INTO mockup_studio_webhook_deliveries
       (id, subscription_id, event_key, status, status_code, error)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6)`,
    [deliveryId, subscription.id, eventKey, status, statusCode, error],
  ).catch(() => undefined);
  await pool.query(
    `UPDATE mockup_studio_webhook_subscriptions SET last_delivered_at=now(),last_status_code=$2,
       failure_count=CASE WHEN $3 THEN 0 ELSE failure_count+1 END,updated_at=now() WHERE id=$1::uuid`,
    [subscription.id, statusCode, status === "delivered"],
  ).catch(() => undefined);
}
export async function emitMockupWebhook(pool: Pool, projectId: string, createdBy: string, eventKey: MockupWebhookEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const result = await pool.query<Subscription>(
      `SELECT id::text,url,signing_secret FROM mockup_studio_webhook_subscriptions
       WHERE project_id=$1 AND created_by=$2 AND is_active=true AND $3=ANY(events)`,
      [projectId, createdBy, eventKey],
    );
    await Promise.all(result.rows.map((subscription) => deliver(pool, subscription, eventKey, data)));
  } catch (error) {
    console.warn("[mockup-review-webhook] delivery failed", error instanceof Error ? error.message : error);
  }
}
