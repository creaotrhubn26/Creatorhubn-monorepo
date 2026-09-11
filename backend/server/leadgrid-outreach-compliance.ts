import type { Pool } from "pg";

export type LeadgridEmailAddressClassification =
  | "unknown"
  | "verified_shared"
  | "named_person";

export type LeadgridEmailAuthorization =
  | "none"
  | "verified_shared"
  | "documented_consent"
  | "existing_customer";

export type LeadgridEmailComplianceReason =
  | "permitted_verified_shared"
  | "permitted_documented_consent"
  | "permitted_existing_customer"
  | "blocked_no_email"
  | "blocked_suppressed"
  | "blocked_gdpr_basis_missing"
  | "blocked_named_person_without_permission"
  | "blocked_unknown_address";

export interface LeadgridEmailConsentState {
  action: "grant" | "withdraw";
  contactName: string;
  purpose: string;
  consentText: string;
  consentVersion: string;
  source: string;
  evidence: string;
  occurredAt: string;
  expiresAt: string | null;
}

export interface LeadgridExistingCustomerState {
  active: boolean;
  source: string | null;
  relationship: string | null;
  similarServices: string | null;
  electronicAddressProvidedAt: string | null;
  collectionOptOutOfferedAt: string | null;
  attestedAt: string | null;
}

export interface LeadgridGdprProcessingState {
  documented: boolean;
  dataSubjectName: string | null;
  legalBasis: string | null;
  purpose: string | null;
  source: string | null;
  collectedAt: string | null;
  retentionUntil: string | null;
  legitimateInterestGoal: string | null;
  necessityAssessment: string | null;
  balancingAssessment: string | null;
  safeguards: string | null;
  indirectCollection: boolean;
  privacyNoticeStatus: "pending" | "sent" | "exempt" | null;
  privacyNoticeSentAt: string | null;
  privacyNoticeMethod: string | null;
  privacyNoticeReference: string | null;
}

export interface LeadgridEmailComplianceFacts {
  email: string | null;
  addressClassification: LeadgridEmailAddressClassification;
  isSuppressed: boolean;
  consent: LeadgridEmailConsentState | null;
  existingCustomer: LeadgridExistingCustomerState;
  gdprProcessing: LeadgridGdprProcessingState;
}

export interface LeadgridEmailComplianceDecision
  extends LeadgridEmailComplianceFacts {
  normalizedEmail: string | null;
  addressTypeHint: LeadgridEmailAddressClassification;
  allowed: boolean;
  authorization: LeadgridEmailAuthorization;
  reason: LeadgridEmailComplianceReason;
}

const SHARED_LOCAL_PARTS = new Set([
  "admin",
  "booking",
  "firmapost",
  "hello",
  "hei",
  "info",
  "kontakt",
  "kundeservice",
  "office",
  "post",
  "resepsjon",
  "salg",
  "sales",
  "service",
  "support",
]);

export function normalizeLeadgridEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3
    || email.length > 320
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) return null;
  return email;
}

/** A display-only hint. It can never authorize an outbound message. */
export function leadgridEmailAddressTypeHint(
  email: string | null | undefined,
): LeadgridEmailAddressClassification {
  const normalized = normalizeLeadgridEmail(email);
  if (!normalized) return "unknown";
  const localPart = normalized.split("@", 1)[0];
  return SHARED_LOCAL_PARTS.has(localPart) ? "verified_shared" : "unknown";
}

export function evaluateLeadgridEmailCompliance(
  facts: LeadgridEmailComplianceFacts,
  now = new Date(),
): LeadgridEmailComplianceDecision {
  const normalizedEmail = normalizeLeadgridEmail(facts.email);
  const base = {
    ...facts,
    normalizedEmail,
    addressTypeHint: leadgridEmailAddressTypeHint(normalizedEmail),
  };
  if (!normalizedEmail) {
    return {
      ...base,
      allowed: false,
      authorization: "none",
      reason: "blocked_no_email",
    };
  }
  // A recorded objection/unsubscribe always wins, including over an older
  // consent or customer relationship. Removing this requires a separate,
  // deliberate compliance process; no send path can bypass it.
  if (facts.isSuppressed) {
    return {
      ...base,
      allowed: false,
      authorization: "none",
      reason: "blocked_suppressed",
    };
  }
  // Unknown remains blocked even if someone has attached a consent/customer
  // record. The sender must first resolve whether the mailbox is shared or
  // belongs to a person; this is what prevents an ambiguous public address
  // from being treated as permission.
  if (facts.addressClassification === "unknown") {
    return {
      ...base,
      allowed: false,
      authorization: "none",
      reason: "blocked_unknown_address",
    };
  }
  if (facts.addressClassification === "verified_shared") {
    return {
      ...base,
      allowed: true,
      authorization: "verified_shared",
      reason: "permitted_verified_shared",
    };
  }
  const gdpr = facts.gdprProcessing;
  const gdprRecordIsActive = gdpr.documented
    && Boolean(gdpr.legalBasis)
    && Boolean(gdpr.purpose)
    && Boolean(gdpr.source)
    && Boolean(gdpr.collectedAt)
    && Boolean(gdpr.retentionUntil)
    && new Date(gdpr.retentionUntil!).getTime() > now.getTime();
  const consentIsActive = facts.consent?.action === "grant"
    && (!facts.consent.expiresAt || new Date(facts.consent.expiresAt) > now);
  if (consentIsActive && gdprRecordIsActive) {
    return {
      ...base,
      allowed: true,
      authorization: "documented_consent",
      reason: "permitted_documented_consent",
    };
  }
  const customer = facts.existingCustomer;
  const customerExceptionIsDocumented = customer.active
    && Boolean(customer.source)
    && Boolean(customer.relationship)
    && Boolean(customer.similarServices)
    && Boolean(customer.electronicAddressProvidedAt)
    && Boolean(customer.collectionOptOutOfferedAt)
    && Boolean(customer.attestedAt);
  if (customerExceptionIsDocumented && gdprRecordIsActive) {
    return {
      ...base,
      allowed: true,
      authorization: "existing_customer",
      reason: "permitted_existing_customer",
    };
  }
  if ((consentIsActive || customerExceptionIsDocumented) && !gdprRecordIsActive) {
    return {
      ...base,
      allowed: false,
      authorization: "none",
      reason: "blocked_gdpr_basis_missing",
    };
  }
  if (facts.addressClassification === "named_person") {
    return {
      ...base,
      allowed: false,
      authorization: "none",
      reason: "blocked_named_person_without_permission",
    };
  }
  return {
    ...base,
    allowed: false,
    authorization: "none",
    reason: "blocked_unknown_address",
  };
}

interface ComplianceRow {
  address_classification: LeadgridEmailAddressClassification | null;
  existing_customer_active: boolean | null;
  existing_customer_source: string | null;
  existing_customer_relationship: string | null;
  existing_customer_similar_services: string | null;
  electronic_address_provided_at: Date | string | null;
  collection_opt_out_offered_at: Date | string | null;
  existing_customer_attested_at: Date | string | null;
  suppression_reason: string | null;
  consent_action: "grant" | "withdraw" | null;
  consent_contact_name: string | null;
  consent_purpose: string | null;
  consent_text: string | null;
  consent_version: string | null;
  consent_source: string | null;
  consent_evidence: string | null;
  consent_occurred_at: Date | string | null;
  consent_expires_at: Date | string | null;
  gdpr_data_subject_name: string | null;
  gdpr_legal_basis: string | null;
  gdpr_purpose: string | null;
  gdpr_source: string | null;
  gdpr_collected_at: Date | string | null;
  gdpr_retention_until: Date | string | null;
  gdpr_legitimate_interest_goal: string | null;
  gdpr_necessity_assessment: string | null;
  gdpr_balancing_assessment: string | null;
  gdpr_safeguards: string | null;
  gdpr_indirect_collection: boolean | null;
  gdpr_privacy_notice_status: "pending" | "sent" | "exempt" | null;
  gdpr_privacy_notice_sent_at: Date | string | null;
  gdpr_privacy_notice_method: string | null;
  gdpr_privacy_notice_reference: string | null;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getLeadgridEmailCompliance(
  pool: Pick<Pool, "query">,
  input: { organizationId: string; email: string | null | undefined },
): Promise<LeadgridEmailComplianceDecision> {
  const normalizedEmail = normalizeLeadgridEmail(input.email);
  if (!normalizedEmail) {
    return evaluateLeadgridEmailCompliance({
      email: null,
      addressClassification: "unknown",
      isSuppressed: false,
      consent: null,
      existingCustomer: {
        active: false,
        source: null,
        relationship: null,
        similarServices: null,
        electronicAddressProvidedAt: null,
        collectionOptOutOfferedAt: null,
        attestedAt: null,
      },
      gdprProcessing: {
        documented: false,
        dataSubjectName: null,
        legalBasis: null,
        purpose: null,
        source: null,
        collectedAt: null,
        retentionUntil: null,
        legitimateInterestGoal: null,
        necessityAssessment: null,
        balancingAssessment: null,
        safeguards: null,
        indirectCollection: true,
        privacyNoticeStatus: null,
        privacyNoticeSentAt: null,
        privacyNoticeMethod: null,
        privacyNoticeReference: null,
      },
    });
  }

  const result = await pool.query<ComplianceRow>(
    `SELECT p.address_classification,
            p.existing_customer_active,
            p.existing_customer_source,
            p.existing_customer_relationship,
            p.existing_customer_similar_services,
            p.electronic_address_provided_at,
            p.collection_opt_out_offered_at,
            p.existing_customer_attested_at,
            s.reason AS suppression_reason,
            c.action AS consent_action,
            c.contact_name AS consent_contact_name,
            c.purpose AS consent_purpose,
            c.consent_text,
            c.consent_version,
            c.source AS consent_source,
            c.evidence AS consent_evidence,
            c.occurred_at AS consent_occurred_at,
            c.expires_at AS consent_expires_at,
            g.data_subject_name AS gdpr_data_subject_name,
            g.legal_basis AS gdpr_legal_basis,
            g.purpose AS gdpr_purpose,
            g.source AS gdpr_source,
            g.collected_at AS gdpr_collected_at,
            g.retention_until AS gdpr_retention_until,
            g.legitimate_interest_goal AS gdpr_legitimate_interest_goal,
            g.necessity_assessment AS gdpr_necessity_assessment,
            g.balancing_assessment AS gdpr_balancing_assessment,
            g.safeguards AS gdpr_safeguards,
            g.indirect_collection AS gdpr_indirect_collection,
            g.privacy_notice_status AS gdpr_privacy_notice_status,
            g.privacy_notice_sent_at AS gdpr_privacy_notice_sent_at,
            g.privacy_notice_method AS gdpr_privacy_notice_method,
            g.privacy_notice_reference AS gdpr_privacy_notice_reference
       FROM (SELECT $1::uuid AS organization_id, $2::text AS email_normalized) wanted
       LEFT JOIN leadgrid_email_compliance_profiles p
         ON p.organization_id = wanted.organization_id
        AND p.email_normalized = wanted.email_normalized
       LEFT JOIN leadgrid_email_suppressions s
         ON s.organization_id = wanted.organization_id
        AND s.email_normalized = wanted.email_normalized
       LEFT JOIN leadgrid_email_gdpr_processing_records g
         ON g.organization_id = wanted.organization_id
        AND g.email_normalized = wanted.email_normalized
       LEFT JOIN LATERAL (
         SELECT action, contact_name, purpose, consent_text, consent_version,
                source, evidence, occurred_at, expires_at
           FROM leadgrid_email_marketing_consent_events
          WHERE organization_id = wanted.organization_id
            AND email_normalized = wanted.email_normalized
          ORDER BY occurred_at DESC, created_at DESC
          LIMIT 1
       ) c ON TRUE`,
    [input.organizationId, normalizedEmail],
  );
  const row = result.rows[0];
  const consent = row?.consent_action && row.consent_contact_name
    && row.consent_purpose && row.consent_text && row.consent_version
    && row.consent_source && row.consent_evidence && row.consent_occurred_at
    ? {
      action: row.consent_action,
      contactName: row.consent_contact_name,
      purpose: row.consent_purpose,
      consentText: row.consent_text,
      consentVersion: row.consent_version,
      source: row.consent_source,
      evidence: row.consent_evidence,
      occurredAt: iso(row.consent_occurred_at)!,
      expiresAt: iso(row.consent_expires_at),
    }
    : null;
  return evaluateLeadgridEmailCompliance({
    email: normalizedEmail,
    addressClassification: row?.address_classification ?? "unknown",
    isSuppressed: Boolean(row?.suppression_reason),
    consent,
    existingCustomer: {
      active: row?.existing_customer_active === true,
      source: row?.existing_customer_source ?? null,
      relationship: row?.existing_customer_relationship ?? null,
      similarServices: row?.existing_customer_similar_services ?? null,
      electronicAddressProvidedAt: iso(row?.electronic_address_provided_at ?? null),
      collectionOptOutOfferedAt: iso(row?.collection_opt_out_offered_at ?? null),
      attestedAt: iso(row?.existing_customer_attested_at ?? null),
    },
    gdprProcessing: {
      documented: Boolean(row?.gdpr_legal_basis),
      dataSubjectName: row?.gdpr_data_subject_name ?? null,
      legalBasis: row?.gdpr_legal_basis ?? null,
      purpose: row?.gdpr_purpose ?? null,
      source: row?.gdpr_source ?? null,
      collectedAt: iso(row?.gdpr_collected_at ?? null),
      retentionUntil: iso(row?.gdpr_retention_until ?? null),
      legitimateInterestGoal: row?.gdpr_legitimate_interest_goal ?? null,
      necessityAssessment: row?.gdpr_necessity_assessment ?? null,
      balancingAssessment: row?.gdpr_balancing_assessment ?? null,
      safeguards: row?.gdpr_safeguards ?? null,
      indirectCollection: row?.gdpr_indirect_collection ?? true,
      privacyNoticeStatus: row?.gdpr_privacy_notice_status ?? null,
      privacyNoticeSentAt: iso(row?.gdpr_privacy_notice_sent_at ?? null),
      privacyNoticeMethod: row?.gdpr_privacy_notice_method ?? null,
      privacyNoticeReference: row?.gdpr_privacy_notice_reference ?? null,
    },
  });
}

export async function recordLeadgridGdprProcessing(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    email: string;
    dataSubjectName: string;
    legalBasis: "consent" | "contract" | "legal_obligation" | "vital_interests" | "public_task" | "legitimate_interests";
    purpose: string;
    source: string;
    collectedAt: string;
    retentionUntil: string;
    legitimateInterestGoal: string | null;
    necessityAssessment: string | null;
    balancingAssessment: string | null;
    safeguards: string | null;
    indirectCollection: boolean;
    privacyNoticeStatus: "pending" | "sent" | "exempt";
    privacyNoticeSentAt: string | null;
    privacyNoticeMethod: string | null;
    privacyNoticeReference: string | null;
    actorUserId: string;
  },
): Promise<void> {
  const email = normalizeLeadgridEmail(input.email);
  if (!email) throw new Error("invalid_email");
  await pool.query(
    `INSERT INTO leadgrid_email_gdpr_processing_records
       (organization_id, email_normalized, data_subject_name, legal_basis,
        purpose, source, collected_at, retention_until,
        legitimate_interest_goal, necessity_assessment, balancing_assessment,
        safeguards, indirect_collection, privacy_notice_status,
        privacy_notice_sent_at, privacy_notice_method,
        privacy_notice_reference, recorded_by_user_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::timestamptz,
             $8::timestamptz, $9, $10, $11, $12, $13, $14,
             $15::timestamptz, $16, $17, $18)
     ON CONFLICT (organization_id, email_normalized) DO UPDATE
       SET data_subject_name = EXCLUDED.data_subject_name,
           legal_basis = EXCLUDED.legal_basis,
           purpose = EXCLUDED.purpose,
           source = EXCLUDED.source,
           collected_at = EXCLUDED.collected_at,
           retention_until = EXCLUDED.retention_until,
           legitimate_interest_goal = EXCLUDED.legitimate_interest_goal,
           necessity_assessment = EXCLUDED.necessity_assessment,
           balancing_assessment = EXCLUDED.balancing_assessment,
           safeguards = EXCLUDED.safeguards,
           indirect_collection = EXCLUDED.indirect_collection,
           privacy_notice_status = EXCLUDED.privacy_notice_status,
           privacy_notice_sent_at = EXCLUDED.privacy_notice_sent_at,
           privacy_notice_method = EXCLUDED.privacy_notice_method,
           privacy_notice_reference = EXCLUDED.privacy_notice_reference,
           recorded_by_user_id = EXCLUDED.recorded_by_user_id,
           updated_at = NOW()`,
    [
      input.organizationId, email, input.dataSubjectName, input.legalBasis,
      input.purpose, input.source, input.collectedAt, input.retentionUntil,
      input.legitimateInterestGoal, input.necessityAssessment,
      input.balancingAssessment, input.safeguards, input.indirectCollection,
      input.privacyNoticeStatus, input.privacyNoticeSentAt,
      input.privacyNoticeMethod, input.privacyNoticeReference,
      input.actorUserId,
    ],
  );
}

export async function setLeadgridEmailAddressClassification(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    email: string;
    classification: LeadgridEmailAddressClassification;
    source: string;
    evidence: string;
    actorUserId: string;
  },
): Promise<void> {
  const email = normalizeLeadgridEmail(input.email);
  if (!email) throw new Error("invalid_email");
  await pool.query(
    `INSERT INTO leadgrid_email_compliance_profiles
       (organization_id, email_normalized, address_classification,
        classification_source, classification_evidence,
        classification_verified_at, classification_verified_by_user_id)
     VALUES ($1::uuid, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (organization_id, email_normalized) DO UPDATE
       SET address_classification = EXCLUDED.address_classification,
           classification_source = EXCLUDED.classification_source,
           classification_evidence = EXCLUDED.classification_evidence,
           classification_verified_at = NOW(),
           classification_verified_by_user_id = EXCLUDED.classification_verified_by_user_id,
           updated_at = NOW()`,
    [
      input.organizationId,
      email,
      input.classification,
      input.source,
      input.evidence,
      input.actorUserId,
    ],
  );
}

export async function recordLeadgridEmailConsent(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    email: string;
    action: "grant" | "withdraw";
    contactName: string;
    purpose: string;
    consentText: string;
    consentVersion: string;
    source: string;
    evidence: string;
    occurredAt: string;
    expiresAt: string | null;
    actorUserId: string;
  },
): Promise<void> {
  const email = normalizeLeadgridEmail(input.email);
  if (!email) throw new Error("invalid_email");
  await pool.query(
    `INSERT INTO leadgrid_email_marketing_consent_events
       (organization_id, email_normalized, action, contact_name, purpose,
        consent_text, consent_version, source, evidence, occurred_at,
        expires_at, recorded_by_user_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9,
             $10::timestamptz, $11::timestamptz, $12)`,
    [
      input.organizationId,
      email,
      input.action,
      input.contactName,
      input.purpose,
      input.consentText,
      input.consentVersion,
      input.source,
      input.evidence,
      input.occurredAt,
      input.expiresAt,
      input.actorUserId,
    ],
  );
}

export async function attestLeadgridExistingCustomer(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    email: string;
    source: string;
    relationship: string;
    similarServices: string;
    electronicAddressProvidedAt: string;
    collectionOptOutOfferedAt: string;
    actorUserId: string;
  },
): Promise<void> {
  const email = normalizeLeadgridEmail(input.email);
  if (!email) throw new Error("invalid_email");
  await pool.query(
    `INSERT INTO leadgrid_email_compliance_profiles
       (organization_id, email_normalized, existing_customer_active,
        existing_customer_source, existing_customer_relationship,
        existing_customer_similar_services, electronic_address_provided_at,
        collection_opt_out_offered_at, existing_customer_attested_at,
        existing_customer_attested_by_user_id)
     VALUES ($1::uuid, $2, TRUE, $3, $4, $5, $6::timestamptz,
             $7::timestamptz, NOW(), $8)
     ON CONFLICT (organization_id, email_normalized) DO UPDATE
       SET existing_customer_active = TRUE,
           existing_customer_source = EXCLUDED.existing_customer_source,
           existing_customer_relationship = EXCLUDED.existing_customer_relationship,
           existing_customer_similar_services = EXCLUDED.existing_customer_similar_services,
           electronic_address_provided_at = EXCLUDED.electronic_address_provided_at,
           collection_opt_out_offered_at = EXCLUDED.collection_opt_out_offered_at,
           existing_customer_attested_at = NOW(),
           existing_customer_attested_by_user_id = EXCLUDED.existing_customer_attested_by_user_id,
           updated_at = NOW()`,
    [
      input.organizationId,
      email,
      input.source,
      input.relationship,
      input.similarServices,
      input.electronicAddressProvidedAt,
      input.collectionOptOutOfferedAt,
      input.actorUserId,
    ],
  );
}

export async function suppressLeadgridEmail(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    email: string;
    reason: "recipient_objection" | "unsubscribe" | "manual_block" | "hard_bounce" | "complaint";
    source: string;
    notes: string | null;
    actorUserId: string;
  },
): Promise<void> {
  const email = normalizeLeadgridEmail(input.email);
  if (!email) throw new Error("invalid_email");
  await pool.query(
    `INSERT INTO leadgrid_email_suppressions
       (organization_id, email_normalized, reason, source, notes,
        suppressed_at, recorded_by_user_id)
     VALUES ($1::uuid, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (organization_id, email_normalized) DO UPDATE
       SET reason = EXCLUDED.reason,
           source = EXCLUDED.source,
           notes = EXCLUDED.notes,
           suppressed_at = NOW(),
           recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
    [
      input.organizationId,
      email,
      input.reason,
      input.source,
      input.notes,
      input.actorUserId,
    ],
  );
}
