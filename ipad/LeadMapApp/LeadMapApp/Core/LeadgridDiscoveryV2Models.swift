// LeadgridDiscoveryV2Models.swift
//
// Native, durable Discovery contract. These models intentionally live next to
// the legacy LeadDiscovery models: TestFlight builds can finish an old batch
// while new clients use the review-before-import v2 flow.

import Foundation
import CoreLocation

struct DiscoveryV2Geo: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double
    var radiusKm: Double

    enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case radiusKm = "radius_km"
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct DiscoveryV2Brief: Codable, Hashable, Sendable {
    var industryQueries: [String]
    var exclusionTerms: [String]
    var city: String?
    var geo: DiscoveryV2Geo?
    var targetCount: Int
    var enrichmentCount: Int
    var minimumFitScore: Int
    var idealCustomer: String?
    var goal: String?

    enum CodingKeys: String, CodingKey {
        case industryQueries = "industry_queries"
        case exclusionTerms = "exclusion_terms"
        case city, geo
        case targetCount = "target_count"
        case enrichmentCount = "enrichment_count"
        case minimumFitScore = "minimum_fit_score"
        case idealCustomer = "ideal_customer"
        case goal
    }

    static func mapArea(center: CLLocationCoordinate2D, radiusKm: Double = 10) -> Self {
        Self(
            industryQueries: [""],
            exclusionTerms: [],
            city: nil,
            geo: .init(latitude: center.latitude, longitude: center.longitude, radiusKm: radiusKm),
            targetCount: 20,
            enrichmentCount: 10,
            minimumFitScore: 50,
            idealCustomer: nil,
            goal: nil
        )
    }

    var normalized: Self {
        var value = self
        value.industryQueries = industryQueries
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        value.exclusionTerms = exclusionTerms
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        value.city = Self.nilIfBlank(city)
        value.idealCustomer = Self.nilIfBlank(idealCustomer)
        value.goal = Self.nilIfBlank(goal)
        if var geo = value.geo {
            geo.radiusKm = min(50, max(1, geo.radiusKm))
            value.geo = geo
        }
        value.targetCount = min(60, max(1, targetCount))
        value.enrichmentCount = min(value.targetCount, min(60, max(1, enrichmentCount)))
        value.minimumFitScore = min(100, max(0, minimumFitScore))
        return value
    }

    var validationMessage: String? {
        let value = normalized
        if value.industryQueries.isEmpty { return "Skriv minst én kundetype." }
        if value.industryQueries.count > 8 { return "Du kan søke etter opptil åtte kundetyper." }
        if value.geo == nil && value.city == nil { return "Velg kartområdet eller skriv en by." }
        if value.enrichmentCount > value.targetCount { return "Antall som undersøkes kan ikke være høyere enn måltallet." }
        return nil
    }

    private static func nilIfBlank(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

extension DiscoveryV2Brief {
    /// Profiles created before Discovery v2 did not persist every scoring field.
    /// Keep the product default when decoding migrated profile/run snapshots.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        industryQueries = try container.decode([String].self, forKey: .industryQueries)
        exclusionTerms = try container.decodeIfPresent([String].self, forKey: .exclusionTerms) ?? []
        city = try container.decodeIfPresent(String.self, forKey: .city)
        geo = try container.decodeIfPresent(DiscoveryV2Geo.self, forKey: .geo)
        targetCount = try container.decode(Int.self, forKey: .targetCount)
        enrichmentCount = try container.decode(Int.self, forKey: .enrichmentCount)
        minimumFitScore = try container.decodeIfPresent(
            Int.self,
            forKey: .minimumFitScore
        ) ?? 50
        idealCustomer = try container.decodeIfPresent(String.self, forKey: .idealCustomer)
        goal = try container.decodeIfPresent(String.self, forKey: .goal)
    }
}

struct DiscoveryV2DataSource: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var provider: String
    var providerUri: String
    var license: String
    var licenseUri: String
    var notice: String

    enum CodingKeys: String, CodingKey {
        case id, provider, license, notice
        case providerUri = "provider_uri"
        case licenseUri = "license_uri"
    }
}

struct DiscoveryV2PlanQuery: Codable, Hashable, Sendable, Identifiable {
    var textQuery: String
    var hardGeoFilter: Bool
    var id: String { textQuery }

    enum CodingKeys: String, CodingKey {
        case textQuery = "text_query"
        case hardGeoFilter = "hard_geo_filter"
    }
}

struct DiscoveryV2PlanWarning: Codable, Hashable, Sendable, Identifiable {
    var code: String
    var message: String
    var id: String { code + message }
}

enum DiscoveryV2PlanArea: Codable, Hashable, Sendable {
    case geo(DiscoveryV2Geo)
    case city(String)

    private enum Keys: String, CodingKey { case latitude, longitude, radiusKm = "radius_km", city }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        if let city = try container.decodeIfPresent(String.self, forKey: .city) {
            self = .city(city)
            return
        }
        self = .geo(.init(
            latitude: try container.decode(Double.self, forKey: .latitude),
            longitude: try container.decode(Double.self, forKey: .longitude),
            radiusKm: try container.decode(Double.self, forKey: .radiusKm)
        ))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: Keys.self)
        switch self {
        case .city(let city):
            try container.encode(city, forKey: .city)
        case .geo(let geo):
            try container.encode(geo.latitude, forKey: .latitude)
            try container.encode(geo.longitude, forKey: .longitude)
            try container.encode(geo.radiusKm, forKey: .radiusKm)
        }
    }
}

struct DiscoveryV2SearchPlan: Codable, Hashable, Sendable {
    var version: Int
    var queries: [DiscoveryV2PlanQuery]
    var source: String
    var requestedCandidates: Int
    var enrichmentCandidates: Int
    var estimatedSearchPages: Int
    var area: DiscoveryV2PlanArea
    var warnings: [DiscoveryV2PlanWarning]

    enum CodingKeys: String, CodingKey {
        case version, queries, source, area, warnings
        case requestedCandidates = "requested_candidates"
        case enrichmentCandidates = "enrichment_candidates"
        case estimatedSearchPages = "estimated_search_pages"
    }
}

struct DiscoveryV2Preview: Codable, Hashable, Sendable {
    var brief: DiscoveryV2Brief
    var plan: DiscoveryV2SearchPlan
    var planHash: String
    var sources: [DiscoveryV2DataSource]?

    enum CodingKeys: String, CodingKey {
        case brief, plan, sources
        case planHash = "plan_hash"
    }
}

enum DiscoveryV2RunStatus: Hashable, Sendable {
    case planning, awaitingConfirmation, queued, searching, researching
    case reviewReady, completed, partial, cancelRequested, cancelled, failed
    case unknown(String)

    var rawValue: String {
        switch self {
        case .planning: "planning"
        case .awaitingConfirmation: "awaiting_confirmation"
        case .queued: "queued"
        case .searching: "searching"
        case .researching: "researching"
        case .reviewReady: "review_ready"
        case .completed: "completed"
        case .partial: "partial"
        case .cancelRequested: "cancel_requested"
        case .cancelled: "cancelled"
        case .failed: "failed"
        case .unknown(let value): value
        }
    }

    var isRunning: Bool {
        switch self {
        case .planning, .awaitingConfirmation, .queued, .searching, .researching, .cancelRequested: true
        default: false
        }
    }

    var needsReview: Bool {
        switch self { case .reviewReady, .partial: true; default: false }
    }
}

extension DiscoveryV2RunStatus: Codable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = switch raw {
        case "planning": .planning
        case "awaiting_confirmation": .awaitingConfirmation
        case "queued": .queued
        case "searching": .searching
        case "researching": .researching
        case "review_ready": .reviewReady
        case "completed": .completed
        case "partial": .partial
        case "cancel_requested": .cancelRequested
        case "cancelled": .cancelled
        case "failed": .failed
        default: .unknown(raw)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct DiscoveryV2Run: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var projectId: String?
    var profileId: String?
    var status: DiscoveryV2RunStatus
    var briefSnapshot: DiscoveryV2Brief?
    var searchPlan: DiscoveryV2SearchPlan?
    var planHash: String?
    var requestedCount: Int?
    var enrichmentCount: Int?
    var rawResultCount: Int?
    var duplicateCount: Int?
    var excludedCount: Int?
    var candidateCount: Int?
    var researchedCount: Int?
    var reviewReadyCount: Int?
    var approvedCount: Int?
    var rejectedCount: Int?
    var importedCount: Int?
    var failedCount: Int?
    var errorCode: String?
    var errorMessage: String?
    var startedAt: String?
    var finishedAt: String?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case projectId = "project_id"
        case profileId = "profile_id"
        case briefSnapshot = "brief_snapshot"
        case searchPlan = "search_plan"
        case planHash = "plan_hash"
        case requestedCount = "requested_count"
        case enrichmentCount = "enrichment_count"
        case rawResultCount = "raw_result_count"
        case duplicateCount = "duplicate_count"
        case excludedCount = "excluded_count"
        case candidateCount = "candidate_count"
        case researchedCount = "researched_count"
        case reviewReadyCount = "review_ready_count"
        case approvedCount = "approved_count"
        case rejectedCount = "rejected_count"
        case importedCount = "imported_count"
        case failedCount = "failed_count"
        case errorCode = "error_code"
        case errorMessage = "error_message"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var completedWorkCount: Int {
        max(researchedCount ?? 0, (reviewReadyCount ?? 0) + (failedCount ?? 0))
    }

    var totalWorkCount: Int { max(1, candidateCount ?? requestedCount ?? 1) }
    var progress: Double { min(1, Double(completedWorkCount) / Double(totalWorkCount)) }
}

enum DiscoveryV2CandidateDisposition: String, Codable, CaseIterable, Sendable {
    case found, existingCandidate = "existing_candidate", existingLead = "existing_lead"
    case excluded, researchPending = "research_pending", researching, reviewReady = "review_ready"
    case approved, rejected, imported, duplicate, failed
}

struct DiscoveryV2Evidence: Codable, Hashable, Sendable, Identifiable {
    var factor: String?
    var label: String?
    var value: String?
    var source: String?
    var reference: String?
    var id: String { [factor, label, value, source, reference].compactMap { $0 }.joined(separator: "|") }

    enum CodingKeys: String, CodingKey {
        case factor, label, value, source
        case reference = "ref"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        factor = try container.decodeIfPresent(String.self, forKey: .factor)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        reference = try container.decodeIfPresent(String.self, forKey: .reference)
        if let string = try? container.decode(String.self, forKey: .value) {
            value = string
        } else if let number = try? container.decode(Double.self, forKey: .value) {
            value = number.rounded() == number ? String(Int64(number)) : String(number)
        } else if let boolean = try? container.decode(Bool.self, forKey: .value) {
            value = boolean ? "true" : "false"
        } else {
            value = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(factor, forKey: .factor)
        try container.encodeIfPresent(label, forKey: .label)
        try container.encodeIfPresent(value, forKey: .value)
        try container.encodeIfPresent(source, forKey: .source)
        try container.encodeIfPresent(reference, forKey: .reference)
    }
}


struct DiscoveryV2Candidate: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var name: String
    var websiteUrl: String?
    var source: String?
    var phone: String?
    var email: String?
    var address: String?
    var city: String?
    var latitude: Double?
    var longitude: Double?
    var organizationNumber: String?
    var organizationForm: String?
    var naceCode: String?
    var naceDescription: String?
    var employeeCount: Int?
    var registeredInVatRegister: Bool?
    var sourceUri: String?
    var sources: [DiscoveryV2DataSource]?
    var status: String?
    var researchStatus: String?
    var disposition: DiscoveryV2CandidateDisposition?
    var fitScore: Int?
    var fitCoverage: Double?
    var dataQualityScore: Int?
    var dataQualityCoverage: Double?
    var excluded: Bool?
    var exclusionMatches: [String]?
    var reasons: [String]?
    var evidence: [DiscoveryV2Evidence]?

    enum CodingKeys: String, CodingKey {
        case id, name, phone, email, address, city, latitude, longitude, status, disposition, excluded, reasons, evidence, sources
        case websiteUrl = "website_url"
        case source
        case organizationNumber = "organization_number"
        case organizationForm = "organization_form"
        case naceCode = "nace_code"
        case naceDescription = "nace_description"
        case employeeCount = "employee_count"
        case registeredInVatRegister = "registered_in_vat_register"
        case sourceUri = "source_uri"
        case researchStatus = "research_status"
        case fitScore = "fit_score"
        case fitCoverage = "fit_coverage"
        case dataQualityScore = "data_quality_score"
        case dataQualityCoverage = "data_quality_coverage"
        case exclusionMatches = "exclusion_matches"
    }


    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

enum DiscoveryV2Decision: String, Codable, Sendable { case approve, reject }

enum DiscoveryV2ReasonCode: String, Codable, CaseIterable, Sendable, Identifiable {
    case goodFit = "good_fit"
    case wrongCustomerType = "wrong_customer_type"
    case outsideArea = "outside_area"
    case competitor, duplicate
    case wrongSize = "wrong_size"
    case insufficientData = "insufficient_data"
    case notRelevant = "not_relevant"
    case other

    var id: String { rawValue }
    var title: String {
        switch self {
        case .goodFit: "God match"
        case .wrongCustomerType: "Feil kundetype"
        case .outsideArea: "Utenfor området"
        case .competitor: "Konkurrent"
        case .duplicate: "Duplikat"
        case .wrongSize: "Feil størrelse"
        case .insufficientData: "For lite data"
        case .notRelevant: "Ikke relevant"
        case .other: "Annet"
        }
    }
}

struct DiscoveryV2DecisionRequest: Codable, Hashable, Sendable {
    var decision: DiscoveryV2Decision
    var reasonCode: DiscoveryV2ReasonCode?
    var note: String?

    enum CodingKeys: String, CodingKey {
        case decision, note
        case reasonCode = "reason_code"
    }
}

struct DiscoveryV2Profile: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var name: String
    var isDefault: Bool
    var version: Int
    var brief: DiscoveryV2Brief
    var placesDetailsEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, version, brief
        case isDefault = "is_default"
        case placesDetailsEnabled = "places_details_enabled"
    }
}

struct DiscoveryV2ProfileWrite: Codable, Hashable, Sendable {
    var name: String
    var isDefault: Bool
    var expectedVersion: Int?
    var brief: DiscoveryV2Brief
    var placesDetailsEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case name, brief
        case isDefault = "is_default"
        case expectedVersion = "expected_version"
        case placesDetailsEnabled = "places_details_enabled"
    }
}

struct DiscoveryV2APIErrorBody: Codable, Sendable {
    struct Detail: Codable, Sendable {
        var code: String
        var message: String
        var retryable: Bool
        var field: String?
    }
    var error: Detail
}

struct DiscoveryV2ServiceError: Error, LocalizedError, Sendable {
    var code: String
    var message: String
    var retryable: Bool
    var field: String?
    var statusCode: Int
    var errorDescription: String? { message }
}
