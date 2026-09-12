import XCTest
import SwiftUI
@testable import LeadMapApp

final class ProjectDomainOnboardingTests: XCTestCase {
    func testInvitationHistoryDecodesAcceptedStatus() throws {
        let data = Data(#"""
        {
          "id":"invite-accepted",
          "email":"accepted@dentum.no",
          "role":"member",
          "invitedAt":"2026-09-08T12:00:00.000Z",
          "expiresAt":"2026-09-15T12:00:00.000Z",
          "acceptedAt":"2026-09-08T13:00:00.000Z",
          "status":"accepted",
          "emailStatus":"sent",
          "salesTeamId":"dentum-salg",
          "salesTeamRole":"member"
        }
        """#.utf8)

        let invitation = try JSONDecoder().decode(
            LeadgridProjectInvitationStatus.self,
            from: data
        )
        XCTAssertEqual(invitation.status, "accepted")
        XCTAssertEqual(invitation.acceptedAt, "2026-09-08T13:00:00.000Z")
        XCTAssertEqual(invitation.salesTeamId, "dentum-salg")
    }

    func testDentumPrototypeInviteDecodesSuperAdminStorageSetup() throws {
        let data = Data(#"""
        {
          "id":"invite-prototype",
          "email":"tester@dentum.no",
          "role":"member",
          "invitedAt":"2026-09-10T08:00:00.000Z",
          "expiresAt":"2026-09-17T08:00:00.000Z",
          "acceptedAt":null,
          "status":"pending",
          "emailStatus":"sent",
          "salesTeamId":null,
          "salesTeamRole":null,
          "isPrototypeTester":true,
          "storagePolicy":"organization",
          "setupManagedBySuperAdmin":true
        }
        """#.utf8)

        let invitation = try JSONDecoder().decode(
            LeadgridProjectInvitationStatus.self,
            from: data
        )
        XCTAssertEqual(invitation.isPrototypeTester, true)
        XCTAssertEqual(invitation.storagePolicy, "organization")
        XCTAssertEqual(invitation.setupManagedBySuperAdmin, true)
    }

    func testAccessSetupEncodesTenantProjectAndTeamRolesWithoutLocalIdentifiers() throws {
        let setup = LeadgridProjectOnboardingAccessSetup(
            organization: .init(mode: "create", organizationId: nil, name: "Dentum"),
            administratorEmail: "daniel@creatorhubn.com",
            team: .init(mode: "create", id: nil, name: "Dentum salg", colorHex: "#A852FC"),
            invitations: [.init(
                email: "selger@dentum.no",
                projectRole: .member,
                teamRole: .member
            )]
        )
        let data = try JSONEncoder().encode(setup)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["administrator_email"] as? String, "daniel@creatorhubn.com")
        let organization = try XCTUnwrap(json["organization"] as? [String: Any])
        XCTAssertEqual(organization["mode"] as? String, "create")
        XCTAssertEqual(organization["name"] as? String, "Dentum")
        let invitation = try XCTUnwrap((json["invitations"] as? [[String: Any]])?.first)
        XCTAssertEqual(invitation["project_role"] as? String, "member")
        XCTAssertEqual(invitation["team_role"] as? String, "member")
        XCTAssertNil(invitation["id"])
    }

    func testDentumPreviewDecodesCompleteDiscoveryProfileAndAllSkills() throws {
        let data = Data(#"""
        {
          "id":"22222222-2222-4222-8222-222222222222",
          "website_url":"https://dentum.no",
          "website_domain":"dentum.no",
          "project_name":"Dentum",
          "project_description":"Markedsplass for tannklinikker i Oslo",
          "category":"Tannhelse",
          "category_confidence":"high",
          "classification_reasons":["Nettsiden omtaler tannklinikk."],
          "recommended_profiles":[{
            "name":"Tannhelse – Oslo",
            "is_default":true,
            "status":"active",
            "brief":{
              "industry_queries":["tannlege"],
              "exclusion_terms":["tannteknisk laboratorium"],
              "city":"Oslo",
              "geo":null,
              "territory_code":null,
              "municipality_numbers":[],
              "municipality_names":[],
              "target_count":30,
              "enrichment_count":15,
              "minimum_fit_score":65,
              "ideal_customer":"Aktiv tannklinikk",
              "goal":"Finne relevante tannklinikker",
              "organization_forms":[],
              "employee_count":null,
              "organization_structure":"any",
              "website_requirement":"any",
              "website_quality":{"minimum_score":null},
              "commercial_signals":{
                "registered_in_vat_register":null,
                "registered_in_business_register":true
              }
            },
            "approval_mode":"manual",
            "places_details_enabled":false,
            "auto_discover_enabled":false,
            "schedule_cron":"0 6 * * *",
            "schedule_timezone":"Europe/Oslo"
          }],
          "skills":[
            {"key":"leadgrid_find_duplicates","title":"Finn duplikater","state":"ready_after_first_approved_lead","requires_confirmation":false},
            {"key":"leadgrid_enrich_company","title":"Berik fra BRREG","state":"ready_after_first_approved_lead","requires_confirmation":true},
            {"key":"leadgrid_log_visit","title":"Logg kontakt","state":"ready_after_first_approved_lead","requires_confirmation":true},
            {"key":"leadgrid_sync_offline_actions","title":"Synkroniser offline","state":"ready","requires_confirmation":true},
            {"key":"leadgrid_plan_follow_up","title":"Planlegg oppfølging","state":"ready_after_first_approved_lead","requires_confirmation":true},
            {"key":"leadgrid_data_quality","title":"Sjekk datakvalitet","state":"ready","requires_confirmation":false}
          ],
          "expires_at":"2026-09-08T12:00:00.000Z",
          "can_manage_multiple_profiles":true
        }
        """#.utf8)

        let preview = try JSONDecoder().decode(
            LeadgridProjectOnboardingPreview.self,
            from: data
        )

        XCTAssertEqual(preview.websiteDomain, "dentum.no")
        XCTAssertEqual(preview.category, "Tannhelse")
        XCTAssertTrue(preview.canManageMultipleProfiles)
        XCTAssertEqual(preview.recommendedProfiles.count, 1)
        XCTAssertEqual(
            preview.recommendedProfiles[0].brief.industryQueries,
            ["tannlege"]
        )
        XCTAssertEqual(preview.recommendedProfiles[0].brief.city, "Oslo")
        XCTAssertNil(preview.recommendedProfiles[0].brief.validationMessage)
        XCTAssertEqual(Set(preview.skills.map(\.key)).count, 6)
        XCTAssertEqual(
            preview.skills.first(where: { $0.key == "leadgrid_sync_offline_actions" })?.state,
            .ready
        )
        XCTAssertEqual(
            preview.skills.first(where: { $0.key == "leadgrid_enrich_company" })?.state,
            .readyAfterFirstApprovedLead
        )
    }

    func testTidumPreviewDecodesFourNationalDiscoveryProfiles() throws {
        let names = [
            "Barnevern og avlastning – Norge",
            "Bofellesskap og miljøarbeid – Norge",
            "BPA og feltbasert omsorg – Norge",
            "Kommunale omsorgstjenester – Norge",
        ]
        let templateKeys = [
            "tidum.child_welfare",
            "tidum.residential_care",
            "tidum.bpa_field_services",
            "tidum.municipal_services",
        ]
        let industryQueries = [
            ["87.104", "87.105", "87.991", "88.991"],
            ["87.106", "87.201", "87.202", "87.999"],
            ["88.104", "88.105", "88.106"],
            [],
        ]
        let profilePayloads: [[String: Any]] = names.enumerated().map { index, name in
            let municipalityProfile = index == 3
            let employeeCount: Any
            let businessRegisterRequirement: Any
            if municipalityProfile {
                employeeCount = NSNull()
                businessRegisterRequirement = NSNull()
            } else {
                employeeCount = ["minimum": 5, "maximum": NSNull()]
                businessRegisterRequirement = true
            }
            return [
                "name": name,
                "is_default": index == 0,
                "status": "active",
                "template_key": templateKeys[index],
                "template_version": 1,
                "brief": [
                    "industry_queries": industryQueries[index],
                    "organization_name_queries": municipalityProfile ? ["kommune"] : [],
                    "exclusion_terms": municipalityProfile
                        ? []
                        : ["holding", "eiendom", "renhold", "bemanning"],
                    "country_code": "NO",
                    "city": NSNull(),
                    "geo": NSNull(),
                    "territory_code": NSNull(),
                    "municipality_numbers": [],
                    "municipality_names": [],
                    "target_count": index == 2 ? 40 : 60,
                    "enrichment_count": 30,
                    "minimum_fit_score": municipalityProfile ? 65 : 70,
                    "ideal_customer": "Norsk omsorgsaktør med felt- eller turnusarbeid.",
                    "goal": "Finne presise kandidater for Tidum.",
                    "organization_forms": municipalityProfile ? ["KOMM"] : ["AS", "IKS", "STI"],
                    "employee_count": employeeCount,
                    "organization_structure": "any",
                    "website_requirement": "any",
                    "website_quality": ["minimum_score": NSNull()],
                    "subject_kind": "organization",
                    "qualification_terms": municipalityProfile ? [] : ["omsorg", "miljøarbeid"],
                    "qualification_requirement": "preferred",
                    "commercial_signals": [
                        "registered_in_vat_register": NSNull(),
                        "registered_in_business_register": businessRegisterRequirement,
                    ],
                ],
                "approval_mode": "manual",
                "places_details_enabled": false,
                "auto_discover_enabled": false,
                "schedule_cron": "0 6 * * *",
                "schedule_timezone": "Europe/Oslo",
            ]
        }
        let payload: [String: Any] = [
            "id": "22222222-2222-4222-8222-222222222222",
            "website_url": "https://tidum.no",
            "website_domain": "tidum.no",
            "project_name": "Tidum",
            "project_description": "Arbeidstidssystem for barn, omsorg og miljøarbeid.",
            "category": "Arbeidstid, omsorg og miljøarbeid",
            "category_confidence": "high",
            "classification_reasons": ["Domenet er verifisert som Tidum."],
            "brand_profile": [
                "targetAudience": "Private omsorgsaktører og kommunale tjenester i Norge.",
            ],
            "recommended_profiles": profilePayloads,
            "skills": [],
            "expires_at": "2026-09-12T12:00:00.000Z",
            "can_manage_multiple_profiles": true,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)

        let preview = try JSONDecoder().decode(
            LeadgridProjectOnboardingPreview.self,
            from: data
        )

        XCTAssertEqual(preview.websiteDomain, "tidum.no")
        XCTAssertEqual(preview.projectName, "Tidum")
        XCTAssertEqual(preview.category, "Arbeidstid, omsorg og miljøarbeid")
        XCTAssertEqual(preview.brandProfile?.targetAudience, "Private omsorgsaktører og kommunale tjenester i Norge.")
        XCTAssertEqual(preview.recommendedProfiles.map(\.name), names)
        XCTAssertEqual(preview.recommendedProfiles.compactMap(\.templateKey), templateKeys)
        XCTAssertTrue(preview.recommendedProfiles.allSatisfy {
            $0.brief.countryCode == "NO"
                && $0.brief.areaSummary == "Hele Norge"
                && $0.brief.validationMessage == nil
        })
        XCTAssertEqual(
            preview.recommendedProfiles[0].brief.industryQueries,
            ["87.104", "87.105", "87.991", "88.991"]
        )
        XCTAssertEqual(preview.recommendedProfiles[0].brief.organizationForms, ["AS", "IKS", "STI"])
        XCTAssertEqual(preview.recommendedProfiles[0].brief.employeeCount?.minimum, 5)
        XCTAssertEqual(preview.recommendedProfiles[3].brief.organizationNameQueries, ["kommune"])
        XCTAssertEqual(preview.recommendedProfiles[3].brief.organizationForms, ["KOMM"])
        XCTAssertNil(preview.recommendedProfiles[3].brief.employeeCount)
        XCTAssertNil(
            preview.recommendedProfiles[3].brief.commercialSignals.registeredInBusinessRegister
        )
    }

    func testRoleRoomPreviewDecodesSixEditableNationalProfiles() throws {
        let profileNames = [
            "Film- og TV-produksjon – Norge",
            "Reklame- og innholdsbyråer – Norge",
            "Casting- og talentmiljøer – Norge",
            "Film- og medieutdanning – Norge",
            "Dansestudioer og danseskoler – Norge",
            "Skuespillere og talenter – Norge",
        ]
        let templateKeys = [
            "role_room.production",
            "role_room.agencies",
            "role_room.casting",
            "role_room.education",
            "role_room.dance",
            "role_room.talents",
        ]
        let qualificationTerms = [
            ["filmproduksjon", "tv-produksjon", "postproduksjon", "produksjonsselskap"],
            ["reklame", "innholdsproduksjon", "film", "casting"],
            ["casting", "skuespiller", "talent", "self-tape", "film", "tv"],
            ["film", "medieproduksjon", "scenekunst", "skuespill", "tv-produksjon", "audiovisuell"],
            ["dans", "dance", "ballett", "koreografi"],
            ["skuespiller", "actor", "talent", "film", "scene"],
        ]
        let profilePayloads: [[String: Any]] = profileNames.enumerated().map { index, name in
            let castingProfile = index == 2
            let educationProfile = index == 3
            let danceProfile = index == 4
            let talentProfile = index == 5
            return [
                "name": name,
                "is_default": index == 0,
                "status": "active",
                "template_key": templateKeys[index],
                "template_version": 1,
                "brief": [
                    "industry_queries": castingProfile || educationProfile || danceProfile || talentProfile
                        ? []
                        : ["59.110"],
                    "organization_name_queries": castingProfile
                        ? ["casting"]
                        : educationProfile
                            ? ["filmskule", "universitet", "høgskole", "høyskole", "fagskole"]
                            : danceProfile
                                ? ["dansestudio", "danseskole", "ballettskole", "dance studio"]
                                : talentProfile ? ["skuespiller", "actor"] : [],
                    "exclusion_terms": castingProfile ? ["støperi"] : [],
                    "country_code": "NO",
                    "city": NSNull(),
                    "geo": NSNull(),
                    "target_count": castingProfile ? 40 : educationProfile ? 50 : 60,
                    "enrichment_count": 30,
                    "minimum_fit_score": castingProfile ? 70 : 65,
                    "subject_kind": talentProfile ? "person" : "organization",
                    "qualification_terms": qualificationTerms[index],
                    "qualification_requirement": index == 0 ? "preferred" : "required",
                ],
                "approval_mode": "manual",
                "places_details_enabled": false,
                "auto_discover_enabled": false,
                "schedule_cron": "0 6 * * *",
                "schedule_timezone": "Europe/Oslo",
            ]
        }
        let payload: [String: Any] = [
            "id": "22222222-2222-4222-8222-222222222222",
            "website_url": "https://theroleroom.com",
            "website_domain": "theroleroom.com",
            "project_name": "The Role Room",
            "project_description": "Produksjonsflate for film, TV og innholdsproduksjon.",
            "category": "Film, TV, casting og talent",
            "category_confidence": "high",
            "classification_reasons": ["Domenet er verifisert som The Role Room."],
            "recommended_profiles": profilePayloads,
            "skills": [],
            "expires_at": "2026-09-09T12:00:00.000Z",
            "can_manage_multiple_profiles": true,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)

        let preview = try JSONDecoder().decode(
            LeadgridProjectOnboardingPreview.self,
            from: data
        )

        XCTAssertEqual(preview.projectName, "The Role Room")
        XCTAssertEqual(preview.recommendedProfiles.map(\.name), profileNames)
        XCTAssertEqual(preview.recommendedProfiles.compactMap(\.templateKey), templateKeys)
        XCTAssertTrue(preview.recommendedProfiles.allSatisfy { $0.templateVersion == 1 })
        XCTAssertTrue(preview.recommendedProfiles.allSatisfy {
            $0.brief.countryCode == "NO"
                && $0.brief.areaSummary == "Hele Norge"
                && $0.brief.validationMessage == nil
        })
        XCTAssertEqual(
            preview.recommendedProfiles[2].brief.organizationNameQueries,
            ["casting"]
        )
        XCTAssertEqual(preview.recommendedProfiles[2].brief.industryQueries, [])
        XCTAssertEqual(
            preview.recommendedProfiles[3].brief.organizationNameQueries,
            ["filmskule", "universitet", "høgskole", "høyskole", "fagskole"]
        )
        XCTAssertEqual(preview.recommendedProfiles[3].brief.industryQueries, [])
        XCTAssertEqual(
            preview.recommendedProfiles[4].brief.organizationNameQueries,
            ["dansestudio", "danseskole", "ballettskole", "dance studio"]
        )
        XCTAssertEqual(
            preview.recommendedProfiles[5].brief.organizationNameQueries,
            ["skuespiller", "actor"]
        )
        XCTAssertEqual(preview.recommendedProfiles[5].brief.subjectKind, .person)
        XCTAssertEqual(preview.recommendedProfiles[3].brief.qualificationRequirement, .required)
        XCTAssertEqual(
            preview.recommendedProfiles[3].brief.qualificationTerms,
            qualificationTerms[3]
        )
    }

    func testBrandOverridesEncodeTheEditableFoundationWithCanonicalKeys() throws {
        let overrides = LeadgridProjectOnboardingBrandOverrides(
            projectName: "The Role Room Norge",
            projectDescription: "Produksjon, casting, utdanning og talenter.",
            category: "Film, TV, casting og talent",
            targetAudience: "Produksjonsselskap, byråer, skoler, dansestudioer og skuespillere"
        )

        let data = try JSONEncoder().encode(overrides)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(json["project_name"] as? String, "The Role Room Norge")
        XCTAssertEqual(
            json["project_description"] as? String,
            "Produksjon, casting, utdanning og talenter.")
        XCTAssertEqual(json["category"] as? String, "Film, TV, casting og talent")
        XCTAssertEqual(
            json["target_audience"] as? String,
            "Produksjonsselskap, byråer, skoler, dansestudioer og skuespillere")
        XCTAssertNil(json["targetAudience"])
    }

    func testCommitResponseReusesExistingDentumProjectWithoutDuplicateLeadState() throws {
        let data = Data(#"""
        {
          "project":{
            "id":"dentum",
            "organizationId":"11111111-1111-4111-8111-111111111111",
            "name":"Dentum",
            "description":"Tannhelse",
            "status":"active",
            "hasBrandKit":true,
            "leadCount":0,
            "competitorCount":0
          },
          "profiles":[],
          "skills":[],
          "reused_project":true,
          "replayed":false,
          "access":{
            "organization":{"id":"11111111-1111-4111-8111-111111111111","name":"Dentum","reused":true},
            "team":{"id":"dentum-salg","name":"Dentum salg","reused":false},
            "administrator":{
              "email":"daniel@creatorhubn.com",
              "status":"active",
              "organization_role":"admin",
              "project_role":"owner",
              "email_status":"not_required"
            },
            "invitations":[{
              "id":"55555555-5555-4555-8555-555555555555",
              "email":"selger@dentum.no",
              "status":"invited",
              "project_role":"member",
              "team_role":"member",
              "email_status":"sent"
            }],
            "discovery_access_verified":true
          }
        }
        """#.utf8)

        let result = try JSONDecoder().decode(
            LeadgridProjectOnboardingResult.self,
            from: data
        )
        XCTAssertEqual(result.project.id, "dentum")
        XCTAssertTrue(result.project.hasBrandKit)
        XCTAssertEqual(result.project.leadCount, 0)
        XCTAssertTrue(result.reusedProject)
        XCTAssertFalse(result.replayed)
        XCTAssertEqual(result.access?.administrator.email, "daniel@creatorhubn.com")
        XCTAssertEqual(result.access?.team?.name, "Dentum salg")
        XCTAssertEqual(result.access?.invitations.first?.emailStatus, "sent")
        XCTAssertEqual(result.access?.discoveryAccessVerified, true)
    }
}

final class DentumLeadOutreachTests: XCTestCase {
    private func lead(
        company: String = "Majorstuen Tannlegesenter AS",
        contactName: String = "Anne Lunde",
        status: LeadRow.LeadStatus = .notContacted,
        city: String? = "Oslo"
    ) -> LeadRow {
        LeadRow(
            company: company,
            category: "Tannhelse",
            contactName: contactName,
            contactRole: "Daglig leder",
            leadScore: 86,
            status: status,
            ownerName: "Daniel Qazi",
            ownerInitials: "DQ",
            ownerColor: .purple,
            nextFollowUp: nil,
            nextFollowUpOverdue: false,
            valueNok: 0,
            companyColor: .blue,
            projectId: "dentum-oslo",
            email: "post@klinikk.example",
            city: city,
            websiteURL: "https://klinikk.example",
            organizationNumber: "999888777"
        )
    }

    func testDentumProjectProvidesCompleteDentalClinicKit() throws {
        let context = LeadOutreachContext(
            lead: lead(),
            projectName: "Dentum",
            senderName: "Daniel Qazi"
        )
        let kit = LeadOutreachTemplateEngine.makeKit(context: context)

        XCTAssertTrue(kit.isDentum)
        XCTAssertEqual(kit.title, "Dentum-oppsett")
        XCTAssertEqual(kit.templates.count, 7)
        XCTAssertEqual(kit.recommendedTemplateID, "dentum-pilot")
        XCTAssertEqual(Set(kit.templates.map(\.id)).count, kit.templates.count)

        let pilot = try XCTUnwrap(kit.templates.first { $0.id == "dentum-pilot" })
        XCTAssertEqual(
            pilot.subject,
            "Kan Majorstuen Tannlegesenter AS bli med i Dentum-piloten?"
        )
        XCTAssertTrue(pilot.body.contains("Hei Anne,"))
        XCTAssertTrue(pilot.body.contains("pasienter i Oslo"))
        XCTAssertTrue(pilot.body.contains("gratis og uforpliktende"))
        XCTAssertTrue(pilot.body.contains("Daniel Qazi\nDentum"))
        XCTAssertFalse(pilot.body.contains("{{"))
    }

    func testSelectedLeadChangesEveryPersonalizedClinicMessage() {
        let first = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(), projectName: "Dentum", senderName: "Daniel Qazi"
        ))
        let second = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(company: "Bjørvika Tannklinikk", contactName: "Ola Berg", city: "Bjørvika"),
            projectName: "Dentum",
            senderName: "Daniel Qazi"
        ))

        XCTAssertEqual(first.templates.map(\.id), second.templates.map(\.id))
        for (firstTemplate, secondTemplate) in zip(first.templates, second.templates) {
            XCTAssertNotEqual(firstTemplate.subject, secondTemplate.subject)
            XCTAssertNotEqual(firstTemplate.body, secondTemplate.body)
            XCTAssertTrue(secondTemplate.body.contains("Ola"))
            XCTAssertTrue(secondTemplate.body.contains("Bjørvika Tannklinikk"))
        }
    }

    func testLeadStatusChoosesSafeRecommendedTemplate() {
        let contacted = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(status: .contacted), projectName: "Dentum", senderName: "Daniel"
        ))
        let interested = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(status: .interested), projectName: "Dentum", senderName: "Daniel"
        ))
        let warm = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(status: .warm), projectName: "Dentum", senderName: "Daniel"
        ))

        XCTAssertEqual(contacted.recommendedTemplateID, "dentum-follow-up")
        XCTAssertEqual(interested.recommendedTemplateID, "dentum-next-step")
        XCTAssertEqual(warm.recommendedTemplateID, "dentum-short-call")
    }

    func testMissingContactAndNonDentumProjectHaveHonestFallbacks() throws {
        let missingContact = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(contactName: "", city: nil),
            projectName: "Dentum",
            senderName: "Gjest"
        ))
        let pilot = try XCTUnwrap(missingContact.templates.first)
        XCTAssertTrue(pilot.body.hasPrefix("Hei,\n"))
        XCTAssertTrue(pilot.body.contains("området deres"))
        XCTAssertTrue(pilot.body.contains("Salgsteamet\nDentum"))

        let generic = LeadOutreachTemplateEngine.makeKit(context: .init(
            lead: lead(), projectName: "Et annet kundeprosjekt", senderName: "Daniel"
        ))
        XCTAssertFalse(generic.isDentum)
        XCTAssertEqual(generic.templates.count, 6)
        XCTAssertFalse(generic.templates.contains { $0.body.contains("Dentum") })
    }
}
