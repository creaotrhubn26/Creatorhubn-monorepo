import XCTest
import CoreLocation
@testable import LeadMapApp

final class AddLeadFieldParserTests: XCTestCase {
    func testNormalizesNorwegianOrganizationNumber() throws {
        XCTAssertEqual(
            try AddLeadFieldParser.organizationNumber("NO 937 518 684 MVA"),
            "937518684"
        )
        XCTAssertNil(try AddLeadFieldParser.organizationNumber(""))
    }

    func testRejectsInvalidOrganizationNumberAndEmployeeRange() {
        XCTAssertThrowsError(try AddLeadFieldParser.organizationNumber("123"))
        XCTAssertThrowsError(try AddLeadFieldParser.organizationNumber("123456789"))
        XCTAssertThrowsError(try AddLeadFieldParser.employeeCount("25–50"))
    }

    func testValidatesEmailAndSafeWebsiteSchemes() throws {
        XCTAssertEqual(try AddLeadFieldParser.email(" post@example.no "), "post@example.no")
        XCTAssertThrowsError(try AddLeadFieldParser.email("ugyldig-epost"))
        XCTAssertEqual(try AddLeadFieldParser.website("leadgrid.no"), "leadgrid.no")
        XCTAssertThrowsError(try AddLeadFieldParser.website("javascript:alert(1)"))
        XCTAssertThrowsError(try AddLeadFieldParser.website("https://user:pass@example.no"))
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

        let idempotencyKey = UUID(uuidString: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")!
        let request = data.makeCreateRequest(
            projectID: "project-1",
            idempotencyKey: idempotencyKey
        )
        let body = request.makeBody()

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
        XCTAssertEqual(request.idempotencyKey, idempotencyKey)
    }
}

final class LeadgridAssignmentScopeContractTests: XCTestCase {
    private let crmLeadID = "22222222-2222-4222-8222-222222222222"

    func testAssignableUsersUsesCRMLeadAndProjectTogether() throws {
        let path = try LeadgridAssignmentScope.assignableUsersPath(
            role: "team_leader",
            customerId: crmLeadID,
            projectId: "dentum-oslo"
        )
        let components = try XCTUnwrap(
            URLComponents(string: "https://leadgrid.no\(path)")
        )
        let query = Dictionary(
            uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
                item.value.map { (item.name, $0) }
            }
        )

        XCTAssertEqual(components.path, "/api/leadgrid/assignable-users")
        XCTAssertEqual(query["role"], "team_leader")
        XCTAssertEqual(query["leadId"], crmLeadID)
        XCTAssertEqual(query["projectId"], "dentum-oslo")
    }

    func testAssignableUsersFailsClosedWithoutPersistedScope() {
        XCTAssertThrowsError(
            try LeadgridAssignmentScope.assignableUsersPath(
                role: "rep",
                customerId: "agency-source-id",
                projectId: "dentum-oslo"
            )
        ) { error in
            XCTAssertEqual(
                error as? LeadgridAssignmentScopeError,
                .invalidCRMLeadID
            )
        }

        XCTAssertThrowsError(
            try LeadgridAssignmentScope.assignableUsersPath(
                role: "rep",
                customerId: crmLeadID,
                projectId: " "
            )
        ) { error in
            XCTAssertEqual(
                error as? LeadgridAssignmentScopeError,
                .missingProjectID
            )
        }
    }
}
