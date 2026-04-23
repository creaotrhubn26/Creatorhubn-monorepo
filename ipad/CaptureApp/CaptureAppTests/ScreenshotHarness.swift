import XCTest

/// Drives the App Store screenshot set. Launches the app in its
/// onboarding-reset mode, walks a scripted path through the tabs,
/// and captures one frame per required screenshot slot. Fastlane's
/// ``snapshot`` CLI runs this on a matrix of iPad sizes and
/// uploads the output via ``fastlane deliver_screenshots``.
///
/// The UI test doesn't assert anything semantic — its only job is
/// to drive navigation + produce stable, reproducible frames.
/// Actual correctness is tested elsewhere (OnboardingStateTests,
/// TabPathTests, etc.).
///
/// Run locally from Xcode:
///   Product → Test → ScreenshotHarness (single class).
/// Output lives in DerivedData's ``Attachments/``.
///
/// Run from fastlane:
///   fastlane snapshot --scheme CaptureApp \
///       --test-without-building --output_directory fastlane/screenshots
final class ScreenshotHarness: XCTestCase {
    override class var runsForEachTargetApplicationUIConfiguration: Bool { false }

    func testCaptureAppStoreScreenshots() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--reset-onboarding",
            // A marker the app reads to seed deterministic demo
            // data into the local DB so every screenshot is taken
            // against the same "Bea's bryllup" project, same shot
            // list, same culled-asset mix. Wire-up lives in
            // ``CaptureAppMain`` behind a DEBUG-only branch.
            "--screenshot-demo-fixtures",
        ]
        app.launch()

        snap(app, name: "01_Welcome")

        // Step through the 3-card value-props screen.
        app.buttons["Kom i gang"].tap()
        snap(app, name: "02_ValueProps")

        // Step through to the permissions explainer.
        app.buttons["Sett opp kameraet"].tap()
        snap(app, name: "03_Permissions")

        // Skip past sign-in by tapping the dev-mode fixture button.
        // The fixture injects a fake ``SignInService.StoredSession``
        // so the tab bar can render without a live backend.
        app.buttons["Logg inn"].tap()
        if app.buttons["Bruk demo-konto"].waitForExistence(timeout: 2) {
            app.buttons["Bruk demo-konto"].tap()
        }

        // Main shell tabs: walk each once.
        snap(app, name: "04_Today")

        app.tabBars.buttons["Shoot"].tap()
        snap(app, name: "05_Shoot")

        // Live Cull is a nested view from Shoot → a session; the
        // fixture sets up an active one so we can jump straight in.
        if app.buttons["Start Live Cull"].waitForExistence(timeout: 2) {
            app.buttons["Start Live Cull"].tap()
            snap(app, name: "06_LiveCull")
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        app.tabBars.buttons["Galleri"].tap()
        snap(app, name: "07_Galleri")

        app.tabBars.buttons["Admin"].tap()
        snap(app, name: "08_Admin")

        app.tabBars.buttons["Tilbud"].tap()
        snap(app, name: "09_Tilbud")

        app.tabBars.buttons["Pris"].tap()
        snap(app, name: "10_Pris")
    }

    /// Capture a screenshot + attach it to the test so fastlane's
    /// snapshot runner picks it up. Waits briefly so any in-flight
    /// animation settles before the frame is taken.
    private func snap(_ app: XCUIApplication, name: String) {
        let animationSettle = XCTWaiter().wait(for: [
            XCTNSPredicateExpectation(
                predicate: NSPredicate(format: "exists == true"),
                object: app,
            ),
        ], timeout: 1.5)
        _ = animationSettle

        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
