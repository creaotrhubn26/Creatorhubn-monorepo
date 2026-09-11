import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requestedLeadMapOrganizationId } from "./lead-map-org-scope.js";
import {
  LeadMapProjectScopeError,
  requestedLeadMapProjectId,
  sendLeadMapProjectScopeError,
} from "./lead-map-project-scope.js";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { resolveLeadMapSession } from "./lead-map-session-helper.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { getLeadgridSession, type LeadgridSession } from "./leadgrid-project-access.js";
import {
  attestLeadgridExistingCustomer,
  getLeadgridEmailCompliance,
  recordLeadgridGdprProcessing,
  recordLeadgridEmailConsent,
  setLeadgridEmailAddressClassification,
  suppressLeadgridEmail,
  type LeadgridEmailAddressClassification,
  type LeadgridEmailComplianceDecision,
} from "./leadgrid-outreach-compliance.js";

type SessionData = LeadgridSession & { name?: string };

const CLASSIFICATIONS = new Set<LeadgridEmailAddressClassification>([
  "unknown",
  "verified_shared",
  "named_person",
]);
const SUPPRESSION_REASONS = new Set([
  "recipient_objection",
  "unsubscribe",
  "manual_block",
  "hard_bounce",
  "complaint",
]);

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, maxLength);
}

function requiredInstant(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function responseShape(compliance: LeadgridEmailComplianceDecision) {
  return {
    email: compliance.email,
    normalized_email: compliance.normalizedEmail,
    address_classification: compliance.addressClassification,
    address_type_hint: compliance.addressTypeHint,
    allowed: compliance.allowed,
    authorization: compliance.authorization,
    reason: compliance.reason,
    is_suppressed: compliance.isSuppressed,
    consent: compliance.consent && {
      action: compliance.consent.action,
      purpose: compliance.consent.purpose,
      source: compliance.consent.source,
      occurred_at: compliance.consent.occurredAt,
      expires_at: compliance.consent.expiresAt,
    },
    existing_customer: {
      active: compliance.existingCustomer.active,
      attested_at: compliance.existingCustomer.attestedAt,
    },
    gdpr_processing: {
      documented: compliance.gdprProcessing.documented,
      legal_basis: compliance.gdprProcessing.legalBasis,
      purpose: compliance.gdprProcessing.purpose,
      source: compliance.gdprProcessing.source,
      collected_at: compliance.gdprProcessing.collectedAt,
      retention_until: compliance.gdprProcessing.retentionUntil,
      indirect_collection: compliance.gdprProcessing.indirectCollection,
      privacy_notice_status: compliance.gdprProcessing.privacyNoticeStatus,
      privacy_notice_sent_at: compliance.gdprProcessing.privacyNoticeSentAt,
      privacy_notice_method: compliance.gdprProcessing.privacyNoticeMethod,
    },
  };
}

export function registerLeadgridOutreachComplianceRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}): void {
  const { app, pool, activeSessions } = deps;

  async function session(req: Request): Promise<SessionData | null> {
    const current = getLeadgridSession(req, activeSessions);
    return current ?? await resolveLeadMapSession(req, pool, activeSessions);
  }

  async function scopedLead(req: Request, userId: string) {
    const projectId = requestedLeadMapProjectId(req);
    if (!projectId) throw new LeadMapProjectScopeError(400, "project_id_required");
    const lead = await loadAccessibleLeadgridLead(pool, {
      leadId: String(req.params.id ?? ""),
      userId,
    });
    const requestedOrganizationId = requestedLeadMapOrganizationId(req);
    if (
      !lead
      || lead.projectId !== projectId
      || (requestedOrganizationId && requestedOrganizationId !== lead.organizationId)
    ) {
      throw new LeadMapProjectScopeError(404, "project_not_found");
    }
    const result = await pool.query<{ email: string | null }>(
      `SELECT email
         FROM crm_customers
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id = $3
          AND archived_at IS NULL
        LIMIT 1`,
      [lead.id, lead.organizationId, lead.projectId],
    );
    if (!result.rows[0]) throw new LeadMapProjectScopeError(404, "project_not_found");
    return { ...lead, email: result.rows[0].email };
  }

  async function answer(req: Request, res: Response, userId: string) {
    const lead = await scopedLead(req, userId);
    const compliance = await getLeadgridEmailCompliance(pool, {
      organizationId: lead.organizationId,
      email: lead.email,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ compliance: responseShape(compliance) });
  }

  function handleFailure(error: unknown, res: Response, code: string): Response | void {
    if (sendLeadMapProjectScopeError(error, res)) return;
    console.error(`[outreach-compliance] ${code}:`, error);
    return res.status(500).json({ error: code, detail: "internal_error" });
  }

  app.get(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance",
    requireLeadMapPermission("leads.view", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "outreach_compliance_failed");
      }
    },
  );

  app.put(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance/address-classification",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const classification = requiredText(req.body?.classification, 40) as LeadgridEmailAddressClassification | null;
      const source = requiredText(req.body?.source, 300);
      const evidence = requiredText(req.body?.evidence, 4_000);
      if (!classification || !CLASSIFICATIONS.has(classification) || !source || !evidence) {
        return res.status(422).json({
          error: "invalid_address_classification_evidence",
          fields: {
            classification: "Velg ukjent, verifisert fellesadresse eller navngitt personadresse.",
            source: "Oppgi hvor adressetypen ble kontrollert.",
            evidence: "Dokumenter hva som viser hvem adressen tilhører.",
          },
        });
      }
      try {
        const lead = await scopedLead(req, current.userId);
        if (!lead.email) return res.status(422).json({ error: "lead_missing_email" });
        await setLeadgridEmailAddressClassification(pool, {
          organizationId: lead.organizationId,
          email: lead.email,
          classification,
          source,
          evidence,
          actorUserId: current.userId,
        });
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "address_classification_failed");
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance/consents",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const action = req.body?.action === "grant" || req.body?.action === "withdraw"
        ? req.body.action as "grant" | "withdraw"
        : null;
      const contactName = requiredText(req.body?.contact_name, 300);
      const purpose = requiredText(req.body?.purpose, 300);
      const consentText = requiredText(req.body?.consent_text, 4_000);
      const consentVersion = requiredText(req.body?.consent_version, 100);
      const source = requiredText(req.body?.source, 300);
      const evidence = requiredText(req.body?.evidence, 4_000);
      const occurredAt = requiredInstant(req.body?.occurred_at);
      const expiresAt = req.body?.expires_at == null
        ? null
        : requiredInstant(req.body.expires_at);
      if (
        !action || !contactName || !purpose || !consentText || !consentVersion
        || !source || !evidence || !occurredAt
        || (req.body?.expires_at != null && !expiresAt)
        || (expiresAt && new Date(expiresAt) <= new Date(occurredAt))
      ) {
        return res.status(422).json({ error: "invalid_consent_evidence" });
      }
      try {
        const lead = await scopedLead(req, current.userId);
        if (!lead.email) return res.status(422).json({ error: "lead_missing_email" });
        await recordLeadgridEmailConsent(pool, {
          organizationId: lead.organizationId,
          email: lead.email,
          action,
          contactName,
          purpose,
          consentText,
          consentVersion,
          source,
          evidence,
          occurredAt,
          expiresAt,
          actorUserId: current.userId,
        });
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "consent_record_failed");
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance/existing-customer",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const source = requiredText(req.body?.source, 300);
      const relationship = requiredText(req.body?.relationship, 1_000);
      const similarServices = requiredText(req.body?.similar_services, 1_000);
      const electronicAddressProvidedAt = requiredInstant(
        req.body?.electronic_address_provided_at,
      );
      const collectionOptOutOfferedAt = requiredInstant(
        req.body?.collection_opt_out_offered_at,
      );
      if (
        !source || !relationship || !similarServices
        || !electronicAddressProvidedAt || !collectionOptOutOfferedAt
      ) {
        return res.status(422).json({ error: "invalid_existing_customer_evidence" });
      }
      try {
        const lead = await scopedLead(req, current.userId);
        if (!lead.email) return res.status(422).json({ error: "lead_missing_email" });
        await attestLeadgridExistingCustomer(pool, {
          organizationId: lead.organizationId,
          email: lead.email,
          source,
          relationship,
          similarServices,
          electronicAddressProvidedAt,
          collectionOptOutOfferedAt,
          actorUserId: current.userId,
        });
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "existing_customer_record_failed");
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance/gdpr-processing",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const legalBasis = requiredText(req.body?.legal_basis, 40);
      const allowedBases = new Set([
        "consent", "contract", "legal_obligation", "vital_interests",
        "public_task", "legitimate_interests",
      ]);
      const dataSubjectName = requiredText(req.body?.data_subject_name, 300);
      const purpose = requiredText(req.body?.purpose, 1_000);
      const source = requiredText(req.body?.source, 1_000);
      const collectedAt = requiredInstant(req.body?.collected_at);
      const retentionUntil = requiredInstant(req.body?.retention_until);
      const legitimateInterestGoal = optionalText(req.body?.legitimate_interest_goal, 2_000);
      const necessityAssessment = optionalText(req.body?.necessity_assessment, 2_000);
      const balancingAssessment = optionalText(req.body?.balancing_assessment, 4_000);
      const safeguards = optionalText(req.body?.safeguards, 2_000);
      const privacyNoticeStatus = requiredText(req.body?.privacy_notice_status, 20);
      const privacyNoticeSentAt = req.body?.privacy_notice_sent_at == null
        ? null
        : requiredInstant(req.body.privacy_notice_sent_at);
      const privacyNoticeMethod = optionalText(req.body?.privacy_notice_method, 300);
      const privacyNoticeReference = optionalText(req.body?.privacy_notice_reference, 2_000);
      const validNotice = privacyNoticeStatus === "pending"
        || privacyNoticeStatus === "exempt"
        || (
          privacyNoticeStatus === "sent"
          && Boolean(privacyNoticeSentAt)
          && Boolean(privacyNoticeMethod)
          && Boolean(privacyNoticeReference)
        );
      const validInterestAssessment = legalBasis !== "legitimate_interests"
        || Boolean(
          legitimateInterestGoal && necessityAssessment
          && balancingAssessment && safeguards,
        );
      if (
        !legalBasis || !allowedBases.has(legalBasis) || !dataSubjectName
        || !purpose || !source || !collectedAt || !retentionUntil
        || new Date(retentionUntil) <= new Date(collectedAt)
        || typeof req.body?.indirect_collection !== "boolean"
        || !validNotice || !validInterestAssessment
      ) {
        return res.status(422).json({
          error: "invalid_gdpr_processing_record",
          detail: legalBasis === "legitimate_interests"
            ? "Berettiget interesse krever formål, nødvendighet, interesseavveining og tiltak."
            : "Dokumenter behandlingsgrunnlag, formål, kilde, lagringstid og personverninformasjon.",
        });
      }
      try {
        const lead = await scopedLead(req, current.userId);
        if (!lead.email) return res.status(422).json({ error: "lead_missing_email" });
        await recordLeadgridGdprProcessing(pool, {
          organizationId: lead.organizationId,
          email: lead.email,
          dataSubjectName,
          legalBasis: legalBasis as "consent" | "contract" | "legal_obligation" | "vital_interests" | "public_task" | "legitimate_interests",
          purpose,
          source,
          collectedAt,
          retentionUntil,
          legitimateInterestGoal,
          necessityAssessment,
          balancingAssessment,
          safeguards,
          indirectCollection: req.body.indirect_collection,
          privacyNoticeStatus: privacyNoticeStatus as "pending" | "sent" | "exempt",
          privacyNoticeSentAt,
          privacyNoticeMethod,
          privacyNoticeReference,
          actorUserId: current.userId,
        });
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "gdpr_processing_record_failed");
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/leads/:id/outreach-compliance/suppressions",
    requireLeadMapPermission("leads.update", { pool, activeSessions }),
    async (req, res) => {
      const current = await session(req);
      if (!current?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const reason = requiredText(req.body?.reason, 40);
      const source = requiredText(req.body?.source, 300);
      const notes = optionalText(req.body?.notes, 4_000);
      if (!reason || !SUPPRESSION_REASONS.has(reason) || !source) {
        return res.status(422).json({ error: "invalid_suppression" });
      }
      try {
        const lead = await scopedLead(req, current.userId);
        if (!lead.email) return res.status(422).json({ error: "lead_missing_email" });
        await suppressLeadgridEmail(pool, {
          organizationId: lead.organizationId,
          email: lead.email,
          reason: reason as "recipient_objection" | "unsubscribe" | "manual_block" | "hard_bounce" | "complaint",
          source,
          notes,
          actorUserId: current.userId,
        });
        return await answer(req, res, current.userId);
      } catch (error) {
        return handleFailure(error, res, "suppression_record_failed");
      }
    },
  );
}
