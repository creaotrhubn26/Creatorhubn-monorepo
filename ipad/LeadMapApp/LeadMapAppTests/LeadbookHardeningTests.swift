import XCTest
@testable import LeadMapApp

final class LeadbookHardeningTests: XCTestCase {
    func testCanonicalExampleDeepLinkUsesFullUUID() throws {
        let id = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
        let url = try XCTUnwrap(URL(string: "leadgrid://leadbook/examples/\(id.uuidString)"))
        XCTAssertEqual(LeadbookDeepLinkRouter.parse(url), .example(id))
    }

    func testCanonicalAndLegacyTemplateDeepLinks() throws {
        let id = UUID(uuidString: "33333333-3333-4333-8333-333333333333")!
        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(try XCTUnwrap(URL(string: "leadgrid://leadbook/templates/\(id.uuidString)"))),
            .template(id)
        )
        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(try XCTUnwrap(URL(string: "leadgrid://leadbook/\(id.uuidString)"))),
            .template(id)
        )
    }

    func testRejectsTruncatedAndForeignDeepLinks() throws {
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "leadgrid://leadbook/22222222"))))
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "https://leadgrid.no/leadbook/examples/22222222-2222-4222-8222-222222222222"))))
    }
}
