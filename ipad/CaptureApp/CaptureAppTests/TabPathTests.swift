import XCTest
@testable import CaptureApp

/// Lock the URLs that the CreatorHub One WebView tabs deep-link into.
///
/// The paths are a contract between the iPad shell and the web
/// ``UniversalDashboard`` (+ ``AdministrationHub``): renaming one
/// without the other silently breaks a tab, so this test catches the
/// drift early.
///
/// Shape the dashboard expects:
///   * ``/photographer-dashboard-material`` — mounts UniversalDashboard.
///   * ``?tab=<id>`` — selects the main tab (e.g. ``administration``).
///   * ``?subTab=<id>`` — handed off via sessionStorage, consumed by
///     AdministrationHub via ``consumePendingAdministrationDeepLink``.
final class TabPathTests: XCTestCase {

    func testGalleryLandsOnShowcaseAdmin() throws {
        let components = try XCTUnwrap(
            URLComponents(string: "https://example.com" + CreatorHubOneRootView.TabPath.gallery),
        )
        XCTAssertEqual(components.path, "/photographer-dashboard-material")
        XCTAssertEqual(queryValue(in: components, name: "tab"), "showcase-admin")
        XCTAssertNil(queryValue(in: components, name: "subTab"),
            "Gallery doesn't need a subTab — it's a top-level view.")
    }

    func testAdminLandsOnAdministrationTab() throws {
        let components = try XCTUnwrap(
            URLComponents(string: "https://example.com" + CreatorHubOneRootView.TabPath.admin),
        )
        XCTAssertEqual(components.path, "/photographer-dashboard-material")
        XCTAssertEqual(queryValue(in: components, name: "tab"), "administration")
        XCTAssertNil(queryValue(in: components, name: "subTab"),
            "Admin tab shows the hub's default (Prisadministrasjon).")
    }

    func testTilbudOpensQuoteBuilderOverPricing() throws {
        let components = try XCTUnwrap(
            URLComponents(string: "https://example.com" + CreatorHubOneRootView.TabPath.tilbud),
        )
        XCTAssertEqual(components.path, "/photographer-dashboard-material")
        XCTAssertEqual(queryValue(in: components, name: "tab"), "administration")
        XCTAssertEqual(queryValue(in: components, name: "subTab"), "quotes",
            "``subTab=quotes`` is the contract AdministrationHub reads to auto-open the modal.")
    }

    func testPricingUsesStandaloneRoute() throws {
        let components = try XCTUnwrap(
            URLComponents(string: "https://example.com" + CreatorHubOneRootView.TabPath.pricing),
        )
        XCTAssertEqual(components.path, "/price-administration")
        XCTAssertTrue(components.queryItems == nil || components.queryItems!.isEmpty,
            "Pris tab uses the direct route; no params needed.")
    }

    func testMessagesDeepLinksToCommunicationSubTab() throws {
        let components = try XCTUnwrap(
            URLComponents(string: "https://example.com" + CreatorHubOneRootView.TabPath.messages),
        )
        XCTAssertEqual(components.path, "/photographer-dashboard-material")
        XCTAssertEqual(queryValue(in: components, name: "tab"), "administration")
        XCTAssertEqual(queryValue(in: components, name: "subTab"), "communication")
    }

    func testAllPathsAreRelativeToBase() {
        // Sanity: nothing hardcodes a host. Base URL is picked from the
        // signed-in ``StoredSession`` so staging + prod both work.
        let paths = [
            CreatorHubOneRootView.TabPath.gallery,
            CreatorHubOneRootView.TabPath.admin,
            CreatorHubOneRootView.TabPath.tilbud,
            CreatorHubOneRootView.TabPath.pricing,
            CreatorHubOneRootView.TabPath.messages,
        ]
        for path in paths {
            XCTAssertTrue(path.hasPrefix("/"),
                "\(path) must be root-relative — base URL comes from the session")
            XCTAssertFalse(path.contains("://"),
                "\(path) must not hardcode a scheme or host")
        }
    }

    // MARK: - helpers

    private func queryValue(in components: URLComponents, name: String) -> String? {
        components.queryItems?.first(where: { $0.name == name })?.value
    }
}
