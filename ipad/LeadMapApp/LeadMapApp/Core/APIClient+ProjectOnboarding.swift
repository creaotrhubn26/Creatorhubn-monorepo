import Foundation

struct LeadgridProjectOnboardingSkill: Codable, Hashable, Sendable, Identifiable {
    enum Readiness: String, Codable, Hashable, Sendable {
        case ready
        case readyAfterFirstApprovedLead = "ready_after_first_approved_lead"
    }

    var key: String
    var title: String
    var state: Readiness
    var requiresConfirmation: Bool

    var id: String { key }

    enum CodingKeys: String, CodingKey {
        case key, title, state
        case requiresConfirmation = "requires_confirmation"
    }
}

struct LeadgridProjectOnboardingPreview: Codable, Hashable, Sendable {
    var id: String
    var websiteURL: String
    var websiteDomain: String
    var projectName: String
    var projectDescription: String
    var category: String
    var categoryConfidence: String
    var classificationReasons: [String]
    var recommendedProfiles: [DiscoveryV2ProfileWrite]
    var skills: [LeadgridProjectOnboardingSkill]
    var expiresAt: String
    var canManageMultipleProfiles: Bool

    enum CodingKeys: String, CodingKey {
        case id, category, skills
        case websiteURL = "website_url"
        case websiteDomain = "website_domain"
        case projectName = "project_name"
        case projectDescription = "project_description"
        case categoryConfidence = "category_confidence"
        case classificationReasons = "classification_reasons"
        case recommendedProfiles = "recommended_profiles"
        case expiresAt = "expires_at"
        case canManageMultipleProfiles = "can_manage_multiple_profiles"
    }
}

struct LeadgridProjectOnboardingResult: Codable, Hashable, Sendable {
    var project: ProjectListItem
    var profiles: [DiscoveryV2Profile]
    var skills: [LeadgridProjectOnboardingSkill]
    var reusedProject: Bool
    var replayed: Bool

    enum CodingKeys: String, CodingKey {
        case project, profiles, skills, replayed
        case reusedProject = "reused_project"
    }
}

#if DEBUG
private var usesDomainOnboardingQAFixture: Bool {
    ProcessInfo.processInfo.environment["QA_TOUR"] == "domain-onboarding"
}

private var domainOnboardingQABrief: DiscoveryV2Brief {
    DiscoveryV2Brief(
        industryQueries: ["tannklinikk", "tannlege"],
        exclusionTerms: ["tannteknisk laboratorium", "tannlegeutdanning"],
        city: "Oslo",
        geo: nil,
        targetCount: 30,
        enrichmentCount: 15,
        minimumFitScore: 65,
        idealCustomer: "Aktiv tannklinikk med lokal pasientbase og kommersiell beslutningstaker.",
        goal: "Finne og kvalifisere tannklinikker som kan få flere relevante pasienthenvendelser.",
        organizationForms: ["AS"]
    )
}

private var domainOnboardingQAWriteProfile: DiscoveryV2ProfileWrite {
    DiscoveryV2ProfileWrite(
        name: "Tannhelse – Oslo",
        isDefault: true,
        expectedVersion: nil,
        brief: domainOnboardingQABrief,
        placesDetailsEnabled: false,
        status: .active
    )
}

private var domainOnboardingQASkills: [LeadgridProjectOnboardingSkill] {
    [
        .init(key: "leadgrid_find_duplicates", title: "Finn duplikater", state: .readyAfterFirstApprovedLead, requiresConfirmation: false),
        .init(key: "leadgrid_enrich_company", title: "Berik fra BRREG", state: .readyAfterFirstApprovedLead, requiresConfirmation: true),
        .init(key: "leadgrid_log_visit", title: "Logg kontakt", state: .readyAfterFirstApprovedLead, requiresConfirmation: true),
        .init(key: "leadgrid_sync_offline_actions", title: "Synkroniser offline", state: .ready, requiresConfirmation: true),
        .init(key: "leadgrid_plan_follow_up", title: "Planlegg oppfølging", state: .readyAfterFirstApprovedLead, requiresConfirmation: true),
        .init(key: "leadgrid_data_quality", title: "Sjekk datakvalitet", state: .ready, requiresConfirmation: false),
    ]
}

private var domainOnboardingQAPreview: LeadgridProjectOnboardingPreview {
    LeadgridProjectOnboardingPreview(
        id: "22222222-2222-4222-8222-222222222222",
        websiteURL: "https://www.dentum.no",
        websiteDomain: "dentum.no",
        projectName: "Dentum",
        projectDescription: "Uavhengig markedsplass for tannhelse.",
        category: "Tannhelse",
        categoryConfidence: "high",
        classificationReasons: ["Nettstedet omtaler tannleger, tannklinikker og pasienthenvendelser."],
        recommendedProfiles: [domainOnboardingQAWriteProfile],
        skills: domainOnboardingQASkills,
        expiresAt: "2099-01-01T00:00:00.000Z",
        canManageMultipleProfiles: true
    )
}

private func domainOnboardingQAResult(
    profiles: [DiscoveryV2ProfileWrite]?
) -> LeadgridProjectOnboardingResult {
    let writes = profiles ?? [domainOnboardingQAWriteProfile]
    return LeadgridProjectOnboardingResult(
        project: ProjectListItem(
            id: "qa-dentum-project",
            organizationId: "11111111-1111-4111-8111-111111111111",
            name: "Dentum",
            description: "Uavhengig markedsplass for tannhelse.",
            status: "active",
            hasBrandKit: true,
            leadCount: 0,
            competitorCount: 0
        ),
        profiles: writes.enumerated().map { index, write in
            DiscoveryV2Profile(
                id: "qa-dentum-profile-\(index + 1)",
                name: write.name,
                isDefault: index == 0,
                version: 1,
                brief: write.brief,
                placesDetailsEnabled: write.placesDetailsEnabled,
                status: .active
            )
        },
        skills: domainOnboardingQASkills,
        reusedProject: false,
        replayed: false
    )
}
#endif

extension APIClient {
    func previewLeadgridProject(
        websiteURL: String,
        organizationId: String
    ) async throws -> LeadgridProjectOnboardingPreview {
        #if DEBUG
        if usesDomainOnboardingQAFixture { return domainOnboardingQAPreview }
        #endif
        struct Body: Encodable {
            var organizationId: String
            var websiteURL: String

            enum CodingKeys: String, CodingKey {
                case organizationId = "organization_id"
                case websiteURL = "website_url"
            }
        }
        struct Envelope: Decodable {
            var preview: LeadgridProjectOnboardingPreview
        }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/project-onboarding/preview",
            body: try JSONEncoder().encode(Body(
                organizationId: organizationId,
                websiteURL: websiteURL
            )),
            organizationId: organizationId
        )
        return try JSONDecoder().decode(Envelope.self, from: data).preview
    }

    func commitLeadgridProjectOnboarding(
        previewId: String,
        organizationId: String,
        profiles: [DiscoveryV2ProfileWrite]? = nil
    ) async throws -> LeadgridProjectOnboardingResult {
        #if DEBUG
        if usesDomainOnboardingQAFixture {
            guard let profiles,
                  profiles.count == 2,
                  profiles[0].name == "Tannhelse – Oslo",
                  profiles[1].name == "Tannhelse – Oslo 2"
            else {
                throw URLError(.badServerResponse)
            }
            return domainOnboardingQAResult(profiles: profiles)
        }
        #endif
        struct Body: Encodable {
            var organizationId: String
            var previewId: String
            var profiles: [DiscoveryV2ProfileWrite]?

            enum CodingKeys: String, CodingKey {
                case profiles
                case organizationId = "organization_id"
                case previewId = "preview_id"
            }
        }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/project-onboarding/commit",
            body: try JSONEncoder().encode(Body(
                organizationId: organizationId,
                previewId: previewId,
                profiles: profiles
            )),
            organizationId: organizationId
        )
        return try JSONDecoder().decode(LeadgridProjectOnboardingResult.self, from: data)
    }
}
