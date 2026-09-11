import Foundation

enum LeadgridEmailAddressClassification: String, Codable, Sendable {
    case unknown
    case verifiedShared = "verified_shared"
    case namedPerson = "named_person"
}

enum LeadgridEmailAuthorization: String, Codable, Sendable {
    case none
    case verifiedShared = "verified_shared"
    case documentedConsent = "documented_consent"
    case existingCustomer = "existing_customer"
}

enum LeadgridEmailComplianceReason: String, Codable, Sendable {
    case permittedVerifiedShared = "permitted_verified_shared"
    case permittedDocumentedConsent = "permitted_documented_consent"
    case permittedExistingCustomer = "permitted_existing_customer"
    case blockedNoEmail = "blocked_no_email"
    case blockedSuppressed = "blocked_suppressed"
    case blockedGdprBasisMissing = "blocked_gdpr_basis_missing"
    case blockedNamedPersonWithoutPermission = "blocked_named_person_without_permission"
    case blockedUnknownAddress = "blocked_unknown_address"
}

struct LeadgridEmailConsentState: Codable, Equatable, Sendable {
    let action: String
    let contactName: String?
    let purpose: String?
    let consentText: String?
    let consentVersion: String?
    let source: String?
    let evidence: String?
    let occurredAt: String
    let expiresAt: String?
}

struct LeadgridExistingCustomerState: Codable, Equatable, Sendable {
    let active: Bool
    let source: String?
    let relationship: String?
    let similarServices: String?
    let electronicAddressProvidedAt: String?
    let collectionOptOutOfferedAt: String?
    let attestedAt: String?
}

struct LeadgridGdprProcessingState: Codable, Equatable, Sendable {
    let documented: Bool
    let dataSubjectName: String?
    let legalBasis: String?
    let purpose: String?
    let source: String?
    let collectedAt: String?
    let retentionUntil: String?
    let legitimateInterestGoal: String?
    let necessityAssessment: String?
    let balancingAssessment: String?
    let safeguards: String?
    let indirectCollection: Bool
    let privacyNoticeStatus: String?
    let privacyNoticeSentAt: String?
    let privacyNoticeMethod: String?
    let privacyNoticeReference: String?
}

struct LeadgridEmailCompliance: Codable, Equatable, Sendable {
    let email: String?
    let normalizedEmail: String?
    let addressClassification: LeadgridEmailAddressClassification
    let addressTypeHint: LeadgridEmailAddressClassification
    let allowed: Bool
    let authorization: LeadgridEmailAuthorization
    let reason: LeadgridEmailComplianceReason
    let isSuppressed: Bool
    let consent: LeadgridEmailConsentState?
    let existingCustomer: LeadgridExistingCustomerState
    let gdprProcessing: LeadgridGdprProcessingState

    var statusTitle: String {
        switch reason {
        case .permittedVerifiedShared: return "Verifisert fellesadresse"
        case .permittedDocumentedConsent: return "Samtykke dokumentert"
        case .permittedExistingCustomer: return "Eksisterende kundeforhold dokumentert"
        case .blockedSuppressed: return "Reservert – ikke send"
        case .blockedGdprBasisMissing: return "GDPR-grunnlag må dokumenteres"
        case .blockedNamedPersonWithoutPermission: return "Personadresse – samtykke mangler"
        case .blockedUnknownAddress: return "Adressetype må bekreftes"
        case .blockedNoEmail: return "E-postadresse mangler"
        }
    }

    var guidance: String {
        switch reason {
        case .permittedVerifiedShared:
            return "Adressen er kontrollert som en felles inngang til virksomheten."
        case .permittedDocumentedConsent:
            return "Mottakerens samtykke er lagret med tidspunkt, kilde, ordlyd og formål."
        case .permittedExistingCustomer:
            return "Det snevre kundeunntaket er dokumentert for tilsvarende tjenester."
        case .blockedSuppressed:
            return "Mottakeren er sperret i hele organisasjonen, også i andre prosjekter."
        case .blockedGdprBasisMissing:
            return "Markedsføringsgrunnlaget finnes, men behandlingsgrunnlag, kilde, lagringstid og personverninformasjon mangler."
        case .blockedNamedPersonWithoutPermission:
            return "En navngitt jobb-adresse kan ikke brukes før samtykke eller gyldig kundeunntak er dokumentert."
        case .blockedUnknownAddress:
            return "At adressen er offentlig eller ser ut som info@ er ikke nok. Kontroller hvem adressen tilhører."
        case .blockedNoEmail:
            return "Legg inn en gyldig e-postadresse før utsendelsesgrunnlaget vurderes."
        }
    }

    func permitsMarketing(to recipient: String) -> Bool {
        guard allowed,
              let authorized = Self.normalized(email ?? normalizedEmail),
              let requested = Self.normalized(recipient)
        else { return false }
        return authorized == requested
    }

    static func dentumQAVerifiedShared(email: String) -> Self {
        .init(
            email: email,
            normalizedEmail: normalized(email),
            addressClassification: .verifiedShared,
            addressTypeHint: .verifiedShared,
            allowed: true,
            authorization: .verifiedShared,
            reason: .permittedVerifiedShared,
            isSuppressed: false,
            consent: nil,
            existingCustomer: .init(
                active: false,
                source: nil,
                relationship: nil,
                similarServices: nil,
                electronicAddressProvidedAt: nil,
                collectionOptOutOfferedAt: nil,
                attestedAt: nil),
            gdprProcessing: .init(
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
        )
    }

    static func qaNamedPersonBlocked(email: String) -> Self {
        .init(
            email: email,
            normalizedEmail: normalized(email),
            addressClassification: .namedPerson,
            addressTypeHint: .unknown,
            allowed: false,
            authorization: .none,
            reason: .blockedNamedPersonWithoutPermission,
            isSuppressed: false,
            consent: nil,
            existingCustomer: .init(
                active: false,
                source: nil,
                relationship: nil,
                similarServices: nil,
                electronicAddressProvidedAt: nil,
                collectionOptOutOfferedAt: nil,
                attestedAt: nil),
            gdprProcessing: .init(
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
        )
    }

    private static func normalized(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !value.isEmpty else { return nil }
        return value
    }
}

private struct LeadgridEmailComplianceEnvelope: Decodable, Sendable {
    let compliance: LeadgridEmailCompliance
}

private struct LeadgridAddressClassificationRequest: Encodable, Sendable {
    let classification: LeadgridEmailAddressClassification
    let source: String
    let evidence: String
}

struct LeadgridEmailConsentRequest: Encodable, Sendable {
    let action: String
    let contactName: String
    let purpose: String
    let consentText: String
    let consentVersion: String
    let source: String
    let evidence: String
    let occurredAt: String
    let expiresAt: String?
}

struct LeadgridExistingCustomerRequest: Encodable, Sendable {
    let source: String
    let relationship: String
    let similarServices: String
    let electronicAddressProvidedAt: String
    let collectionOptOutOfferedAt: String
}

struct LeadgridGdprProcessingRequest: Encodable, Sendable {
    let dataSubjectName: String
    let legalBasis: String
    let purpose: String
    let source: String
    let collectedAt: String
    let retentionUntil: String
    let legitimateInterestGoal: String?
    let necessityAssessment: String?
    let balancingAssessment: String?
    let safeguards: String?
    let indirectCollection: Bool
    let privacyNoticeStatus: String
    let privacyNoticeSentAt: String?
    let privacyNoticeMethod: String?
    let privacyNoticeReference: String?
}

private struct LeadgridEmailSuppressionRequest: Encodable, Sendable {
    let reason: String
    let source: String
    let notes: String?
}

enum LeadgridOutreachComplianceScopeError: LocalizedError, Equatable {
    case invalidLead
    case missingProject
    case missingOrganization

    var errorDescription: String? {
        switch self {
        case .invalidLead: return "E-postkontrollen krever en lagret lead."
        case .missingProject: return "Velg riktig kundeprosjekt før e-postkontrollen."
        case .missingOrganization: return "Velg riktig organisasjon før e-postkontrollen."
        }
    }
}

extension APIClient {
    private func outreachCompliancePath(
        leadId: String,
        projectId: String,
        organizationId: String,
        suffix: String = ""
    ) throws -> String {
        guard UUID(uuidString: leadId.trimmingCharacters(in: .whitespacesAndNewlines)) != nil else {
            throw LeadgridOutreachComplianceScopeError.invalidLead
        }
        let projectId = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !projectId.isEmpty, projectId.count <= 255 else {
            throw LeadgridOutreachComplianceScopeError.missingProject
        }
        let organizationId = organizationId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !organizationId.isEmpty, organizationId.count <= 255 else {
            throw LeadgridOutreachComplianceScopeError.missingOrganization
        }
        var components = URLComponents()
        components.path = "/api/admin-room/lead-map/leads/\(leadId)/outreach-compliance\(suffix)"
        components.queryItems = [
            URLQueryItem(name: "projectId", value: projectId),
            URLQueryItem(name: "organization_id", value: organizationId),
        ]
        guard let path = components.string else { throw URLError(.badURL) }
        return path
    }

    func fetchOutreachCompliance(
        leadId: String,
        projectId: String,
        organizationId: String
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId)
        let response: LeadgridEmailComplianceEnvelope = try await _get(path)
        return response.compliance
    }

    func setOutreachAddressClassification(
        leadId: String,
        projectId: String,
        organizationId: String,
        classification: LeadgridEmailAddressClassification,
        source: String,
        evidence: String
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId,
            suffix: "/address-classification")
        let response: LeadgridEmailComplianceEnvelope = try await _put(
            path,
            body: LeadgridAddressClassificationRequest(
                classification: classification,
                source: source,
                evidence: evidence))
        return response.compliance
    }

    func recordOutreachConsent(
        leadId: String,
        projectId: String,
        organizationId: String,
        request: LeadgridEmailConsentRequest
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId,
            suffix: "/consents")
        let response: LeadgridEmailComplianceEnvelope = try await _post(path, body: request)
        return response.compliance
    }

    func recordOutreachExistingCustomer(
        leadId: String,
        projectId: String,
        organizationId: String,
        request: LeadgridExistingCustomerRequest
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId,
            suffix: "/existing-customer")
        let response: LeadgridEmailComplianceEnvelope = try await _post(path, body: request)
        return response.compliance
    }

    func suppressOutreachEmail(
        leadId: String,
        projectId: String,
        organizationId: String,
        reason: String,
        source: String,
        notes: String?
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId,
            suffix: "/suppressions")
        let response: LeadgridEmailComplianceEnvelope = try await _post(
            path,
            body: LeadgridEmailSuppressionRequest(
                reason: reason,
                source: source,
                notes: notes))
        return response.compliance
    }

    func recordOutreachGdprProcessing(
        leadId: String,
        projectId: String,
        organizationId: String,
        request: LeadgridGdprProcessingRequest
    ) async throws -> LeadgridEmailCompliance {
        let path = try outreachCompliancePath(
            leadId: leadId,
            projectId: projectId,
            organizationId: organizationId,
            suffix: "/gdpr-processing")
        let response: LeadgridEmailComplianceEnvelope = try await _post(path, body: request)
        return response.compliance
    }
}
