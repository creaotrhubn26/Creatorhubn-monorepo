import XCTest
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
