import XCTest
@testable import LeadMapApp

final class ProjectDomainOnboardingTests: XCTestCase {
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
          "replayed":false
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
    }
}
