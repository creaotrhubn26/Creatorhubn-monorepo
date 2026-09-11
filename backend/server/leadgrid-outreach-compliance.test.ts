import { describe, expect, it, vi } from "vitest";
import {
  evaluateLeadgridEmailCompliance,
  getLeadgridEmailCompliance,
  leadgridEmailAddressTypeHint,
  recordLeadgridGdprProcessing,
  type LeadgridEmailComplianceFacts,
} from "./leadgrid-outreach-compliance.js";

function facts(
  overrides: Partial<LeadgridEmailComplianceFacts> = {},
): LeadgridEmailComplianceFacts {
  return {
    email: "post@tannklinikk.no",
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
    ...overrides,
  };
}

function documentedGdpr() {
  return {
    documented: true,
    dataSubjectName: "Kari Nordmann",
    legalBasis: "consent",
    purpose: "B2B prospecting",
    source: "web form",
    collectedAt: "2026-09-01T10:00:00.000Z",
    retentionUntil: "2027-09-01T10:00:00.000Z",
    legitimateInterestGoal: null,
    necessityAssessment: null,
    balancingAssessment: null,
    safeguards: null,
    indirectCollection: false,
    privacyNoticeStatus: "sent" as const,
    privacyNoticeSentAt: "2026-09-01T10:00:00.000Z",
    privacyNoticeMethod: "web form",
    privacyNoticeReference: "privacy-v2",
  };
}

describe("Leadgrid outbound email compliance", () => {
  it("treats generic-looking addresses only as a non-authoritative hint", () => {
    expect(leadgridEmailAddressTypeHint("INFO@KLINIKK.NO")).toBe("verified_shared");
    const decision = evaluateLeadgridEmailCompliance(facts());
    expect(decision.addressTypeHint).toBe("verified_shared");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("blocked_unknown_address");
  });

  it("allows an address only after it is verified as shared", () => {
    const decision = evaluateLeadgridEmailCompliance(facts({
      addressClassification: "verified_shared",
    }));
    expect(decision.allowed).toBe(true);
    expect(decision.authorization).toBe("verified_shared");
  });

  it("blocks a named person without documented permission", () => {
    const decision = evaluateLeadgridEmailCompliance(facts({
      email: "kari.nordmann@klinikk.no",
      addressClassification: "named_person",
    }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("blocked_named_person_without_permission");
  });

  it("allows valid documented consent and rejects an expired grant", () => {
    const baseConsent = {
      action: "grant" as const,
      contactName: "Kari Nordmann",
      purpose: "direct_marketing_email",
      consentText: "Jeg samtykker til markedsføring på e-post.",
      consentVersion: "2026-09-10",
      source: "web_form",
      evidence: "CRM form submission 42",
      occurredAt: "2026-09-01T10:00:00.000Z",
      expiresAt: "2026-10-01T10:00:00.000Z",
    };
    expect(evaluateLeadgridEmailCompliance(
      facts({
        email: "kari@klinikk.no",
        addressClassification: "named_person",
        consent: baseConsent,
        gdprProcessing: documentedGdpr(),
      }),
      new Date("2026-09-10T12:00:00.000Z"),
    ).allowed).toBe(true);
    expect(evaluateLeadgridEmailCompliance(
      facts({
        email: "kari@klinikk.no",
        addressClassification: "named_person",
        consent: baseConsent,
        gdprProcessing: documentedGdpr(),
      }),
      new Date("2026-10-02T12:00:00.000Z"),
    ).allowed).toBe(false);
  });

  it("keeps personal outreach blocked until the separate GDPR record exists", () => {
    const decision = evaluateLeadgridEmailCompliance(facts({
      email: "kari@klinikk.no",
      addressClassification: "named_person",
      consent: {
        action: "grant",
        contactName: "Kari Nordmann",
        purpose: "direct_marketing_email",
        consentText: "Samtykke",
        consentVersion: "v1",
        source: "web_form",
        evidence: "form-1",
        occurredAt: "2026-09-01T10:00:00.000Z",
        expiresAt: null,
      },
    }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("blocked_gdpr_basis_missing");
  });

  it("requires every part of the narrow existing-customer attestation", () => {
    const customer = {
      active: true,
      source: "signed_order",
      relationship: "Existing Dentum customer",
      similarServices: "Dental marketing services",
      electronicAddressProvidedAt: "2026-08-01T10:00:00.000Z",
      collectionOptOutOfferedAt: "2026-08-01T10:00:00.000Z",
      attestedAt: "2026-09-10T10:00:00.000Z",
    };
    expect(evaluateLeadgridEmailCompliance(facts({
      email: "kari@klinikk.no",
      addressClassification: "named_person",
      existingCustomer: customer,
      gdprProcessing: documentedGdpr(),
    })).authorization).toBe("existing_customer");
    expect(evaluateLeadgridEmailCompliance(facts({
      email: "kari@klinikk.no",
      addressClassification: "named_person",
      existingCustomer: { ...customer, similarServices: null },
      gdprProcessing: documentedGdpr(),
    })).allowed).toBe(false);
  });

  it("lets an organization-wide reservation override every other basis", () => {
    const decision = evaluateLeadgridEmailCompliance(facts({
      addressClassification: "verified_shared",
      isSuppressed: true,
      consent: {
        action: "grant",
        contactName: "Tannklinikken",
        purpose: "direct_marketing_email",
        consentText: "Samtykke",
        consentVersion: "v1",
        source: "web_form",
        evidence: "event-1",
        occurredAt: "2026-09-10T10:00:00.000Z",
        expiresAt: null,
      },
    }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("blocked_suppressed");
  });

  it("loads evidence only through the exact organization and normalized email", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const decision = await getLeadgridEmailCompliance(
      { query } as never,
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        email: " POST@Dentum.No ",
      },
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("p.organization_id = wanted.organization_id");
    expect(sql).toContain("s.organization_id = wanted.organization_id");
    expect(sql).toContain("WHERE organization_id = wanted.organization_id");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "post@dentum.no",
    ]);
    expect(decision.allowed).toBe(false);
  });

  it("persists the full three-part legitimate-interest assessment", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await recordLeadgridGdprProcessing({ query } as never, {
      organizationId: "11111111-1111-4111-8111-111111111111",
      email: " Kari@Klinikk.no ",
      dataSubjectName: "Kari Nordmann",
      legalBasis: "legitimate_interests",
      purpose: "Kvalifisere en relevant bedriftskontakt",
      source: "Klinikkens nettside",
      collectedAt: "2026-09-10T10:00:00.000Z",
      retentionUntil: "2026-12-09T10:00:00.000Z",
      legitimateInterestGoal: "Finne klinikker som kan bruke Dentum",
      necessityAssessment: "Kontaktdata er nødvendig for å identifisere riktig virksomhetskontakt",
      balancingAssessment: "Begrenset B2B-bruk med lav inngripen",
      safeguards: "90 dagers vurdering, sperreliste og ingen automatisk utsendelse",
      indirectCollection: true,
      privacyNoticeStatus: "pending",
      privacyNoticeSentAt: null,
      privacyNoticeMethod: null,
      privacyNoticeReference: null,
      actorUserId: "daniel",
    });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("leadgrid_email_gdpr_processing_records");
    expect(sql).toContain("legitimate_interest_goal");
    expect(params[0]).toBe("11111111-1111-4111-8111-111111111111");
    expect(params[1]).toBe("kari@klinikk.no");
    expect(params.slice(8, 12)).toEqual([
      "Finne klinikker som kan bruke Dentum",
      "Kontaktdata er nødvendig for å identifisere riktig virksomhetskontakt",
      "Begrenset B2B-bruk med lav inngripen",
      "90 dagers vurdering, sperreliste og ingen automatisk utsendelse",
    ]);
  });
});
