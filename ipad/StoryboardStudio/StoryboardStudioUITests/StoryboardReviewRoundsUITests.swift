import XCTest

final class StoryboardReviewRoundsUITests: XCTestCase {
    @MainActor
    func testReviewWorkspaceContainsShotsAndRevisions() throws {
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_WORKSPACE_DEMO"] = "1"
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launch()

        XCTAssertTrue(app.navigationBars["Review — TROLL"].waitForExistence(timeout: 8))
        let workspacePicker = app.segmentedControls["storyboard.review.workspacePicker"]
        XCTAssertTrue(workspacePicker.waitForExistence(timeout: 5))
        XCTAssertEqual(workspacePicker.buttons.count, 2)
        XCTAssertTrue(workspacePicker.buttons["Shots"].isSelected)

        workspacePicker.buttons["Låste revisjoner"].tap()

        XCTAssertTrue(workspacePicker.buttons["Låste revisjoner"].isSelected)
        XCTAssertTrue(app.staticTexts["v3 · Regissørens sign-off"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Review-runder"].exists)

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Samlet Review — låste revisjoner"
        attachment.lifetime = .keepAlways
        add(attachment)

        workspacePicker.buttons["Shots"].tap()
        XCTAssertTrue(workspacePicker.buttons["Shots"].isSelected)
    }

    @MainActor
    func testImmutableReviewRoundSurfaceRunsOnIPadSimulator() throws {
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launch()

        XCTAssertTrue(app.navigationBars["Review-runder"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["1 ulest"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.inbox.storyboard_review_comment_added"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["v3 · Regissørens sign-off"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["2 storyboardendringer · manus endret"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.otherElements["storyboard.review.resolutionQueue"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.comment.markup.comment-demo"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.comment.resolve.comment-demo"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.share"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.restore"].exists)

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Storyboard review-runder — iPad"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
