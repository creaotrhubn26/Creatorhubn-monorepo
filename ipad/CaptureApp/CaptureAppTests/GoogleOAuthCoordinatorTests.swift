import XCTest
@testable import CaptureApp

@MainActor
final class GoogleOAuthCoordinatorTests: XCTestCase {
    func testAcceptsCreatorHubIOSClientID() {
        let clientID = "256648631702-example.apps.googleusercontent.com"
        XCTAssertEqual(GoogleOAuthCoordinator.validatedClientID(clientID), clientID)
    }

    func testTrimsConfiguredClientID() {
        XCTAssertEqual(
            GoogleOAuthCoordinator.validatedClientID(
                "  256648631702-example.apps.googleusercontent.com\n"
            ),
            "256648631702-example.apps.googleusercontent.com"
        )
    }

    func testRejectsMissingPlaceholderAndMalformedClientIDs() {
        XCTAssertNil(GoogleOAuthCoordinator.validatedClientID(nil))
        XCTAssertNil(GoogleOAuthCoordinator.validatedClientID(""))
        XCTAssertNil(GoogleOAuthCoordinator.validatedClientID("REPLACE_WITH_CLIENT_ID"))
        XCTAssertNil(GoogleOAuthCoordinator.validatedClientID("role-room-client"))
    }
}
