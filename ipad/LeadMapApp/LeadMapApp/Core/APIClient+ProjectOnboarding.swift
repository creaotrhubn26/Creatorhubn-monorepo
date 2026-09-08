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
    var access: LeadgridProjectOnboardingAccessResult?

    enum CodingKeys: String, CodingKey {
        case project, profiles, skills, replayed, access
        case reusedProject = "reused_project"
    }
}

enum LeadgridProjectOnboardingProjectRole: String, Codable, Hashable, Sendable, CaseIterable, Identifiable {
    case owner, member, viewer
    var id: String { rawValue }
    var title: String {
        switch self {
        case .owner: "Eier"
        case .member: "Medlem"
        case .viewer: "Leser"
        }
    }
}

enum LeadgridProjectOnboardingTeamRole: String, Codable, Hashable, Sendable, CaseIterable, Identifiable {
    case leader, member, none
    var id: String { rawValue }
    var title: String {
        switch self {
        case .leader: "Teamleder"
        case .member: "Teammedlem"
        case .none: "Ikke i team"
        }
    }
}

struct LeadgridProjectOnboardingOrganizationSelection: Codable, Hashable, Sendable {
    var mode: String
    var organizationId: String?
    var name: String?

    enum CodingKeys: String, CodingKey {
        case mode, name
        case organizationId = "organization_id"
    }
}

struct LeadgridProjectOnboardingTeamSelection: Codable, Hashable, Sendable {
    var mode: String
    var id: String?
    var name: String?
    var colorHex: String?

    enum CodingKeys: String, CodingKey {
        case mode, id, name
        case colorHex = "color_hex"
    }
}

struct LeadgridProjectOnboardingInvitationWrite: Codable, Hashable, Sendable, Identifiable {
    var id = UUID()
    var email: String
    var projectRole: LeadgridProjectOnboardingProjectRole
    var teamRole: LeadgridProjectOnboardingTeamRole

    enum CodingKeys: String, CodingKey {
        case email
        case projectRole = "project_role"
        case teamRole = "team_role"
    }
}

struct LeadgridProjectOnboardingAccessSetup: Codable, Hashable, Sendable {
    var organization: LeadgridProjectOnboardingOrganizationSelection
    var administratorEmail: String
    var team: LeadgridProjectOnboardingTeamSelection
    var invitations: [LeadgridProjectOnboardingInvitationWrite]

    enum CodingKeys: String, CodingKey {
        case organization, team, invitations
        case administratorEmail = "administrator_email"
    }
}

struct LeadgridProjectOnboardingAccessOptions: Codable, Hashable, Sendable {
    struct Organization: Codable, Hashable, Sendable, Identifiable {
        var id: String
        var name: String
    }
    struct Team: Codable, Hashable, Sendable, Identifiable {
        var id: String
        var name: String
        var colorHex: String

        enum CodingKeys: String, CodingKey {
            case id, name
            case colorHex = "color_hex"
        }
    }

    var organizations: [Organization]
    var teams: [Team]
}

struct LeadgridProjectOnboardingAccessResult: Codable, Hashable, Sendable {
    struct Organization: Codable, Hashable, Sendable {
        var id: String
        var name: String
        var reused: Bool
    }
    struct Team: Codable, Hashable, Sendable {
        var id: String
        var name: String
        var reused: Bool
    }
    struct Administrator: Codable, Hashable, Sendable {
        var email: String
        var status: String
        var organizationRole: String
        var projectRole: String
        var emailStatus: String

        enum CodingKeys: String, CodingKey {
            case email, status
            case organizationRole = "organization_role"
            case projectRole = "project_role"
            case emailStatus = "email_status"
        }
    }
    struct Invitation: Codable, Hashable, Sendable, Identifiable {
        var id: String?
        var email: String
        var status: String
        var projectRole: LeadgridProjectOnboardingProjectRole
        var teamRole: LeadgridProjectOnboardingTeamRole
        var emailStatus: String

        var stableId: String { id ?? email }

        enum CodingKeys: String, CodingKey {
            case id, email, status
            case projectRole = "project_role"
            case teamRole = "team_role"
            case emailStatus = "email_status"
        }
    }

    var organization: Organization
    var team: Team?
    var administrator: Administrator
    var invitations: [Invitation]
    var discoveryAccessVerified: Bool

    enum CodingKeys: String, CodingKey {
        case organization, team, administrator, invitations
        case discoveryAccessVerified = "discovery_access_verified"
    }
}

struct LeadgridProjectInvitationStatus: Decodable, Hashable, Sendable, Identifiable {
    var id: String
    var email: String
    var role: LeadgridProjectOnboardingProjectRole
    var invitedAt: String
    var expiresAt: String
    var acceptedAt: String?
    var status: String
    var emailStatus: String?
    var salesTeamId: String?
    var salesTeamRole: String?
}

struct LeadgridProjectInvitationSendResult: Decodable, Hashable, Sendable {
    var ok: Bool
    var invitationId: String
    var emailSent: Bool
    var emailReason: String?
    var emailStatus: String
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
            organizationId: "44444444-4444-4444-8444-444444444444",
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
        replayed: false,
        access: LeadgridProjectOnboardingAccessResult(
            organization: .init(
                id: "44444444-4444-4444-8444-444444444444",
                name: "Dentum",
                reused: false
            ),
            team: .init(id: "dentum-salg", name: "Dentum salg", reused: false),
            administrator: .init(
                email: "superadmin@leadgrid.no",
                status: "active",
                organizationRole: "admin",
                projectRole: "owner",
                emailStatus: "not_required"
            ),
            invitations: [],
            discoveryAccessVerified: true
        )
    )
}
#endif

extension APIClient {
    func fetchLeadgridProjectInvitations(
        projectId: String,
        organizationId: String
    ) async throws -> [LeadgridProjectInvitationStatus] {
        struct Envelope: Decodable { var invitations: [LeadgridProjectInvitationStatus] }
        let encodedProject = projectId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? projectId
        let data = try await executeRaw(
            method: "GET",
            path: "/api/admin-room/lead-map/projects/\(encodedProject)/invitations",
            body: nil,
            organizationId: organizationId
        )
        return try JSONDecoder().decode(Envelope.self, from: data).invitations
    }

    func inviteLeadgridProjectMember(
        projectId: String,
        organizationId: String,
        email: String,
        role: LeadgridProjectOnboardingProjectRole,
        salesTeamId: String?,
        salesTeamRole: LeadgridProjectOnboardingTeamRole?
    ) async throws -> LeadgridProjectInvitationSendResult {
        struct Body: Encodable {
            var email: String
            var role: LeadgridProjectOnboardingProjectRole
            var salesTeamId: String?
            var salesTeamRole: String?

            enum CodingKeys: String, CodingKey {
                case email, role
                case salesTeamId = "sales_team_id"
                case salesTeamRole = "sales_team_role"
            }
        }
        let encodedProject = projectId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? projectId
        let data = try await executeRaw(
            method: "POST",
            path: "/api/admin-room/lead-map/projects/\(encodedProject)/invitations",
            body: try JSONEncoder().encode(Body(
                email: email,
                role: role,
                salesTeamId: salesTeamId,
                salesTeamRole: salesTeamRole.flatMap { role in
                    role == LeadgridProjectOnboardingTeamRole.none ? nil : role.rawValue
                }
            )),
            organizationId: organizationId
        )
        return try JSONDecoder().decode(LeadgridProjectInvitationSendResult.self, from: data)
    }

    func fetchLeadgridProjectOnboardingAccessOptions(
        sourceOrganizationId: String,
        targetOrganizationId: String? = nil
    ) async throws -> LeadgridProjectOnboardingAccessOptions {
        #if DEBUG
        if usesDomainOnboardingQAFixture {
            return .init(
                organizations: [
                    .init(id: sourceOrganizationId, name: "Creatorhub AS"),
                    .init(id: "44444444-4444-4444-8444-444444444444", name: "Dentum")
                ],
                teams: targetOrganizationId == nil
                    ? []
                    : [.init(id: "dentum-salg", name: "Dentum salg", colorHex: "#A852FC")]
            )
        }
        #endif
        var items = [URLQueryItem(name: "source_organization_id", value: sourceOrganizationId)]
        if let targetOrganizationId {
            items.append(URLQueryItem(name: "target_organization_id", value: targetOrganizationId))
        }
        var components = URLComponents()
        components.path = "/api/leadgrid/project-onboarding/access-options"
        components.queryItems = items
        guard let path = components.string else { throw URLError(.badURL) }
        let data = try await executeRaw(
            method: "GET",
            path: path,
            body: nil,
            organizationId: sourceOrganizationId
        )
        return try JSONDecoder().decode(LeadgridProjectOnboardingAccessOptions.self, from: data)
    }

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
        profiles: [DiscoveryV2ProfileWrite]? = nil,
        accessSetup: LeadgridProjectOnboardingAccessSetup? = nil
    ) async throws -> LeadgridProjectOnboardingResult {
        #if DEBUG
        if usesDomainOnboardingQAFixture {
            guard let profiles,
                  profiles.count == 2,
                  profiles[0].name == "Tannhelse – Oslo",
                  profiles[1].name == "Tannhelse – Oslo 2",
                  accessSetup?.organization.mode == "create",
                  accessSetup?.administratorEmail == "superadmin@leadgrid.no",
                  accessSetup?.team.mode == "create"
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
            var accessSetup: LeadgridProjectOnboardingAccessSetup?

            enum CodingKeys: String, CodingKey {
                case profiles
                case organizationId = "organization_id"
                case previewId = "preview_id"
                case accessSetup = "access_setup"
            }
        }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/project-onboarding/commit",
            body: try JSONEncoder().encode(Body(
                organizationId: organizationId,
                previewId: previewId,
                profiles: profiles,
                accessSetup: accessSetup
            )),
            organizationId: organizationId
        )
        return try JSONDecoder().decode(LeadgridProjectOnboardingResult.self, from: data)
    }
}
