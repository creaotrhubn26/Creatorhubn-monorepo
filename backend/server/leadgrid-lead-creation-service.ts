import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { extractOrgNrFromText } from "./lead-brreg-service.js";
import { enqueueJob } from "./job-queue.js";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "ugyldig e-postadresse",
  )
  .nullable()
  .optional();

export const leadDraftInputSchema = z
  .object({
    creation_id: z.string().uuid(),
    organization_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(200),
    company: optionalText(240),
    organization_number: optionalText(32),
    website_url: optionalText(2_048),
    contact_name: optionalText(240),
    contact_role: optionalText(160),
    email: optionalEmail,
    phone: optionalText(50),
    address: optionalText(500),
    postal_code: optionalText(20),
    city: optionalText(120),
    country: optionalText(2),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    google_place_id: optionalText(255),
    industry_id: z.string().uuid().nullable().optional(),
    industry: optionalText(60),
    employee_count_estimate: z.number().int().min(0).max(10_000_000).nullable().optional(),
    annual_revenue_nok_estimate: z.number().min(0).max(99_999_999_999_999).nullable().optional(),
    estimated_value: z.number().min(0).max(99_999_999.99).nullable().optional(),
    notes: optionalText(20_000),
    lead_temperature: z.enum(["cold", "warm", "hot", "ready"]).default("warm"),
    pipeline_stage: z
      .enum(["new", "first_contact", "qualified", "meeting", "proposal", "negotiation", "won", "lost"])
      .default("new"),
    lead_status: z
      .enum([
        "unvisited",
        "visited",
        "return",
        "not_present",
        "declined",
        "interested",
        "meeting_booked",
        "proposal_sent",
        "won",
        "lost",
        "do_not_contact",
      ])
      .default("unvisited"),
    next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
    next_action: optionalText(2_000),
    location_confidence: z.enum(["exact", "geocoded", "approximate", "unknown"]).default("unknown"),
    lead_source: z.string().trim().min(1).max(80).default("manual"),
    project_id: z.string().trim().min(1).max(255).nullable().optional(),
    raw_text: optionalText(20_000),
    allow_duplicate: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    const hasLatitude = value.latitude !== null && value.latitude !== undefined;
    const hasLongitude = value.longitude !== null && value.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasLatitude ? ["longitude"] : ["latitude"],
        message: "latitude og longitude må sendes sammen",
      });
    }
  });

export type LeadDraftInput = z.infer<typeof leadDraftInputSchema>;

export interface NormalizedLeadDraft {
  creationId: string;
  organizationId: string | null;
  name: string;
  company: string | null;
  organizationNumber: string | null;
  websiteUrl: string | null;
  websiteDomain: string | null;
  contactName: string | null;
  contactRole: string | null;
  email: string | null;
  phone: string | null;
  phoneDigits: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  industryId: string | null;
  industry: string | null;
  employeeCountEstimate: number | null;
  annualRevenueNokEstimate: number | null;
  estimatedValue: number | null;
  notes: string | null;
  leadTemperature: LeadDraftInput["lead_temperature"];
  pipelineStage: LeadDraftInput["pipeline_stage"];
  leadStatus: LeadDraftInput["lead_status"];
  nextFollowUpAt: string | null;
  nextAction: string | null;
  locationConfidence: LeadDraftInput["location_confidence"];
  leadSource: string;
  projectId: string | null;
  rawText: string | null;
  allowDuplicate: boolean;
}

export interface LeadDuplicateCandidate {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  address: string | null;
  city: string | null;
  matchReasons: Array<
    | "organization_number"
    | "google_place"
    | "website_domain"
    | "email"
    | "phone"
    | "name_city"
    | "coordinates"
  >;
}

export interface LeadCreationResult {
  id: string;
  created: boolean;
  replayed: boolean;
  duplicatesChecked: number;
}

type Queryable = Pick<PoolClient, "query">;

interface DuplicateRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  phone_normalized: string | null;
  website_url: string | null;
  website_domain_normalized: string | null;
  address: string | null;
  city: string | null;
  enrichment_org_nr: string | null;
  google_place_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
}

export class LeadDraftNormalizationError extends Error {
  constructor(
    readonly field: string,
    readonly reason: string,
  ) {
    super(`${field}: ${reason}`);
    this.name = "LeadDraftNormalizationError";
  }
}

export class LeadDuplicateConflictError extends Error {
  constructor(readonly candidates: LeadDuplicateCandidate[]) {
    super("Mulig duplikat må bekreftes før opprettelse.");
    this.name = "LeadDuplicateConflictError";
  }
}

export class LeadIdempotencyConflictError extends Error {
  constructor() {
    super("creation_id er brukt tidligere med en annen lead-payload.");
    this.name = "LeadIdempotencyConflictError";
  }
}

export class LeadScopeValidationError extends Error {
  constructor(readonly code: "organization_mismatch" | "project_not_in_organization" | "industry_not_available") {
    super(code);
    this.name = "LeadScopeValidationError";
  }
}

function cleaned(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function normalizeWebsite(
  rawValue: string | null | undefined,
): { url: string | null; domain: string | null } {
  const value = cleaned(rawValue);
  if (!value) return { url: null, domain: null };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new LeadDraftNormalizationError("website_url", "ugyldig URL");
  }
  if (!(["http:", "https:"] as string[]).includes(parsed.protocol)) {
    throw new LeadDraftNormalizationError("website_url", "kun http og https er tillatt");
  }
  if (parsed.username || parsed.password || !parsed.hostname) {
    throw new LeadDraftNormalizationError("website_url", "ugyldig nettadresse");
  }
  const domain = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!domain || domain.length > 253) {
    throw new LeadDraftNormalizationError("website_url", "ugyldig domene");
  }
  parsed.hostname = domain;
  parsed.hash = "";
  return { url: parsed.toString(), domain };
}

export function normalizeLeadDraft(input: LeadDraftInput): NormalizedLeadDraft {
  const website = normalizeWebsite(input.website_url);
  const rawOrgNumber = cleaned(input.organization_number);
  let organizationNumber: string | null = null;
  if (rawOrgNumber) {
    const digits = rawOrgNumber.replace(/\D/g, "");
    if (digits.length !== 9 || extractOrgNrFromText(digits) !== digits) {
      throw new LeadDraftNormalizationError(
        "organization_number",
        "må være et gyldig norsk organisasjonsnummer",
      );
    }
    organizationNumber = digits;
  }
  const email = cleaned(input.email)?.toLowerCase() ?? null;
  const phone = cleaned(input.phone);
  const phoneDigits = phone?.replace(/\D/g, "") || null;
  const country = cleaned(input.country)?.toUpperCase() ?? null;

  return {
    creationId: input.creation_id,
    organizationId: input.organization_id ?? null,
    name: input.name.replace(/\s+/g, " ").trim(),
    company: cleaned(input.company),
    organizationNumber,
    websiteUrl: website.url,
    websiteDomain: website.domain,
    contactName: cleaned(input.contact_name),
    contactRole: cleaned(input.contact_role),
    email,
    phone,
    phoneDigits,
    address: cleaned(input.address),
    postalCode: cleaned(input.postal_code),
    city: cleaned(input.city),
    country,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    googlePlaceId: cleaned(input.google_place_id),
    industryId: input.industry_id ?? null,
    industry: cleaned(input.industry),
    employeeCountEstimate: input.employee_count_estimate ?? null,
    annualRevenueNokEstimate: input.annual_revenue_nok_estimate ?? null,
    estimatedValue: input.estimated_value ?? null,
    notes: cleaned(input.notes),
    leadTemperature: input.lead_temperature,
    pipelineStage: input.pipeline_stage,
    leadStatus: input.lead_status,
    nextFollowUpAt: input.next_follow_up_at ?? null,
    nextAction: cleaned(input.next_action),
    locationConfidence: input.location_confidence,
    leadSource: input.lead_source,
    projectId: input.project_id ?? null,
    rawText: cleaned(input.raw_text),
    allowDuplicate: input.allow_duplicate,
  };
}

function requestHash(draft: NormalizedLeadDraft): string {
  const { allowDuplicate: _allowDuplicate, ...persistedInput } = draft;
  return createHash("sha256").update(JSON.stringify(persistedInput)).digest("hex");
}


function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusM = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export async function findLeadDuplicates(
  db: Queryable,
  organizationId: string,
  draft: NormalizedLeadDraft,
): Promise<LeadDuplicateCandidate[]> {
  const params: unknown[] = [organizationId];
  const clauses: string[] = [];
  const add = (value: unknown, expression: (position: number) => string) => {
    params.push(value);
    clauses.push(expression(params.length));
  };

  if (draft.organizationNumber) {
    add(draft.organizationNumber, (position) => `enrichment_org_nr = $${position}`);
  }
  if (draft.googlePlaceId) {
    add(draft.googlePlaceId, (position) => `google_place_id = $${position}`);
  }
  if (draft.websiteDomain) {
    add(draft.websiteDomain, (position) => `website_domain_normalized = $${position}`);
  }
  if (draft.email) {
    add(draft.email, (position) => `email_normalized = $${position}`);
  }
  if (draft.phoneDigits && draft.phoneDigits.length >= 8) {
    add(draft.phoneDigits.slice(-8), (position) =>
      `phone_normalized = $${position}`,
    );
  }
  if (draft.city) {
    params.push(draft.name.toLowerCase(), draft.city.toLowerCase());
    clauses.push(`(LOWER(name) = $${params.length - 1} AND LOWER(COALESCE(city, '')) = $${params.length})`);
  }
  if (draft.latitude !== null && draft.longitude !== null) {
    // Grovt indeksvennlig vindu først; Haversine nedenfor avgjør <= 30 m.
    params.push(
      draft.latitude - 0.0003,
      draft.latitude + 0.0003,
      draft.longitude - 0.0006,
      draft.longitude + 0.0006,
    );
    const first = params.length - 3;
    clauses.push(
      "(latitude BETWEEN $" + first + " AND $" + (first + 1) +
      " AND longitude BETWEEN $" + (first + 2) + " AND $" + (first + 3) + ")",
    );
  }
  if (clauses.length === 0) return [];

  const result = await db.query<DuplicateRow>(
    `SELECT id::text, name, company, email, email_normalized,
            phone, phone_normalized, website_url,
            website_domain_normalized, address, city,
            enrichment_org_nr, google_place_id, latitude, longitude
       FROM crm_customers
      WHERE organization_id = $1::uuid
        AND archived_at IS NULL
        AND (${clauses.join(" OR ")})
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 20`,
    params,
  );

  const candidates = result.rows.map((row) => {
    const reasons: LeadDuplicateCandidate["matchReasons"] = [];
    if (draft.organizationNumber && row.enrichment_org_nr === draft.organizationNumber) {
      reasons.push("organization_number");
    }
    if (draft.googlePlaceId && row.google_place_id === draft.googlePlaceId) {
      reasons.push("google_place");
    }
    if (draft.websiteDomain && row.website_domain_normalized === draft.websiteDomain) {
      reasons.push("website_domain");
    }
    if (draft.email && row.email_normalized === draft.email) reasons.push("email");
    if (
      draft.phoneDigits &&
      draft.phoneDigits.length >= 8 &&
      row.phone_normalized === draft.phoneDigits.slice(-8)
    ) {
      reasons.push("phone");
    }
    if (
      draft.city &&
      row.name.toLowerCase() === draft.name.toLowerCase() &&
      row.city?.toLowerCase() === draft.city.toLowerCase()
    ) {
      reasons.push("name_city");
    }
    const rowLatitude = row.latitude === null ? null : Number(row.latitude);
    const rowLongitude = row.longitude === null ? null : Number(row.longitude);
    if (
      draft.latitude !== null &&
      draft.longitude !== null &&
      rowLatitude !== null &&
      rowLongitude !== null &&
      Number.isFinite(rowLatitude) &&
      Number.isFinite(rowLongitude) &&
      distanceMeters(draft.latitude, draft.longitude, rowLatitude, rowLongitude) <= 30
    ) {
      reasons.push("coordinates");
    }
    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      websiteUrl: row.website_url,
      address: row.address,
      city: row.city,
      matchReasons: reasons,
    };
  });

  return candidates.filter((candidate) => candidate.matchReasons.length > 0).slice(0, 5);
}

async function validateReferences(
  db: Queryable,
  organizationId: string,
  draft: NormalizedLeadDraft,
): Promise<void> {
  if (draft.projectId) {
    const project = await db.query(
      `SELECT 1 FROM casting_projects
        WHERE id = $1 AND organization_id = $2::uuid
        LIMIT 1`,
      [draft.projectId, organizationId],
    );
    if (project.rowCount !== 1) {
      throw new LeadScopeValidationError("project_not_in_organization");
    }
  }
  if (draft.industryId) {
    const industry = await db.query(
      `SELECT 1 FROM industries
        WHERE id = $1::uuid
          AND is_active = TRUE
          AND (scope = 'global' OR organization_id = $2::uuid)
        LIMIT 1`,
      [draft.industryId, organizationId],
    );
    if (industry.rowCount !== 1) {
      throw new LeadScopeValidationError("industry_not_available");
    }
  }
}

export async function createLeadFromDraft(
  pool: Pool,
  context: {
    organizationId: string;
    userId: string;
    draft: NormalizedLeadDraft;
    /** Original normalized client payload, before deterministic server enrichment. */
    idempotencyDraft?: NormalizedLeadDraft;
  },
): Promise<LeadCreationResult> {
  if (context.draft.organizationId && context.draft.organizationId !== context.organizationId) {
    throw new LeadScopeValidationError("organization_mismatch");
  }

  const client = await pool.connect();
  const hash = requestHash(context.idempotencyDraft ?? context.draft);
  try {
    await client.query("BEGIN");
    // Serialiser det korte check+insert-vinduet per organisasjon. Ulike
    // workspaces blokkerer aldri hverandre, mens to samtidige like leads
    // ikke kan passere duplikatsjekken før den første transaksjonen committer.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`leadgrid-lead-create:${context.organizationId}`],
    );

    const replay = await client.query<{ id: string; creation_request_hash: string | null }>(
      `SELECT id::text, creation_request_hash
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND creation_idempotency_key = $2::uuid
        LIMIT 1`,
      [context.organizationId, context.draft.creationId],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].creation_request_hash !== hash) {
        throw new LeadIdempotencyConflictError();
      }
      await client.query("COMMIT");
      return {
        id: replay.rows[0].id,
        created: false,
        replayed: true,
        duplicatesChecked: 0,
      };
    }

    const duplicates = await findLeadDuplicates(client, context.organizationId, context.draft);
    if (duplicates.length > 0 && !context.draft.allowDuplicate) {
      throw new LeadDuplicateConflictError(duplicates);
    }

    await validateReferences(client, context.organizationId, context.draft);

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO crm_customers (
         id, name, company, contact_name, contact_role, email, phone,
         website_url, website_domain_normalized,
         address, postal_code, city, country, latitude, longitude,
         location_confidence, enrichment_org_nr, google_place_id,
         industry_id, lead_category, employee_count_estimate,
         annual_revenue_nok_estimate, estimated_value, notes,
         lead_temperature, pipeline_stage, lead_status, lead_source,
         next_follow_up_at, next_action,
         status, owner_user_id, assigned_user_id, assigned_at,
         assigned_by_user_id, organization_id, project_id,
         creation_idempotency_key, creation_request_hash,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6,
         $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17,
         $18::uuid, $19, $20,
         $21, $22, $23,
         $24, $25, $26, $27,
         $28::timestamptz, $29,
         'lead', $30, $30, NOW(),
         $30, $31::uuid, $32,
         $33::uuid, $34,
         NOW(), NOW()
       )
       ON CONFLICT DO NOTHING
       RETURNING id::text`,
      [
        context.draft.name,
        context.draft.company,
        context.draft.contactName,
        context.draft.contactRole,
        context.draft.email,
        context.draft.phone,
        context.draft.websiteUrl,
        context.draft.websiteDomain,
        context.draft.address,
        context.draft.postalCode,
        context.draft.city,
        context.draft.country,
        context.draft.latitude,
        context.draft.longitude,
        context.draft.locationConfidence,
        context.draft.organizationNumber,
        context.draft.googlePlaceId,
        context.draft.industryId,
        context.draft.industry,
        context.draft.employeeCountEstimate,
        context.draft.annualRevenueNokEstimate,
        context.draft.estimatedValue,
        context.draft.notes,
        context.draft.leadTemperature,
        context.draft.pipelineStage,
        context.draft.leadStatus,
        context.draft.leadSource,
        context.draft.nextFollowUpAt,
        context.draft.nextAction,
        context.userId,
        context.organizationId,
        context.draft.projectId,
        context.draft.creationId,
        hash,
      ],
    );

    let id = inserted.rows[0]?.id;
    let created = Boolean(id);
    if (!id) {
      const concurrentReplay = await client.query<{ id: string; creation_request_hash: string | null }>(
        `SELECT id::text, creation_request_hash
           FROM crm_customers
          WHERE organization_id = $1::uuid
            AND creation_idempotency_key = $2::uuid
          LIMIT 1`,
        [context.organizationId, context.draft.creationId],
      );
      const row = concurrentReplay.rows[0];
      if (!row) throw new Error("lead_create_conflict_without_replay");
      if (row.creation_request_hash !== hash) throw new LeadIdempotencyConflictError();
      id = row.id;
    }

    if (created) {
      const occurredAt = new Date().toISOString();
      if (context.draft.organizationNumber) {
        await enqueueJob(client, {
          jobType: "lead_brreg_enrich",
          payload: { leadId: id, ownerUserId: context.userId },
          dedupeKey: "lead_brreg_enrich|" + id,
          createdBy: context.userId,
        });
      }
      await enqueueJob(client, {
        jobType: "leadgrid_workflow_event",
        payload: {
          organizationId: context.organizationId,
          leadId: id,
          actorUserId: context.userId,
          source: context.draft.leadSource,
          occurredAt,
        },
        dedupeKey: "leadgrid_workflow_event|lead.created|" + id,
        maxAttempts: 5,
        createdBy: context.userId,
      });
    }

    await client.query("COMMIT");
    return {
      id,
      created,
      replayed: !created,
      duplicatesChecked: duplicates.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}
