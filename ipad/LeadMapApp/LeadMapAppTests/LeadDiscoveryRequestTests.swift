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
