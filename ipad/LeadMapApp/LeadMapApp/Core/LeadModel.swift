// LeadModel.swift
//
// Codable som matcher backend MapLead-typen (frontend/client TypeScript-
// versjonen). Backend bruker snake_case → JSONDecoder konfigurert med
// .convertFromSnakeCase, så vi skriver felt-navn i camelCase her.

import Foundation

enum LeadStatus: String, Codable, CaseIterable, Identifiable {
    case unvisited
    case visited
    case `return`
    case notPresent = "not_present"
    case declined
    case interested
    case meetingBooked = "meeting_booked"
    case proposalSent = "proposal_sent"
    case won
    case lost
    case doNotContact = "do_not_contact"

    public var id: String { rawValue }

    /// Norsk visning i UI (2026-07-02: byttet fra engelsk fordi picker-menyer
    /// i VisitLogModal viste «Interested / Meeting booked / Declined» osv.
    /// Rå enum-verdiene ligger fortsatt i engelsk snake_case mot backend).
    var label: String {
        switch self {
        case .unvisited: return "Ikke besøkt"
        case .visited: return "Besøkt"
        case .return: return "Kom tilbake"
        case .notPresent: return "Ikke tilstede"
        case .declined: return "Avslo"
        case .interested: return "Interessert"
        case .meetingBooked: return "Møte booket"
        case .proposalSent: return "Tilbud sendt"
        case .won: return "Vunnet"
        case .lost: return "Tapt"
        case .doNotContact: return "Ikke kontakt"
        }
    }
}

struct LeadModel: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let company: String?
    let category: String?
    let status: LeadStatus
    let address: String?
    let postalCode: String?
    let city: String?
    let country: String?
    let latitude: Double
    let longitude: Double
    let phone: String?
    let email: String?
    let websiteUrl: String?
    // ── Strukturert bedrifts- og kontaktprofil (mig 474) ─────────────
    // Default nil holder eksplisitte test-/preview-initializers kompatible.
    var organizationNumber: String? = nil
    var contactName: String? = nil
    var contactRole: String? = nil
    var employeeCountEstimate: Int? = nil
    var annualRevenueNokEstimate: Double? = nil
    let instagramUrl: String?
    let linkedinUrl: String?
    let googleRating: Double?
    let googlePlaceId: String?
    /// Bedrifts-logo (mig 288). Vises som sirkulær pin på kartet.
    let logoUrl: String?
    let aiOpportunityScore: Int?
    /// CPV-koder (anbuds-språket) — settes automatisk fra bransjen.
    var cpvKoder: [String]? = nil
    let estimatedValue: Double?
    let leadSource: String?
    let assignedUserId: String?
    let assignedUserName: String?
    let assignedUserEmail: String?
    let projectId: String?
    let lastVisitAt: Date?
    let nextFollowUpAt: Date?
    let nextAction: String?
    let tags: [String]?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
    // ── Leadgrid Intelligence (PR #855) ──────────────────────────────
    // Felter som backend kan returnere på MapLead-payloaden. Brukes til å
    // styre pulserende lilla "hot"-pin og pipeline-baserte map-farger.
    // Alle valgfrie så eldre/cachede payloads fortsatt decodes.
    let leadTemperature: String?
    let pipelineStage: String?
    let leadScore: Int?
    // ── Bransje-kategorisering (mig 329) ─────────────────────────────
    /// Bransje-id (industries.id). Brukes for IndustryBadge i UI og
    /// «Bare mine bransjer»-filter på kartet. Backwards-compat: optional
    /// så eldre cached payloads fortsatt decodes.
    let industryId: String?
    /// Personlig favoritt, persistert per bruker og workspace.
    var isFavorite: Bool? = nil
}

// MARK: - Canonical lead creation contract

enum LeadDraftValidationField: String, Codable, Hashable, Sendable {
    case organization
    case name
    case company
    case organizationNumber
    case website
    case contactName
    case contactRole
    case email
    case phone
    case address
    case postalCode
    case city
    case country
    case coordinates
    case industry
    case notes
    case nextAction
    case leadTemperature
    case leadSource
    case project
    case rawText
}

struct LeadDraftValidationIssue: Equatable, Sendable {
    let field: LeadDraftValidationField
    let message: String
}

/// Én tapsfri kontrakt for alle iPad-innganger som oppretter leads.
/// creationId følger samme logiske skjema gjennom direkte kall, retry og
/// offline-kø, slik at et nettverksbrudd aldri kan opprette leaden to ganger.
struct LeadDraft: Codable, Equatable, Sendable {
    var creationId: UUID
    var organizationId: String
    var name: String
    var company: String?
    var organizationNumber: String?
    var websiteUrl: String?
    var contactName: String?
    var contactRole: String?
    var email: String?
    var phone: String?
    var address: String?
    var postalCode: String?
    var city: String?
    var country: String?
    var latitude: Double?
    var longitude: Double?
    var googlePlaceId: String?
    var industryId: String?
    var industry: String?
    var employeeCountEstimate: Int?
    var annualRevenueNokEstimate: Double?
    var estimatedValue: Double?
    var notes: String?
    var leadTemperature: String
    var pipelineStage: String
    var leadStatus: String
    var nextFollowUpAt: String?
    var nextAction: String?
    var locationConfidence: String
    var leadSource: String
    var projectId: String?
    var rawText: String?
    var allowDuplicate: Bool

    static func optionalText(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Samme grenser som backend-kontrakten. Alle opprettelsesinnganger går
    /// gjennom denne før nettverkskall eller offline-kø.
    func validationDetails() -> [LeadDraftValidationIssue] {
        var issues: [LeadDraftValidationIssue] = []
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if organizationId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            issues.append(.init(field: .organization, message: "Velg en organisasjon."))
        }
        if trimmedName.isEmpty {
            issues.append(.init(field: .name, message: "Navn er påkrevd."))
        } else if trimmedName.count > 200 {
            issues.append(.init(field: .name, message: "Navn kan være maks 200 tegn."))
        }
        Self.validateLength(company, max: 240, label: "Bedrift", field: .company, issues: &issues)
        Self.validateLength(contactName, max: 240, label: "Kontaktperson", field: .contactName, issues: &issues)
        Self.validateLength(contactRole, max: 160, label: "Rolle", field: .contactRole, issues: &issues)
        Self.validateLength(phone, max: 50, label: "Telefon", field: .phone, issues: &issues)
        Self.validateLength(address, max: 500, label: "Adresse", field: .address, issues: &issues)
        Self.validateLength(postalCode, max: 20, label: "Postnummer", field: .postalCode, issues: &issues)
        Self.validateLength(city, max: 120, label: "Sted", field: .city, issues: &issues)
        Self.validateLength(country, max: 2, label: "Landkode", field: .country, issues: &issues)
        Self.validateLength(industry, max: 60, label: "Bransje", field: .industry, issues: &issues)
        Self.validateLength(notes, max: 20_000, label: "Notater", field: .notes, issues: &issues)
        Self.validateLength(nextAction, max: 2_000, label: "Neste handling", field: .nextAction, issues: &issues)
        Self.validateLength(leadSource, max: 80, label: "Lead-kilde", field: .leadSource, issues: &issues)
        Self.validateLength(projectId, max: 255, label: "Prosjekt", field: .project, issues: &issues)
        Self.validateLength(rawText, max: 20_000, label: "Råtekst", field: .rawText, issues: &issues)

        if let value = Self.optionalText(email ?? "") {
            if value.count > 200 {
                issues.append(.init(field: .email, message: "E-post kan være maks 200 tegn."))
            } else if value.range(
                    of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#,
                    options: .regularExpression
            ) == nil {
                issues.append(.init(field: .email, message: "E-postadressen er ugyldig."))
            }
        }
        if let value = Self.optionalText(organizationNumber ?? "") {
            if value.count > 32 {
                issues.append(.init(
                    field: .organizationNumber,
                    message: "Organisasjonsnummer kan være maks 32 tegn."
                ))
            }
            let digits = value.filter { $0.isNumber }
            if digits.count != 9 || !Self.isValidNorwegianOrganizationNumber(digits) {
                issues.append(.init(
                    field: .organizationNumber,
                    message: "Organisasjonsnummeret er ugyldig."
                ))
            }
        }
        if let value = Self.optionalText(websiteUrl ?? "") {
            if value.count > 2_048 {
                issues.append(.init(field: .website, message: "Nettadressen kan være maks 2048 tegn."))
            } else {
                let candidate = value.contains("://") ? value : "https://\(value)"
                let parts = URLComponents(string: candidate)
                if parts?.host?.isEmpty != false ||
                    !["http", "https"].contains(parts?.scheme?.lowercased() ?? "") ||
                    parts?.user != nil ||
                    parts?.password != nil {
                    issues.append(.init(field: .website, message: "Nettadressen er ugyldig."))
                }
            }
        }
        if (latitude == nil) != (longitude == nil) {
            issues.append(.init(
                field: .coordinates,
                message: "Breddegrad og lengdegrad må angis sammen."
            ))
        }
        if let latitude, !(-90...90).contains(latitude) {
            issues.append(.init(field: .coordinates, message: "Breddegraden er ugyldig."))
        }
        if let longitude, !(-180...180).contains(longitude) {
            issues.append(.init(field: .coordinates, message: "Lengdegraden er ugyldig."))
        }
        if !["cold", "warm", "hot", "ready"].contains(leadTemperature) {
            issues.append(.init(
                field: .leadTemperature,
                message: "Lead-temperaturen er ugyldig."
            ))
        }
        return issues
    }

    func validationIssues() -> [String] {
        validationDetails().map(\.message)
    }

    private static func validateLength(
        _ value: String?,
        max: Int,
        label: String,
        field: LeadDraftValidationField,
        issues: inout [LeadDraftValidationIssue]
    ) {
        if let value = optionalText(value ?? ""), value.count > max {
            issues.append(.init(
                field: field,
                message: "\(label) kan være maks \(max) tegn."
            ))
        }
    }

    private static func isValidNorwegianOrganizationNumber(_ value: String) -> Bool {
        let digits = value.compactMap(\.wholeNumberValue)
        guard digits.count == 9 else { return false }
        let weights = [3, 2, 7, 6, 5, 4, 3, 2]
        let remainder = 11 - zip(digits.prefix(8), weights)
            .reduce(0) { $0 + $1.0 * $1.1 } % 11
        let checkDigit = remainder == 11 ? 0 : remainder
        return checkDigit != 10 && checkDigit == digits[8]
    }

    /// Tolker både «25», «25 ansatte» og intervall som «25-50».
    static func employeeEstimate(from value: String) -> Int? {
        let values = decimalValues(in: value)
        guard let first = values.first, first >= 0 else { return nil }
        let estimate = values.count > 1 ? (first + values[1]) / 2 : first
        return Int(estimate.rounded())
    }

    /// Tolker norske skjema-input som «10-20 mill.», «1,5 mrd» og heltall.
    static func nokEstimate(from value: String) -> Double? {
        let lower = value.lowercased()
        let multiplier: Double
        if lower.contains("mrd") || lower.contains("milliard") {
            multiplier = 1_000_000_000
        } else if lower.contains("mill") {
            multiplier = 1_000_000
        } else if lower.contains("tusen") || lower.contains("k ") || lower.hasSuffix("k") {
            multiplier = 1_000
        } else {
            multiplier = 1
        }
        let values = decimalValues(in: value)
        guard let first = values.first, first >= 0 else { return nil }
        let estimate = values.count > 1 ? (first + values[1]) / 2 : first
        return estimate * multiplier
    }

    private static func decimalValues(in value: String) -> [Double] {
        let compact = value
            .replacingOccurrences(of: "\u{00a0}", with: "")
            .replacingOccurrences(of: " ", with: "")
        guard let expression = try? NSRegularExpression(pattern: #"\d+(?:[.,]\d+)?"#) else {
            return []
        }
        let range = NSRange(compact.startIndex..., in: compact)
        return expression.matches(in: compact, range: range).compactMap { match in
            guard let swiftRange = Range(match.range, in: compact) else { return nil }
            return Double(compact[swiftRange].replacingOccurrences(of: ",", with: "."))
        }
    }
}

struct LeadDraftClassification: Equatable, Sendable {
    let temperature: String
    let pipelineStage: String
    let leadStatus: String

    static func from(pinStatusRawValue value: String) -> Self {
        switch value {
        case "hot":      return .init(temperature: "hot", pipelineStage: "qualified", leadStatus: "interested")
        case "warm":     return .init(temperature: "warm", pipelineStage: "first_contact", leadStatus: "visited")
        case "customer": return .init(temperature: "ready", pipelineStage: "won", leadStatus: "won")
        case "meeting":  return .init(temperature: "hot", pipelineStage: "meeting", leadStatus: "meeting_booked")
        case "followup": return .init(temperature: "warm", pipelineStage: "first_contact", leadStatus: "return")
        default:          return .init(temperature: "cold", pipelineStage: "new", leadStatus: "unvisited")
        }
    }
}

struct LeadDuplicateCandidate: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let company: String?
    let email: String?
    let phone: String?
    let websiteUrl: String?
    let address: String?
    let city: String?
    let matchReasons: [String]
}

struct LeadCreationBrregLink: Codable, Equatable, Sendable {
    let status: String
    let orgNr: String?
    let matchedName: String?
    let via: String?
}

struct LeadCreationResponse: Codable, Equatable, Sendable {
    let ok: Bool
    let id: String
    let created: Bool
    let replayed: Bool
    let duplicatesChecked: Int
    let brreg: LeadCreationBrregLink?
}

enum LeadCreationSubmissionError: Error, LocalizedError, Sendable {
    case duplicate([LeadDuplicateCandidate])
    case idempotencyConflict

    var errorDescription: String? {
        switch self {
        case .duplicate:
            return "En mulig duplikat finnes allerede."
        case .idempotencyConflict:
            return "Dette skjemaet er allerede brukt med andre data. Åpne skjemaet på nytt."
        }
    }
}
