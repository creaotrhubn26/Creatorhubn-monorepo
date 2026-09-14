import Foundation

struct LeadgridRecommendedAnbudProfile: Codable, Hashable, Sendable {
    struct SuggestedWatch: Codable, Hashable, Sendable, Identifiable {
        var key: String
        var name: String
        var query: DoffinWatchQueryDTO
        var id: String { key }
    }

    var templateKey: String
    var templateVersion: Int
    var name: String
    var description: String
    var cpvCodes: [String]
    var keywords: [String]
    var exclusionTerms: [String]
    var suggestedWatches: [SuggestedWatch]
    var requiresAdminConfirmation: Bool

    enum CodingKeys: String, CodingKey {
        case name, description, keywords
        case templateKey = "template_key"
        case templateVersion = "template_version"
        case cpvCodes = "cpv_codes"
        case exclusionTerms = "exclusion_terms"
        case suggestedWatches = "suggested_watches"
        case requiresAdminConfirmation = "requires_admin_confirmation"
    }
}

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
    struct BrandProfile: Codable, Hashable, Sendable {
        var targetAudience: String

        enum CodingKeys: String, CodingKey {
            case targetAudience = "targetAudience"
        }
    }
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
    var brandProfile: BrandProfile? = nil
    var recommendedAnbudProfile: LeadgridRecommendedAnbudProfile? = nil

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
        case brandProfile = "brand_profile"
        case recommendedAnbudProfile = "recommended_anbud_profile"
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

struct LeadgridProjectOnboardingBrandOverrides: Codable, Hashable, Sendable {
    var projectName: String
    var projectDescription: String
    var category: String
    var targetAudience: String

    enum CodingKeys: String, CodingKey {
        case projectName = "project_name"
        case projectDescription = "project_description"
        case category
        case targetAudience = "target_audience"
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
    var isPrototypeTester: Bool?
    var storagePolicy: String?
    var setupManagedBySuperAdmin: Bool?
}

struct LeadgridProjectInvitationSendResult: Decodable, Hashable, Sendable {
    var ok: Bool
    var invitationId: String
    var emailSent: Bool
    var emailReason: String?
    var emailStatus: String
    var isPrototypeTester: Bool?
    var storagePolicy: String?
    var setupManagedBySuperAdmin: Bool?
}

#if DEBUG
private var usesDomainOnboardingQAFixture: Bool {
    ProcessInfo.processInfo.environment["QA_TOUR"] == "domain-onboarding"
}

private var domainOnboardingQABrief: DiscoveryV2Brief {
    DiscoveryV2Brief(
        industryQueries: ["tannlege"],
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

private func roleRoomOnboardingQABrief(
    industryQueries: [String] = [],
    organizationNameQueries: [String] = [],
    exclusions: [String] = [],
    targetCount: Int = 60,
    minimumFitScore: Int = 65,
    requireBusinessRegistration: Bool? = true
) -> DiscoveryV2Brief {
    DiscoveryV2Brief(
        industryQueries: industryQueries,
        organizationNameQueries: organizationNameQueries,
        exclusionTerms: exclusions,
        countryCode: "NO",
        city: nil,
        geo: nil,
        targetCount: targetCount,
        enrichmentCount: min(30, targetCount),
        minimumFitScore: minimumFitScore,
        idealCustomer: "Norsk virksomhet med praktisk behov for casting og produksjonsflyt.",
        goal: "Finne presise kandidater for The Role Room.",
        commercialSignals: .init(
            registeredInVatRegister: nil,
            registeredInBusinessRegister: requireBusinessRegistration
        )
    )
}

private var roleRoomOnboardingQAWriteProfiles: [DiscoveryV2ProfileWrite] {
    [
        .init(
            name: "Film- og TV-produksjon – Norge",
            isDefault: true,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                industryQueries: ["59.110", "59.120", "60.200"],
                exclusions: ["kino", "filmklubb"]
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
        .init(
            name: "Reklame- og innholdsbyråer – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                industryQueries: ["73.110", "74.200"],
                exclusions: ["avis", "trykkeri", "fotobutikk", "hobbyklubb"]
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
        .init(
            name: "Casting- og talentmiljøer – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                organizationNameQueries: ["casting"],
                exclusions: ["støping", "designvirksomhet"],
                targetCount: 40,
                minimumFitScore: 70
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
        .init(
            name: "Film- og medieutdanning – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                organizationNameQueries: [
                    "filmskule", "universitet", "høgskole", "høyskole", "fagskole",
                ],
                exclusions: [
                    "grunnskole", "barnehage", "sykehus", "forlag", "eiendom", "holding",
                ],
                targetCount: 50,
                minimumFitScore: 70,
                requireBusinessRegistration: nil
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
        .init(
            name: "Dansestudioer og danseskoler – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                organizationNameQueries: [
                    "dansestudio", "danseskole", "ballettskole", "dance studio",
                ],
                exclusions: [
                    "dancewear", "dansetøy", "butikk", "eiendom", "holding", "transport", "import",
                ],
                targetCount: 50,
                minimumFitScore: 70,
                requireBusinessRegistration: nil
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
        .init(
            name: "Skuespillere og talenter – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: roleRoomOnboardingQABrief(
                organizationNameQueries: ["skuespiller", "actor"],
                exclusions: [
                    "forbund", "forening", "undervisning", "kurs", "eiendom", "holding", "rekruttering", "renhold",
                ],
                targetCount: 60,
                minimumFitScore: 70,
                requireBusinessRegistration: nil
            ),
            placesDetailsEnabled: false,
            status: .active
        ),
    ]
}

private var roleRoomOnboardingQAPreview: LeadgridProjectOnboardingPreview {
    LeadgridProjectOnboardingPreview(
        id: "33333333-3333-4333-8333-333333333333",
        websiteURL: "https://theroleroom.com",
        websiteDomain: "theroleroom.com",
        projectName: "The Role Room",
        projectDescription: "Produksjonsflate for film, TV og innholdsproduksjon.",
        category: "Film, TV, casting og talent",
        categoryConfidence: "high",
        classificationReasons: ["Domenet er verifisert som The Role Room."],
        recommendedProfiles: roleRoomOnboardingQAWriteProfiles,
        skills: domainOnboardingQASkills,
        expiresAt: "2099-01-01T00:00:00.000Z",
        canManageMultipleProfiles: true
    )
}

private func creatorHubOnboardingQABrief(
    industryQueries: [String],
    exclusions: [String],
    targetCount: Int = 60,
    qualificationTerms: [String],
    qualificationRequirement: DiscoveryV2QualificationRequirement = .preferred,
    websiteRequirement: DiscoveryV2WebsiteRequirement = .any,
    minimumWebsiteQualityScore: Int? = nil
) -> DiscoveryV2Brief {
    DiscoveryV2Brief(
        industryQueries: industryQueries,
        exclusionTerms: exclusions,
        countryCode: "NO",
        city: nil,
        geo: nil,
        targetCount: targetCount,
        enrichmentCount: min(30, targetCount),
        minimumFitScore: 70,
        idealCustomer: "Aktiv norsk kreativ virksomhet med betalende kundeprosjekter.",
        goal: "Finne presise kandidater for Creatorhub.",
        organizationForms: ["ANS", "AS", "DA", "ENK"],
        websiteRequirement: websiteRequirement,
        websiteQuality: .init(minimumScore: minimumWebsiteQualityScore),
        qualificationTerms: qualificationTerms,
        qualificationRequirement: qualificationRequirement,
        commercialSignals: .init(
            registeredInVatRegister: nil,
            registeredInBusinessRegister: true
        )
    )
}

private var creatorHubOnboardingQAWriteProfiles: [DiscoveryV2ProfileWrite] {
    let commonExclusions = [
        "holding", "eiendom", "forening", "hobbyklubb", "fotobutikk", "trykkeri",
    ]
    return [
        .init(
            name: "Profesjonelle fotografer – Norge",
            isDefault: true,
            expectedVersion: nil,
            brief: creatorHubOnboardingQABrief(
                industryQueries: ["74.200"],
                exclusions: commonExclusions,
                qualificationTerms: [
                    "fotograf", "fotografering", "fotostudio", "bryllup",
                    "portrett", "bedriftsfoto", "eventfoto",
                ]
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "creatorhub.photographers",
            templateVersion: 1
        ),
        .init(
            name: "Video- og innholdsprodusenter – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: creatorHubOnboardingQABrief(
                industryQueries: ["59.110", "59.120"],
                exclusions: commonExclusions + [
                    "kino", "filmklubb", "distribusjon", "kringkasting", "tv-kanal",
                ],
                qualificationTerms: [
                    "videoproduksjon", "innholdsproduksjon", "filmproduksjon",
                    "postproduksjon", "videograf", "motion graphics",
                ]
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "creatorhub.video_content",
            templateVersion: 1
        ),
        .init(
            name: "Musikk- og lydprodusenter – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: creatorHubOnboardingQABrief(
                industryQueries: ["59.200"],
                exclusions: commonExclusions + [
                    "radio", "musikkbutikk", "instrumentbutikk", "kor", "korps",
                ],
                qualificationTerms: [
                    "lydstudio", "musikkproduksjon", "lydproduksjon", "innspilling",
                    "mixing", "mastering", "produsent",
                ]
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "creatorhub.music_audio",
            templateVersion: 1
        ),
        .init(
            name: "Kreative byråer og designstudioer – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: creatorHubOnboardingQABrief(
                industryQueries: ["73.110", "73.120", "74.120"],
                exclusions: commonExclusions + [
                    "invest", "avis", "magasin", "ren medieformidling",
                ],
                targetCount: 50,
                qualificationTerms: [
                    "kreativt byrå", "designbyrå", "innholdsbyrå", "branding",
                    "visuell identitet", "kampanjeproduksjon", "kreativt studio",
                ],
                qualificationRequirement: .required,
                websiteRequirement: .present,
                minimumWebsiteQualityScore: 40
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "creatorhub.creative_agencies",
            templateVersion: 1
        ),
    ]
}

private var creatorHubOnboardingQAPreview: LeadgridProjectOnboardingPreview {
    LeadgridProjectOnboardingPreview(
        id: "66666666-6666-4666-8666-666666666666",
        websiteURL: "https://creatorhubn.com",
        websiteDomain: "creatorhubn.com",
        projectName: "Creatorhub",
        projectDescription: "Plattform for å administrere og skalere kreativt arbeid.",
        category: "Plattform for kreativt arbeid",
        categoryConfidence: "high",
        classificationReasons: [
            "Domenet er verifisert som Creatorhub.",
            "Målgruppene er delt i fire presise, nasjonale profiler.",
        ],
        recommendedProfiles: creatorHubOnboardingQAWriteProfiles,
        skills: domainOnboardingQASkills,
        expiresAt: "2099-01-01T00:00:00.000Z",
        canManageMultipleProfiles: true,
        brandProfile: .init(
            targetAudience: "Profesjonelle skapere, studioer, byråer og kreative team i Norge."
        )
    )
}

private func tidumOnboardingQABrief(
    industryQueries: [String] = [],
    organizationNameQueries: [String] = [],
    exclusionTerms: [String]? = nil,
    targetCount: Int = 60,
    minimumFitScore: Int = 70,
    organizationForms: [String] = ["AS", "IKS", "STI"],
    employeeCount: DiscoveryV2EmployeeCountFilter? = .init(minimum: 5, maximum: nil),
    qualificationTerms: [String]? = nil,
    requireBusinessRegistration: Bool? = true
) -> DiscoveryV2Brief {
    DiscoveryV2Brief(
        industryQueries: industryQueries,
        organizationNameQueries: organizationNameQueries,
        exclusionTerms: exclusionTerms ?? ["holding", "eiendom", "renhold", "bemanning"],
        countryCode: "NO",
        city: nil,
        geo: nil,
        targetCount: targetCount,
        enrichmentCount: min(30, targetCount),
        minimumFitScore: minimumFitScore,
        idealCustomer: "Norsk omsorgsaktør med felt- eller turnusarbeid.",
        goal: "Finne presise kandidater for Tidum.",
        organizationForms: organizationForms,
        employeeCount: employeeCount,
        qualificationTerms: qualificationTerms ?? ["omsorg", "miljøarbeid", "avlastning", "BPA"],
        commercialSignals: .init(
            registeredInVatRegister: nil,
            registeredInBusinessRegister: requireBusinessRegistration
        )
    )
}

private var tidumOnboardingQAWriteProfiles: [DiscoveryV2ProfileWrite] {
    [
        .init(
            name: "Barnevern og avlastning – Norge",
            isDefault: true,
            expectedVersion: nil,
            brief: tidumOnboardingQABrief(
                industryQueries: ["87.104", "87.105", "87.991", "88.991"]
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "tidum.child_welfare",
            templateVersion: 1
        ),
        .init(
            name: "Bofellesskap og miljøarbeid – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: tidumOnboardingQABrief(
                industryQueries: ["87.106", "87.201", "87.202", "87.999"]
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "tidum.residential_care",
            templateVersion: 1
        ),
        .init(
            name: "BPA og feltbasert omsorg – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: tidumOnboardingQABrief(
                industryQueries: ["88.104", "88.105", "88.106"],
                targetCount: 40
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "tidum.bpa_field_services",
            templateVersion: 1
        ),
        .init(
            name: "Kommunale tjenestesteder – Norge",
            isDefault: false,
            expectedVersion: nil,
            brief: tidumOnboardingQABrief(
                organizationNameQueries: [
                    "barneverntjeneste",
                    "avlastning",
                    "bofellesskap",
                    "BPA",
                    "miljøarbeidertjeneste",
                ],
                exclusionTerms: [
                    "barnehage",
                    "skole",
                    "sykehjem",
                    "natur",
                    "eiendom",
                    "husholdning",
                    "administrasjon",
                ],
                organizationForms: ["BEDR"],
                employeeCount: nil,
                qualificationTerms: [],
                requireBusinessRegistration: nil
            ),
            placesDetailsEnabled: false,
            status: .active,
            templateKey: "tidum.municipal_services",
            templateVersion: 1
        ),
    ]
}

private var tidumOnboardingQAPreview: LeadgridProjectOnboardingPreview {
    LeadgridProjectOnboardingPreview(
        id: "55555555-5555-4555-8555-555555555555",
        websiteURL: "https://tidum.no",
        websiteDomain: "tidum.no",
        projectName: "Tidum",
        projectDescription: "Arbeidstidssystem for barn, omsorg og miljøarbeid.",
        category: "Arbeidstid, omsorg og miljøarbeid",
        categoryConfidence: "high",
        classificationReasons: [
            "Domenet er verifisert som Tidum.",
            "Private omsorgsaktører og kommunale tjenester er delt i egne profiler.",
        ],
        recommendedProfiles: tidumOnboardingQAWriteProfiles,
        skills: domainOnboardingQASkills,
        expiresAt: "2099-01-01T00:00:00.000Z",
        canManageMultipleProfiles: true,
        brandProfile: .init(
            targetAudience: "Private omsorgsaktører og kommunale tjenester i Norge."
        ),
        recommendedAnbudProfile: .init(
            templateKey: "tidum.procurement",
            templateVersion: 1,
            name: "Tidum – arbeidstid, turnus og dokumentasjon",
            description: "Offentlige anskaffelser av arbeidstids-, HR-, turnus- og dokumentasjonsprogramvare.",
            cpvCodes: ["48450000", "72212450", "48332000", "48311000", "48311100"],
            keywords: ["arbeidstid", "turnus", "digital dokumentasjon"],
            exclusionTerms: ["kjøp av omsorgsplasser", "bemanningstjenester"],
            suggestedWatches: [
                .init(
                    key: "tidum.time_hr_software",
                    name: "Tidum · Arbeidstid og HR-programvare",
                    query: .init(q: nil, location: nil, cpv: "48450000,72212450")
                ),
                .init(
                    key: "tidum.scheduling",
                    name: "Tidum · Turnus og planlegging",
                    query: .init(q: "turnus", location: nil, cpv: "48332000,48450000")
                ),
                .init(
                    key: "tidum.documentation",
                    name: "Tidum · Digital dokumentasjon",
                    query: .init(q: "dokumentasjon", location: nil, cpv: "48311000,48311100")
                ),
            ],
            requiresAdminConfirmation: true
        )
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

private func roleRoomOnboardingQAResult(
    profiles: [DiscoveryV2ProfileWrite]
) -> LeadgridProjectOnboardingResult {
    LeadgridProjectOnboardingResult(
        project: ProjectListItem(
            id: "qa-role-room-project",
            organizationId: "44444444-4444-4444-8444-444444444444",
            name: "The Role Room",
            description: "Produksjonsflate for film, TV og innholdsproduksjon.",
            status: "active",
            hasBrandKit: true,
            leadCount: 0,
            competitorCount: 0
        ),
        profiles: profiles.enumerated().map { index, write in
            DiscoveryV2Profile(
                id: "qa-role-room-profile-\(index + 1)",
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
                name: "The Role Room",
                reused: false
            ),
            team: .init(id: "role-room-salg", name: "The Role Room salg", reused: false),
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

private func creatorHubOnboardingQAResult(
    profiles: [DiscoveryV2ProfileWrite]
) -> LeadgridProjectOnboardingResult {
    LeadgridProjectOnboardingResult(
        project: ProjectListItem(
            id: "qa-creatorhub-project",
            organizationId: "44444444-4444-4444-8444-444444444444",
            name: "Creatorhub",
            description: "Plattform for å administrere og skalere kreativt arbeid.",
            status: "active",
            hasBrandKit: true,
            leadCount: 0,
            competitorCount: 0
        ),
        profiles: profiles.enumerated().map { index, write in
            DiscoveryV2Profile(
                id: "qa-creatorhub-profile-\(index + 1)",
                name: write.name,
                isDefault: index == 0,
                version: 1,
                brief: write.brief,
                placesDetailsEnabled: write.placesDetailsEnabled,
                status: .active,
                templateKey: write.templateKey,
                templateVersion: write.templateVersion
            )
        },
        skills: domainOnboardingQASkills,
        reusedProject: false,
        replayed: false,
        access: LeadgridProjectOnboardingAccessResult(
            organization: .init(
                id: "44444444-4444-4444-8444-444444444444",
                name: "Creatorhub",
                reused: false
            ),
            team: .init(id: "creatorhub-salg", name: "Creatorhub salg", reused: false),
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

private func tidumOnboardingQAResult(
    profiles: [DiscoveryV2ProfileWrite]
) -> LeadgridProjectOnboardingResult {
    LeadgridProjectOnboardingResult(
        project: ProjectListItem(
            id: "qa-tidum-project",
            organizationId: "44444444-4444-4444-8444-444444444444",
            name: "Tidum",
            description: "Arbeidstidssystem for barn, omsorg og miljøarbeid.",
            status: "active",
            hasBrandKit: true,
            leadCount: 0,
            competitorCount: 0
        ),
        profiles: profiles.enumerated().map { index, write in
            DiscoveryV2Profile(
                id: "qa-tidum-profile-\(index + 1)",
                name: write.name,
                isDefault: index == 0,
                version: 1,
                brief: write.brief,
                placesDetailsEnabled: write.placesDetailsEnabled,
                status: .active,
                templateKey: write.templateKey,
                templateVersion: write.templateVersion
            )
        },
        skills: domainOnboardingQASkills,
        reusedProject: false,
        replayed: false,
        access: LeadgridProjectOnboardingAccessResult(
            organization: .init(
                id: "44444444-4444-4444-8444-444444444444",
                name: "Tidum",
                reused: false
            ),
            team: .init(id: "tidum-salg", name: "Tidum salg", reused: false),
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
        salesTeamRole: LeadgridProjectOnboardingTeamRole?,
        isPrototypeTester: Bool? = nil,
        useOrganizationStorage: Bool? = nil
    ) async throws -> LeadgridProjectInvitationSendResult {
        struct Body: Encodable {
            var email: String
            var role: LeadgridProjectOnboardingProjectRole
            var salesTeamId: String?
            var salesTeamRole: String?
            var isPrototypeTester: Bool?
            var useOrganizationStorage: Bool?

            enum CodingKeys: String, CodingKey {
                case email, role
                case salesTeamId = "sales_team_id"
                case salesTeamRole = "sales_team_role"
                case isPrototypeTester = "is_prototype_tester"
                case useOrganizationStorage = "use_organization_storage"
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
                },
                isPrototypeTester: isPrototypeTester,
                useOrganizationStorage: useOrganizationStorage
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
        if usesDomainOnboardingQAFixture {
            let domain = websiteURL.lowercased()
            if domain.contains("creatorhubn.com") {
                return creatorHubOnboardingQAPreview
            }
            if domain.contains("theroleroom.com") {
                return roleRoomOnboardingQAPreview
            }
            if domain.contains("tidum.no") {
                return tidumOnboardingQAPreview
            }
            return domainOnboardingQAPreview
        }
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
        accessSetup: LeadgridProjectOnboardingAccessSetup? = nil,
        brandOverrides: LeadgridProjectOnboardingBrandOverrides? = nil
    ) async throws -> LeadgridProjectOnboardingResult {
        #if DEBUG
        if usesDomainOnboardingQAFixture {
            if previewId == creatorHubOnboardingQAPreview.id {
                guard let profiles,
                      profiles.map(\.name) == creatorHubOnboardingQAWriteProfiles.map(\.name),
                      accessSetup?.organization.mode == "create",
                      accessSetup?.administratorEmail == "superadmin@leadgrid.no",
                      accessSetup?.team.mode == "create"
                else {
                    throw URLError(.badServerResponse)
                }
                return creatorHubOnboardingQAResult(profiles: profiles)
            }
            if previewId == roleRoomOnboardingQAPreview.id {
                guard let profiles,
                      profiles.map(\.name) == roleRoomOnboardingQAWriteProfiles.map(\.name),
                      accessSetup?.organization.mode == "create",
                      accessSetup?.administratorEmail == "superadmin@leadgrid.no",
                      accessSetup?.team.mode == "create"
                else {
                    throw URLError(.badServerResponse)
                }
                return roleRoomOnboardingQAResult(profiles: profiles)
            }
            if previewId == tidumOnboardingQAPreview.id {
                guard let profiles,
                      profiles.map(\.name) == tidumOnboardingQAWriteProfiles.map(\.name),
                      accessSetup?.organization.mode == "create",
                      accessSetup?.administratorEmail == "superadmin@leadgrid.no",
                      accessSetup?.team.mode == "create"
                else {
                    throw URLError(.badServerResponse)
                }
                return tidumOnboardingQAResult(profiles: profiles)
            }
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
            var brandOverrides: LeadgridProjectOnboardingBrandOverrides?

            enum CodingKeys: String, CodingKey {
                case profiles
                case organizationId = "organization_id"
                case previewId = "preview_id"
                case accessSetup = "access_setup"
                case brandOverrides = "brand_overrides"
            }
        }
        let data = try await executeRaw(
            method: "POST",
            path: "/api/leadgrid/project-onboarding/commit",
            body: try JSONEncoder().encode(Body(
                organizationId: organizationId,
                previewId: previewId,
                profiles: profiles,
                accessSetup: accessSetup,
                brandOverrides: brandOverrides
            )),
            organizationId: organizationId
        )
        return try JSONDecoder().decode(LeadgridProjectOnboardingResult.self, from: data)
    }
}
