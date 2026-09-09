import XCTest
@testable import LeadMapApp

final class DiscoveryV2Tests: XCTestCase {
    func testPreviewDecodesDirectSnakeCaseContract() throws {
        let json = #"""
        {
          "brief": {
            "industry_queries": ["regnskapsbyrå"],
            "exclusion_terms": ["konkurrent"],
            "geo": {"latitude": 0, "longitude": 0, "radius_km": 12},
            "target_count": 20,
            "enrichment_count": 10,
            "minimum_fit_score": 55
          },
          "plan": {
            "version": 2,
            "queries": [{"text_query":"regnskapsbyrå","hard_geo_filter":true}],
            "source": "brreg_open_data",
            "requested_candidates": 20,
            "enrichment_candidates": 10,
            "estimated_search_pages": 1,
            "area": {"latitude":0,"longitude":0,"radius_km":12},
            "warnings": []
          },
          "plan_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "sources": [{
            "id": "brreg",
            "provider": "Brønnøysundregistrene",
            "provider_uri": "https://data.brreg.no/enhetsregisteret/",
            "license": "NLOD 2.0",
            "license_uri": "https://data.norge.no/nlod/no/2.0/",
            "notice": "Offentlig foretaksinformasjon"
          }]
        }
        """#.data(using: .utf8)!

        let preview = try JSONDecoder().decode(DiscoveryV2Preview.self, from: json)

        XCTAssertEqual(preview.brief.geo?.latitude, 0)
        XCTAssertEqual(preview.brief.geo?.longitude, 0)
        XCTAssertEqual(preview.plan.queries.first?.textQuery, "regnskapsbyrå")
        XCTAssertTrue(preview.plan.queries.first?.hardGeoFilter == true)
        XCTAssertEqual(preview.plan.version, 2)
        XCTAssertEqual(preview.plan.source, "brreg_open_data")
        XCTAssertEqual(preview.sources?.first?.id, "brreg")
        XCTAssertEqual(preview.sources?.first?.license, "NLOD 2.0")
    }

    func testBriefRequestPreservesZeroCoordinatesAndSnakeCase() throws {
        let brief = DiscoveryV2Brief(
            industryQueries: ["hotell"],
            exclusionTerms: [],
            city: nil,
            geo: .init(latitude: 0, longitude: 0, radiusKm: 5),
            targetCount: 12,
            enrichmentCount: 6,
            minimumFitScore: 50,
            idealCustomer: nil,
            goal: nil)

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(brief)) as? [String: Any])
        let geo = try XCTUnwrap(object["geo"] as? [String: Any])

        XCTAssertEqual(object["industry_queries"] as? [String], ["hotell"])
        XCTAssertEqual(object["target_count"] as? Int, 12)
        XCTAssertEqual(geo["latitude"] as? Double, 0)
        XCTAssertEqual(geo["longitude"] as? Double, 0)
        XCTAssertEqual(geo["radius_km"] as? Double, 5)
    }

    func testWebsiteAssessmentLimitIsOnlyActiveForWebsiteQuality() throws {
        var brief = DiscoveryV2Brief(
            industryQueries: ["hotell"],
            exclusionTerms: [],
            city: "Oslo",
            geo: nil,
            targetCount: 12,
            enrichmentCount: 6,
            minimumFitScore: 50,
            idealCustomer: nil,
            goal: nil)

        XCTAssertNil(brief.effectiveWebsiteAssessmentLimit)
        XCTAssertEqual(
            brief.websiteAssessmentLimitDescription,
            "Brukes kun når vurdering av nettsidekvalitet er aktivert.")

        brief.websiteQuality.minimumScore = 65
        XCTAssertEqual(brief.effectiveWebsiteAssessmentLimit, 6)
        XCTAssertEqual(
            brief.websiteAssessmentLimitDescription,
            "Maks 6 Brreg-registrerte nettsider kan vurderes per kjøring.")

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(brief))
                as? [String: Any])
        XCTAssertEqual(object["enrichment_count"] as? Int, 6)
    }

    func testOrganizationStructureCopyOnlyClaimsBrregGroupEvidence() {
        XCTAssertEqual(
            DiscoveryV2OrganizationStructure.any.title,
            "Ikke filtrer på Brreg-konserntilknytning")
        XCTAssertEqual(
            DiscoveryV2OrganizationStructure.independent.title,
            "Ingen Brreg-konserntilknytning observert")
        XCTAssertEqual(
            DiscoveryV2OrganizationStructure.chain.title,
            "Brreg-konserntilknytning observert")
        XCTAssertEqual(
            DiscoveryV2OrganizationStructure.evidenceNotice,
            "Viser bare registrert konsernstruktur i Brreg – ikke kommersiell kjede eller franchise.")
    }

    func testNBARequestPathAlwaysCarriesEncodedLeadgridProjectScope() throws {
        let path = LeadgridNBARequestPath.make(
            projectId: "customer/project & oslo",
            priority: "high",
            limit: 500)
        let components = try XCTUnwrap(URLComponents(string: path))
        let items = try XCTUnwrap(components.queryItems)

        XCTAssertEqual(components.path, "/api/leadgrid/intelligence/recommendations")
        XCTAssertEqual(items.first(where: { $0.name == "projectId" })?.value, "customer/project & oslo")
        XCTAssertEqual(items.first(where: { $0.name == "priority" })?.value, "high")
        XCTAssertEqual(items.first(where: { $0.name == "limit" })?.value, "200")
    }

    func testIntelligenceLifecyclePathsAlwaysCarryProjectScope() throws {
        let mutation = try XCTUnwrap(URLComponents(string:
            LeadgridNBARequestPath.mutation(
                id: "rec/one", action: "accept", projectId: "customer & oslo")))
        let followUp = try XCTUnwrap(URLComponents(string:
            LeadgridNBARequestPath.followUpQueue(projectId: "customer & oslo")))
        let snapshot = try XCTUnwrap(URLComponents(string:
            LeadgridIntelligenceRequestPath.lead(
                "lead/one", action: "history", projectId: "customer & oslo")))
        let pipeline = try XCTUnwrap(URLComponents(string:
            LeadgridPipelineRequestPath.update(
                leadId: "lead/one", projectId: "customer & oslo")))

        for components in [mutation, followUp, snapshot, pipeline] {
            XCTAssertEqual(
                components.queryItems?.first(where: { $0.name == "projectId" })?.value,
                "customer & oslo")
        }
        XCTAssertEqual(
            mutation.percentEncodedPath,
            "/api/leadgrid/intelligence/recommendations/rec%2Fone/accept")
        XCTAssertEqual(
            snapshot.percentEncodedPath,
            "/api/leadgrid/intelligence/leads/lead%2Fone/history")
        XCTAssertEqual(
            pipeline.percentEncodedPath,
            "/api/leadgrid/intelligence/leads/lead%2Fone/pipeline-stage")
    }

    func testMinimalRecommendationMutationResponsesDecodeTruthfully() throws {
        let accepted = try JSONDecoder().decode(
            LeadgridNBAMutationResult.self,
            from: Data(#"{"id":"rec-1","status":"accepted","replayed":true}"#.utf8))
        let executed = try JSONDecoder().decode(
            LeadgridNBAExecutionResult.self,
            from: Data(#"{"id":"rec-1","status":"executed","outcome":"positive","replayed":false}"#.utf8))

        XCTAssertEqual(accepted.id, "rec-1")
        XCTAssertEqual(accepted.status, "accepted")
        XCTAssertEqual(accepted.replayed, true)
        XCTAssertTrue(executed.confirmsExecution)
        XCTAssertEqual(executed.outcome, .positive)
    }

    func testCandidateKeepsFitAndDataQualitySeparateAndMissingEvidenceNil() throws {
        let json = #"""
        {
          "id":"candidate-1",
          "name":"Nordic AS",
          "fit_score":84,
          "fit_coverage":0.75,
          "data_quality_score":42,
          "data_quality_coverage":0.4,
          "organization_number":"123456789",
          "disposition":"review_ready"
        }
        """#.data(using: .utf8)!

        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: json)

        XCTAssertEqual(candidate.fitScore, 84)
        XCTAssertEqual(candidate.dataQualityScore, 42)
        XCTAssertEqual(candidate.fitCoverage, 0.75)
        XCTAssertNil(candidate.reasons)
        XCTAssertNil(candidate.evidence)
        XCTAssertEqual(candidate.organizationNumber, "123456789")
    }

    func testNumericEvidenceDoesNotBreakCandidateDecode() throws {
        let data = Data(#"{"id":"c1","name":"Test","evidence":[{"ref":"distance_meters","label":"Avstand","value":1250}]}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)
        XCTAssertEqual(candidate.evidence?.first?.reference, "distance_meters")
        XCTAssertEqual(candidate.evidence?.first?.value, "1250")
    }

    func testCandidateDecodesBRREGIdentity() throws {
        let data = Data(#"{"id":"c1","name":"Test AS","source":"brreg_open_data","organization_number":"987654321","address":"Storgata 1","city":"Oslo","sources":[{"id":"brreg","provider":"Brønnøysundregistrene","provider_uri":"https://data.brreg.no/enhetsregisteret/","license":"NLOD 2.0","license_uri":"https://data.norge.no/nlod/no/2.0/","notice":"Offentlig foretaksinformasjon"}]}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertEqual(candidate.source, "brreg_open_data")
        XCTAssertEqual(candidate.organizationNumber, "987654321")
        XCTAssertEqual(candidate.address, "Storgata 1")
        XCTAssertEqual(candidate.city, "Oslo")
        XCTAssertEqual(candidate.sources?.map(\.id), ["brreg"])
    }

    func testCandidateDecodesClinicAccountWithPractitionerContacts() throws {
        let data = Data(#"""
        {
          "id":"clinic-1",
          "name":"Storgata Tannklinikk AS",
          "entity_kind":"clinic",
          "entity_kind_confidence":"high",
          "entity_kind_evidence":["public_clinic_name"],
          "clinic_group":{
            "role":"clinic_account",
            "clinic_candidate_id":"clinic-1",
            "clinic_name":"Storgata Tannklinikk AS",
            "clinic_lead_id":null,
            "relationship_confidence":null,
            "evidence":["classified_clinic_account"],
            "practitioners":[{
              "candidate_id":"dentist-1",
              "name":"Tannlege Kari Nordmann",
              "organization_number":"987654321",
              "relationship_confidence":"high",
              "evidence":["same_normalized_address","only_clinic_at_location"]
            }]
          }
        }
        """#.utf8)

        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertEqual(candidate.entityKind, .clinic)
        XCTAssertEqual(candidate.entityKindConfidence, "high")
        XCTAssertEqual(candidate.clinicGroup?.role, .clinicAccount)
        XCTAssertEqual(candidate.clinicGroup?.practitioners.count, 1)
        XCTAssertEqual(candidate.clinicGroup?.practitioners.first?.name, "Tannlege Kari Nordmann")
    }

    func testLegacyCandidateWithoutClinicGroupingStillDecodes() throws {
        let data = Data(#"{"id":"candidate-legacy","name":"Legacy AS"}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertNil(candidate.entityKind)
        XCTAssertNil(candidate.clinicGroup)
    }

    func testPractitionerCanReferenceAnExistingClinicLead() throws {
        let data = Data(#"{"id":"dentist-1","name":"Tannlege Kari Nordmann","entity_kind":"practitioner","clinic_group":{"role":"practitioner_contact","clinic_candidate_id":"clinic-1","clinic_name":"Storgata Tannklinikk AS","clinic_lead_id":"lead-1","relationship_confidence":"high","evidence":["same_normalized_address"],"practitioners":[]}}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertEqual(candidate.clinicGroup?.role, .practitionerContact)
        XCTAssertEqual(candidate.clinicGroup?.clinicLeadId, "lead-1")
    }

    func testDecisionAndLeadbookContactContractsDecode() throws {
        let decisionData = Data(#"{"candidate_id":"clinic-1","run_id":"run-1","decision":"approve","candidate_status":"imported","lead_id":"lead-1","feedback_id":"feedback-1","contact_count":2,"replayed":false}"#.utf8)
        let decision = try JSONDecoder().decode(
            DiscoveryV2DecisionResult.self,
            from: decisionData)
        XCTAssertEqual(decision.contactCount, 2)

        let contactData = Data(#"{"id":"contact-1","name":"Tannlege Kari Nordmann","role":"Tannlege","organizationNumber":"987654321","source":"discovery","relationshipConfidence":"high"}"#.utf8)
        let contact = try JSONDecoder().decode(
            LeadgridCustomerContact.self,
            from: contactData)
        XCTAssertEqual(contact.organizationNumber, "987654321")
        XCTAssertEqual(contact.relationshipConfidence, "high")
    }

    func testMigratedProfileUsesDefensiveBriefDefaults() throws {
        let data = Data(#"{"id":"profile-1","name":"Standard","is_default":true,"version":2,"brief":{"industry_queries":["regnskap"],"exclusion_terms":[],"city":"Oslo","target_count":20,"enrichment_count":10}}"#.utf8)
        let profile = try JSONDecoder().decode(DiscoveryV2Profile.self, from: data)

        XCTAssertEqual(profile.brief.minimumFitScore, 50)
        XCTAssertEqual(profile.brief.municipalityNames, [])
        XCTAssertEqual(profile.brief.organizationForms, [])
        XCTAssertNil(profile.brief.employeeCount)
        XCTAssertEqual(profile.brief.organizationStructure, .any)
        XCTAssertEqual(profile.brief.websiteRequirement, .any)
        XCTAssertNil(profile.brief.commercialSignals.registeredInVatRegister)
    }

    func testMunicipalityProfileRoundTripsHardFiltersAndFitCriteria() throws {
        var brief = DiscoveryV2Brief.mapArea(
            center: .init(latitude: 59.91, longitude: 10.75))
        brief.industryQueries = ["tannklinikk"]
        brief.geo = nil
        brief.municipalityNames = ["Bærum", "Asker"]
        brief.municipalityNumbers = ["3201", "3203"]
        brief.territoryCode = "VEST"
        brief.organizationForms = ["as"]
        brief.employeeCount = .init(minimum: 5, maximum: 50)
        brief.organizationStructure = .independent
        brief.websiteRequirement = .present
        brief.commercialSignals = .init(
            registeredInVatRegister: true,
            registeredInBusinessRegister: true)

        XCTAssertNil(brief.validationMessage)
        XCTAssertEqual(brief.areaSummary, "Bærum + Asker")
        XCTAssertTrue(brief.fitFilterSummary.contains("5–50 ansatte"))

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(brief.normalized))
                as? [String: Any])
        XCTAssertEqual(object["municipality_names"] as? [String], ["Bærum", "Asker"])
        XCTAssertEqual(object["municipality_numbers"] as? [String], ["3201", "3203"])
        XCTAssertEqual(object["territory_code"] as? String, "vest")
        XCTAssertEqual(object["organization_forms"] as? [String], ["AS"])
        XCTAssertEqual(object["organization_structure"] as? String, "independent")
        XCTAssertEqual(object["website_requirement"] as? String, "present")
        let employees = try XCTUnwrap(object["employee_count"] as? [String: Any])
        XCTAssertEqual(employees["minimum"] as? Int, 5)
        XCTAssertEqual(employees["maximum"] as? Int, 50)
    }

    func testMunicipalityPreviewPlanDecodesHardAreaAndTerritoryProvenance() throws {
        let data = Data(#"{"version":2,"queries":[{"text_query":"tannklinikk","hard_geo_filter":true}],"source":"brreg_open_data","requested_candidates":60,"enrichment_candidates":40,"estimated_search_pages":3,"area":{"municipality_numbers":["3201","3203"],"municipality_names":["Bærum","Asker"]},"territory_code":"vest","warnings":[]}"#.utf8)
        let plan = try JSONDecoder().decode(DiscoveryV2SearchPlan.self, from: data)

        guard case .municipalities(let area) = plan.area else {
            return XCTFail("Forventet hardt kommuneområde")
        }
        XCTAssertEqual(area.municipalityNumbers, ["3201", "3203"])
        XCTAssertEqual(area.municipalityNames, ["Bærum", "Asker"])
        XCTAssertEqual(plan.territoryCode, "vest")
    }

    func testMunicipalityTextCodecSupportsOfficialNameAndNumberPairs() {
        let parsed = DiscoveryV2MunicipalityTextCodec.values(from: """
        Bærum | 3201
        Asker | 3203
        Nordre Follo
        0301
        """)

        XCTAssertEqual(parsed.names, ["Bærum", "Asker", "Nordre Follo"])
        XCTAssertEqual(parsed.numbers, ["3201", "3203", "0301"])
        XCTAssertTrue(
            DiscoveryV2MunicipalityTextCodec.text(
                names: ["Bærum", "Asker"],
                numbers: ["3201", "3203"]
            ).contains("Bærum | 3201"))
    }

    func testHardMunicipalitySelectionRejectsLegacyAreaAndInvalidEmployeeRange() {
        var brief = DiscoveryV2Brief.mapArea(
            center: .init(latitude: 59.91, longitude: 10.75))
        brief.industryQueries = ["tannklinikk"]
        brief.municipalityNames = ["Oslo"]
        XCTAssertEqual(
            brief.validationMessage,
            "Kommuneutvalg kan ikke kombineres med by eller kart-radius.")

        brief.geo = nil
        brief.employeeCount = .init(minimum: 50, maximum: 5)
        XCTAssertEqual(
            brief.validationMessage,
            "Minste antall ansatte kan ikke være høyere enn største antall.")

        brief.employeeCount = .init(minimum: 2, maximum: nil)
        XCTAssertEqual(
            brief.validationMessage,
            "Minimum ansatte må være 0, 1 eller minst 5.")

        brief.employeeCount = nil
        brief.territoryCode = "øst nord"
        XCTAssertEqual(
            brief.validationMessage,
            "Territorium-taggen må være en kort kode, for eksempel «ost-nord».")
    }

    func testProfilePresentationKeepsMultipleRegionsDistinct() throws {
        let data = Data(#"{"id":"profile-west","name":"Vest","is_default":false,"version":1,"brief":{"industry_queries":["tannklinikk"],"exclusion_terms":[],"municipality_names":["Bærum","Asker"],"municipality_numbers":["3201","3203"],"territory_code":"vest","target_count":60,"enrichment_count":40,"minimum_fit_score":65}}"#.utf8)
        let profile = try JSONDecoder().decode(DiscoveryV2Profile.self, from: data)

        XCTAssertEqual(profile.name, "Vest")
        XCTAssertEqual(profile.brief.areaSummary, "Bærum + Asker")
        XCTAssertEqual(profile.brief.territoryCode, "vest")
        XCTAssertEqual(profile.brief.fitFilterSummary.first, "Match minst 65")
    }

    func testOsloRegionPresetBuildsFourProfilesInOneProjectContext() throws {
        var base = DiscoveryV2Brief.mapArea(
            center: .init(latitude: 59.91, longitude: 10.75))
        base.industryQueries = ["tannklinikk", "tannlege"]
        base.exclusionTerms = ["holding", "kjede"]
        base.idealCustomer = "Selvstendig klinikk med vekstambisjon"
        base.goal = "Rekruttere pilotklinikker"
        base.organizationStructure = .independent
        base.websiteRequirement = .present

        let preset = DiscoveryV2ProfilePreset.osloRegionClinicPilot
        let drafts = preset.drafts(copying: base)
        let byTerritory = Dictionary(uniqueKeysWithValues: drafts.compactMap { draft in
            draft.brief.territoryCode.map { ($0, draft) }
        })

        XCTAssertEqual(drafts.count, 4)
        XCTAssertEqual(drafts.compactMap(\.brief.territoryCode), [
            "oslo", "vest", "ost-nord", "sor",
        ])
        XCTAssertEqual(Set(byTerritory.keys), ["oslo", "vest", "ost-nord", "sor"])
        XCTAssertEqual(byTerritory["oslo"]?.brief.municipalityNumbers, ["0301"])
        XCTAssertEqual(byTerritory["vest"]?.brief.municipalityNumbers, ["3201", "3203"])
        XCTAssertEqual(
            byTerritory["ost-nord"]?.brief.municipalityNumbers,
            ["3222", "3205", "3232", "3224", "3209"])
        XCTAssertEqual(
            byTerritory["sor"]?.brief.municipalityNumbers,
            ["3207", "3212", "3214", "3218", "3216"])
        XCTAssertEqual(drafts.flatMap(\.brief.municipalityNumbers).count, 13)
        XCTAssertTrue(drafts.allSatisfy { draft in
            draft.brief.city == nil
                && draft.brief.geo == nil
                && draft.brief.targetCount == 60
                && draft.brief.enrichmentCount == 40
                && draft.brief.minimumFitScore == 65
                && draft.brief.organizationForms == ["AS"]
                && draft.brief.employeeCount?.minimum == 5
                && draft.brief.industryQueries == base.industryQueries
                && draft.brief.exclusionTerms == base.exclusionTerms
                && draft.brief.idealCustomer == base.idealCustomer
                && draft.brief.goal == base.goal
        })
        XCTAssertFalse(preset.title.localizedCaseInsensitiveContains("Dentum"))
    }

    func testPresetTerritoryMakesBatchRetrySkipExistingProfile() throws {
        let drafts = DiscoveryV2ProfilePreset.osloRegionClinicPilot.drafts(
            copying: configuredClinicBrief())
        let west = try XCTUnwrap(drafts.first(where: { $0.brief.territoryCode == "vest" }))
        let existing = DiscoveryV2Profile(
            id: "profile-west",
            name: "Vest – eksisterende navn",
            isDefault: false,
            version: 3,
            brief: west.brief,
            placesDetailsEnabled: false)

        XCTAssertTrue(DiscoveryRunCoordinator.profile(west, existsIn: [existing]))
    }

    func testProfileMatchingUsesBackendCanonicalSetOrder() throws {
        let drafts = DiscoveryV2ProfilePreset.osloRegionClinicPilot.drafts(
            copying: configuredClinicBrief())
        let eastNorth = try XCTUnwrap(
            drafts.first(where: { $0.brief.territoryCode == "ost-nord" }))
        var serverBrief = eastNorth.brief
        serverBrief.municipalityNumbers.reverse()
        serverBrief.municipalityNames.reverse()
        serverBrief.organizationForms = ["ENK", "AS"]
        var draftWithForms = eastNorth
        draftWithForms.brief.organizationForms = ["AS", "ENK"]
        let existing = DiscoveryV2Profile(
            id: "profile-east-north",
            name: "Øst og nord",
            isDefault: false,
            version: 5,
            brief: serverBrief,
            placesDetailsEnabled: false,
            status: .active)

        XCTAssertTrue(
            DiscoveryRunCoordinator.profile(draftWithForms, matches: existing))
        XCTAssertTrue(DiscoveryRunCoordinator.profileBriefsMatch(
            draftWithForms.brief,
            serverBrief))
        XCTAssertNotEqual(
            draftWithForms.brief.normalized.municipalityNumbers,
            serverBrief.normalized.municipalityNumbers,
            "Comparison canonicalization must not reorder the user-facing brief")
    }

    func testCanonicalMunicipalityResponseKeepsNameNumberPairsInEditor() {
        let text = DiscoveryV2MunicipalityTextCodec.text(
            names: ["Bærum", "Asker"],
            numbers: ["3201", "3203"])

        XCTAssertEqual(text, "Bærum | 3201\nAsker | 3203")
        let decoded = DiscoveryV2MunicipalityTextCodec.values(from: text)
        XCTAssertEqual(decoded.names, ["Bærum", "Asker"])
        XCTAssertEqual(decoded.numbers, ["3201", "3203"])
    }

    func testPresetTerritoryRejectsDifferentCustomerAndFiltersAsConflict() throws {
        let drafts = DiscoveryV2ProfilePreset.osloRegionClinicPilot.drafts(
            copying: configuredClinicBrief())
        let oslo = try XCTUnwrap(drafts.first(where: { $0.brief.territoryCode == "oslo" }))
        var restaurantBrief = oslo.brief
        restaurantBrief.industryQueries = ["restaurant"]
        restaurantBrief.idealCustomer = "Uavhengig restaurant"
        let existing = DiscoveryV2Profile(
            id: "profile-oslo-restaurant",
            name: "Oslo restaurant",
            isDefault: false,
            version: 2,
            brief: restaurantBrief,
            placesDetailsEnabled: false)

        XCTAssertFalse(DiscoveryRunCoordinator.profile(oslo, existsIn: [existing]))
        XCTAssertEqual(
            DiscoveryRunCoordinator.conflictingProfile(for: oslo, in: [existing])?.id,
            existing.id)
    }

    func testPausedExactPresetProfileCannotEnableCampaign() throws {
        let drafts = DiscoveryV2ProfilePreset.osloRegionClinicPilot.drafts(
            copying: configuredClinicBrief())
        let west = try XCTUnwrap(drafts.first(where: { $0.brief.territoryCode == "vest" }))
        let paused = DiscoveryV2Profile(
            id: "profile-west-paused",
            name: "Vest",
            isDefault: false,
            version: 3,
            brief: west.brief,
            placesDetailsEnabled: false,
            status: .paused)

        XCTAssertTrue(DiscoveryRunCoordinator.profile(west, existsIn: [paused]))
        XCTAssertEqual(
            DiscoveryRunCoordinator.pausedMatchingProfile(for: west, in: [paused])?.id,
            paused.id)
    }

    func testRunProfileLineageRequiresTheExactSavedPreview() {
        let savedBrief = configuredClinicBrief().normalized
        let profile = DiscoveryV2Profile(
            id: "profile-west",
            name: "Vest",
            isDefault: false,
            version: 3,
            brief: savedBrief,
            placesDetailsEnabled: false)

        XCTAssertEqual(
            DiscoveryRunCoordinator.profileForRun(
                profile,
                previewBrief: savedBrief,
                placesDetailsEnabled: false)?.id,
            profile.id)

        var editedBrief = savedBrief
        editedBrief.targetCount += 1
        XCTAssertNil(DiscoveryRunCoordinator.profileForRun(
            profile,
            previewBrief: editedBrief,
            placesDetailsEnabled: false))
        XCTAssertNil(DiscoveryRunCoordinator.profileForRun(
            profile,
            previewBrief: savedBrief,
            placesDetailsEnabled: true))
        XCTAssertNil(DiscoveryRunCoordinator.profileForRun(
            nil,
            previewBrief: savedBrief,
            placesDetailsEnabled: false))
    }

    func testProfileBatchWireContractWrapsWritesAndDecodesReplay() throws {
        let writes = DiscoveryV2ProfilePreset.osloRegionClinicPilot
            .drafts(copying: configuredClinicBrief())
            .enumerated()
            .map { index, draft in
                DiscoveryV2ProfileWrite(
                    name: draft.name,
                    isDefault: index == 0,
                    expectedVersion: nil,
                    brief: draft.brief,
                    placesDetailsEnabled: false)
            }
        let encoded = try JSONEncoder().encode(
            DiscoveryV2ProfileBatchRequest(profiles: writes))
        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        let profiles = try XCTUnwrap(body["profiles"] as? [[String: Any]])

        XCTAssertEqual(profiles.count, 4)
        XCTAssertEqual(profiles.map { $0["name"] as? String }, [
            "Oslo kjerne", "Vest", "Øst og nord", "Sør",
        ])
        XCTAssertEqual(profiles.filter { $0["is_default"] as? Bool == true }.count, 1)

        let responseData = Data(#"{"profiles":[{"id":"profile-oslo","name":"Oslo kjerne","is_default":true,"version":1,"brief":{"industry_queries":["tannklinikk"],"exclusion_terms":[],"municipality_names":["Oslo"],"municipality_numbers":["0301"],"territory_code":"oslo","target_count":60,"enrichment_count":40,"minimum_fit_score":65}}],"replayed":true}"#.utf8)
        let response = try JSONDecoder().decode(
            DiscoveryV2ProfileBatchResponse.self,
            from: responseData)

        XCTAssertTrue(response.replayed)
        XCTAssertEqual(response.profiles.map(\.id), ["profile-oslo"])
        XCTAssertEqual(response.profiles.first?.brief.territoryCode, "oslo")
    }

    func testCampaignDecodesImmutableBriefAndNullableActors() throws {
        let data = Data(#"""
        {
          "id":"campaign-1",
          "organization_id":"org-1",
          "project_id":"dentum",
          "name":"Dentum – klinikkpilot Oslo og omegn",
          "status":"running",
          "profile_ids":["profile-oslo"],
          "current_position":0,
          "total_profiles":1,
          "completed_profiles":0,
          "partial_profiles":0,
          "failed_profiles":0,
          "active_run_id":"run-2",
          "requested_by":null,
          "cancellation_requested_at":null,
          "cancellation_requested_by":null,
          "started_at":"2026-09-06T10:00:00.000Z",
          "finished_at":null,
          "error_code":null,
          "error_message":null,
          "version":3,
          "created_at":"2026-09-06T10:00:00.000Z",
          "updated_at":"2026-09-06T10:01:00.000Z",
          "items":[{
            "position":0,
            "profile_id":"profile-oslo",
            "profile_version":4,
            "profile_name":"Oslo kjerne",
            "territory_code":"oslo",
            "brief_snapshot":{
              "industry_queries":["86.230","tannklinikk"],
              "exclusion_terms":["holding"],
              "municipality_names":["Oslo"],
              "municipality_numbers":["0301"],
              "territory_code":"oslo",
              "target_count":60,
              "enrichment_count":40,
              "minimum_fit_score":65,
              "ideal_customer":"Selvstendig tannklinikk"
            },
            "status":"running",
            "attempt_count":2,
            "current_run_id":"run-2",
            "run_status":"researching",
            "candidate_count":31,
            "researched_count":12,
            "review_ready_count":8,
            "error_code":null,
            "error_message":null,
            "started_at":"2026-09-06T10:00:00.000Z",
            "finished_at":null,
            "attempts":[{
              "attempt_no":1,
              "run_id":"run-1",
              "status":"failed",
              "candidate_count":10,
              "review_ready_count":0,
              "error_code":"provider_timeout",
              "error_message":"Tidsavbrudd",
              "started_at":"2026-09-06T09:55:00.000Z",
              "finished_at":"2026-09-06T09:56:00.000Z",
              "created_at":"2026-09-06T09:55:00.000Z"
            },{
              "attempt_no":2,
              "run_id":"run-2",
              "status":"researching",
              "candidate_count":31,
              "review_ready_count":8,
              "error_code":null,
              "error_message":null,
              "started_at":"2026-09-06T10:00:00.000Z",
              "finished_at":null,
              "created_at":"2026-09-06T10:00:00.000Z"
            }]
          }]
        }
        """#.utf8)

        let campaign = try JSONDecoder().decode(DiscoveryV2CampaignRun.self, from: data)
        let item = try XCTUnwrap(campaign.items.first)

        XCTAssertNil(campaign.requestedBy)
        XCTAssertEqual(campaign.projectId, "dentum")
        XCTAssertEqual(campaign.currentItem?.profileName, "Oslo kjerne")
        XCTAssertEqual(item.briefSnapshot.industryQueries, ["86.230", "tannklinikk"])
        XCTAssertEqual(item.briefSnapshot.idealCustomer, "Selvstendig tannklinikk")
        XCTAssertTrue(DiscoveryRunCoordinator.campaignItem(item, containsRunId: "run-1"))
        XCTAssertTrue(DiscoveryRunCoordinator.campaignItem(item, containsRunId: "run-2"))
        XCTAssertFalse(DiscoveryRunCoordinator.campaignItem(item, containsRunId: "run-other-project"))
    }

    func testCampaignCommandKeyIsStableForOneVersionAndChangesOnAdvance() {
        let first = DiscoveryRunCoordinator.campaignCommandIdempotencyKey(
            projectId: "dentum",
            campaignId: "campaign-1",
            action: "cancel",
            version: 4)
        let replay = DiscoveryRunCoordinator.campaignCommandIdempotencyKey(
            projectId: "dentum",
            campaignId: "campaign-1",
            action: "cancel",
            version: 4)
        let next = DiscoveryRunCoordinator.campaignCommandIdempotencyKey(
            projectId: "dentum",
            campaignId: "campaign-1",
            action: "cancel",
            version: 5)

        XCTAssertEqual(first, replay)
        XCTAssertNotEqual(first, next)
    }

    func testCampaignStartEncodesTheVersionsShownAtConfirmation() throws {
        let request = DiscoveryV2CampaignCreateRequest(
            name: "Dentum – klinikkpilot Oslo og omegn",
            profiles: [
                .init(profileId: "profile-oslo", expectedVersion: 3),
                .init(profileId: "profile-west", expectedVersion: 7),
            ])
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request))
                as? [String: Any])
        let profiles = try XCTUnwrap(object["profiles"] as? [[String: Any]])

        XCTAssertNil(object["profile_ids"])
        XCTAssertEqual(profiles.map { $0["profile_id"] as? String }, [
            "profile-oslo", "profile-west",
        ])
        XCTAssertEqual(profiles.map { $0["expected_version"] as? Int }, [3, 7])
    }

    func testProfileBatchAttemptKeepsOneBareUUIDAcrossRetries() throws {
        let id = try XCTUnwrap(UUID(uuidString: "A2B6A8D6-359A-4B51-ACB1-9D7A67BE672B"))
        let attempt = DiscoveryV2ProfileBatchAttempt(id: id)

        XCTAssertEqual(
            attempt.idempotencyKey,
            "a2b6a8d6-359a-4b51-acb1-9d7a67be672b")
        XCTAssertEqual(attempt.idempotencyKey, attempt.idempotencyKey)
    }

    func testProfileBatchResultNeverDescribesAtomicFailureAsPartialSuccess() {
        let result = DiscoveryV2ProfileBatchResult(
            createdNames: [],
            existingNames: ["Vest"],
            failedNames: ["Oslo kjerne", "Øst og nord", "Sør"])

        XCTAssertFalse(result.isComplete)
        XCTAssertEqual(result.createdCount, 0)
        XCTAssertEqual(result.existingCount, 1)
        XCTAssertFalse(result.replayed)
    }

    func testNBAExecutionContractUsesOnlyBackendOutcomesAndAcceptsReplay() throws {
        XCTAssertEqual(
            Set(LeadgridNBAOutcome.allCases.map(\.rawValue)),
            Set(["positive", "neutral", "negative"]))

        let first = try JSONDecoder().decode(
            LeadgridNBAExecutionResult.self,
            from: Data(#"{"id":"rec-1","status":"executed","outcome":"positive","replayed":false}"#.utf8))
        let replay = try JSONDecoder().decode(
            LeadgridNBAExecutionResult.self,
            from: Data(#"{"id":"rec-1","status":"executed","outcome":"positive","replayed":true}"#.utf8))

        XCTAssertEqual(first.outcome, .positive)
        XCTAssertTrue(first.confirmsExecution)
        XCTAssertEqual(first.replayed, false)
        XCTAssertTrue(replay.confirmsExecution)
        XCTAssertEqual(replay.replayed, true)
    }

    func testNBAExecutionDoesNotAcceptAnUnconfirmedResponse() throws {
        let result = try JSONDecoder().decode(
            LeadgridNBAExecutionResult.self,
            from: Data(#"{"id":"rec-2","status":"pending","outcome":"neutral"}"#.utf8))

        XCTAssertFalse(result.confirmsExecution)
        XCTAssertNil(result.replayed)
    }

    func testCandidateDecodesProfileAndCrossProfileTerritoryProvenance() throws {
        let data = Data(#"{"id":"c1","name":"Klinikk AS","discovery_profile":{"id":"p-west","name":"Vest","version":2,"territory_code":"vest"},"observed_run_count":3,"observed_in_profiles":[{"profile_id":"p-west","profile_name":"Vest","profile_version":2,"territory_code":"vest","run_count":2,"last_seen_at":"2026-09-05T10:00:00.000Z"},{"profile_id":"p-oslo","profile_name":"Oslo kjerne","profile_version":1,"territory_code":"oslo","run_count":1,"last_seen_at":"2026-09-04T10:00:00.000Z"}]}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertEqual(candidate.discoveryProfile?.name, "Vest")
        XCTAssertEqual(candidate.discoveryProfile?.territoryCode, "vest")
        XCTAssertEqual(candidate.observedRunCount, 3)
        XCTAssertEqual(candidate.observedInProfiles?.map(\.territoryCode), ["vest", "oslo"])
        XCTAssertEqual(candidate.observedInProfiles?.map(\.runCount), [2, 1])
    }

    func testCandidateSurfacesApproximateObservationProvenance() throws {
        let data = Data(#"{"id":"c1","name":"Historisk klinikk","observation":{"origin":"legacy_backfill_current_canonical","observed_at":null,"captured_at":"2026-09-06T10:00:00.000Z","is_approximate":true}}"#.utf8)
        let candidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: data)

        XCTAssertEqual(candidate.observation?.origin, .legacyBackfillCurrentCanonical)
        XCTAssertNil(candidate.observation?.observedAt)
        XCTAssertEqual(candidate.observation?.capturedAt, "2026-09-06T10:00:00.000Z")
        XCTAssertNotNil(candidate.observation?.reviewNotice)

        let futureData = Data(#"{"id":"c2","name":"Ny opprinnelse","observation":{"origin":"future_provider_mode","is_approximate":false}}"#.utf8)
        let futureCandidate = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: futureData)
        XCTAssertEqual(futureCandidate.observation?.origin, .unknown)
        XCTAssertNotNil(futureCandidate.observation?.reviewNotice)
    }

    func testWebsiteQualityFilterRoundTripsAndRejectsContradictoryPresenceRule() throws {
        var brief = configuredClinicBrief()
        brief.websiteQuality.minimumScore = 72
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(brief)) as? [String: Any])
        let quality = try XCTUnwrap(object["website_quality"] as? [String: Any])
        XCTAssertEqual(quality["minimum_score"] as? Int, 72)
        XCTAssertNil(brief.validationMessage)

        brief.websiteRequirement = .missing
        XCTAssertEqual(
            brief.validationMessage,
            "Nettsidekvalitet kan ikke kreves når profilen bare skal finne virksomheter uten registrert nettsted.")

        brief.websiteQuality.minimumScore = 140
        XCTAssertEqual(brief.normalized.websiteQuality.minimumScore, 100)
    }

    func testCandidateWebsiteAssessmentDistinguishesMeasuredFromUnknown() throws {
        let assessedData = Data(#"{"id":"c1","name":"Klinikk AS","score_explanation":{"website_quality":{"status":"assessed","score":78,"minimum_score":65,"outcome":"passed","reason":"assessed","evidence":{"source_uri":"https://example.no","final_url":"https://example.no/","fetched_at":"2026-09-05T12:00:00.000Z","http_status":200,"redirect_count":1,"signals":{"https":true,"reachable":true,"title":true,"meta_description":false,"viewport":true,"contact_path":true,"call_to_action":false}}}}}"#.utf8)
        let assessed = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: assessedData)
        XCTAssertEqual(assessed.scoreExplanation?.websiteQuality?.score, 78)
        XCTAssertEqual(
            assessed.scoreExplanation?.websiteQuality?.presentation,
            "Nettsidekvalitet 78 av 100")
        XCTAssertEqual(
            assessed.scoreExplanation?.websiteQuality?.evidence?.signals?.contactPath,
            true)

        let unknownData = Data(#"{"id":"c2","name":"Ukjent AS","score_explanation":{"website_quality":{"status":"unknown","score":null,"minimum_score":65,"outcome":"unknown","reason":"request_failed"}}}"#.utf8)
        let unknown = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: unknownData)
        XCTAssertNil(unknown.scoreExplanation?.websiteQuality?.score)
        XCTAssertEqual(
            unknown.scoreExplanation?.websiteQuality?.presentation,
            "Nettsidekvalitet ukjent – beholdt for manuell vurdering")

        let directData = Data(#"{"id":"c3","name":"Direkte AS","website_quality":{"status":"assessed","score":81,"reason":"assessed","fetched_at":"2026-09-05T12:00:00.000Z","source_uri":"https://example.no","final_url":"https://www.example.no/","http_status":200,"redirect_count":1,"signals":{"https":true,"reachable":true,"title":true,"meta_description":true,"viewport":true,"contact_path":false,"call_to_action":true}}}"#.utf8)
        let direct = try JSONDecoder().decode(DiscoveryV2Candidate.self, from: directData)
        XCTAssertEqual(direct.websiteQuality?.score, 81)
        XCTAssertEqual(direct.websiteQuality?.resolvedEvidence?.httpStatus, 200)
        XCTAssertEqual(direct.websiteQuality?.resolvedEvidence?.signals?.callToAction, true)
    }

    func testExternalContactScopeRequiresExactActiveProjectAndIdentity() throws {
        let scope = try XCTUnwrap(LeadgridExternalContactScope.resolve(
            activeOrganizationId: " org-1 ",
            activeProjectId: "project-1",
            leadId: " lead-1 ",
            leadProjectId: "project-1"))

        XCTAssertEqual(scope.organizationId, "org-1")
        XCTAssertEqual(scope.projectId, "project-1")
        XCTAssertEqual(scope.leadId, "lead-1")
        XCTAssertTrue(scope.isStillActive(
            organizationId: "org-1",
            projectId: "project-1"))
        XCTAssertFalse(scope.isStillActive(
            organizationId: "org-2",
            projectId: "project-1"))
        XCTAssertFalse(scope.isStillActive(
            organizationId: "org-1",
            projectId: "project-2"))
        XCTAssertNil(LeadgridExternalContactScope.resolve(
            activeOrganizationId: "org-1",
            activeProjectId: "project-1",
            leadId: "lead-1",
            leadProjectId: nil))
        XCTAssertNil(LeadgridExternalContactScope.resolve(
            activeOrganizationId: "org-1",
            activeProjectId: "project-1",
            leadId: "lead-1",
            leadProjectId: "project-2"))
        XCTAssertNil(LeadgridExternalContactScope.resolve(
            activeOrganizationId: "org-1",
            activeProjectId: "project-1",
            leadId: "   ",
            leadProjectId: "project-1"))
    }

    func testExternalContactConfirmationWaitsForInactiveThenActiveReturn() {
        var presentation = LeadgridExternalContactPresentationState()
        presentation.beginHandoff()
        presentation.externalAppDidOpen()

        XCTAssertFalse(presentation.consumeConfirmationIfActive(true))
        XCTAssertTrue(presentation.hasPendingConfirmation)

        presentation.sceneActivityDidChange(isActive: false)
        XCTAssertFalse(presentation.consumeContinuousActiveFallback(true))
        XCTAssertFalse(presentation.consumeConfirmationIfActive(false))
        XCTAssertTrue(presentation.hasPendingConfirmation)

        presentation.sceneActivityDidChange(isActive: true)
        XCTAssertTrue(presentation.consumeConfirmationIfActive(true))
        XCTAssertFalse(presentation.hasPendingConfirmation)
        XCTAssertFalse(presentation.consumeConfirmationIfActive(true))
    }

    func testExternalContactConfirmationFallsBackWhenSceneRemainsActiveOnlyOnce() {
        var presentation = LeadgridExternalContactPresentationState()
        presentation.beginHandoff()
        presentation.externalAppDidOpen()

        XCTAssertFalse(presentation.consumeConfirmationIfActive(true))
        XCTAssertTrue(presentation.consumeContinuousActiveFallback(true))
        XCTAssertFalse(presentation.hasPendingConfirmation)
        XCTAssertFalse(presentation.consumeContinuousActiveFallback(true))
        XCTAssertFalse(presentation.consumeConfirmationIfActive(true))
    }

    func testExternalContactConfirmationSurvivesDelayedOpenCallbackAndCanCancel() {
        var presentation = LeadgridExternalContactPresentationState()
        presentation.beginHandoff()
        presentation.sceneActivityDidChange(isActive: false)
        presentation.sceneActivityDidChange(isActive: true)
        presentation.externalAppDidOpen()

        XCTAssertTrue(presentation.consumeConfirmationIfActive(true))

        presentation.beginHandoff()
        presentation.sceneActivityDidChange(isActive: false)
        presentation.externalAppDidOpen()
        presentation.cancel()
        presentation.sceneActivityDidChange(isActive: true)
        XCTAssertFalse(presentation.consumeConfirmationIfActive(true))
        XCTAssertFalse(presentation.hasPendingConfirmation)
    }

    func testExternalContactIsPersistableOnlyAfterExplicitCompletion() throws {
        XCTAssertNil(LeadgridExternalContactRecord.make(
            channel: .email,
            lifecycle: .initiated))
        XCTAssertNil(LeadgridExternalContactRecord.make(
            channel: .sms,
            lifecycle: .cancelled))

        let occurredAt = Date(timeIntervalSince1970: 1_700_000_000)
        let email = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: .email,
            lifecycle: .completed,
            occurredAt: occurredAt))
        XCTAssertEqual(email.visitType, "email")
        XCTAssertEqual(email.activityKind, "email")
        XCTAssertTrue(email.conversationSummary.contains("bekreftet"))

        let whatsapp = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: .whatsapp,
            lifecycle: .completed,
            occurredAt: occurredAt))
        XCTAssertEqual(whatsapp.visitType, "whatsapp")
        XCTAssertEqual(whatsapp.activityKind, "whatsapp")

        let sms = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: .sms,
            lifecycle: .completed,
            occurredAt: occurredAt))
        XCTAssertEqual(sms.visitType, "sms")
        XCTAssertEqual(sms.activityKind, "sms")

        let phone = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: .phone,
            lifecycle: .completed,
            occurredAt: occurredAt))
        XCTAssertEqual(phone.activityKind, "call")
        XCTAssertTrue(phone.conversationSummary.contains("gjennomført"))
    }

    func testQueuedContactCopyOnlyPromisesActivitySynchronization() {
        let message = LeadgridExternalContactCopy.queuedLoggingMessage
        XCTAssertEqual(
            message,
            "Loggføringen ligger i offline-køen og synkroniseres automatisk når forbindelsen er tilbake.")
        XCTAssertFalse(message.localizedCaseInsensitiveContains("sendes"))
        XCTAssertTrue(message.localizedCaseInsensitiveContains("loggføringen"))
    }

    @MainActor
    func testExternalContactRetryKeepsActionIdTimestampPayloadAndQueueEntryStable() async throws {
        let actionId = try XCTUnwrap(UUID(uuidString: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"))
        let occurredAt = Date(timeIntervalSince1970: 1_700_000_000)
        let scope = LeadgridExternalContactScope(
            organizationId: "org-1",
            projectId: "project-1",
            leadId: "lead-1")
        var attempt = LeadgridExternalContactAttempt()
        attempt.begin(
            channel: .email,
            actionId: actionId,
            occurredAt: occurredAt,
            scope: scope)
        XCTAssertEqual(attempt.scope, scope)

        let first = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: try XCTUnwrap(attempt.channel),
            lifecycle: .completed,
            occurredAt: try XCTUnwrap(attempt.occurredAt),
            actionId: try XCTUnwrap(attempt.actionId)))
        let retry = try XCTUnwrap(LeadgridExternalContactRecord.make(
            channel: try XCTUnwrap(attempt.channel),
            lifecycle: .completed,
            occurredAt: try XCTUnwrap(attempt.occurredAt),
            actionId: try XCTUnwrap(attempt.actionId)))
        XCTAssertEqual(first, retry)

        let payload = OfflineResilientActions.AgentVisitPayload(
            visitType: first.visitType,
            conversationSummary: first.conversationSummary,
            contactPerson: nil,
            notes: first.conversationSummary,
            newStatus: nil,
            nextAction: nil,
            nextFollowUpAt: nil,
            visitDatetime: ISO8601DateFormatter().string(from: first.occurredAt),
            activityKind: first.activityKind)
        let action = try OfflineResilientActions.makeAgentVisitAction(
            organizationId: "org-1",
            projectId: "project-1",
            leadId: "lead-1",
            payload: payload,
            actionId: actionId)
            .bound(actorUserId: "user-1")
        let directKey = OfflineActionIdempotency.key(for: action, organizationId: "org-1")
        let replayedAction = try JSONDecoder().decode(
            OfflineActionQueue.PendingAction.self,
            from: JSONEncoder().encode(action))
        let replayKey = OfflineActionIdempotency.key(for: replayedAction, organizationId: "org-1")
        XCTAssertEqual(directKey, actionId.uuidString.lowercased())
        XCTAssertEqual(replayKey, directKey)
        XCTAssertEqual(replayedAction.bodyJson, action.bodyJson)

        let queueURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("leadgrid-contact-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: queueURL) }
        let queue = OfflineActionQueue(fileURL: queueURL)
        let firstEnqueue = await queue.enqueue(action)
        let retryEnqueue = await queue.enqueue(replayedAction)
        let pending = await queue.pendingActions()
        XCTAssertTrue(firstEnqueue)
        XCTAssertTrue(retryEnqueue)
        XCTAssertEqual(pending.map(\.id), [actionId])

        attempt.finalize()
        XCTAssertTrue(attempt.isFinalized)
        XCTAssertFalse(attempt.canConfirmOrRetry)
        XCTAssertNil(attempt.actionId)
        XCTAssertNil(attempt.occurredAt)
        XCTAssertNil(attempt.scope)
    }

    func testAnalyticsRequestPathAddsEncodedProjectWithoutDroppingExistingQuery() throws {
        let path = LeadgridAnalyticsRequestPath.make(
            "/api/leadgrid/analytics/segments",
            queryItems: [.init(name: "by", value: "lead_status")],
            projectId: "dentum oslo/vest")
        let components = try XCTUnwrap(URLComponents(string: path))

        XCTAssertEqual(components.path, "/api/leadgrid/analytics/segments")
        XCTAssertEqual(
            Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") }),
            ["by": "lead_status", "projectId": "dentum oslo/vest"])
        XCTAssertEqual(
            LeadgridAnalyticsRequestPath.make("/api/leadgrid/analytics/sources"),
            "/api/leadgrid/analytics/sources")
    }

    func testOutcomeAnalyticsKeepsValuesSeparatedByCurrencyAndProjectScope() throws {
        let data = Data(#"{"outcomes":[{"eventType":"booking_confirmed","events":2,"uniqueLeads":2,"quantity":3,"valuesByCurrency":[{"currency":"NOK","valueMinor":125000},{"currency":"EUR","valueMinor":4900}],"lastOccurredAt":"2026-09-05T12:00:00.000Z"}]}"#.utf8)
        let response = try JSONDecoder().decode(AnalyticsOutcomesResponse.self, from: data)
        let outcome = try XCTUnwrap(response.outcomes.first)

        XCTAssertEqual(outcome.eventType, .bookingConfirmed)
        XCTAssertEqual(outcome.eventType.title, "Booking bekreftet")
        XCTAssertEqual(outcome.events, 2)
        XCTAssertEqual(outcome.uniqueLeads, 2)
        XCTAssertEqual(outcome.quantity, 3)
        XCTAssertEqual(outcome.valuesByCurrency.map(\.currency), ["NOK", "EUR"])
        XCTAssertEqual(outcome.valuesByCurrency.map(\.valueMinor), [125_000, 4_900])
        XCTAssertTrue(outcome.hasActivity)

        let path = LeadgridAnalyticsRequestPath.make(
            "/api/leadgrid/analytics/outcomes",
            queryItems: [.init(name: "sinceDays", value: "90")],
            projectId: "dentum-oslo")
        let components = try XCTUnwrap(URLComponents(string: path))
        XCTAssertEqual(
            Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") }),
            ["sinceDays": "90", "projectId": "dentum-oslo"])
    }

    @MainActor
    func testConfigurationGenerationAndTenantIdentityMustAllMatch() {
        XCTAssertTrue(DiscoveryRunCoordinator.configurationMatches(expectedGeneration: 4, expectedOrganizationId: "org-a", expectedProjectId: "project-a", activeGeneration: 4, activeOrganizationId: "org-a", activeProjectId: "project-a"))
        XCTAssertFalse(DiscoveryRunCoordinator.configurationMatches(expectedGeneration: 3, expectedOrganizationId: "org-a", expectedProjectId: "project-a", activeGeneration: 4, activeOrganizationId: "org-a", activeProjectId: "project-a"))
        XCTAssertFalse(DiscoveryRunCoordinator.configurationMatches(expectedGeneration: 4, expectedOrganizationId: "org-a", expectedProjectId: "project-a", activeGeneration: 4, activeOrganizationId: "org-b", activeProjectId: "project-a"))
    }

    func testProjectListItemDecodesOrganizationScope() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let data = Data(#"{"id":"project-a","organization_id":"org-a","name":"A","description":null,"status":"active","has_brand_kit":false,"lead_count":0,"competitor_count":0}"#.utf8)
        let project = try decoder.decode(ProjectListItem.self, from: data)

        XCTAssertEqual(project.organizationId, "org-a")
    }

    func testColdStartResumeIncludesPartialRuns() {
        XCTAssertEqual(DiscoveryV2APIContract.resumableRunStatuses, ["active", "review_ready", "partial"])
    }

    func testReviewResumeDoesNotDependOnCandidatesBeingLoaded() {
        XCTAssertEqual(
            DiscoveryRunCoordinator.workspacePhase(runStatus: .reviewReady, hasPreview: false),
            .review)
        XCTAssertEqual(
            DiscoveryRunCoordinator.workspacePhase(runStatus: .partial, hasPreview: false),
            .review)
        XCTAssertTrue(DiscoveryRunCoordinator.shouldResumeExistingRun(.reviewReady))
        XCTAssertTrue(DiscoveryRunCoordinator.shouldResumeExistingRun(.partial))
    }

    func testUnknownRunStatusIsForwardCompatible() throws {
        let status = try JSONDecoder().decode(
            DiscoveryV2RunStatus.self,
            from: Data(#""paused_by_budget""#.utf8))
        XCTAssertEqual(status, .unknown("paused_by_budget"))
        XCTAssertFalse(status.isRunning)
    }

    func testPersistenceEnvelopeRoundTripsDraftAndIdempotencyKey() throws {
        let brief = DiscoveryV2Brief.mapArea(
            center: .init(latitude: 59.91, longitude: 10.75),
            radiusKm: 8)
        let value = DiscoveryV2PersistedState(
            organizationId: "org-1",
            projectId: "project-1",
            projectName: "Leadgrid",
            brief: brief,
            preview: nil,
            run: nil,
            nextCursor: nil,
            selectedProfile: nil,
            placesDetailsEnabled: true,
            pendingRunIdempotencyKey: "ipad-project-1-fixed-key",
            campaigns: nil,
            pendingCampaignStartIdempotencyKey: "ipad-project-1-campaign-key",
            pendingCampaignStart: .init(
                request: .init(
                    name: "Dentum – Oslo og omegn",
                    profiles: [
                        .init(profileId: "profile-oslo", expectedVersion: 4),
                        .init(profileId: "profile-west", expectedVersion: 2),
                    ]),
                idempotencyKey: "ipad-project-1-campaign-key"),
            isShowingCampaignOverview: false,
            savedAt: Date(timeIntervalSince1970: 1_700_000_000))

        let data = try JSONEncoder().encode(value)
        let restored = try JSONDecoder().decode(DiscoveryV2PersistedState.self, from: data)

        XCTAssertEqual(restored, value)
        XCTAssertEqual(restored.placesDetailsEnabled, true)
        XCTAssertEqual(restored.pendingRunIdempotencyKey, "ipad-project-1-fixed-key")
        XCTAssertEqual(restored.pendingCampaignStartIdempotencyKey, "ipad-project-1-campaign-key")
        XCTAssertEqual(restored.pendingCampaignStart?.request.name, "Dentum – Oslo og omegn")
        XCTAssertEqual(restored.pendingCampaignStart?.request.profiles.map(\.expectedVersion), [4, 2])
        XCTAssertEqual(restored.pendingCampaignStart?.idempotencyKey, "ipad-project-1-campaign-key")
        XCTAssertEqual(restored.isShowingCampaignOverview, false)

        var legacyObject = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any])
        legacyObject.removeValue(forKey: "isShowingCampaignOverview")
        legacyObject.removeValue(forKey: "pendingCampaignStart")
        let legacyData = try JSONSerialization.data(withJSONObject: legacyObject)
        let legacy = try JSONDecoder().decode(DiscoveryV2PersistedState.self, from: legacyData)
        XCTAssertNil(legacy.isShowingCampaignOverview)
        XCTAssertNil(legacy.pendingCampaignStart)
    }

    func testRunSelectionGenerationRejectsDelayedAForBAndOverview() {
        XCTAssertFalse(DiscoveryRunCoordinator.runSelectionMatches(
            expectedGeneration: 4,
            expectedRunId: "run-a",
            currentGeneration: 5,
            currentRunId: "run-b"))
        XCTAssertFalse(DiscoveryRunCoordinator.runSelectionMatches(
            expectedGeneration: 4,
            expectedRunId: "run-a",
            currentGeneration: 5,
            currentRunId: nil))
        XCTAssertTrue(DiscoveryRunCoordinator.runSelectionMatches(
            expectedGeneration: 5,
            expectedRunId: "run-b",
            currentGeneration: 5,
            currentRunId: "run-b"))
    }

    func testCampaignOverviewCannotAbandonRunCreateOrConfirmation() {
        XCTAssertTrue(DiscoveryRunCoordinator.campaignOverviewNavigationAllowed(
            hasCampaigns: true,
            isBusy: false,
            isStartingRun: false))
        XCTAssertFalse(DiscoveryRunCoordinator.campaignOverviewNavigationAllowed(
            hasCampaigns: true,
            isBusy: true,
            isStartingRun: false))
        XCTAssertFalse(DiscoveryRunCoordinator.campaignOverviewNavigationAllowed(
            hasCampaigns: true,
            isBusy: false,
            isStartingRun: true))
        XCTAssertFalse(DiscoveryRunCoordinator.campaignOverviewNavigationAllowed(
            hasCampaigns: false,
            isBusy: false,
            isStartingRun: false))
    }

    func testOlderCampaignReadCannotRegressNewerCommandResponse() {
        XCTAssertFalse(DiscoveryRunCoordinator.shouldApplyCampaignResponse(
            requestGeneration: 7,
            currentRequestGeneration: 8,
            incomingVersion: 9,
            storedVersion: 8))
        XCTAssertFalse(DiscoveryRunCoordinator.shouldApplyCampaignResponse(
            requestGeneration: 8,
            currentRequestGeneration: 8,
            incomingVersion: 7,
            storedVersion: 8))
        XCTAssertTrue(DiscoveryRunCoordinator.shouldApplyCampaignResponse(
            requestGeneration: 8,
            currentRequestGeneration: 8,
            incomingVersion: 8,
            storedVersion: 8))
    }

    @MainActor
    func testStableCacheScopeAndUniqueRequestKeys() {
        XCTAssertEqual(
            DiscoveryRunCoordinator.cacheName(organizationId: "org/1", projectId: "project 1"),
            "discovery-state")
        let first = DiscoveryRunCoordinator.makeIdempotencyKey(projectId: "p1")
        let second = DiscoveryRunCoordinator.makeIdempotencyKey(projectId: "p1")
        XCTAssertNotEqual(first, second)
        XCTAssertGreaterThanOrEqual(first.count, 8)
    }

    @MainActor
    func testRealtimeOrgChangeRequiresFreshSocket() {
        XCTAssertTrue(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://api.example", currentSessionIdentity: "session-a",
            currentChannels: ["org:old"], requestedBaseURL: "https://api.example",
            requestedSessionIdentity: "session-a", requestedChannels: ["org:new"],
            hasActiveConnection: true))
        XCTAssertFalse(LeadgridRealtimeClient.requiresReconnect(
            currentBaseURL: "https://api.example", currentSessionIdentity: "session-a",
            currentChannels: ["org:same"], requestedBaseURL: "https://api.example",
            requestedSessionIdentity: "session-a", requestedChannels: ["org:same"],
            hasActiveConnection: true))
        XCTAssertTrue(LeadgridRealtimeClient.isCurrentConnection(
            callbackGeneration: 7, activeGeneration: 7, hasMatchingTask: true))
        XCTAssertFalse(LeadgridRealtimeClient.isCurrentConnection(
            callbackGeneration: 6, activeGeneration: 7, hasMatchingTask: true))
        XCTAssertFalse(LeadgridRealtimeClient.isCurrentConnection(
            callbackGeneration: 7, activeGeneration: 7, hasMatchingTask: false))
    }

    func testRealtimeTicketDecodesCanonicalEnvelope() throws {
        let data = Data(#"{"ticket":"single-use","expiresAt":"2026-08-31T12:00:00.000Z","websocketPath":"/ws/leadgrid"}"#.utf8)
        let credential = try JSONDecoder().decode(LeadgridRealtimeTicket.self, from: data)

        XCTAssertEqual(credential.ticket, "single-use")
        XCTAssertEqual(credential.websocketPath, "/ws/leadgrid")
    }

    @MainActor
    func testRealtimeWebSocketURLContainsOnlySingleUseTicket() throws {
        let url = try XCTUnwrap(LeadgridRealtimeClient.webSocketURL(
            baseURL: "https://api.example/old?token=long-lived",
            websocketPath: "/ws/leadgrid",
            ticket: "single-use"))
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))

        XCTAssertEqual(url.scheme, "wss")
        XCTAssertEqual(url.path, "/ws/leadgrid")
        XCTAssertEqual(components.queryItems, [URLQueryItem(name: "ticket", value: "single-use")])
        XCTAssertFalse((url.query ?? "").contains("token="))
    }

    func testRejectedDecisionRequiresReasonInCoordinatorContract() throws {
        let request = DiscoveryV2DecisionRequest(
            decision: .reject,
            reasonCode: .wrongCustomerType,
            note: nil)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        XCTAssertEqual(object["decision"] as? String, "reject")
        XCTAssertEqual(object["reason_code"] as? String, "wrong_customer_type")
        XCTAssertNil(object["confirmed_google_place_id"])
    }

    func testConfirmedGoogleIdentityIsExplicitAndPartOfDecisionIdempotency() throws {
        let request = DiscoveryV2DecisionRequest(
            decision: .approve,
            reasonCode: .goodFit,
            note: nil,
            confirmedGooglePlaceId: "places/ChIJ-confirmed")
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        XCTAssertEqual(object["confirmed_google_place_id"] as? String, "places/ChIJ-confirmed")

        let first = DiscoveryRunCoordinator.decisionIdempotencyKey(
            runId: "run-1",
            candidateId: "candidate-1",
            decision: .approve,
            confirmedGooglePlaceId: "places/ChIJ-confirmed")
        let retry = DiscoveryRunCoordinator.decisionIdempotencyKey(
            runId: "run-1",
            candidateId: "candidate-1",
            decision: .approve,
            confirmedGooglePlaceId: "places/ChIJ-confirmed")
        let changedIdentity = DiscoveryRunCoordinator.decisionIdempotencyKey(
            runId: "run-1",
            candidateId: "candidate-1",
            decision: .approve,
            confirmedGooglePlaceId: "places/another")
        let refreshedConfirmation = DiscoveryRunCoordinator.decisionIdempotencyKey(
            runId: "run-1",
            candidateId: "candidate-1",
            decision: .approve,
            confirmedGooglePlaceId: "places/ChIJ-confirmed",
            placeConfirmationExpiresAt: "2026-09-05T12:15:00.000Z")
        XCTAssertEqual(first, retry)
        XCTAssertNotEqual(first, changedIdentity)
        XCTAssertNotEqual(first, refreshedConfirmation)
    }

    func testTransientGoogleMapsDetailsDecodeWithoutChangingCandidateContract() throws {
        let data = Data(#"""
        {
          "candidate_id":"candidate-1",
          "mode":"transient_details_only",
          "fetched_at":"2026-08-31T12:00:00.000Z",
          "confirmation_expires_at":"2026-08-31T12:15:00.000Z",
          "provider":{
            "id":"google_places",
            "name":"Google Maps",
            "policy_uri":"https://developers.google.com/maps/documentation/places/web-service/policies"
          },
          "notice":"Hentet på forespørsel og ikke lagret.",
          "ranking_notice":"Påvirker ikke Discovery-score.",
          "matches":[{
            "place_id":"places/leadgrid",
            "display_name":"Leadgrid AS",
            "formatted_address":"Storgata 1, Oslo",
            "latitude":59.91,
            "longitude":10.75,
            "primary_type":"corporate_office",
            "primary_type_label":"Bedriftskontor",
            "business_status":"OPERATIONAL",
            "website_uri":"https://leadgrid.no/",
            "national_phone_number":"979 59 294",
            "international_phone_number":"+47 979 59 294",
            "google_maps_uri":"https://maps.google.com/?cid=123",
            "attributions":[{
              "provider":"Example data",
              "provider_uri":"https://example.com/source"
            }],
            "match_quality":"strong",
            "match_reasons":["Navnet samsvarer nøyaktig"]
          }]
        }
        """#.utf8)

        let response = try JSONDecoder().decode(
            DiscoveryV2PlaceDetailsResponse.self,
            from: data)

        XCTAssertEqual(response.mode, "transient_details_only")
        XCTAssertEqual(response.provider.name, "Google Maps")
        XCTAssertEqual(response.matches.count, 1)
        XCTAssertEqual(response.matches.first?.matchQualityTitle, "Sterkt identitetstreff")
        XCTAssertEqual(response.matches.first?.businessStatusTitle, "I drift")
        XCTAssertEqual(response.matches.first?.phoneNumber, "+47 979 59 294")
        XCTAssertEqual(response.matches.first?.attributions.first?.provider, "Example data")
        XCTAssertEqual(response.confirmationExpiresAt, "2026-08-31T12:15:00.000Z")
        var confirmed = try XCTUnwrap(response.matches.first)
        confirmed.confirmationExpiresAt = response.confirmationExpiresAt
        let expiry = try XCTUnwrap(confirmed.confirmationExpiryDate)
        XCTAssertTrue(confirmed.hasFreshConfirmation(at: expiry.addingTimeInterval(-1)))
        XCTAssertFalse(confirmed.hasFreshConfirmation(at: expiry))
    }

    func testProfilePlacesOptInIsBackwardCompatibleAndExplicitlyEncoded() throws {
        let legacy = Data(#"{"id":"profile-1","name":"Standard","is_default":true,"version":2,"brief":{"industry_queries":["regnskap"],"exclusion_terms":[],"city":"Oslo","target_count":20,"enrichment_count":10}}"#.utf8)
        let legacyProfile = try JSONDecoder().decode(DiscoveryV2Profile.self, from: legacy)
        XCTAssertNil(legacyProfile.placesDetailsEnabled)

        let request = DiscoveryV2ProfileWrite(
            name: "Standard",
            isDefault: true,
            expectedVersion: 2,
            brief: legacyProfile.brief,
            placesDetailsEnabled: true)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])

        XCTAssertEqual(object["places_details_enabled"] as? Bool, true)
        XCTAssertEqual(object["expected_version"] as? Int, 2)
    }

    func testRunCarriesTheProfileThatControlsTransientDetails() throws {
        let data = Data(#"{"id":"run-1","profile_id":"profile-1","status":"review_ready"}"#.utf8)
        let run = try JSONDecoder().decode(DiscoveryV2Run.self, from: data)

        XCTAssertEqual(run.profileId, "profile-1")
        XCTAssertEqual(run.status, .reviewReady)
    }

    private func configuredClinicBrief() -> DiscoveryV2Brief {
        var brief = DiscoveryV2Brief.mapArea(
            center: .init(latitude: 59.91, longitude: 10.75))
        brief.industryQueries = ["tannklinikk"]
        brief.exclusionTerms = ["holding"]
        brief.websiteRequirement = .present
        return brief
    }
}

final class LeadgridWorkflowProjectScopeTests: XCTestCase {
    func testEveryWorkflowPathCarriesEncodedProjectScope() throws {
        let projectId = "dentum oslo/vest & sør"
        let workflowId = "workflow/one"
        let paths = [
            try LeadgridWorkflowRequestPath.make(
                "/api/leadgrid/workflows",
                projectId: projectId,
                queryItems: [.init(name: "active", value: "true")]
            ),
            try LeadgridWorkflowRequestPath.make(
                "/api/leadgrid/workflows/templates",
                projectId: projectId
            ),
            try LeadgridWorkflowRequestPath.workflow(
                workflowId,
                projectId: projectId
            ),
            try LeadgridWorkflowRequestPath.workflow(
                workflowId,
                suffix: "/test",
                projectId: projectId
            ),
            try LeadgridWorkflowRequestPath.workflow(
                workflowId,
                suffix: "/execute",
                projectId: projectId
            ),
            try LeadgridWorkflowRequestPath.workflow(
                workflowId,
                suffix: "/executions",
                projectId: projectId,
                queryItems: [.init(name: "limit", value: "50")]
            ),
        ]

        for path in paths {
            let components = try XCTUnwrap(URLComponents(string: path))
            XCTAssertEqual(
                components.queryItems?.first(where: { $0.name == "projectId" })?.value,
                projectId
            )
        }
        XCTAssertTrue(paths[2].contains("workflow%2Fone"))
    }

    func testWorkflowPathFailsClosedWithoutProject() throws {
        XCTAssertThrowsError(
            try LeadgridWorkflowRequestPath.make(
                "/api/leadgrid/workflows",
                projectId: "   "
            )
        ) { error in
            XCTAssertEqual(
                error as? LeadgridWorkflowScopeError,
                .missingProjectID
            )
        }
    }

    func testWorkflowDecodesAuthoritativeProjectID() throws {
        let data = Data(#"{"id":"workflow-1","projectId":"project-a","name":"Oppfølging","description":null,"isActive":true,"triggerType":"manual","executionCount":0,"lastExecutedAt":null,"lastErrorAt":null,"lastErrorMessage":null,"templateKey":null,"createdBy":"user-a","createdAt":"2026-09-06T10:00:00.000Z","updatedAt":"2026-09-06T10:00:00.000Z","triggerConfig":null,"conditions":null,"actions":null}"#.utf8)

        let workflow = try JSONDecoder().decode(LeadgridWorkflow.self, from: data)

        XCTAssertEqual(workflow.projectId, "project-a")
    }
}
