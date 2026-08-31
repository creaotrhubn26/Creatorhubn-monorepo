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

    func testMigratedProfileUsesDefensiveBriefDefaults() throws {
        let data = Data(#"{"id":"profile-1","name":"Standard","is_default":true,"version":2,"brief":{"industry_queries":["regnskap"],"exclusion_terms":[],"city":"Oslo","target_count":20,"enrichment_count":10}}"#.utf8)
        let profile = try JSONDecoder().decode(DiscoveryV2Profile.self, from: data)

        XCTAssertEqual(profile.brief.minimumFitScore, 50)
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
            pendingRunIdempotencyKey: "ipad-project-1-fixed-key",
            savedAt: Date(timeIntervalSince1970: 1_700_000_000))

        let data = try JSONEncoder().encode(value)
        let restored = try JSONDecoder().decode(DiscoveryV2PersistedState.self, from: data)

        XCTAssertEqual(restored, value)
        XCTAssertEqual(restored.pendingRunIdempotencyKey, "ipad-project-1-fixed-key")
    }

    @MainActor
    func testStableCacheScopeAndUniqueRequestKeys() {
        XCTAssertEqual(
            DiscoveryRunCoordinator.cacheName(organizationId: "org/1", projectId: "project 1"),
            "discovery-v2-org-1-project-1")
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
    }

    func testTransientGoogleMapsDetailsDecodeWithoutChangingCandidateContract() throws {
        let data = Data(#"""
        {
          "candidate_id":"candidate-1",
          "mode":"transient_details_only",
          "fetched_at":"2026-08-31T12:00:00.000Z",
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
}
