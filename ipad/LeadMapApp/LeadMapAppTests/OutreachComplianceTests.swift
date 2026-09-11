import XCTest
@testable import LeadMapApp

final class OutreachComplianceTests: XCTestCase {
    private let customer = LeadgridExistingCustomerState(
        active: false,
        source: nil,
        relationship: nil,
        similarServices: nil,
        electronicAddressProvidedAt: nil,
        collectionOptOutOfferedAt: nil,
        attestedAt: nil)
    private let gdpr = LeadgridGdprProcessingState(
        documented: false,
        dataSubjectName: nil,
        legalBasis: nil,
        purpose: nil,
        source: nil,
        collectedAt: nil,
        retentionUntil: nil,
        legitimateInterestGoal: nil,
        necessityAssessment: nil,
        balancingAssessment: nil,
        safeguards: nil,
        indirectCollection: true,
        privacyNoticeStatus: nil,
        privacyNoticeSentAt: nil,
        privacyNoticeMethod: nil,
        privacyNoticeReference: nil)

    func testUnknownGenericLookingAddressRemainsBlocked() {
        let compliance = LeadgridEmailCompliance(
            email: "info@klinikk.no",
            normalizedEmail: "info@klinikk.no",
            addressClassification: .unknown,
            addressTypeHint: .verifiedShared,
            allowed: false,
            authorization: .none,
            reason: .blockedUnknownAddress,
            isSuppressed: false,
            consent: nil,
            existingCustomer: customer,
            gdprProcessing: gdpr)

        XCTAssertFalse(compliance.permitsMarketing(to: "info@klinikk.no"))
        XCTAssertEqual(compliance.statusTitle, "Adressetype må bekreftes")
    }

    func testVerifiedSharedAddressPermitsOnlyTheAuthoritativeRecipient() {
        let compliance = LeadgridEmailCompliance.dentumQAVerifiedShared(
            email: "post@majorstuentannlegesenter.no")

        XCTAssertTrue(compliance.permitsMarketing(
            to: " POST@majorstuentannlegesenter.no "))
        XCTAssertFalse(compliance.permitsMarketing(to: "anne@majorstuentannlegesenter.no"))
        XCTAssertEqual(compliance.statusTitle, "Verifisert fellesadresse")
    }

    func testOrganizationSuppressionCannotBePresentedAsAllowed() {
        let compliance = LeadgridEmailCompliance(
            email: "post@klinikk.no",
            normalizedEmail: "post@klinikk.no",
            addressClassification: .verifiedShared,
            addressTypeHint: .verifiedShared,
            allowed: false,
            authorization: .none,
            reason: .blockedSuppressed,
            isSuppressed: true,
            consent: nil,
            existingCustomer: customer,
            gdprProcessing: gdpr)

        XCTAssertFalse(compliance.permitsMarketing(to: "post@klinikk.no"))
        XCTAssertEqual(compliance.statusTitle, "Reservert – ikke send")
        XCTAssertTrue(compliance.guidance.contains("hele organisasjonen"))
    }

    func testNamedPersonFixtureCannotOpenARecipient() {
        let compliance = LeadgridEmailCompliance.qaNamedPersonBlocked(
            email: "anne@klinikk.no")
        XCTAssertFalse(compliance.permitsMarketing(to: "anne@klinikk.no"))
        XCTAssertEqual(compliance.statusTitle, "Personadresse – samtykke mangler")
    }

    func testDelayNoticePurposeIsSeparateFromMarketing() {
        XCTAssertNotEqual(
            LeadgridExternalContactPurpose.service,
            LeadgridExternalContactPurpose.marketing)
    }

    func testRedactedServerDecisionDecodesWithoutAuditEvidence() throws {
        let payload = #"""
        {
          "email": "person@klinikk.no",
          "normalized_email": "person@klinikk.no",
          "address_classification": "named_person",
          "address_type_hint": "unknown",
          "allowed": true,
          "authorization": "documented_consent",
          "reason": "permitted_documented_consent",
          "is_suppressed": false,
          "consent": {
            "action": "grant",
            "purpose": "Produktinformasjon",
            "source": "Signert skjema",
            "occurred_at": "2026-09-01T10:00:00.000Z",
            "expires_at": null
          },
          "existing_customer": {
            "active": false,
            "attested_at": null
          },
          "gdpr_processing": {
            "documented": true,
            "legal_basis": "consent",
            "purpose": "Produktinformasjon",
            "source": "Klinikkens nettside",
            "collected_at": "2026-09-01T10:00:00.000Z",
            "retention_until": "2026-12-01T10:00:00.000Z",
            "indirect_collection": true,
            "privacy_notice_status": "sent",
            "privacy_notice_sent_at": "2026-09-01T11:00:00.000Z",
            "privacy_notice_method": "email"
          }
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        let compliance = try decoder.decode(LeadgridEmailCompliance.self, from: payload)

        XCTAssertTrue(compliance.permitsMarketing(to: "person@klinikk.no"))
        XCTAssertNil(compliance.consent?.consentText)
        XCTAssertNil(compliance.consent?.evidence)
        XCTAssertNil(compliance.gdprProcessing.balancingAssessment)
        XCTAssertNil(compliance.gdprProcessing.privacyNoticeReference)
    }
}
