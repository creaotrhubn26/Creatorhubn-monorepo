import XCTest

final class StoryboardReviewRoundsUITests: XCTestCase {
    @MainActor
    func testImmutableReviewRoundSurfaceRunsOnIPadSimulator() throws {
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launch()

        XCTAssertTrue(app.navigationBars["Review-runder"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["v3 · Regissørens sign-off"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["2 storyboardendringer · manus endret"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.share"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.restore"].exists)

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Storyboard review-runder — iPad"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
