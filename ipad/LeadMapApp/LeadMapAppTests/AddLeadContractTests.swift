import XCTest
import CoreLocation
@testable import LeadMapApp

final class AddLeadFieldParserTests: XCTestCase {
    func testNormalizesNorwegianOrganizationNumber() throws {
        XCTAssertEqual(
            try AddLeadFieldParser.organizationNumber("NO 912 345 678 MVA"),
            "912345678"
        )
        XCTAssertNil(try AddLeadFieldParser.organizationNumber(""))
    }

    func testRejectsInvalidOrganizationNumberAndEmployeeRange() {
        XCTAssertThrowsError(try AddLeadFieldParser.organizationNumber("123"))
        XCTAssertThrowsError(try AddLeadFieldParser.employeeCount("25–50"))
    }

    func testParsesNorwegianRevenueFormatsWithoutGuessingRanges() throws {
        XCTAssertEqual(try AddLeadFieldParser.annualRevenueNok("10 000 000"), 10_000_000)
        XCTAssertEqual(try AddLeadFieldParser.annualRevenueNok("10,5 mill."), 10_500_000)
        XCTAssertThrowsError(try AddLeadFieldParser.annualRevenueNok("10–20 mill."))
    }
}

final class AddLeadRequestContractTests: XCTestCase {
    func testTemperatureContractIsColdWarmHotReady() {
        XCTAssertEqual(LeadTemperature.allCases.map(\.rawValue), ["cold", "warm", "hot", "ready"])
        XCTAssertEqual(LeadTemperature.parse("ready"), .ready)
        XCTAssertEqual(LeadTemperature.parse("lukewarm"), .ready)
    }

    func testNewLeadDataSendsEveryStructuredField() throws {
        let followUp = Date(timeIntervalSince1970: 1_788_336_600)
        let data = AddLeadSheet.NewLeadData(
            companyName: "Nordic Elektro AS",
            organizationNumber: "912345678",
            websiteURL: "https://nordic.example",
            contactName: "Anders Johansen",
            contactRole: "Daglig leder",
            phone: "+4799999999",
            email: "post@nordic.example",
            industryLabel: "Elektro",
            employeeCountEstimate: 25,
            annualRevenueNokEstimate: 10_000_000,
            notes: "Ring etter frokost",
            leadTemperature: .hot,
            leadStatus: .meetingBooked,
            nextFollowUpAt: followUp,
            nextAction: "Bekreft møtet",
            address: "Storgata 12, 0184 Oslo",
            postalCode: "0184",
            city: "Oslo",
            coord: CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522),
            locationConfidence: "geocoded",
            leadSource: "brreg_lookup"
        )

        let body = data.makeCreateRequest(projectID: "project-1").makeBody()

        XCTAssertEqual(body["name"] as? String, "Nordic Elektro AS")
        XCTAssertEqual(body["organization_number"] as? String, "912345678")
        XCTAssertEqual(body["website_url"] as? String, "https://nordic.example")
        XCTAssertEqual(body["contact_name"] as? String, "Anders Johansen")
        XCTAssertEqual(body["contact_role"] as? String, "Daglig leder")
        XCTAssertEqual(body["industry_label"] as? String, "Elektro")
        XCTAssertEqual(body["employee_count_estimate"] as? Int, 25)
        XCTAssertEqual(body["annual_revenue_nok_estimate"] as? Double, 10_000_000)
        XCTAssertEqual(body["notes"] as? String, "Ring etter frokost")
        XCTAssertEqual(body["lead_temperature"] as? String, "hot")
        XCTAssertEqual(body["lead_status"] as? String, "meeting_booked")
        XCTAssertEqual(body["next_action"] as? String, "Bekreft møtet")
        XCTAssertNotNil(body["next_follow_up_at"] as? String)
        XCTAssertEqual(body["location_confidence"] as? String, "geocoded")
        XCTAssertEqual(body["lead_source"] as? String, "brreg_lookup")
        XCTAssertEqual(body["project_id"] as? String, "project-1")
    }
}
