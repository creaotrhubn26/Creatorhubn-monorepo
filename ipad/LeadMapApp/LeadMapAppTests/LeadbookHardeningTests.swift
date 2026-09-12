import XCTest
@testable import LeadMapApp

final class LeadbookHardeningTests: XCTestCase {
    func testCanonicalExampleDeepLinkUsesFullUUID() throws {
        let id = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
        let url = try XCTUnwrap(URL(string: "leadgrid://leadbook/examples/\(id.uuidString)"))
        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(url),
            LeadbookDeepLinkRoute(destination: .example(id), scope: nil)
        )
    }

    func testCanonicalAndLegacyTemplateDeepLinks() throws {
        let id = UUID(uuidString: "33333333-3333-4333-8333-333333333333")!
        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(try XCTUnwrap(URL(string: "leadgrid://leadbook/templates/\(id.uuidString)"))),
            LeadbookDeepLinkRoute(destination: .template(id), scope: nil)
        )
        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(try XCTUnwrap(URL(string: "leadgrid://leadbook/\(id.uuidString)"))),
            LeadbookDeepLinkRoute(destination: .template(id), scope: nil)
        )
    }

    func testRejectsTruncatedAndForeignDeepLinks() throws {
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "leadgrid://leadbook/22222222"))))
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "https://leadgrid.no/leadbook/examples/22222222-2222-4222-8222-222222222222"))))
    }

    func testScopedDeepLinkCarriesCanonicalProjectContext() throws {
        let id = UUID(uuidString: "22222222-2222-4222-8222-222222222222")!
        let organizationId = "11111111-1111-4111-8111-111111111111"
        let url = try XCTUnwrap(URL(string:
            "leadgrid://leadbook/examples/\(id.uuidString)?projectId=dentum-oslo&organizationId=\(organizationId.uppercased())"
        ))

        XCTAssertEqual(
            LeadbookDeepLinkRouter.parse(url),
            LeadbookDeepLinkRoute(
                destination: .example(id),
                scope: LeadbookDeepLinkScope(
                    projectId: "dentum-oslo",
                    organizationId: organizationId
                )
            )
        )
    }

    func testRejectsPartialDuplicateAndMalformedProjectScope() throws {
        let base = "leadgrid://leadbook/examples/22222222-2222-4222-8222-222222222222"
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "\(base)?projectId=dentum-oslo"))))
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "\(base)?projectId=a&projectId=b&organizationId=11111111-1111-4111-8111-111111111111"))))
        XCTAssertNil(LeadbookDeepLinkRouter.parse(
            try XCTUnwrap(URL(string: "\(base)?projectId=dentum-oslo&organizationId=not-a-uuid"))))
    }
}
