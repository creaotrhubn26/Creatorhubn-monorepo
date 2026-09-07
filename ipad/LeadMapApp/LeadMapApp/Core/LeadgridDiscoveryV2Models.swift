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

struct DiscoveryV2EmployeeCountFilter: Codable, Hashable, Sendable {
    var minimum: Int?
    var maximum: Int?
}

enum DiscoveryV2OrganizationStructure: String, Codable, CaseIterable, Sendable {
    case any
    case independent
    case chain

    static let evidenceNotice =
        "Viser bare registrert konsernstruktur i Brreg – ikke kommersiell kjede eller franchise."

    var title: String {
        switch self {
        case .any: return "Ikke filtrer på Brreg-konserntilknytning"
        case .independent: return "Ingen Brreg-konserntilknytning observert"
        case .chain: return "Brreg-konserntilknytning observert"
        }
    }
}

enum DiscoveryV2WebsiteRequirement: String, Codable, CaseIterable, Sendable {
    case any
    case present
    case missing

    var title: String {
        switch self {
        case .any: return "Ingen krav"
        case .present: return "Har nettsted"
        case .missing: return "Mangler nettsted"
        }
    }
}

struct DiscoveryV2CommercialSignals: Codable, Hashable, Sendable {
    var registeredInVatRegister: Bool?
    var registeredInBusinessRegister: Bool?

    enum CodingKeys: String, CodingKey {
        case registeredInVatRegister = "registered_in_vat_register"
        case registeredInBusinessRegister = "registered_in_business_register"
    }
}

struct DiscoveryV2WebsiteQualityFilter: Codable, Hashable, Sendable {
    var minimumScore: Int?

    enum CodingKeys: String, CodingKey {
        case minimumScore = "minimum_score"
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
    var territoryCode: String? = nil
    var municipalityNumbers: [String] = []
    var municipalityNames: [String] = []
    var organizationForms: [String] = []
    var employeeCount: DiscoveryV2EmployeeCountFilter? = nil
    var organizationStructure: DiscoveryV2OrganizationStructure = .any
    var websiteRequirement: DiscoveryV2WebsiteRequirement = .any
    var websiteQuality: DiscoveryV2WebsiteQualityFilter = .init(minimumScore: nil)
    var commercialSignals: DiscoveryV2CommercialSignals = .init(
        registeredInVatRegister: nil,
        registeredInBusinessRegister: nil)

    enum CodingKeys: String, CodingKey {
        case industryQueries = "industry_queries"
        case exclusionTerms = "exclusion_terms"
        case city, geo
        case targetCount = "target_count"
        case enrichmentCount = "enrichment_count"
        case minimumFitScore = "minimum_fit_score"
        case idealCustomer = "ideal_customer"
        case goal
        case territoryCode = "territory_code"
        case municipalityNumbers = "municipality_numbers"
        case municipalityNames = "municipality_names"
        case organizationForms = "organization_forms"
        case employeeCount = "employee_count"
        case organizationStructure = "organization_structure"
        case websiteRequirement = "website_requirement"
        case websiteQuality = "website_quality"
        case commercialSignals = "commercial_signals"
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
        value.organizationForms = organizationForms
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }
            .filter { !$0.isEmpty }
            .uniqued()
        value.municipalityNumbers = municipalityNumbers
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .uniqued()
        value.municipalityNames = municipalityNames
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .uniqued()
        value.city = Self.nilIfBlank(city)
        value.idealCustomer = Self.nilIfBlank(idealCustomer)
        value.goal = Self.nilIfBlank(goal)
        value.territoryCode = Self.nilIfBlank(territoryCode)?.lowercased()
        if var geo = value.geo {
            geo.radiusKm = min(50, max(1, geo.radiusKm))
            value.geo = geo
        }
        value.targetCount = min(60, max(1, targetCount))
        value.enrichmentCount = min(value.targetCount, min(60, max(1, enrichmentCount)))
        value.minimumFitScore = min(100, max(0, minimumFitScore))
        if var employeeCount = value.employeeCount {
            employeeCount.minimum = employeeCount.minimum.map { max(0, $0) }
            employeeCount.maximum = employeeCount.maximum.map { max(0, $0) }
            if employeeCount.minimum == nil && employeeCount.maximum == nil {
                value.employeeCount = nil
            } else {
                value.employeeCount = employeeCount
            }
        }
        value.websiteQuality.minimumScore = value.websiteQuality.minimumScore.map {
            min(100, max(0, $0))
        }
        return value
    }

    /// enrichment_count beholdes på wire og i databasen, men er bare et
    /// utførelsestak for registrerte nettsider når nettsidekvalitet er slått på.
    var effectiveWebsiteAssessmentLimit: Int? {
        guard websiteQuality.minimumScore != nil else { return nil }
        return min(targetCount, min(60, max(1, enrichmentCount)))
    }

    var websiteAssessmentLimitDescription: String {
        guard let limit = effectiveWebsiteAssessmentLimit else {
            return "Brukes kun når vurdering av nettsidekvalitet er aktivert."
        }
        return "Maks \(limit) Brreg-registrerte nettsider kan vurderes per kjøring."
    }

    var validationMessage: String? {
        let value = normalized
        if value.industryQueries.isEmpty { return "Skriv minst én kundetype." }
        if value.industryQueries.count > 8 { return "Du kan søke etter opptil åtte kundetyper." }
        let hasMunicipalities = !value.municipalityNumbers.isEmpty
            || !value.municipalityNames.isEmpty
        if value.geo == nil && value.city == nil && !hasMunicipalities {
            return "Velg kartområdet, skriv en by eller velg minst én kommune."
        }
        if hasMunicipalities && (value.geo != nil || value.city != nil) {
            return "Kommuneutvalg kan ikke kombineres med by eller kart-radius."
        }
        if value.municipalityNumbers.contains(where: { $0.range(of: #"^\d{4}$"#, options: .regularExpression) == nil }) {
            return "Kommunenummer må bestå av fire siffer."
        }
        if let territoryCode = value.territoryCode,
           territoryCode.range(
            of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#,
            options: .regularExpression) == nil || territoryCode.count > 48 {
            return "Territorium-taggen må være en kort kode, for eksempel «ost-nord»."
        }
        if value.enrichmentCount > value.targetCount {
            return "Taket for registrerte nettsider som kan vurderes, kan ikke være høyere enn antall kandidater."
        }
        if let employeeCount = value.employeeCount {
            if let minimum = employeeCount.minimum,
               minimum != 0 && minimum != 1 && minimum < 5 {
                return "Minimum ansatte må være 0, 1 eller minst 5."
            }
            if let maximum = employeeCount.maximum,
               maximum != 0 && maximum != 4 && maximum < 5 {
                return "Maksimum ansatte må være 0, 4 eller minst 5."
            }
            if let minimum = employeeCount.minimum,
               let maximum = employeeCount.maximum,
               minimum > maximum {
                return "Minste antall ansatte kan ikke være høyere enn største antall."
            }
        }
        if value.websiteRequirement == .missing,
           value.websiteQuality.minimumScore != nil {
            return "Nettsidekvalitet kan ikke kreves når profilen bare skal finne virksomheter uten registrert nettsted."
        }
        return nil
    }

    private static func nilIfBlank(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }
}

struct DiscoveryV2MunicipalityTextCodec {
    static func text(names: [String], numbers: [String]) -> String {
        let count = max(names.count, numbers.count)
        return (0..<count).map { index in
            let name = names.indices.contains(index) ? names[index] : ""
            let number = numbers.indices.contains(index) ? numbers[index] : ""
            if name.isEmpty { return number }
            if number.isEmpty { return name }
            return "\(name) | \(number)"
        }.joined(separator: "\n")
    }

    static func values(from text: String) -> (names: [String], numbers: [String]) {
        var names: [String] = []
        var numbers: [String] = []
        for rawLine in text.components(separatedBy: .newlines) {
            let parts = rawLine.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            guard parts.contains(where: { !$0.isEmpty }) else { continue }
            if parts.count == 1 {
                if parts[0].range(of: #"^\d{4}$"#, options: .regularExpression) != nil {
                    numbers.append(parts[0])
                } else {
                    names.append(parts[0])
                }
            } else {
                if !parts[0].isEmpty { names.append(parts[0]) }
                if !parts[1].isEmpty { numbers.append(parts[1]) }
            }
        }
        return (names.uniqued(), numbers.uniqued())
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
        territoryCode = try container.decodeIfPresent(String.self, forKey: .territoryCode)
        municipalityNumbers = try container.decodeIfPresent(
            [String].self,
            forKey: .municipalityNumbers
        ) ?? []
        municipalityNames = try container.decodeIfPresent(
            [String].self,
            forKey: .municipalityNames
        ) ?? []
        organizationForms = try container.decodeIfPresent(
            [String].self,
            forKey: .organizationForms
        ) ?? []
        employeeCount = try container.decodeIfPresent(
            DiscoveryV2EmployeeCountFilter.self,
            forKey: .employeeCount)
        organizationStructure = try container.decodeIfPresent(
            DiscoveryV2OrganizationStructure.self,
            forKey: .organizationStructure
        ) ?? .any
        websiteRequirement = try container.decodeIfPresent(
            DiscoveryV2WebsiteRequirement.self,
            forKey: .websiteRequirement
        ) ?? .any
        websiteQuality = try container.decodeIfPresent(
            DiscoveryV2WebsiteQualityFilter.self,
            forKey: .websiteQuality
        ) ?? .init(minimumScore: nil)
        commercialSignals = try container.decodeIfPresent(
            DiscoveryV2CommercialSignals.self,
            forKey: .commercialSignals
        ) ?? .init(
            registeredInVatRegister: nil,
            registeredInBusinessRegister: nil)
    }
}

extension DiscoveryV2Brief {
    var areaSummary: String {
        if !normalized.municipalityNames.isEmpty {
            return normalized.municipalityNames.joined(separator: " + ")
        }
        if !normalized.municipalityNumbers.isEmpty {
            return normalized.municipalityNumbers.joined(separator: " + ")
        }
        if let city = normalized.city { return city }
        if let geo = normalized.geo {
            return "\(Int(geo.radiusKm.rounded())) km rundt kartpunkt"
        }
        return "Område ikke valgt"
    }

    var fitFilterSummary: [String] {
        var values = ["Match minst \(normalized.minimumFitScore)"]
        if !normalized.organizationForms.isEmpty {
            values.append(normalized.organizationForms.joined(separator: ", "))
        }
        if let count = normalized.employeeCount {
            switch (count.minimum, count.maximum) {
            case let (minimum?, maximum?): values.append("\(minimum)–\(maximum) ansatte")
            case let (minimum?, nil): values.append("Minst \(minimum) ansatte")
            case let (nil, maximum?): values.append("Maks \(maximum) ansatte")
            case (nil, nil): break
            }
        }
        if normalized.organizationStructure != .any {
            values.append(normalized.organizationStructure.title)
        }
        if normalized.websiteRequirement != .any {
            values.append(normalized.websiteRequirement.title)
        }
        if let minimumScore = normalized.websiteQuality.minimumScore {
            values.append("Nettsted minst \(minimumScore)")
        }
        if normalized.commercialSignals.registeredInVatRegister == true {
            values.append("MVA-registrert")
        }
        if normalized.commercialSignals.registeredInBusinessRegister == true {
            values.append("Foretaksregisteret")
        }
        return values
    }
}

struct DiscoveryV2Municipality: Codable, Hashable, Sendable, Identifiable {
    var name: String
    var number: String
    var id: String { number }
}

struct DiscoveryV2ProfilePresetRegion: Hashable, Sendable, Identifiable {
    var name: String
    var territoryCode: String
    var municipalities: [DiscoveryV2Municipality]
    var id: String { territoryCode }
}

struct DiscoveryV2ProfilePresetDraft: Hashable, Sendable, Identifiable {
    var name: String
    var brief: DiscoveryV2Brief
    var id: String { brief.territoryCode ?? name }
}

struct DiscoveryV2ProfilePreset: Hashable, Sendable, Identifiable {
    var id: String
    var title: String
    var detail: String
    var regions: [DiscoveryV2ProfilePresetRegion]
    var targetCount: Int
    var enrichmentCount: Int
    var minimumFitScore: Int
    var requiredOrganizationForms: [String]
    var minimumEmployees: Int?

    static let osloRegionClinicPilot = Self(
        id: "oslo-region-clinic-pilot",
        title: "Oslo og omegn – klinikkpilot",
        detail: "Fire territorier med samme kundetype, ICP og eksklusjoner. Malen kan brukes i alle klinikkprosjekter.",
        regions: [
            .init(
                name: "Oslo kjerne",
                territoryCode: "oslo",
                municipalities: [.init(name: "Oslo", number: "0301")]),
            .init(
                name: "Vest",
                territoryCode: "vest",
                municipalities: [
                    .init(name: "Bærum", number: "3201"),
                    .init(name: "Asker", number: "3203"),
                ]),
            .init(
                name: "Øst og nord",
                territoryCode: "ost-nord",
                municipalities: [
                    .init(name: "Lørenskog", number: "3222"),
                    .init(name: "Lillestrøm", number: "3205"),
                    .init(name: "Nittedal", number: "3232"),
                    .init(name: "Rælingen", number: "3224"),
                    .init(name: "Ullensaker", number: "3209"),
                ]),
            .init(
                name: "Sør",
                territoryCode: "sor",
                municipalities: [
                    .init(name: "Nordre Follo", number: "3207"),
                    .init(name: "Nesodden", number: "3212"),
                    .init(name: "Frogn", number: "3214"),
                    .init(name: "Ås", number: "3218"),
                    .init(name: "Vestby", number: "3216"),
                ]),
        ],
        targetCount: 60,
        enrichmentCount: 40,
        minimumFitScore: 65,
        requiredOrganizationForms: ["AS"],
        minimumEmployees: 5)

    func drafts(copying baseBrief: DiscoveryV2Brief) -> [DiscoveryV2ProfilePresetDraft] {
        regions.map { region in
            var brief = baseBrief
            brief.city = nil
            brief.geo = nil
            brief.municipalityNames = region.municipalities.map(\.name)
            brief.municipalityNumbers = region.municipalities.map(\.number)
            brief.territoryCode = region.territoryCode
            brief.targetCount = targetCount
            brief.enrichmentCount = min(targetCount, enrichmentCount)
            brief.minimumFitScore = minimumFitScore
            if !requiredOrganizationForms.isEmpty {
                brief.organizationForms = requiredOrganizationForms
            }
            if let minimumEmployees {
                let requestedMinimum = brief.employeeCount?.minimum ?? minimumEmployees
                let effectiveMinimum = max(minimumEmployees, requestedMinimum)
                let requestedMaximum = brief.employeeCount?.maximum
                brief.employeeCount = .init(
                    minimum: effectiveMinimum,
                    maximum: requestedMaximum.flatMap { $0 >= effectiveMinimum ? $0 : nil })
            }
            return .init(name: region.name, brief: brief.normalized)
        }
    }
}

struct DiscoveryV2ProfileBatchRequest: Codable, Hashable, Sendable {
    var profiles: [DiscoveryV2ProfileWrite]
}

struct DiscoveryV2ProfileBatchResponse: Codable, Hashable, Sendable {
    var profiles: [DiscoveryV2Profile]
    var replayed: Bool
}

/// One stable key for the lifetime of an explicit batch attempt. The
/// confirmation sheet keeps this value across retry taps, so a lost response
/// can be replayed without creating another set of profiles.
struct DiscoveryV2ProfileBatchAttempt: Equatable, Sendable {
    let idempotencyKey: String

    init(id: UUID = UUID()) {
        idempotencyKey = id.uuidString.lowercased()
    }
}

struct DiscoveryV2ProfileBatchResult: Equatable, Sendable {
    var createdNames: [String]
    var existingNames: [String]
    var failedNames: [String]
    var replayed = false

    var isComplete: Bool { failedNames.isEmpty }
    var createdCount: Int { createdNames.count }
    var existingCount: Int { existingNames.count }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
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

struct DiscoveryV2MunicipalityArea: Codable, Hashable, Sendable {
    var municipalityNumbers: [String]
    var municipalityNames: [String]

    enum CodingKeys: String, CodingKey {
        case municipalityNumbers = "municipality_numbers"
        case municipalityNames = "municipality_names"
    }
}

enum DiscoveryV2PlanArea: Codable, Hashable, Sendable {
    case geo(DiscoveryV2Geo)
    case city(String)
    case municipalities(DiscoveryV2MunicipalityArea)

    private enum Keys: String, CodingKey {
        case latitude, longitude, radiusKm = "radius_km", city
        case municipalityNumbers = "municipality_numbers"
        case municipalityNames = "municipality_names"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        if let city = try container.decodeIfPresent(String.self, forKey: .city) {
            self = .city(city)
            return
        }
        let municipalityNumbers = try container.decodeIfPresent(
            [String].self,
            forKey: .municipalityNumbers
        ) ?? []
        let municipalityNames = try container.decodeIfPresent(
            [String].self,
            forKey: .municipalityNames
        ) ?? []
        if !municipalityNumbers.isEmpty || !municipalityNames.isEmpty {
            self = .municipalities(.init(
                municipalityNumbers: municipalityNumbers,
                municipalityNames: municipalityNames))
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
        case .municipalities(let area):
            try container.encode(area.municipalityNumbers, forKey: .municipalityNumbers)
            try container.encode(area.municipalityNames, forKey: .municipalityNames)
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
    var territoryCode: String?
    var warnings: [DiscoveryV2PlanWarning]

    enum CodingKeys: String, CodingKey {
        case version, queries, source, area, warnings
        case territoryCode = "territory_code"
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


enum DiscoveryV2CampaignStatus: Hashable, Sendable {
    case queued, running, completed, partial, failed, cancelRequested, cancelled
    case unknown(String)

    var rawValue: String {
        switch self {
        case .queued: "queued"
        case .running: "running"
        case .completed: "completed"
        case .partial: "partial"
        case .failed: "failed"
        case .cancelRequested: "cancel_requested"
        case .cancelled: "cancelled"
        case .unknown(let value): value
        }
    }

    var isActive: Bool {
        switch self {
        case .queued, .running, .cancelRequested: true
        default: false
        }
    }

    var title: String {
        switch self {
        case .queued: "I kø"
        case .running: "Kjører"
        case .completed: "Fullført"
        case .partial: "Delvis fullført"
        case .failed: "Stoppet"
        case .cancelRequested: "Avbryter"
        case .cancelled: "Avbrutt"
        case .unknown: "Oppdateres"
        }
    }
}

extension DiscoveryV2CampaignStatus: Codable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = switch raw {
        case "queued": .queued
        case "running": .running
        case "completed": .completed
        case "partial": .partial
        case "failed": .failed
        case "cancel_requested": .cancelRequested
        case "cancelled": .cancelled
        default: .unknown(raw)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

enum DiscoveryV2CampaignItemStatus: Hashable, Sendable {
    case pending, launching, queued, running, completed, partial, failed, cancelled
    case unknown(String)

    var rawValue: String {
        switch self {
        case .pending: "pending"
        case .launching: "launching"
        case .queued: "queued"
        case .running: "running"
        case .completed: "completed"
        case .partial: "partial"
        case .failed: "failed"
        case .cancelled: "cancelled"
        case .unknown(let value): value
        }
    }

    var isActive: Bool {
        switch self {
        case .launching, .queued, .running: true
        default: false
        }
    }

    var title: String {
        switch self {
        case .pending: "Venter"
        case .launching: "Starter"
        case .queued: "I kø"
        case .running: "Kjører"
        case .completed: "Fullført"
        case .partial: "Delvis"
        case .failed: "Feilet"
        case .cancelled: "Avbrutt"
        case .unknown: "Oppdateres"
        }
    }
}

extension DiscoveryV2CampaignItemStatus: Codable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = switch raw {
        case "pending": .pending
        case "launching": .launching
        case "queued": .queued
        case "running": .running
        case "completed": .completed
        case "partial": .partial
        case "failed": .failed
        case "cancelled": .cancelled
        default: .unknown(raw)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct DiscoveryV2CampaignAttempt: Codable, Hashable, Sendable, Identifiable {
    var attemptNo: Int
    var runId: String
    var status: DiscoveryV2RunStatus
    var candidateCount: Int
    var reviewReadyCount: Int
    var errorCode: String?
    var errorMessage: String?
    var startedAt: String?
    var finishedAt: String?
    var createdAt: String

    var id: String { runId }

    enum CodingKeys: String, CodingKey {
        case status
        case attemptNo = "attempt_no"
        case runId = "run_id"
        case candidateCount = "candidate_count"
        case reviewReadyCount = "review_ready_count"
        case errorCode = "error_code"
        case errorMessage = "error_message"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case createdAt = "created_at"
    }
}

struct DiscoveryV2CampaignItem: Codable, Hashable, Sendable, Identifiable {
    var position: Int
    var profileId: String
    var profileVersion: Int
    var profileName: String
    var territoryCode: String?
    var briefSnapshot: DiscoveryV2Brief
    var status: DiscoveryV2CampaignItemStatus
    var attemptCount: Int
    var currentRunId: String?
    var runStatus: DiscoveryV2RunStatus?
    var candidateCount: Int
    var researchedCount: Int
    var reviewReadyCount: Int
    var errorCode: String?
    var errorMessage: String?
    var startedAt: String?
    var finishedAt: String?
    var attempts: [DiscoveryV2CampaignAttempt]

    var id: String { "\(position)-\(profileId)" }

    enum CodingKeys: String, CodingKey {
        case position, status, attempts
        case profileId = "profile_id"
        case profileVersion = "profile_version"
        case profileName = "profile_name"
        case territoryCode = "territory_code"
        case briefSnapshot = "brief_snapshot"
        case attemptCount = "attempt_count"
        case currentRunId = "current_run_id"
        case runStatus = "run_status"
        case candidateCount = "candidate_count"
        case researchedCount = "researched_count"
        case reviewReadyCount = "review_ready_count"
        case errorCode = "error_code"
        case errorMessage = "error_message"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
    }
}

struct DiscoveryV2CampaignRun: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var organizationId: String
    var projectId: String
    var name: String
    var status: DiscoveryV2CampaignStatus
    var profileIds: [String]
    var currentPosition: Int
    var totalProfiles: Int
    var completedProfiles: Int
    var partialProfiles: Int
    var failedProfiles: Int
    var activeRunId: String?
    var requestedBy: String?
    var cancellationRequestedAt: String?
    var cancellationRequestedBy: String?
    var startedAt: String?
    var finishedAt: String?
    var errorCode: String?
    var errorMessage: String?
    var version: Int
    var createdAt: String
    var updatedAt: String
    var items: [DiscoveryV2CampaignItem]

    var currentItem: DiscoveryV2CampaignItem? {
        items.first(where: { $0.position == currentPosition })
            ?? items.first(where: { $0.status.isActive })
    }

    var linkedRunIsActive: Bool {
        activeRunId != nil && currentItem?.runStatus?.isRunning == true
    }

    var needsStatusPolling: Bool { status.isActive || linkedRunIsActive }

    var finishedProfileCount: Int {
        items.filter {
            switch $0.status {
            case .completed, .partial, .failed, .cancelled: true
            default: false
            }
        }.count
    }

    var progress: Double {
        guard totalProfiles > 0 else { return 0 }
        return min(1, Double(finishedProfileCount) / Double(totalProfiles))
    }

    var candidateCount: Int { items.reduce(0) { $0 + $1.candidateCount } }
    var reviewReadyCount: Int { items.reduce(0) { $0 + $1.reviewReadyCount } }

    enum CodingKeys: String, CodingKey {
        case id, name, status, version, items
        case organizationId = "organization_id"
        case projectId = "project_id"
        case profileIds = "profile_ids"
        case currentPosition = "current_position"
        case totalProfiles = "total_profiles"
        case completedProfiles = "completed_profiles"
        case partialProfiles = "partial_profiles"
        case failedProfiles = "failed_profiles"
        case activeRunId = "active_run_id"
        case requestedBy = "requested_by"
        case cancellationRequestedAt = "cancellation_requested_at"
        case cancellationRequestedBy = "cancellation_requested_by"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case errorCode = "error_code"
        case errorMessage = "error_message"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct DiscoveryV2CampaignProfileReference: Codable, Hashable, Sendable {
    var profileId: String
    var expectedVersion: Int

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case expectedVersion = "expected_version"
    }
}

struct DiscoveryV2CampaignCreateRequest: Codable, Hashable, Sendable {
    var name: String
    var profiles: [DiscoveryV2CampaignProfileReference]

    enum CodingKeys: String, CodingKey {
        case name, profiles
    }
}

/// Exact start intent persisted before POST. Retrying this value with the
/// same key is the only safe recovery when the server may have committed but
/// the response was lost.
struct DiscoveryV2PendingCampaignStart: Codable, Hashable, Sendable {
    var request: DiscoveryV2CampaignCreateRequest
    var idempotencyKey: String
}

struct DiscoveryV2CampaignMutation: Codable, Hashable, Sendable {
    var campaign: DiscoveryV2CampaignRun
    var replayed: Bool
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

struct DiscoveryV2CandidateProfileProvenance: Codable, Hashable, Sendable {
    var id: String?
    var name: String?
    var version: Int?
    var territoryCode: String?

    enum CodingKeys: String, CodingKey {
        case id, name, version
        case territoryCode = "territory_code"
    }
}

struct DiscoveryV2CandidateProfileObservation: Codable, Hashable, Sendable, Identifiable {
    var profileId: String?
    var profileName: String?
    var profileVersion: Int?
    var territoryCode: String?
    var runCount: Int
    var lastSeenAt: String

    var id: String {
        [profileId, territoryCode, lastSeenAt].compactMap { $0 }.joined(separator: "|")
    }

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case profileName = "profile_name"
        case profileVersion = "profile_version"
        case territoryCode = "territory_code"
        case runCount = "run_count"
        case lastSeenAt = "last_seen_at"
    }
}

enum DiscoveryV2ObservationOrigin: String, Hashable, Sendable {
    case providerObservation = "provider_observation"
    case rollingDeployCanonicalFallback = "rolling_deploy_canonical_fallback"
    case legacyBackfillCurrentCanonical = "legacy_backfill_current_canonical"
    case unknown
}

extension DiscoveryV2ObservationOrigin: Codable {
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: raw) ?? .unknown
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct DiscoveryV2ObservationMetadata: Codable, Hashable, Sendable {
    var origin: DiscoveryV2ObservationOrigin
    var observedAt: String?
    var capturedAt: String?
    var isApproximate: Bool

    enum CodingKeys: String, CodingKey {
        case origin
        case observedAt = "observed_at"
        case capturedAt = "captured_at"
        case isApproximate = "is_approximate"
    }

    var reviewNotice: String? {
        guard isApproximate || origin != .providerObservation else { return nil }
        switch origin {
        case .legacyBackfillCurrentCanonical:
            return "Historisk kandidatdata er tilbakefylt fra siste kjente registerverdi. Kontroller feltene før godkjenning."
        case .rollingDeployCanonicalFallback:
            return "Kandidatdata ble fanget via kompatibilitetsmodus. Kontroller tidsfølsomme felt før godkjenning."
        case .unknown:
            return "Observasjonens opprinnelse er ukjent. Kontroller feltene før godkjenning."
        case .providerObservation:
            return "Observasjonen er merket som approksimert. Kontroller feltene før godkjenning."
        }
    }
}

struct DiscoveryV2WebsiteQualitySignals: Codable, Hashable, Sendable {
    var https: Bool?
    var reachable: Bool?
    var title: Bool?
    var metaDescription: Bool?
    var viewport: Bool?
    var contactPath: Bool?
    var callToAction: Bool?

    enum CodingKeys: String, CodingKey {
        case https, reachable, title, viewport
        case metaDescription = "meta_description"
        case contactPath = "contact_path"
        case callToAction = "call_to_action"
    }
}

struct DiscoveryV2WebsiteQualityEvidence: Codable, Hashable, Sendable {
    var sourceUri: String?
    var finalUrl: String?
    var fetchedAt: String?
    var httpStatus: Int?
    var redirectCount: Int?
    var signals: DiscoveryV2WebsiteQualitySignals?

    enum CodingKeys: String, CodingKey {
        case signals
        case sourceUri = "source_uri"
        case finalUrl = "final_url"
        case fetchedAt = "fetched_at"
        case httpStatus = "http_status"
        case redirectCount = "redirect_count"
    }
}

struct DiscoveryV2WebsiteQualityAssessment: Codable, Hashable, Sendable {
    var status: String
    var score: Double?
    var minimumScore: Int?
    var outcome: String?
    var reason: String?
    var evidence: DiscoveryV2WebsiteQualityEvidence?
    // Candidate-level assessment exposes evidence directly, while the score
    // explanation nests the same fields in `evidence`. Decode both shapes.
    var sourceUri: String?
    var finalUrl: String?
    var fetchedAt: String?
    var httpStatus: Int?
    var redirectCount: Int?
    var signals: DiscoveryV2WebsiteQualitySignals?

    enum CodingKeys: String, CodingKey {
        case status, score, outcome, reason, evidence, signals
        case minimumScore = "minimum_score"
        case sourceUri = "source_uri"
        case finalUrl = "final_url"
        case fetchedAt = "fetched_at"
        case httpStatus = "http_status"
        case redirectCount = "redirect_count"
    }

    var resolvedEvidence: DiscoveryV2WebsiteQualityEvidence? {
        if let evidence { return evidence }
        guard sourceUri != nil || finalUrl != nil || fetchedAt != nil
                || httpStatus != nil || redirectCount != nil || signals != nil
        else { return nil }
        return .init(
            sourceUri: sourceUri,
            finalUrl: finalUrl,
            fetchedAt: fetchedAt,
            httpStatus: httpStatus,
            redirectCount: redirectCount,
            signals: signals)
    }

    var presentation: String? {
        if status == "assessed", let score {
            return "Nettsidekvalitet \(Int(score.rounded())) av 100"
        }
        guard minimumScore != nil || status == "unknown" else { return nil }
        return "Nettsidekvalitet ukjent – beholdt for manuell vurdering"
    }
}

struct DiscoveryV2ScoreExplanation: Codable, Hashable, Sendable {
    var websiteQuality: DiscoveryV2WebsiteQualityAssessment?

    enum CodingKeys: String, CodingKey {
        case websiteQuality = "website_quality"
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
    var organizationFormCode: String?
    var organizationStructure: String?
    var naceCode: String?
    var naceDescription: String?
    var employeeCount: Int?
    var registeredInVatRegister: Bool?
    var registeredInBusinessRegister: Bool?
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
    var discoveryProfile: DiscoveryV2CandidateProfileProvenance?
    var observedRunCount: Int?
    var observedInProfiles: [DiscoveryV2CandidateProfileObservation]?
    var websiteQuality: DiscoveryV2WebsiteQualityAssessment?
    var scoreExplanation: DiscoveryV2ScoreExplanation?
    var observation: DiscoveryV2ObservationMetadata?

    enum CodingKeys: String, CodingKey {
        case id, name, phone, email, address, city, latitude, longitude, status, disposition, excluded, reasons, evidence, sources, observation
        case websiteUrl = "website_url"
        case source
        case organizationNumber = "organization_number"
        case organizationForm = "organization_form"
        case organizationFormCode = "organization_form_code"
        case organizationStructure = "organization_structure"
        case naceCode = "nace_code"
        case naceDescription = "nace_description"
        case employeeCount = "employee_count"
        case registeredInVatRegister = "registered_in_vat_register"
        case registeredInBusinessRegister = "registered_in_business_register"
        case sourceUri = "source_uri"
        case researchStatus = "research_status"
        case fitScore = "fit_score"
        case fitCoverage = "fit_coverage"
        case dataQualityScore = "data_quality_score"
        case dataQualityCoverage = "data_quality_coverage"
        case exclusionMatches = "exclusion_matches"
        case discoveryProfile = "discovery_profile"
        case observedRunCount = "observed_run_count"
        case observedInProfiles = "observed_in_profiles"
        case websiteQuality = "website_quality"
        case scoreExplanation = "score_explanation"
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
    /// Set only after the user explicitly confirms a transient Google Maps
    /// identity match. Merely opening Places details must never populate it.
    var confirmedGooglePlaceId: String? = nil

    enum CodingKeys: String, CodingKey {
        case decision, note
        case reasonCode = "reason_code"
        case confirmedGooglePlaceId = "confirmed_google_place_id"
    }
}

enum DiscoveryV2ProfileStatus: String, Codable, Hashable, Sendable {
    case active, paused, archived
}

struct DiscoveryV2Profile: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var name: String
    var isDefault: Bool
    var version: Int
    var brief: DiscoveryV2Brief
    var placesDetailsEnabled: Bool?
    var status: DiscoveryV2ProfileStatus? = nil

    /// Cached profiles written by older clients have no status. Treat those
    /// as active locally; the authoritative list is reloaded before start.
    var isActive: Bool { status == nil || status == .active }

    enum CodingKeys: String, CodingKey {
        case id, name, version, brief, status
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
    var status: DiscoveryV2ProfileStatus? = nil

    enum CodingKeys: String, CodingKey {
        case name, brief, status
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
