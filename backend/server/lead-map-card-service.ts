import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { LeadCreationIdempotencyConflictError } from "./lead-map-service.js";
import { normalizeWebsiteDomain } from "./lead-map-create-contract.js";

export interface CardLeadCreationInput {
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string;
  projectId: string | null;
  leadSource: "business_card_scan" | "doffin_anbud";
  organizationNumber: string | null;
  ownerUserId: string;
  organizationId: string;
  idempotencyKey: string | null;
}

export interface CardLeadCreationResult {
  id: string;
  created: boolean;
  idempotentReplay: boolean;
  duplicateMatch: "organization_number" | "domain" | "email" | null;
}

export class CardLeadProjectScopeError extends Error {
  constructor() {
    super("project_not_in_organization");
    this.name = "CardLeadProjectScopeError";
  }
}

function requestHash(input: CardLeadCreationInput): string {
  const stablePayload = {
    name: input.name,
    title: input.title,
    company: input.company,
    email: input.email,
    phone: input.phone,
    website: input.website,
    notes: input.notes,
    projectId: input.projectId,
    leadSource: input.leadSource,
    organizationNumber: input.organizationNumber,
    organizationId: input.organizationId,
  };
  return createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");
}

/** Retry-safe, workspace-scoped persistence shared by card and Doffin flows. */
export async function createCardLead(
  pool: Pool,
  input: CardLeadCreationInput,
): Promise<CardLeadCreationResult> {
  const client = await pool.connect();
  const hash = input.idempotencyKey ? requestHash(input) : null;
  const domain = normalizeWebsiteDomain(input.website);
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const naturalKey = input.organizationNumber
    ? `orgnr:${input.organizationNumber}`
    : domain
      ? `domain:${domain}`
      : normalizedEmail
        ? `email:${normalizedEmail}`
        : null;
  try {
    await client.query("BEGIN");

    if (input.projectId) {
      const project = await client.query(
        `SELECT 1 FROM leadgrid_projects
          WHERE id = $1 AND organization_id = $2::uuid AND archived_at IS NULL
          LIMIT 1`,
        [input.projectId, input.organizationId],
      );
      if (!project.rows.length) throw new CardLeadProjectScopeError();
    }

    if (input.idempotencyKey) {
      const existing = await client.query<{
        id: string;
        creation_request_hash: string | null;
      }>(
        `SELECT id::text, creation_request_hash
           FROM crm_customers
          WHERE organization_id = $1::uuid
            AND creation_idempotency_key = $2::uuid
          LIMIT 1`,
        [input.organizationId, input.idempotencyKey],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.creation_request_hash !== hash) {
          throw new LeadCreationIdempotencyConflictError(row.id);
        }
        await client.query("COMMIT");
        return {
          id: row.id,
          created: false,
          idempotentReplay: true,
          duplicateMatch: null,
        };
      }
    }

    // Serialize equal natural identities inside one workspace. Without this,
    // two devices can both pass the duplicate SELECT before either INSERT.
    if (naturalKey) {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`leadgrid-card:${input.organizationId}:${naturalKey}`],
      );
      const duplicate = await client.query<{ id: string; duplicate_match: "organization_number" | "domain" | "email" }>(
        `SELECT id::text,
                CASE
                  WHEN $2::text IS NOT NULL AND enrichment_org_nr = $2 THEN 'organization_number'
                  WHEN $3::text IS NOT NULL AND website_domain_normalized = $3 THEN 'domain'
                  ELSE 'email'
                END AS duplicate_match
           FROM crm_customers
          WHERE organization_id = $1::uuid
            AND archived_at IS NULL
            AND (
              ($2::text IS NOT NULL AND enrichment_org_nr = $2)
              OR ($3::text IS NOT NULL AND website_domain_normalized = $3)
              OR ($4::text IS NOT NULL AND lower(email) = $4)
            )
          ORDER BY updated_at DESC
          LIMIT 1`,
        [input.organizationId, input.organizationNumber, domain, normalizedEmail],
      );
      const existing = duplicate.rows[0];
      if (existing) {
        await client.query("COMMIT");
        return {
          id: existing.id,
          created: false,
          idempotentReplay: false,
          duplicateMatch: existing.duplicate_match,
        };
      }
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO crm_customers (
         id, name, company, contact_name, contact_role,
         phone, email, website_url, website_domain_normalized,
         lead_status, lead_source, source, status,
         owner_user_id, organization_id, assigned_user_id,
         assigned_at, assigned_by_user_id, project_id, notes,
         enrichment_org_nr, creation_idempotency_key, creation_request_hash,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $1, $3,
         $4, $5, $6, $7,
         'unvisited', $8, $8, 'lead',
         $9, $10::uuid, $9,
         NOW(), $9, $11, $12,
         $13, $14::uuid, $15,
         NOW(), NOW()
       )
       ON CONFLICT (organization_id, creation_idempotency_key)
         WHERE organization_id IS NOT NULL
           AND creation_idempotency_key IS NOT NULL
       DO NOTHING
       RETURNING id::text`,
      [
        input.name,
        input.company,
        input.title,
        input.phone,
        input.email,
        input.website,
        domain,
        input.leadSource,
        input.ownerUserId,
        input.organizationId,
        input.projectId,
        input.notes,
        input.organizationNumber,
        input.idempotencyKey,
        hash,
      ],
    );

    const row = inserted.rows[0];
    if (row) {
      await client.query(
        `INSERT INTO crm_lead_activities
           (customer_id, user_id, activity_type, description, metadata)
         VALUES ($1::uuid, $2, 'lead_created', $3, $4::jsonb)`,
        [
          row.id,
          input.ownerUserId,
          input.leadSource === "doffin_anbud" ? "Lead opprettet fra anbud" : "Lead opprettet fra visittkort",
          JSON.stringify({ source: input.leadSource, organizationId: input.organizationId }),
        ],
      );
      await client.query("COMMIT");
      return {
        id: row.id,
        created: true,
        idempotentReplay: false,
        duplicateMatch: null,
      };
    }

    const replayed = await client.query<{
      id: string;
      creation_request_hash: string | null;
    }>(
      `SELECT id::text, creation_request_hash
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND creation_idempotency_key = $2::uuid
        LIMIT 1`,
      [input.organizationId, input.idempotencyKey],
    );
    const replay = replayed.rows[0];
    if (!replay || replay.creation_request_hash !== hash) {
      throw new LeadCreationIdempotencyConflictError(replay?.id ?? "");
    }
    await client.query("COMMIT");
    return {
      id: replay.id,
      created: false,
      idempotentReplay: true,
      duplicateMatch: null,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
