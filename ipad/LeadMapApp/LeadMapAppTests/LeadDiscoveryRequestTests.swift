import XCTest
import CoreLocation
@testable import LeadMapApp

final class LeadDiscoveryRequestTests: XCTestCase {

    func testExplicitCustomerTypeIsSentWithMapArea() throws {
        let request = LeadDiscoveryRequest(
            count: 20,
            industryQuery: "restauranter",
            geo: LeadDiscoveryGeo(lat: 59.91, lng: 10.75, radiusKm: 8)
        )

        let body = request.toDict()
        let geo = try XCTUnwrap(body["geo"] as? [String: Any])

        XCTAssertEqual(body["industry_query"] as? String, "restauranter")
        XCTAssertEqual(body["count"] as? Int, 20)
        XCTAssertEqual(geo["lat"] as? Double, 59.91)
        XCTAssertEqual(geo["lng"] as? Double, 10.75)
        XCTAssertEqual(geo["radius_km"] as? Int, 8)
    }

    func testEmptyCustomerTypeIsOmitted() {
        let body = LeadDiscoveryRequest(industryQuery: "").toDict()

        XCTAssertNil(body["industry_query"])
    }

    func testIndustryRequiredFailureRetainsInlineRetryMetadata() {
        let stage = DiscoveryStage.failed(
            "Mangler kundetype",
            cpvSuggestion: ["45000000"],
            requiresIndustryQuery: true
        )

        guard case .failed(
            let message,
            let cpvSuggestion,
            let requiresIndustryQuery
        ) = stage else {
            return XCTFail("Forventet failed-stage")
        }

        XCTAssertEqual(message, "Mangler kundetype")
        XCTAssertEqual(cpvSuggestion, ["45000000"])
        XCTAssertTrue(requiresIndustryQuery)
    }
}

final class AddLeadDraftFlowTests: XCTestCase {

    func testCancelRemovesTemporaryMapPinAndSession() {
        var flow = AddLeadDraftFlow()
        let coordinate = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)

        flow.begin(at: coordinate)
        XCTAssertTrue(flow.isPresented)
        XCTAssertEqual(flow.visiblePinCoordinate?.latitude, coordinate.latitude)
        XCTAssertEqual(flow.visiblePinCoordinate?.longitude, coordinate.longitude)

        flow.end()
        XCTAssertFalse(flow.isPresented)
        XCTAssertNil(flow.visiblePinCoordinate)
    }

    func testMenuCreatedDraftHasNoSyntheticOsloPin() {
        var flow = AddLeadDraftFlow()

        flow.begin()

        XCTAssertTrue(flow.isPresented)
        XCTAssertNil(flow.visiblePinCoordinate)
    }

    func testIdempotencyKeyIsStableForRetryAndRenewedForNewSession() {
        var flow = AddLeadDraftFlow()

        flow.begin()
        let firstKey = flow.activeSession?.idempotencyKey
        XCTAssertNotNil(firstKey)
        XCTAssertEqual(flow.activeSession?.idempotencyKey, firstKey)

        flow.end()
        flow.begin()

        XCTAssertNotEqual(flow.activeSession?.idempotencyKey, firstKey)
    }
}

final class AddLeadSubmissionStateTests: XCTestCase {

    func testFailureStopsSavingAndKeepsUserFacingError() {
        var state = AddLeadSubmissionState()
        state.begin()
        XCTAssertTrue(state.isSaving)

        state.fail("Kunne ikke lagre")

        XCTAssertFalse(state.isSaving)
        XCTAssertFalse(state.didSave)
        XCTAssertEqual(state.errorMessage, "Kunne ikke lagre")
    }

    func testSuccessMarksSubmissionCompletedWithoutError() {
        var state = AddLeadSubmissionState()
        state.begin()
        state.succeed()

        XCTAssertFalse(state.isSaving)
        XCTAssertTrue(state.didSave)
        XCTAssertNil(state.errorMessage)
    }
}

final class AddLeadResponsiveLayoutTests: XCTestCase {

    func testPhoneWidthUsesCompactSingleColumnForm() {
        XCTAssertTrue(AddLeadResponsiveLayout.usesCompactForm(
            containerWidth: 430,
            isAccessibilityText: false
        ))
    }

    func testRegularIPadWidthKeepsWideForm() {
        XCTAssertFalse(AddLeadResponsiveLayout.usesCompactForm(
            containerWidth: 768,
            isAccessibilityText: false
        ))
    }

    func testAccessibilityTextForcesReadableStackAtWideWidth() {
        XCTAssertTrue(AddLeadResponsiveLayout.usesCompactForm(
            containerWidth: 820,
            isAccessibilityText: true
        ))
    }
}

final class DorsalgAddressFetchPolicyTests: XCTestCase {

    func testProgressivePageBudgetShowsFirstPageBeforeBackgroundPages() {
        XCTAssertEqual(DorsalgAddressFetchPolicy.pageSize, 350)
        XCTAssertEqual(
            DorsalgAddressFetchPolicy.additionalPages(total: 2_253),
            [1, 2, 3]
        )
        XCTAssertEqual(
            DorsalgAddressFetchPolicy.additionalPages(total: 300),
            []
        )
    }

    func testLandscapeSpanContributesToRequestRadius() {
        let radius = DorsalgAddressFetchPolicy.requestRadius(
            latitudeDelta: 0.01,
            longitudeDelta: 0.05,
            centerLatitude: 60
        )

        XCTAssertGreaterThan(radius, 1_200)
        XCTAssertLessThanOrEqual(
            radius,
            DorsalgAddressFetchPolicy.maximumRequestRadius
        )
    }

    func testViewportSelectionCapsAnnotationsAndAppliesStatusFilter() {
        let addresses = (0..<300).map { index in
            KartverketService.AdressePunkt(
                adressetekst: "Testgata \(index)",
                postnummer: "0184",
                poststed: "Oslo",
                lat: 59.91 + Double(index) * 0.00001,
                lon: 10.75 + Double(index) * 0.00001
            )
        }
        let all = DorsalgAddressFetchPolicy.visible(
            addresses: addresses,
            centerLatitude: 59.91,
            centerLongitude: 10.75,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
            statuses: [:],
            statusFilter: nil
        )
        let wonID = addresses[42].id
        let won = DorsalgAddressFetchPolicy.visible(
            addresses: addresses,
            centerLatitude: 59.91,
            centerLongitude: 10.75,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
            statuses: [wonID: "vunnet"],
            statusFilter: "vunnet"
        )

        XCTAssertEqual(all.count, DorsalgAddressFetchPolicy.renderLimit)
        XCTAssertEqual(won.map(\.id), [wonID])
    }

    func testLoadedDistanceDefinesReusableCoverageWhenResultIsTruncated() {
        let addresses = [
            KartverketService.AdressePunkt(
                adressetekst: "Nærgata 1",
                postnummer: "0184",
                poststed: "Oslo",
                lat: 59.91,
                lon: 10.75
            ),
            KartverketService.AdressePunkt(
                adressetekst: "Nærgata 2",
                postnummer: "0184",
                poststed: "Oslo",
                lat: 59.915,
                lon: 10.75
            ),
        ]
        let coverage = DorsalgAddressFetchPolicy.coverageRadius(
            loadedAddresses: addresses,
            reportedTotal: 2_000,
            requestedRadius: 2_000,
            centerLatitude: 59.91,
            centerLongitude: 10.75
        )

        XCTAssertGreaterThan(coverage, 500)
        XCTAssertLessThan(coverage, 700)
        XCTAssertTrue(DorsalgAddressFetchPolicy.isCovered(
            requestLatitude: 59.91,
            requestLongitude: 10.75,
            visibleRadius: 400,
            coverageLatitude: 59.91,
            coverageLongitude: 10.75,
            coverageRadius: coverage
        ))
        XCTAssertFalse(DorsalgAddressFetchPolicy.isCovered(
            requestLatitude: 59.91,
            requestLongitude: 10.75,
            visibleRadius: 600,
            coverageLatitude: 59.91,
            coverageLongitude: 10.75,
            coverageRadius: coverage
        ))
    }
}
