/**
 * Project-scoped customer onboarding.
 *
 * One request enriches and provisions a customer/lead inside an existing,
 * explicitly selected Leadgrid project. The project's persisted organization
 * is authoritative; request-supplied tenant IDs are never used.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import {
  hashLeadCreationBody,
  normalizeWebsiteDomain,
  parseLeadCreationBody,
  parseLeadCreationIdempotencyKey,
  LeadCreationValidationError,
} from "./lead-map-create-contract.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  createLeadFromPin,
  DuplicateLeadError,
  LeadCreationIdempotencyConflictError,
} from "./lead-map-service.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";
import { leadgridPublicOrigin } from "./leadgrid-public-origin.js";
import type { GateResult } from "./plan-limits-service.js";
import { runScoutForLead } from "./lead-scout-service.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

interface PresetRow {
  id: string;
  name: string;
  industry: string | null;
  default_needs: string[] | null;
  default_signals: string[] | null;
  default_tags: string[] | null;
  default_custom_fields: Record<string, unknown> | null;
  default_lead_source: string | null;
}

interface AuditRow {
  id: string;
  organization_id: string;
  project_id: string;
  triggered_by: string;
  website_url: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  preset_id: string | null;
  idempotency_key: string;
  request_hash: string;
  quota_claimed_at: string | null;
  customer_id: string | null;
  brreg_name: string | null;
  portal_token_id: string | null;
  invitation_status: string;
  status: string;
  error_message: string | null;
}

interface OnboardScope {
  auditId: string;
  organizationId: string;
  projectId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestedProjectId(req: Request): string | null {
  const raw =
    req.body?.project_id ??
    req.body?.projectId ??
    req.query?.project_id ??
    req.query?.projectId;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value && value.length <= 255 ? value : null;
}

async function resolveAccessibleProjectOrganization(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) return null;
  const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
  return project?.organizationId ?? null;
}

function normalizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let candidate = input.trim();
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) candidate = "https://" + candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (
    value.length < 3 ||
    value.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return null;
  }
  return value;
}

function optionalText(input: unknown, maxLength: number): string | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value ? value.slice(0, maxLength) : null;
}

function requestedPresetId(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string" || !UUID_PATTERN.test(input.trim())) {
    throw new LeadCreationValidationError("preset_not_found");
  }
  return input.trim().toLowerCase();
}

function onboardingRequestHash(input: {
  projectId: string;
  websiteUrl: string;
  contactEmail: string;
  contactName: string | null;
  contactPhone: string | null;
  presetId: string | null;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function extractDomainName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] || "kunde";
  } catch {
    return "kunde";
  }
}

async function lookupBrreg(
  searchName: string,
): Promise<{ orgNumber: string | null; officialName: string | null }> {
  try {
    const response = await fetch(
      "https://data.brreg.no/enhetsregisteret/api/enheter?navn="
        + encodeURIComponent(searchName)
        + "&size=1",
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6_000),
      },
    );
    if (!response.ok) return { orgNumber: null, officialName: null };
    const data = await response.json() as {
      _embedded?: {
        enheter?: Array<{ organisasjonsnummer?: string; navn?: string }>;
      };
    };
    const first = data._embedded?.enheter?.[0];
    return {
      orgNumber:
        typeof first?.organisasjonsnummer === "string"
          ? first.organisasjonsnummer
          : null,
      officialName: typeof first?.navn === "string" ? first.navn : null,
    };
  } catch {
    return { orgNumber: null, officialName: null };
  }
}

function makePortalToken(): string {
  return randomBytes(24).toString("base64url");
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFailureCode(error: unknown): string {
  if (error instanceof LeadCreationIdempotencyConflictError) {
    return "idempotency_payload_conflict";
  }
  if (error instanceof LeadCreationValidationError) return error.code;
  return "internal_error";
}

async function updateAuditFailure(
  pool: Pool,
  scope: OnboardScope,
  errorCode: string,
): Promise<void> {
  await pool.query(
    `UPDATE customer_auto_onboards
        SET status = 'failed',
            error_message = $4,
            finished_at = NOW(),
            updated_at = NOW()
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [scope.auditId, scope.organizationId, scope.projectId, errorCode],
  );
}

async function loadAudit(
  pool: Pool,
  scope: OnboardScope,
): Promise<AuditRow | null> {
  const result = await pool.query<AuditRow>(
    `SELECT id::text,
            organization_id::text,
            project_id,
            triggered_by,
            website_url,
            contact_email,
            contact_name,
            contact_phone,
            preset_id::text,
            idempotency_key::text,
            request_hash,
            quota_claimed_at::text,
            customer_id,
            brreg_name,
            portal_token_id::text,
            invitation_status,
            status,
            error_message
       FROM customer_auto_onboards
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
      LIMIT 1`,
    [scope.auditId, scope.organizationId, scope.projectId],
  );
  return result.rows[0] ?? null;
}

async function ensureQuotaClaimed(
  pool: Pool,
  scope: OnboardScope,
): Promise<{
  allowed: boolean;
  gate?: GateResult | {
    allowed: false;
    reason: "customer_limit_reached" | "auto_onboard_limit_reached";
  };
  quotaClaimedAt: string | null;
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      status: string;
      error_message: string | null;
      quota_claimed_at: string | null;
    }>(
      `SELECT status,
              error_message,
              quota_claimed_at::text
         FROM customer_auto_onboards
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
        FOR UPDATE`,
      [scope.auditId, scope.organizationId, scope.projectId],
    );
    const audit = current.rows[0];
    if (!audit) {
      await client.query("ROLLBACK");
      throw new LeadCreationValidationError("audit_not_found");
    }
    if (audit.quota_claimed_at) {
      await client.query("COMMIT");
      return {
        allowed: true,
        quotaClaimedAt: audit.quota_claimed_at,
      };
    }
    if (audit.status === "completed" || audit.status === "duplicate") {
      await client.query("COMMIT");
      return { allowed: true, quotaClaimedAt: null };
    }
    if (
      audit.error_message === "customer_limit_reached"
      || audit.error_message === "auto_onboard_limit_reached"
    ) {
      await client.query("COMMIT");
      return {
        allowed: false,
        gate: {
          allowed: false,
          reason: audit.error_message,
        },
        quotaClaimedAt: null,
      };
    }

    const { canCreateCustomer, tryClaimAutoOnboard } =
      await import("./plan-limits-service.js");
    // Both the usage increment and audit marker must commit together. Passing
    // the checked-out client keeps every query in this transaction.
    const transactionalPool = client as unknown as Pool;
    const customerGate = await canCreateCustomer(
      transactionalPool,
      scope.organizationId,
    );
    if (!customerGate.allowed) {
      await client.query(
        `UPDATE customer_auto_onboards
            SET status = 'failed',
                error_message = 'customer_limit_reached',
                finished_at = NOW(),
                updated_at = NOW()
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3`,
        [scope.auditId, scope.organizationId, scope.projectId],
      );
      await client.query("COMMIT");
      return {
        allowed: false,
        gate: customerGate,
        quotaClaimedAt: null,
      };
    }

    const autoOnboardGate = await tryClaimAutoOnboard(
      transactionalPool,
      scope.organizationId,
    );
    if (!autoOnboardGate.allowed) {
      await client.query(
        `UPDATE customer_auto_onboards
            SET status = 'failed',
                error_message = 'auto_onboard_limit_reached',
                finished_at = NOW(),
                updated_at = NOW()
          WHERE id = $1::uuid
            AND organization_id = $2::uuid
            AND project_id = $3`,
        [scope.auditId, scope.organizationId, scope.projectId],
      );
      await client.query("COMMIT");
      return {
        allowed: false,
        gate: autoOnboardGate,
        quotaClaimedAt: null,
      };
    }

    const claimed = await client.query<{ quota_claimed_at: string }>(
      `UPDATE customer_auto_onboards
          SET quota_claimed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
        RETURNING quota_claimed_at::text`,
      [scope.auditId, scope.organizationId, scope.projectId],
    );
    await client.query("COMMIT");
    return {
      allowed: true,
      quotaClaimedAt: claimed.rows[0]?.quota_claimed_at ?? null,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadPreset(
  pool: Pool,
  organizationId: string,
  presetId: string | null,
): Promise<PresetRow | null> {
  if (!presetId) return null;
  const result = await pool.query<PresetRow>(
    `SELECT id::text,
            name,
            industry,
            default_needs,
            default_signals,
            default_tags,
            default_custom_fields,
            default_lead_source
       FROM lead_parameter_presets
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND is_active = TRUE
      LIMIT 1`,
    [presetId, organizationId],
  );
  if (!result.rows[0]) {
    throw new LeadCreationValidationError("preset_not_found");
  }
  return result.rows[0];
}

async function decorateLeadFromPreset(
  pool: Pool,
  input: {
    leadId: string;
    organizationId: string;
    projectId: string;
    userId: string;
    preset: PresetRow | null;
  },
): Promise<number> {
  const tags = Array.isArray(input.preset?.default_tags)
    ? input.preset.default_tags.filter((item): item is string =>
        typeof item === "string" && item.trim().length > 0)
    : [];
  const customFields =
    input.preset?.default_custom_fields
    && typeof input.preset.default_custom_fields === "object"
    && !Array.isArray(input.preset.default_custom_fields)
      ? input.preset.default_custom_fields
      : {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lead = await client.query(
      `UPDATE crm_customers
          SET tags = ARRAY(
                SELECT value
                  FROM unnest(
                    COALESCE(tags, ARRAY[]::text[]) || $4::text[]
                  ) WITH ORDINALITY AS requested(value, position)
                 GROUP BY value
                 ORDER BY MIN(position)
              ),
              custom_fields = $5::jsonb || COALESCE(custom_fields, '{}'::jsonb),
              lead_parameter_preset_id = COALESCE(
                lead_parameter_preset_id,
                $6::uuid
              ),
              latitude = NULL,
              longitude = NULL,
              location_confidence = 'unknown',
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
        RETURNING id::text`,
      [
        input.leadId,
        input.organizationId,
        input.projectId,
        tags,
        JSON.stringify(customFields),
        input.preset?.id ?? null,
      ],
    );
    if (lead.rowCount !== 1) {
      throw new LeadCreationValidationError("lead_not_found");
    }

    let needsCount = 0;
    for (const needType of input.preset?.default_needs ?? []) {
      if (typeof needType !== "string" || !needType.trim()) continue;
      const inserted = await client.query(
        `INSERT INTO crm_customer_needs
           (customer_id, organization_id, project_id, need_type, priority,
            evidence, detected_by, status)
         VALUES ($1, $2::uuid, $3, $4, 3, $5, $6, 'detected')
         ON CONFLICT (customer_id, need_type) DO NOTHING
         RETURNING id`,
        [
          input.leadId,
          input.organizationId,
          input.projectId,
          needType.slice(0, 60),
          input.preset
            ? 'Fra preset "' + input.preset.name + '"'
            : "Fra onboarding",
          input.userId,
        ],
      );
      needsCount += inserted.rowCount ?? 0;
    }

    for (const signalType of input.preset?.default_signals ?? []) {
      if (typeof signalType !== "string" || !signalType.trim()) continue;
      await client.query(
        `INSERT INTO crm_customer_signals
           (customer_id, organization_id, project_id, signal_type, polarity,
            raw_value, source)
         VALUES ($1, $2::uuid, $3, $4, 'neutral', $5, 'preset')
         ON CONFLICT (customer_id, signal_type) DO NOTHING`,
        [
          input.leadId,
          input.organizationId,
          input.projectId,
          signalType.slice(0, 60),
          input.preset
            ? 'Fra preset "' + input.preset.name + '"'
            : "Fra onboarding",
        ],
      );
    }

    await client.query("COMMIT");
    return needsCount;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function provisionPortalToken(
  pool: Pool,
  audit: AuditRow,
  customerId: string,
): Promise<{ id: string; token: string }> {
  const result = await pool.query<{ id: string; token: string }>(
    `INSERT INTO client_portal_tokens
       (organization_id, project_id, customer_id, token,
        invited_email, invited_name, created_by, auto_onboard_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)
     ON CONFLICT (auto_onboard_id)
       WHERE auto_onboard_id IS NOT NULL
     DO UPDATE SET
       invited_email = EXCLUDED.invited_email,
       invited_name = EXCLUDED.invited_name
     RETURNING id::text, token`,
    [
      audit.organization_id,
      audit.project_id,
      customerId,
      makePortalToken(),
      audit.contact_email,
      audit.contact_name,
      audit.triggered_by,
      audit.id,
    ],
  );
  return result.rows[0];
}

async function sendPortalInvitation(
  pool: Pool,
  audit: AuditRow,
  customerName: string,
  portalToken: string,
): Promise<void> {
  const claimed = await pool.query(
    `UPDATE customer_auto_onboards
        SET invitation_status = 'claimed',
            invitation_claimed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
        AND invitation_status IN ('pending', 'failed')
      RETURNING id`,
    [audit.id, audit.organization_id, audit.project_id],
  );
  if (claimed.rowCount !== 1) return;

  const portalUrl =
    leadgridPublicOrigin() + "/c/" + encodeURIComponent(portalToken);
  const safeCustomerName = escapeHtml(customerName);
  const safeContactName = audit.contact_name
    ? escapeHtml(audit.contact_name)
    : null;
  const greeting = safeContactName ? "Hei " + safeContactName : "Hei";
  const html =
    '<div style="background:#0b0518;color:#F4F0FF;padding:32px;'
    + 'font-family:-apple-system,Helvetica,Arial,sans-serif">'
    + '<h1 style="color:#A78BFA;font-size:24px;margin:0 0 8px">'
    + "Velkommen, " + safeCustomerName + ".</h1>"
    + '<p style="color:rgba(244,240,255,0.72);font-size:14px;'
    + 'margin:0 0 24px">' + greeting + ",</p>"
    + '<p style="font-size:16px;line-height:1.6">Du har fått tilgang til '
    + "<strong>klient-portalen</strong> i Leadgrid. Her ser du hva vi har "
    + "funnet, hva vi leverer, og hvor langt vi har kommet.</p>"
    + '<p style="margin:24px 0"><a href="' + portalUrl
    + '" style="background:#A78BFA;color:#1a0535;padding:14px 28px;'
    + 'border-radius:999px;text-decoration:none;font-weight:bold;'
    + 'display:inline-block">Åpne klient-portalen →</a></p>'
    + '<p style="color:rgba(244,240,255,0.45);font-size:12px;'
    + 'margin-top:32px">Lenken er gyldig i 90 dager.</p></div>';
  const text =
    greeting + ",\n\nDu har fått tilgang til klient-portalen i Leadgrid for "
    + customerName + ".\n\nÅpne portalen: " + portalUrl
    + "\n\nLenken er gyldig i 90 dager.";

  let sent = false;
  try {
    const result = await sendTransactionalEmail({
      to: audit.contact_email,
      subject: customerName + " — din klient-portal i Leadgrid",
      html,
      text,
      fromLabel: "Leadgrid",
      fromAddress:
        process.env.LEADGRID_EMAIL_FROM
        ?? process.env.CREATORHUB_RESEND_FROM_EMAIL
        ?? "no-reply@leadgrid.no",
      credentialScope: "creatorhub",
      kind: "leadgrid_client_portal_invite",
      projectId: audit.project_id,
      sentByUserId: audit.triggered_by,
      pool,
    });
    sent = result.sent;
  } catch {
    sent = false;
  }

  await pool.query(
    `UPDATE customer_auto_onboards
        SET invitation_status = $4,
            invitation_sent_at = CASE
              WHEN $4 = 'sent' THEN NOW()
              ELSE invitation_sent_at
            END,
            updated_at = NOW()
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [
      audit.id,
      audit.organization_id,
      audit.project_id,
      sent ? "sent" : "failed",
    ],
  );
}

async function retryCompletedInvitation(
  pool: Pool,
  audit: AuditRow,
): Promise<void> {
  if (
    audit.status !== "completed"
    || audit.invitation_status !== "failed"
    || !audit.portal_token_id
    || !audit.customer_id
  ) {
    return;
  }
  const portal = await pool.query<{
    token: string;
    customer_name: string;
  }>(
    `SELECT portal.token,
            COALESCE(customer.name, $5) AS customer_name
       FROM client_portal_tokens portal
       JOIN crm_customers customer
         ON customer.id::text = portal.customer_id::text
        AND customer.organization_id = portal.organization_id
        AND customer.project_id = portal.project_id
      WHERE portal.id = $1::uuid
        AND portal.organization_id = $2::uuid
        AND portal.project_id = $3
        AND portal.customer_id::text = $4
        AND portal.revoked_at IS NULL
        AND portal.expires_at > NOW()
      LIMIT 1`,
    [
      audit.portal_token_id,
      audit.organization_id,
      audit.project_id,
      audit.customer_id,
      audit.brreg_name ?? extractDomainName(audit.website_url),
    ],
  );
  if (!portal.rows[0]) return;
  await sendPortalInvitation(
    pool,
    audit,
    portal.rows[0].customer_name,
    portal.rows[0].token,
  );
}

/**
 * Retry-safe worker. A session advisory lock prevents two HTTP retries from
 * executing side effects concurrently; a crashed process releases the lock.
 */
export async function runScopedCustomerOnboarding(
  pool: Pool,
  scope: OnboardScope,
): Promise<void> {
  let lockClient: PoolClient | null = null;
  const lockKey = "leadgrid-auto-onboard:" + scope.auditId;
  try {
    lockClient = await pool.connect();
    const lock = await lockClient.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",
      [lockKey],
    );
    if (lock.rows[0]?.locked !== true) return;

    const audit = await loadAudit(pool, scope);
    if (
      !audit ||
      !audit.quota_claimed_at ||
      audit.status === "completed" ||
      audit.status === "duplicate"
    ) {
      return;
    }

    await pool.query(
      `UPDATE customer_auto_onboards
          SET status = 'running',
              error_message = NULL,
              finished_at = NULL,
              attempt_count = attempt_count + 1,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [audit.id, audit.organization_id, audit.project_id],
    );

    const preset = await loadPreset(pool, audit.organization_id, audit.preset_id);
    const domainName = extractDomainName(audit.website_url);
    const brreg = await lookupBrreg(audit.contact_name ?? domainName);
    const customerName =
      brreg.officialName
      ?? audit.contact_name
      ?? (domainName.charAt(0).toUpperCase() + domainName.slice(1));

    const canonicalBody = parseLeadCreationBody({
      name: customerName,
      company: customerName,
      contact_name: audit.contact_name,
      phone: audit.contact_phone,
      email: audit.contact_email,
      website_url: audit.website_url,
      organization_number: brreg.orgNumber,
      industry_label: preset?.industry ?? null,
      latitude: 0,
      longitude: 0,
      location_confidence: "unknown",
      lead_temperature: "warm",
      lead_status: "unvisited",
      lead_source: preset?.default_lead_source ?? "auto_onboard",
      project_id: audit.project_id,
      notes: "Auto-onboardet fra " + normalizeWebsiteDomain(audit.website_url),
    });

    let creation;
    try {
      creation = await createLeadFromPin(pool, {
        ...canonicalBody,
        ownerUserId: audit.triggered_by,
        organizationId: audit.organization_id,
        projectId: audit.project_id,
        idempotencyKey: audit.idempotency_key,
        requestHash: hashLeadCreationBody(canonicalBody),
      });
    } catch (error) {
      if (error instanceof DuplicateLeadError) {
        await pool.query(
          `UPDATE customer_auto_onboards
              SET status = 'duplicate',
                  customer_id = $4,
                  brreg_org_number = $5,
                  brreg_name = $6,
                  finished_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3`,
          [
            audit.id,
            audit.organization_id,
            audit.project_id,
            error.existingLeadId,
            brreg.orgNumber,
            brreg.officialName,
          ],
        );
        return;
      }
      throw error;
    }

    await pool.query(
      `UPDATE customer_auto_onboards
          SET customer_id = $4,
              brreg_org_number = $5,
              brreg_name = $6,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [
        audit.id,
        audit.organization_id,
        audit.project_id,
        creation.id,
        brreg.orgNumber,
        brreg.officialName,
      ],
    );

    const presetNeedsCount = await decorateLeadFromPreset(pool, {
      leadId: creation.id,
      organizationId: audit.organization_id,
      projectId: audit.project_id,
      userId: audit.triggered_by,
      preset,
    });

    if (creation.created) {
      try {
        const { incrementUsage } = await import("./plan-limits-service.js");
        await incrementUsage(pool, audit.organization_id, "customers_created");
      } catch {
        // Active-customer gating reads canonical rows, so metric failure must
        // not roll back a successfully persisted customer.
      }
      try {
        const { publishEvent } = await import("./leadgrid-workflow-engine.js");
        await publishEvent({
          pool,
          organizationId: audit.organization_id,
          projectId: audit.project_id,
          type: "lead.created",
          leadId: creation.id,
          actorUserId: audit.triggered_by,
          data: {
            source: canonicalBody.leadSource,
            project_id: audit.project_id,
            occurred_at: new Date().toISOString(),
          },
        });
      } catch {
        // Workflow fan-out is independent from onboarding completion.
      }
    }

    let scoutResult: {
      composite_score: number;
      needs_count: number;
      signals_count: number;
    } | null = null;
    try {
      const result = await runScoutForLead(pool, {
        customerId: creation.id,
        organizationId: audit.organization_id,
        projectId: audit.project_id,
        leadName: customerName,
        websiteUrl: audit.website_url,
        industry: preset?.industry ?? null,
        triggeredBy: audit.triggered_by,
        idempotencyKey: audit.idempotency_key,
      });
      scoutResult = {
        composite_score: result.composite_score,
        needs_count: result.needs_count,
        signals_count: result.signals_count,
      };
    } catch {
      // A temporary crawler/model failure should not discard the customer.
    }

    const portal = await provisionPortalToken(pool, audit, creation.id);
    await pool.query(
      `UPDATE customer_auto_onboards
          SET portal_token_id = $4::uuid,
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [audit.id, audit.organization_id, audit.project_id, portal.id],
    );
    await sendPortalInvitation(pool, audit, customerName, portal.token);

    const logo = await pool.query<{ logo_url: string | null }>(
      `SELECT logo_url
         FROM crm_customers
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
        LIMIT 1`,
      [creation.id, audit.organization_id, audit.project_id],
    );

    await pool.query(
      `UPDATE customer_auto_onboards
          SET status = 'completed',
              needs_count = $4,
              signals_count = $5,
              composite_score = $6,
              logo_url = $7,
              error_message = NULL,
              finished_at = NOW(),
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3`,
      [
        audit.id,
        audit.organization_id,
        audit.project_id,
        scoutResult?.needs_count ?? presetNeedsCount,
        scoutResult?.signals_count ?? 0,
        scoutResult?.composite_score ?? null,
        logo.rows[0]?.logo_url ?? null,
      ],
    );

    try {
      const { triggerOnboardingDrip } =
        await import("./leadgrid-drips-routes.js");
      await triggerOnboardingDrip(pool, {
        userId: audit.triggered_by,
        organizationId: audit.organization_id,
        triggerEvent: "first_auto_onboard",
      });
    } catch {
      // Drips are best-effort and independently idempotent.
    }
  } catch (error) {
    console.error("[leadgrid auto-onboard] worker failed:", safeFailureCode(error));
    await updateAuditFailure(pool, scope, safeFailureCode(error)).catch(
      () => undefined,
    );
  } finally {
    if (lockClient) {
      await lockClient.query(
        "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
        [lockKey],
      ).catch(() => undefined);
      lockClient.release();
    }
  }
}

function startWorker(pool: Pool, scope: OnboardScope): void {
  void runScopedCustomerOnboarding(pool, scope).catch((error) => {
    console.error("[leadgrid auto-onboard] unhandled worker error:", safeFailureCode(error));
  });
}

export function registerCustomerAutoOnboardRoutes({
  app,
  pool,
  activeSessions,
}: Deps): void {
  const root = "/api/admin-room/lead-map/customers";
  const permissionOptions = {
    pool,
    activeSessions,
    resolveOrgId: resolveAccessibleProjectOrganization,
  };

  app.post(
    root + "/auto-onboard",
    requireLeadMapPermission("leads.create", permissionOptions),
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }

      const projectId = requestedProjectId(req);
      if (!projectId) {
        return res.status(400).json({ error: "project_id_required" });
      }
      const project = await loadAccessibleLeadgridProject(
        pool,
        projectId,
        session.userId,
      );
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }

      const websiteUrl = normalizeUrl(req.body?.website_url ?? req.body?.websiteUrl);
      if (!websiteUrl) {
        return res.status(400).json({ error: "invalid_website_url" });
      }
      const contactEmail = normalizeEmail(
        req.body?.contact_email ?? req.body?.contactEmail,
      );
      if (!contactEmail) {
        return res.status(400).json({ error: "invalid_contact_email" });
      }

      let idempotencyKey: string | null = null;
      let presetId: string | null = null;
      try {
        idempotencyKey = parseLeadCreationIdempotencyKey(
          req.get("Idempotency-Key"),
        );
        presetId = requestedPresetId(
          req.body?.preset_id ?? req.body?.presetId,
        );
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof LeadCreationValidationError
              ? error.code
              : "invalid_request",
        });
      }
      if (!idempotencyKey) {
        return res.status(400).json({ error: "idempotency_key_required" });
      }

      if (presetId) {
        const preset = await pool.query(
          `SELECT 1
             FROM lead_parameter_presets
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND is_active = TRUE
            LIMIT 1`,
          [presetId, project.organizationId],
        );
        if (!preset.rows[0]) {
          return res.status(404).json({ error: "preset_not_found" });
        }
      }

      const contactName = optionalText(
        req.body?.contact_name ?? req.body?.contactName,
        160,
      );
      const contactPhone = optionalText(
        req.body?.contact_phone ?? req.body?.contactPhone,
        50,
      );
      const requestHash = onboardingRequestHash({
        projectId: project.id,
        websiteUrl,
        contactEmail,
        contactName,
        contactPhone,
        presetId,
      });

      try {
        const inserted = await pool.query<{
          id: string;
          status: string;
          error_message: string | null;
          quota_claimed_at: string | null;
          invitation_status: string;
        }>(
          `INSERT INTO customer_auto_onboards
             (organization_id, project_id, triggered_by, website_url,
              contact_email, contact_name, contact_phone, preset_id,
              idempotency_key, request_hash, status)
           VALUES (
             $1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid,
             $9::uuid, $10, 'pending'
           )
           ON CONFLICT (organization_id, project_id, idempotency_key)
             WHERE idempotency_key IS NOT NULL
           DO NOTHING
           RETURNING id::text, status, error_message, quota_claimed_at::text,
                     invitation_status`,
          [
            project.organizationId,
            project.id,
            session.userId,
            websiteUrl,
            contactEmail,
            contactName,
            contactPhone,
            presetId,
            idempotencyKey,
            requestHash,
          ],
        );

        let audit = inserted.rows[0];
        let replayed = false;
        if (!audit) {
          replayed = true;
          const existing = await pool.query<{
            id: string;
            status: string;
            error_message: string | null;
            quota_claimed_at: string | null;
            request_hash: string;
            invitation_status: string;
          }>(
            `SELECT id::text,
                    status,
                    error_message,
                    quota_claimed_at::text,
                    request_hash,
                    invitation_status
               FROM customer_auto_onboards
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND idempotency_key = $3::uuid
              LIMIT 1`,
            [project.organizationId, project.id, idempotencyKey],
          );
          const row = existing.rows[0];
          if (!row) {
            return res.status(409).json({ error: "idempotency_conflict" });
          }
          if (row.request_hash !== requestHash) {
            return res.status(409).json({
              error: "idempotency_payload_conflict",
            });
          }
          audit = row;
        }

        if (
          replayed
          && (
            audit.error_message === "customer_limit_reached"
            || audit.error_message === "auto_onboard_limit_reached"
          )
        ) {
          return res.status(402).json({ error: audit.error_message });
        }

        if (audit.status !== "completed" && audit.status !== "duplicate") {
          const quota = await ensureQuotaClaimed(pool, {
            auditId: audit.id,
            organizationId: project.organizationId,
            projectId: project.id,
          });
          if (!quota.allowed) {
            return res.status(402).json({
              error: "plan_limit_reached",
              gate: quota.gate,
            });
          }
          audit.quota_claimed_at = quota.quotaClaimedAt;
        }

        if (
          replayed
          && audit.status === "completed"
          && audit.invitation_status === "failed"
        ) {
          const completedAudit = await loadAudit(pool, {
            auditId: audit.id,
            organizationId: project.organizationId,
            projectId: project.id,
          });
          if (completedAudit) {
            await retryCompletedInvitation(pool, completedAudit);
          }
        }

        const scope = {
          auditId: audit.id,
          organizationId: project.organizationId,
          projectId: project.id,
        };
        if (
          audit.quota_claimed_at
          && audit.status !== "completed"
          && audit.status !== "duplicate"
        ) {
          startWorker(pool, scope);
        }

        const terminal =
          audit.status === "completed" || audit.status === "duplicate";
        if (replayed) res.setHeader("Idempotent-Replayed", "true");
        return res.status(terminal ? 200 : 202).json({
          audit_id: audit.id,
          project_id: project.id,
          status: terminal ? audit.status : "running",
          replayed,
          message: terminal
            ? "Onboardingen er allerede ferdig."
            : "Leadgrid jobber. Poll status for fremdrift.",
        });
      } catch (error) {
        console.error("[leadgrid auto-onboard] request failed:", safeFailureCode(error));
        return res.status(500).json({ error: "auto_onboard_failed" });
      }
    },
  );

  app.get(
    root + "/auto-onboard/:audit_id",
    requireLeadMapPermission("leads.view", permissionOptions),
    async (req: Request, res: Response) => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = requestedProjectId(req);
      if (!projectId) {
        return res.status(400).json({ error: "project_id_required" });
      }
      const project = await loadAccessibleLeadgridProject(
        pool,
        projectId,
        session.userId,
      );
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }
      if (!UUID_PATTERN.test(req.params.audit_id ?? "")) {
        return res.status(404).json({ error: "not_found" });
      }

      try {
        const result = await pool.query(
          `SELECT id::text,
                  status,
                  website_url,
                  contact_email,
                  contact_name,
                  project_id,
                  customer_id,
                  brreg_org_number,
                  brreg_name,
                  logo_url,
                  needs_count,
                  signals_count,
                  composite_score,
                  (portal_token_id IS NOT NULL) AS portal_ready,
                  invitation_status,
                  error_message,
                  started_at::text,
                  finished_at::text
             FROM customer_auto_onboards
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id = $3
            LIMIT 1`,
          [req.params.audit_id, project.organizationId, project.id],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ audit: result.rows[0] });
      } catch (error) {
        console.error("[leadgrid auto-onboard] status failed");
        return res.status(500).json({ error: "status_failed" });
      }
    },
  );
}

export const __test = {
  ensureQuotaClaimed,
  onboardingRequestHash,
  normalizeEmail,
  normalizeUrl,
  requestedProjectId,
};
