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
    func testWorkingReviewPinSupportsTouchMoveTargetAndUndo() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = launchReviewWorkspace()

        XCTAssertTrue(app.navigationBars["Review — TROLL"].waitForExistence(timeout: 8))
        let pin = app.descendants(matching: .any)["storyboard.review.pin.comment-demo"]
        XCTAssertTrue(pin.waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(pin.frame.width, 44)
        XCTAssertGreaterThanOrEqual(pin.frame.height, 44)

        pin.tap()
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.pin.selection"]
            .waitForExistence(timeout: 5))
        let targetHandle = app.descendants(matching: .any)["storyboard.review.pinTarget.comment-demo"]
        XCTAssertTrue(targetHandle.waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(targetHandle.frame.width, 44)
        XCTAssertGreaterThanOrEqual(targetHandle.frame.height, 44)

        let start = pin.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.15, thenDragTo: start.withOffset(CGVector(dx: -72, dy: 46)))
        XCTAssertTrue(app.staticTexts["Pin flyttet ✓"].waitForExistence(timeout: 5))

        let undo = app.buttons["storyboard.review.pin.undo"]
        XCTAssertTrue(undo.waitForExistence(timeout: 5))
        undo.tap()
        XCTAssertTrue(app.staticTexts["Pinflytting angret ✓"].waitForExistence(timeout: 5))

        let targetStart = targetHandle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        targetStart.press(
            forDuration: 0.15,
            thenDragTo: targetStart.withOffset(CGVector(dx: 54, dy: -30)))
        XCTAssertTrue(app.staticTexts["Målpunkt lagret ✓"].waitForExistence(timeout: 5))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Review-pin — flyttbart målpunkt"
        attachment.lifetime = .keepAlways
        add(attachment)
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
    func testLockedReviewPinHasTouchTargetAndCanBeRepositionedByDirector() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launchArguments += ["-storyboard.review.presentationRole", "director"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Review-runder"].waitForExistence(timeout: 8))
        let pin = app.descendants(matching: .any)["storyboard.review.lockedPin.comment-demo"]
        XCTAssertTrue(pin.waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(pin.frame.width, 44)
        XCTAssertGreaterThanOrEqual(pin.frame.height, 44)
        let before = pin.value as? String

        let start = pin.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.15, thenDragTo: start.withOffset(CGVector(dx: -48, dy: 30)))

        XCTAssertTrue(app.staticTexts["Pinplasseringen er lagret."].waitForExistence(timeout: 5))
        XCTAssertNotEqual(pin.value as? String, before)
    }

    @MainActor
    func testCommentBecomesPreviewableChangeAndCanBeUndone() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launchArguments += ["-storyboard.review.presentationRole", "director"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Review-runder"].waitForExistence(timeout: 8))
        let create = app.buttons["storyboard.review.comment.createChange.comment-demo"]
        XCTAssertTrue(create.waitForExistence(timeout: 5))
        if !create.isHittable { app.swipeUp() }
        create.tap()

        XCTAssertTrue(app.navigationBars["Forhåndsvis endring"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["storyboard.review.change.value"].waitForExistence(timeout: 5))
        app.buttons["storyboard.review.change.preview"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.change.previewResult"]
            .waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["2.0 sek"].exists)
        XCTAssertTrue(app.staticTexts["3.0 sek"].exists)
        let previewAttachment = XCTAttachment(screenshot: app.screenshot())
        previewAttachment.name = "Kommentar til endring — før og etter"
        previewAttachment.lifetime = .keepAlways
        add(previewAttachment)
        app.buttons["storyboard.review.change.apply"].tap()

        XCTAssertTrue(app.staticTexts["Endringen er godkjent, anvendt og kan angres fra review-punktet."]
            .waitForExistence(timeout: 5))
        let undo = app.buttons["storyboard.review.comment.undoChange.comment-demo"]
        XCTAssertTrue(undo.waitForExistence(timeout: 5))
        if !undo.isHittable { app.swipeUp() }
        undo.tap()
        XCTAssertTrue(app.staticTexts["Endringen er angret. Review-punktet er åpnet igjen."]
            .waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["storyboard.review.comment.createChange.comment-demo"]
            .waitForExistence(timeout: 5))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Kommentar til endring — angret"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    func testChangePreviewKeepsPrimaryActionVisibleInLandscape() throws {
        XCUIDevice.shared.orientation = .landscapeRight
        let app = XCUIApplication()
        app.launchEnvironment["SB_REVIEW_ROUNDS_DEMO"] = "1"
        app.launchEnvironment["SB_REVIEW_CHANGE_DEMO"] = "1"
        app.launchArguments += ["-storyboard.review.presentationRole", "director"]
        app.launch()

        let previewButton = app.buttons["storyboard.review.change.preview"]
        XCTAssertTrue(app.navigationBars["Forhåndsvis endring"].waitForExistence(timeout: 8))
        XCTAssertTrue(previewButton.waitForExistence(timeout: 5))
        previewButton.tap()

        let apply = app.buttons["storyboard.review.change.apply"]
        XCTAssertTrue(app.descendants(matching: .any)["storyboard.review.change.previewResult"]
            .waitForExistence(timeout: 5))
        XCTAssertTrue(apply.waitForExistence(timeout: 5))
        XCTAssertTrue(apply.isHittable)
        XCTAssertTrue(app.frame.contains(apply.frame))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Kommentar til endring — landskap"
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
