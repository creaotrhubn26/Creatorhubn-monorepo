import XCTest

final class StoryboardReviewRoundsUITests: XCTestCase {
    @MainActor
    func testReviewWorkspacePortraitUsesCompactShotStripAndRevisions() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = launchReviewWorkspace()

        XCTAssertTrue(app.navigationBars["Review — TROLL"].waitForExistence(timeout: 8))
        let workspacePicker = app.segmentedControls["storyboard.review.workspacePicker"]
        XCTAssertTrue(workspacePicker.waitForExistence(timeout: 5))
        XCTAssertEqual(workspacePicker.buttons.count, 2)
        XCTAssertTrue(workspacePicker.buttons["Arbeidskopi"].isSelected)
        XCTAssertTrue(app.buttons["storyboard.review.rolePicker"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.contextRail.toggle"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.compactShotStrip"]
            .waitForExistence(timeout: 5))
        XCTAssertFalse(app.descendants(matching: .any)["storyboard.review.verticalShotRail"].exists)

        workspacePicker.buttons["Låste revisjoner"].tap()

        XCTAssertTrue(workspacePicker.buttons["Låste revisjoner"].isSelected)
        XCTAssertTrue(app.staticTexts["v3 · Regissørens sign-off"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Review-runder"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.lockedStage"]
            .waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.create.open"].waitForExistence(timeout: 5))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Samlet Review — portrett — låste revisjoner"
        attachment.lifetime = .keepAlways
        add(attachment)

        workspacePicker.buttons["Arbeidskopi"].tap()
        XCTAssertTrue(workspacePicker.buttons["Arbeidskopi"].isSelected)
    }

    @MainActor
    func testImmutableReviewRoundSurfaceRunsOnIPadSimulator() throws {
        XCUIDevice.shared.orientation = .portrait
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
        XCTAssertTrue(app.buttons["storyboard.review.share.open"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.more"].waitForExistence(timeout: 5))

        app.buttons["storyboard.review.share.open"].tap()
        XCTAssertTrue(app.navigationBars["Del låst revisjon"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.share"].waitForExistence(timeout: 5))
        app.buttons["Ferdig"].tap()

        app.buttons["storyboard.review.more"].tap()
        app.buttons["Gjenopprett storyboardfelter"].tap()
        XCTAssertTrue(app.navigationBars["Gjenopprett revisjon"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.restore"].waitForExistence(timeout: 5))
        app.buttons["Avbryt"].tap()

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Storyboard review-runder — iPad"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    private func launchReviewWorkspace() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_WORKSPACE_DEMO"] = "1"
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launchArguments += ["-storyboard.review.presentationRole", "director"]
        app.launch()
        return app
    }
}

/// XCTest launches this one flow once per interface configuration declared by
/// the app, which verifies the real landscape and portrait window sizes. A
/// physical-orientation assignment alone is not an interface-orientation
/// guarantee on iPadOS 26's windowed environment.
final class StoryboardReviewOrientationUITests: XCTestCase {
    override class var runsForEachTargetApplicationUIConfiguration: Bool { true }

    @MainActor
    func testReviewUsesLayoutForCurrentWindowOrientation() throws {
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_WORKSPACE_DEMO"] = "1"
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launchArguments += ["-storyboard.review.presentationRole", "director"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Review — TROLL"].waitForExistence(timeout: 8))
        let isLandscape = app.frame.width > app.frame.height
        if isLandscape {
            let rail = app.descendants(matching: .any)["storyboard.review.verticalShotRail"]
            XCTAssertTrue(rail.waitForExistence(timeout: 5))
            assertInsideWindow(rail, app: app)
            XCTAssertFalse(app.descendants(matching: .any)["storyboard.review.compactShotStrip"].exists)
        } else {
            let strip = app.descendants(matching: .any)["storyboard.review.compactShotStrip"]
            XCTAssertTrue(strip.waitForExistence(timeout: 5))
            assertInsideWindow(strip, app: app)
            XCTAssertFalse(app.descendants(matching: .any)["storyboard.review.verticalShotRail"].exists)
        }
        let contextToggle = app.buttons["storyboard.review.contextRail.toggle"]
        XCTAssertTrue(contextToggle.waitForExistence(timeout: 5))
        assertInsideWindow(contextToggle, app: app)
        contextToggle.tap()
        let contextRail = app.descendants(matching: .any)["storyboard.review.contextRail"]
        XCTAssertTrue(contextRail.waitForExistence(timeout: 5))
        assertInsideWindow(contextRail, app: app)
        contextToggle.tap()

        let workspacePicker = app.segmentedControls["storyboard.review.workspacePicker"]
        XCTAssertTrue(workspacePicker.waitForExistence(timeout: 5))
        workspacePicker.buttons["Låste revisjoner"].tap()
        let lockedStage = app.descendants(matching: .any)["storyboard.review.lockedStage"]
        XCTAssertTrue(lockedStage.waitForExistence(timeout: 5))
        assertInsideWindow(lockedStage, app: app)
        XCTAssertTrue(app.buttons["storyboard.review.create.open"].waitForExistence(timeout: 5))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = isLandscape
            ? "Samlet Review — landskap — låst revisjon"
            : "Samlet Review — portrett — låst revisjon"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    private func assertInsideWindow(
        _ element: XCUIElement,
        app: XCUIApplication,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let intersection = element.frame.intersection(app.frame)
        XCTAssertFalse(intersection.isNull, "Elementet er utenfor appvinduet", file: file, line: line)
        XCTAssertGreaterThan(intersection.width, 0, file: file, line: line)
        XCTAssertGreaterThan(intersection.height, 0, file: file, line: line)
        XCTAssertGreaterThanOrEqual(element.frame.minX, app.frame.minX - 1,
                                    "Elementet klippes på venstre side", file: file, line: line)
        XCTAssertLessThanOrEqual(element.frame.maxX, app.frame.maxX + 1,
                                 "Elementet klippes på høyre side", file: file, line: line)
    }
}
