/**
 * leadgrid-workflow-triggers-routes.ts
 *
 * Webhook/event-mottakere som registrerer trigger-events for de 6 nye
 * workflow-triggers (mig 0350):
 *
 *   email.opened          ← /api/leadgrid/events/email/opened
 *   email.link_clicked    ← /api/leadgrid/events/email/link-clicked
 *   meeting.booked        ← /api/leadgrid/events/meetings/booked
 *   meeting.no_show       ← /api/leadgrid/events/meetings/no-show
 *   proposal.opened       ← /api/leadgrid/events/proposals/opened
 *   contract.signed       ← /api/leadgrid/events/contracts/signed
 *
 * Hvert endepunkt:
 *   1) INSERT i sin event-tabell (audit-log)
 *   2) emit workflow-event via publishEvent
 *   3) emit webhook-event til eventuelle integrasjons-abonnementer
 *
 * Auth-kontrakt (fail-closed):
 *   A) Bruker-session: kun møte-eventer, med eksplisitt event-permission i
 *      leadets faktiske org. Provider-eventer godtar aldri vanlig session.
 *   B) Intern service: Authorization: Bearer
 *      $LEADGRID_WORKFLOW_EVENT_SERVICE_TOKEN + timestamp/delivery headers.
 *   C) Ekstern tracking/provider: HMAC-SHA256 med tenant+event-secret fra
 *      $LEADGRID_WORKFLOW_EVENT_SIGNING_SECRETS_JSON.
 *
 *   Signerte/service-kall må sende:
 *     X-Leadgrid-Timestamp   — epoch sekunder eller millisekunder, maks 5 min skew
 *     X-Leadgrid-Delivery-Id — unik event-ID (replay/idempotency)
 *     X-Leadgrid-Signature   — sha256=<hex> for HMAC-kall
 *
 *   HMAC-payload:
 *     `${timestamp}.${deliveryId}.${requestPath}.${stableJsonBody}`
 *
 * Alle seks eventer bindes til customer_id sin organization_id i DB. Body-org
 * er kun en assertion og må matche. Delivery-ID claim'es atomisk i den delte
 * idempotency-tabellen før noen event-sideeffekt utføres.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  ensureIdempotencyTable,
  hashRequest,
  IDEMPOTENCY_TABLE,
  readIdempotencyKey,
} from "./_shared-idempotency.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { publishEvent } from "./leadgrid-workflow-engine.js";
import { emitWebhook } from "./webhook-emitter.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function reqStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const value = v.trim();
  return value.length > 0 ? value : null;
}

function reqInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DELIVERY_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;
const SIGNATURE_RE = /^(?:sha256=)?([0-9a-f]{64})$/i;
const MAX_SIGNATURE_SKEW_MS = 5 * 60 * 1000;
const IDEMPOTENCY_SCOPE_PREFIX = "lg-workflow-events";

type EventType =
  | "email.opened"
  | "email.link_clicked"
  | "meeting.booked"
  | "meeting.no_show"
  | "proposal.opened"
  | "contract.signed";

const SESSION_EVENT_PERMISSION: Partial<Record<EventType, string>> = {
  "meeting.booked": "workflow_events.meeting_booked",
  "meeting.no_show": "workflow_events.meeting_no_show",
};

type AuthContext =
  | {
      mode: "session";
      session: SessionData;
      deliveryId: string | null;
    }
  | {
      mode: "service" | "hmac";
      session: null;
      deliveryId: string;
    };

type EventClaim = {
  scope: string;
  key: string;
  requestHash: string;
};

type PreparedEvent = {
  auth: AuthContext;
  customerId: string;
  organizationId: string;
  claim: EventClaim;
};

type PreparationResult =
  | { kind: "ready"; value: PreparedEvent }
  | { kind: "responded" };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

/**
 * Eksportert slik at interne mailere/provider-adaptere og kontrakttester kan
 * produsere nøyaktig samme signatur som mottakeren verifiserer.
 */
export function computeWorkflowEventSignature(
  secret: string,
  timestamp: string,
  deliveryId: string,
  requestPath: string,
  body: unknown,
): string {
  const payload = `${timestamp}.${deliveryId}.${requestPath}.${stableStringify(body ?? null)}`;
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function firstHeader(req: Request, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return reqStr(value[0]);
  return reqStr(value);
}

function bearerToken(req: Request): string | null {
  const auth = firstHeader(req, "authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return reqStr(auth.slice(7));
}

function safeSecretEqual(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function readFreshTimestamp(
  req: Request,
): { ok: true; raw: string } | { ok: false; error: string } {
  const raw = firstHeader(req, "x-leadgrid-timestamp");
  if (!raw || !/^\d{10,16}$/.test(raw)) {
    return { ok: false, error: "workflow_event_timestamp_required" };
  }
  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric)) {
    return { ok: false, error: "workflow_event_timestamp_invalid" };
  }
  const timestampMs = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  if (Math.abs(Date.now() - timestampMs) > MAX_SIGNATURE_SKEW_MS) {
    return { ok: false, error: "workflow_event_timestamp_expired" };
  }
  return { ok: true, raw };
}

function readDeliveryId(
  req: Request,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = firstHeader(req, "x-leadgrid-delivery-id");
  if (!value) {
    return { ok: false, error: "workflow_event_delivery_id_required" };
  }
  if (!DELIVERY_ID_RE.test(value)) {
    return { ok: false, error: "workflow_event_delivery_id_invalid" };
  }
  return { ok: true, value };
}

async function authenticateEventRequest(
  req: Request,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  body: Record<string, unknown>,
  eventType: EventType,
): Promise<
  | { ok: true; value: AuthContext }
  | { ok: false; status: number; error: string }
> {
  const bearer = bearerToken(req);
  const serviceToken = reqStr(
    process.env.LEADGRID_WORKFLOW_EVENT_SERVICE_TOKEN,
  );

  if (
    bearer &&
    serviceToken &&
    serviceToken.length >= 32 &&
    safeSecretEqual(bearer, serviceToken)
  ) {
    const timestamp = readFreshTimestamp(req);
    if (!timestamp.ok) {
      return { ok: false, status: 401, error: timestamp.error };
    }
    const delivery = readDeliveryId(req);
    if (!delivery.ok) {
      return { ok: false, status: 401, error: delivery.error };
    }
    return {
      ok: true,
      value: { mode: "service", session: null, deliveryId: delivery.value },
    };
  }

  if (bearer) {
    try {
      const session = await resolveLeadMapSession(req, pool, activeSessions);
      if (session) {
        const idempotencyKey = readIdempotencyKey(req);
        return {
          ok: true,
          value: {
            mode: "session",
            session,
            deliveryId: idempotencyKey,
          },
        };
      }
    } catch {
      return {
        ok: false,
        status: 503,
        error: "workflow_event_session_lookup_failed",
      };
    }
  }

  const signatureHeader = firstHeader(req, "x-leadgrid-signature");
  const timestampHeader = firstHeader(req, "x-leadgrid-timestamp");
  const deliveryHeader = firstHeader(req, "x-leadgrid-delivery-id");
  const attemptedHmac = Boolean(
    signatureHeader || timestampHeader || deliveryHeader,
  );
  if (!attemptedHmac) {
    return {
      ok: false,
      status: 401,
      error: "workflow_event_auth_required",
    };
  }

  const secretsJson = reqStr(
    process.env.LEADGRID_WORKFLOW_EVENT_SIGNING_SECRETS_JSON,
  );
  if (!secretsJson) {
    return {
      ok: false,
      status: 503,
      error: "workflow_event_signing_not_configured",
    };
  }
  const assertedOrganizationId = reqStr(body.organization_id);
  if (!assertedOrganizationId || !UUID_RE.test(assertedOrganizationId)) {
    return {
      ok: false,
      status: 401,
      error: "workflow_event_organization_required",
    };
  }
  let signingSecret: string | null = null;
  try {
    const parsed = JSON.parse(secretsJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const tenant = (parsed as Record<string, unknown>)[assertedOrganizationId];
      if (tenant && typeof tenant === "object" && !Array.isArray(tenant)) {
        signingSecret = reqStr((tenant as Record<string, unknown>)[eventType]);
      }
    }
  } catch {
    return {
      ok: false,
      status: 503,
      error: "workflow_event_signing_config_invalid",
    };
  }
  if (!signingSecret || signingSecret.length < 32) {
    return {
      ok: false,
      status: 401,
      error: "workflow_event_signature_invalid",
    };
  }
  const timestamp = readFreshTimestamp(req);
  if (!timestamp.ok) {
    return { ok: false, status: 401, error: timestamp.error };
  }
  const delivery = readDeliveryId(req);
  if (!delivery.ok) {
    return { ok: false, status: 401, error: delivery.error };
  }
  const signatureMatch = signatureHeader?.match(SIGNATURE_RE);
  if (!signatureMatch) {
    return {
      ok: false,
      status: 401,
      error: "workflow_event_signature_invalid",
    };
  }
  const expected = computeWorkflowEventSignature(
    signingSecret,
    timestamp.raw,
    delivery.value,
    req.path,
    body,
  );
  if (!safeSecretEqual(`sha256=${signatureMatch[1].toLowerCase()}`, expected)) {
    return {
      ok: false,
      status: 401,
      error: "workflow_event_signature_invalid",
    };
  }
  return {
    ok: true,
    value: { mode: "hmac", session: null, deliveryId: delivery.value },
  };
}

async function resolveCustomerContext(
  pool: Pool,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; customerId: string; organizationId: string }
  | { ok: false; status: number; error: string }
> {
  const customerId = reqStr(body.customer_id);
  if (!customerId || !UUID_RE.test(customerId)) {
    return { ok: false, status: 400, error: "customer_id_required" };
  }
  let result: { rows: Array<{ id: string; organization_id: string | null }> };
  try {
    result = await pool.query<{ id: string; organization_id: string | null }>(
      `SELECT id::text, organization_id::text
         FROM crm_customers
        WHERE id = $1::uuid
        LIMIT 1`,
      [customerId],
    );
  } catch {
    return { ok: false, status: 503, error: "customer_lookup_failed" };
  }
  const customer = result.rows[0];
  if (!customer) {
    return { ok: false, status: 404, error: "customer_not_found" };
  }
  const organizationId = reqStr(customer.organization_id);
  if (!organizationId || !UUID_RE.test(organizationId)) {
    return {
      ok: false,
      status: 409,
      error: "customer_organization_missing",
    };
  }
  const assertedOrgId = reqStr(body.organization_id);
  if (
    assertedOrgId &&
    (!UUID_RE.test(assertedOrgId) || assertedOrgId !== organizationId)
  ) {
    return { ok: false, status: 403, error: "organization_mismatch" };
  }
  return { ok: true, customerId, organizationId };
}

async function sessionCanAccessOrganization(
  pool: Pool,
  session: SessionData,
  organizationId: string,
  eventType: EventType,
): Promise<boolean> {
  const permission = SESSION_EVENT_PERMISSION[eventType];
  if (!permission) return false;
  const superAdmin = await pool.query(
    `SELECT 1 FROM users WHERE id::text = $1 AND role = 'super_admin' LIMIT 1`,
    [session.userId],
  );
  if (superAdmin.rows.length > 0) return true;
  const effective = await resolveEffectivePermissions(
    pool,
    organizationId,
    session.userId,
  );
  return effective.permissions.has(permission);
}

async function verifySpecificResourceBinding(
  pool: Pool,
  eventType: EventType,
  body: Record<string, unknown>,
  customerId: string,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (eventType === "email.link_clicked" && !reqStr(body.link_url)) {
    return { ok: false, status: 400, error: "link_url_required" };
  }
  if (eventType === "contract.signed") {
    const contractId = reqStr(body.contract_id);
    if (!contractId) {
      return { ok: false, status: 400, error: "contract_id_required" };
    }
    // Provider IDs may be external and therefore absent locally. If a local
    // contract with the same id exists, it must canonically belong to both the
    // customer and organization; a caller cannot bypass that binding.
    const localContract = await pool.query<{
      client_id: string | null;
      client_email: string | null;
      organization_bound: boolean;
    }>(
      `SELECT c.client_id::text,
              c.client_email,
              (
                c.user_id::text = $2
                OR EXISTS (
                  SELECT 1 FROM organization_members om
                   WHERE om.organization_id = $2::uuid
                     AND om.user_id::text = c.user_id::text
                )
              ) AS organization_bound
         FROM contracts c
        WHERE c.id = $1
        LIMIT 1`,
      [contractId, organizationId],
    );
    const contract = localContract.rows[0];
    if (
      contract &&
      (contract.client_id !== customerId || !contract.organization_bound)
    ) {
      return {
        ok: false,
        status: 404,
        error: "contract_not_found_for_customer",
      };
    }
    const signerEmail = reqStr(body.signer_email)?.toLowerCase();
    if (
      contract?.client_email &&
      signerEmail &&
      contract.client_email.toLowerCase() !== signerEmail
    ) {
      return { ok: false, status: 403, error: "contract_signer_mismatch" };
    }
  }
  if (eventType === "proposal.opened") {
    const proposalId = reqStr(body.proposal_id);
    if (!proposalId || !UUID_RE.test(proposalId)) {
      return { ok: false, status: 400, error: "proposal_id_invalid" };
    }
    const result = await pool.query(
      `SELECT 1
         FROM leadgrid_proposals
        WHERE id = $1::uuid
          AND lead_id = $2::uuid
          AND organization_id = $3
        LIMIT 1`,
      [proposalId, customerId, organizationId],
    );
    if (result.rows.length === 0) {
      return {
        ok: false,
        status: 404,
        error: "proposal_not_found_for_customer",
      };
    }
  }
  if (eventType === "meeting.no_show" || eventType === "meeting.booked") {
    const meetingId = reqStr(body.meeting_id);
    if (!meetingId || !UUID_RE.test(meetingId)) {
      return { ok: false, status: 400, error: "meeting_id_invalid" };
    }
    const result = await pool.query(
      `SELECT 1
         FROM leadgrid_meetings
        WHERE id = $1::uuid
          AND customer_id = $2::uuid
          AND organization_id = $3::uuid
        LIMIT 1`,
      [meetingId, customerId, organizationId],
    );
    if (result.rows.length === 0) {
      return {
        ok: false,
        status: 404,
        error: "meeting_not_found_for_customer",
      };
    }
  }
  return { ok: true };
}

function sessionDeliveryId(
  session: SessionData,
  eventType: EventType,
  body: Record<string, unknown>,
): string {
  const digest = createHash("sha256")
    .update(`${session.userId}.${eventType}.${stableStringify(body)}`)
    .digest("hex");
  return `session:${digest}`;
}

async function claimEvent(
  pool: Pool,
  req: Request,
  organizationId: string,
  deliveryId: string,
): Promise<
  | { kind: "claimed"; claim: EventClaim }
  | {
      kind: "duplicate";
      status: number;
      responseBody: Record<string, unknown>;
    }
  | { kind: "conflict" }
  | { kind: "unavailable" }
> {
  if (!(await ensureIdempotencyTable(pool))) {
    return { kind: "unavailable" };
  }
  const scope = `${IDEMPOTENCY_SCOPE_PREFIX}:${organizationId}`;
  const requestHash = hashRequest(req);
  try {
    const inserted = await pool.query<{ idempotency_key: string }>(
      `INSERT INTO ${IDEMPOTENCY_TABLE}
         (scope, request_method, request_path, idempotency_key, request_hash,
          response_status, response_body)
       VALUES ($1, $2, $3, $4, $5, 202, $6::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING idempotency_key`,
      [
        scope,
        req.method,
        req.path,
        deliveryId,
        requestHash,
        JSON.stringify({ ok: true, processing: true }),
      ],
    );
    if (inserted.rows.length > 0) {
      return {
        kind: "claimed",
        claim: { scope, key: deliveryId, requestHash },
      };
    }
    const existing = await pool.query<{
      request_hash: string;
      response_status: number;
      response_body: unknown;
    }>(
      `SELECT request_hash, response_status, response_body
         FROM ${IDEMPOTENCY_TABLE}
        WHERE scope = $1
          AND request_method = $2
          AND request_path = $3
          AND idempotency_key = $4
        LIMIT 1`,
      [scope, req.method, req.path, deliveryId],
    );
    const row = existing.rows[0];
    if (!row) return { kind: "unavailable" };
    if (row.request_hash !== requestHash) return { kind: "conflict" };
    const responseBody =
      row.response_body &&
      typeof row.response_body === "object" &&
      !Array.isArray(row.response_body)
        ? (row.response_body as Record<string, unknown>)
        : { ok: true };
    return {
      kind: "duplicate",
      status: row.response_status === 202 ? 202 : 200,
      responseBody,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

async function completeEventClaim(
  pool: Pool,
  claim: EventClaim,
  responseBody: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE ${IDEMPOTENCY_TABLE}
          SET response_status = 200,
              response_body = $4::jsonb
        WHERE scope = $1
          AND idempotency_key = $2
          AND request_hash = $3`,
      [claim.scope, claim.key, claim.requestHash, JSON.stringify(responseBody)],
    );
  } catch {
    // Behold processing-claim hvis respons-cachen svikter; ikke gjenta eventet.
  }
}

async function releaseEventClaim(pool: Pool, claim: EventClaim): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM ${IDEMPOTENCY_TABLE}
        WHERE scope = $1
          AND idempotency_key = $2
          AND request_hash = $3
          AND response_status = 202`,
      [claim.scope, claim.key, claim.requestHash],
    );
  } catch {
    // Fail-closed: en usikker claim slettes ikke. Det er sikrere å kreve ny
    // delivery-ID enn å risikere doble workflow-/webhook-sideeffekter.
  }
}

async function prepareEvent(
  req: Request,
  res: Response,
  deps: Deps,
  eventType: EventType,
  body: Record<string, unknown>,
): Promise<PreparationResult> {
  const auth = await authenticateEventRequest(
    req,
    deps.pool,
    deps.activeSessions,
    body,
    eventType,
  );
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return { kind: "responded" };
  }

  if (
    auth.value.mode === "session" &&
    !SESSION_EVENT_PERMISSION[eventType]
  ) {
    res.status(403).json({ error: "workflow_event_session_not_allowed" });
    return { kind: "responded" };
  }

  const customer = await resolveCustomerContext(deps.pool, body);
  if (!customer.ok) {
    res.status(customer.status).json({ error: customer.error });
    return { kind: "responded" };
  }

  if (auth.value.mode === "session") {
    try {
      const allowed = await sessionCanAccessOrganization(
        deps.pool,
        auth.value.session,
        customer.organizationId,
        eventType,
      );
      if (!allowed) {
        res.status(403).json({ error: "workflow_event_permission_denied" });
        return { kind: "responded" };
      }
    } catch {
      res.status(503).json({ error: "organization_membership_lookup_failed" });
      return { kind: "responded" };
    }
  }

  try {
    const binding = await verifySpecificResourceBinding(
      deps.pool,
      eventType,
      body,
      customer.customerId,
      customer.organizationId,
    );
    if (!binding.ok) {
      res.status(binding.status).json({ error: binding.error });
      return { kind: "responded" };
    }
  } catch {
    res.status(503).json({ error: "workflow_event_resource_lookup_failed" });
    return { kind: "responded" };
  }

  const deliveryId =
    auth.value.mode === "session"
      ? (auth.value.deliveryId ??
        sessionDeliveryId(auth.value.session, eventType, body))
      : auth.value.deliveryId;
  const claimed = await claimEvent(
    deps.pool,
    req,
    customer.organizationId,
    deliveryId,
  );
  if (claimed.kind === "duplicate") {
    res.setHeader("Idempotent-Replayed", "true");
    res
      .status(claimed.status)
      .json({ ...claimed.responseBody, duplicate: true });
    return { kind: "responded" };
  }
  if (claimed.kind === "conflict") {
    res.status(409).json({ error: "workflow_event_delivery_id_conflict" });
    return { kind: "responded" };
  }
  if (claimed.kind === "unavailable") {
    res.status(503).json({ error: "workflow_event_idempotency_unavailable" });
    return { kind: "responded" };
  }
  return {
    kind: "ready",
    value: {
      auth: auth.value,
      customerId: customer.customerId,
      organizationId: customer.organizationId,
      claim: claimed.claim,
    },
  };
}

function eventMetadata(
  body: Record<string, unknown>,
  prepared: PreparedEvent,
): Record<string, unknown> {
  const supplied = body.metadata;
  const metadata =
    supplied && typeof supplied === "object" && !Array.isArray(supplied)
      ? { ...(supplied as Record<string, unknown>) }
      : {};
  return {
    ...metadata,
    workflow_event_delivery_id: prepared.claim.key,
    workflow_event_auth_mode: prepared.auth.mode,
  };
}

export function registerLeadgridWorkflowTriggerRoutes(deps: Deps): void {
  const { app, pool } = deps;

  // ─── email.opened ───────────────────────────────────────────────
  // Kalles fra tracking-pixel-img-redirect ELLER backend-mailer-callback.
  // Body: { organization_id?, customer_id?, email_id?, user_agent?, ip_address?, metadata? }
  app.post(
    "/api/leadgrid/events/email/opened",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "email.opened",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, customer_id, event_type, email_id,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2::uuid, 'opened', $3, $4, $5::inet, $6::jsonb)`,
          [
            prepared.organizationId,
            prepared.customerId,
            reqStr(body.email_id),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(eventMetadata(body, prepared)),
          ],
        );
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "email.opened",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            email_id: reqStr(body.email_id),
            delivery_id: prepared.claim.key,
            occurred_at: new Date().toISOString(),
          },
        });
        await emitWebhook(
          pool,
          "email.opened",
          {
            lead_id: prepared.customerId,
            email_id: reqStr(body.email_id),
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[email.opened]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── email.link_clicked ─────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/email/link-clicked",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const linkUrl = reqStr(body.link_url);
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "email.link_clicked",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      try {
        await pool.query(
          `INSERT INTO leadgrid_email_tracking_events
             (organization_id, customer_id, event_type, email_id, link_url,
              user_agent, ip_address, metadata)
           VALUES ($1::uuid, $2::uuid, 'link_clicked', $3, $4, $5, $6::inet, $7::jsonb)`,
          [
            prepared.organizationId,
            prepared.customerId,
            reqStr(body.email_id),
            linkUrl,
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(eventMetadata(body, prepared)),
          ],
        );
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "email.link_clicked",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            link_url: linkUrl,
            email_id: reqStr(body.email_id),
            delivery_id: prepared.claim.key,
          },
        });
        await emitWebhook(
          pool,
          "email.link_clicked",
          {
            lead_id: prepared.customerId,
            link_url: linkUrl,
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[email.link_clicked]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── meeting.booked ─────────────────────────────────────────────
  // UI bruker session; normaliserte kalender-provider-callbacks bruker den
  // signerte HMAC-kontrakten eller intern service-token-kontrakt.
  app.post(
    "/api/leadgrid/events/meetings/booked",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "meeting.booked",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      try {
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "meeting.booked",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            meeting_id: reqStr(body.meeting_id),
            meeting_type: reqStr(body.meeting_type) ?? "discovery",
            starts_at: reqStr(body.starts_at),
            delivery_id: prepared.claim.key,
          },
        });
        await emitWebhook(
          pool,
          "meeting.booked",
          {
            lead_id: prepared.customerId,
            meeting_id: reqStr(body.meeting_id),
            meeting_type: reqStr(body.meeting_type) ?? "discovery",
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[meeting.booked]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── meeting.no_show ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/meetings/no-show",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "meeting.no_show",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      const meetingId = reqStr(body.meeting_id);
      try {
        const updated = await pool.query(
          `UPDATE leadgrid_meetings
              SET status = 'no_show',
                  metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND customer_id = $3::uuid
            RETURNING id`,
          [
            meetingId,
            prepared.organizationId,
            prepared.customerId,
            JSON.stringify(eventMetadata(body, prepared)),
          ],
        );
        if (updated.rows.length === 0) {
          await releaseEventClaim(pool, prepared.claim);
          res.status(409).json({ error: "meeting_state_changed" });
          return;
        }
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "meeting.no_show",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            meeting_id: meetingId,
            delivery_id: prepared.claim.key,
          },
        });
        await emitWebhook(
          pool,
          "meeting.no_show",
          {
            lead_id: prepared.customerId,
            meeting_id: meetingId,
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[meeting.no_show]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── proposal.opened ────────────────────────────────────────────
  app.post(
    "/api/leadgrid/events/proposals/opened",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const proposalId = reqStr(body.proposal_id);
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "proposal.opened",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      try {
        await pool.query(
          `INSERT INTO leadgrid_proposal_views
             (organization_id, customer_id, proposal_id,
              view_duration_seconds, pages_viewed, device_type,
              user_agent, ip_address, metadata)
          VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::inet, $9::jsonb)`,
          [
            prepared.organizationId,
            prepared.customerId,
            proposalId,
            reqInt(body.view_duration_seconds),
            reqInt(body.pages_viewed),
            reqStr(body.device_type),
            reqStr(body.user_agent) ?? req.headers["user-agent"] ?? null,
            reqStr(body.ip_address) ?? null,
            JSON.stringify(eventMetadata(body, prepared)),
          ],
        );
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "proposal.opened",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            proposal_id: proposalId,
            delivery_id: prepared.claim.key,
          },
        });
        await emitWebhook(
          pool,
          "proposal.opened",
          {
            lead_id: prepared.customerId,
            proposal_id: proposalId,
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[proposal.opened]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );

  // ─── contract.signed ────────────────────────────────────────────
  // Tar imot provider-normaliserte callbacks. Adapteren må signere den
  // normaliserte body-en med HMAC-kontrakten dokumentert øverst i filen.
  app.post(
    "/api/leadgrid/events/contracts/signed",
    async (req: Request, res: Response): Promise<void> => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const contractId = reqStr(body.contract_id);
      const preparation = await prepareEvent(
        req,
        res,
        deps,
        "contract.signed",
        body,
      );
      if (preparation.kind === "responded") return;
      const prepared = preparation.value;
      const provider = reqStr(body.provider) ?? "manual";
      try {
        await pool.query(
          `INSERT INTO leadgrid_contract_events
             (organization_id, customer_id, event_type, contract_id,
              signer_email, provider, metadata)
          VALUES ($1::uuid, $2::uuid, 'signed', $3, $4, $5, $6::jsonb)`,
          [
            prepared.organizationId,
            prepared.customerId,
            contractId,
            reqStr(body.signer_email),
            provider,
            JSON.stringify(eventMetadata(body, prepared)),
          ],
        );
        await publishEvent({
          pool,
          organizationId: prepared.organizationId,
          type: "contract.signed",
          leadId: prepared.customerId,
          actorUserId:
            prepared.auth.mode === "session"
              ? prepared.auth.session.userId
              : null,
          data: {
            contract_id: contractId,
            provider,
            signer_email: reqStr(body.signer_email),
            delivery_id: prepared.claim.key,
          },
        });
        await emitWebhook(
          pool,
          "contract.signed",
          {
            lead_id: prepared.customerId,
            contract_id: contractId,
            provider,
            delivery_id: prepared.claim.key,
          },
          prepared.organizationId,
        );
        const responseBody = { ok: true };
        await completeEventClaim(pool, prepared.claim, responseBody);
        res.json(responseBody);
      } catch (err) {
        await releaseEventClaim(pool, prepared.claim);
        console.error("[contract.signed]", err);
        res.status(500).json({ error: "record_failed" });
      }
    },
  );
}
