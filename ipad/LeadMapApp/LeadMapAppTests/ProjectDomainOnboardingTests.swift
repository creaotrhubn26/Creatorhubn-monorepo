import XCTest
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
              "industry_queries":["tannklinikk","tannlege"],
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
            ["tannklinikk", "tannlege"]
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
