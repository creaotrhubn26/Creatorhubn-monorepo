import XCTest
@testable import StoryboardStudio

@MainActor
final class StoryboardGoogleSignInTests: XCTestCase {
    func testReadsRoleRoomTransferFromNativeCallback() throws {
        let callback = try XCTUnwrap(URL(
            string: "storyboardstudio://oauth?rrGoogleStatus=success&rrGoogleMode=login&rrGoogleTransfer=transfer-123"
        ))

        XCTAssertEqual(
            try StoryboardGoogleSignIn.transferID(from: callback),
            "transfer-123"
        )
    }

    func testSurfacesRoleRoomCallbackError() throws {
        let callback = try XCTUnwrap(URL(
            string: "storyboardstudio://oauth?rrGoogleStatus=error&rrGoogleMessage=Ugyldig%20foresp%C3%B8rsel"
        ))

        XCTAssertThrowsError(try StoryboardGoogleSignIn.transferID(from: callback)) { error in
            XCTAssertEqual(error.localizedDescription, "Ugyldig forespørsel")
        }
    }

    func testRejectsCallbackWithoutOneTimeTransfer() throws {
        let callback = try XCTUnwrap(URL(
            string: "storyboardstudio://oauth?rrGoogleStatus=success"
        ))

        XCTAssertThrowsError(try StoryboardGoogleSignIn.transferID(from: callback))
    }
}
