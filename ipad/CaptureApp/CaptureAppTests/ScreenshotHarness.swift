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

    override func tearDown() {
        XCUIApplication().terminate()
        XCUIDevice.shared.orientation = .portrait
        super.tearDown()
    }

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

        tapTab("Shoot", in: app)
        snap(app, name: "05_Shoot")

        // Live Cull is a nested view from Shoot → a session; the
        // fixture sets up an active one so we can jump straight in.
        if app.buttons["Start Live Cull"].waitForExistence(timeout: 2) {
            app.buttons["Start Live Cull"].tap()
            snap(app, name: "06_LiveCull")
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }

        tapTab("Galleri", in: app)
        snap(app, name: "07_Galleri")

        tapTab("Admin", in: app)
        snap(app, name: "08_Admin")

        tapTab("Tilbud", in: app)
        snap(app, name: "09_Tilbud")

        tapTab("Pris", in: app)
        snap(app, name: "10_Pris")
    }

    /// Guards the two production workspaces that make the most intensive use
    /// of iPad landscape. The assertions deliberately target controls that
    /// used to be clipped or hidden when the window changed width.
    func testAdaptiveLandscapeWorkspaces() {
        XCUIDevice.shared.orientation = .landscapeLeft

        let shoot = XCUIApplication()
        shoot.terminate()
        shoot.launchArguments += [
            "--legacy-capture-only",
            "--auto-demo",
            "--auto-demo-shots=1",
            "--no-demo-reviews",
        ]
        shoot.launch()
        let shutter = shoot.buttons["capture-shutter-button"]
        XCTAssertTrue(
            shutter.waitForExistence(timeout: 12),
            "Shoot-utløseren må være tilgjengelig i landscape",
        )
        XCTAssertTrue(shutter.isHittable, "Shoot-utløseren må være synlig og trykkbar i landscape")
        snap(shoot, name: "QA_Shoot_Landscape")
        shoot.terminate()

        let video = XCUIApplication()
        video.launchArguments += [
            "--tab-video",
            "--screenshot-demo-fixtures",
            "--video-take-demo",
            "--fake-cameras",
            "--canon-video-demo",
        ]
        video.launch()
        let recordButton = video.buttons["video-record-button"]
        XCTAssertTrue(
            recordButton.waitForExistence(timeout: 12),
            "Video-opptaksknappen må være tilgjengelig i landscape",
        )
        XCTAssertTrue(recordButton.isHittable, "Video-opptaksknappen må være synlig og trykkbar")

        let canonCamera = video.buttons["canon-camera-fake1"]
        XCTAssertTrue(
            canonCamera.waitForExistence(timeout: 4),
            "Den simulerte Canon-kilden må være synlig i landscape",
        )
        canonCamera.tap()
        XCTAssertTrue(
            video.staticTexts["canon-controls-title"].waitForExistence(timeout: 8),
            "CCAPI-kontrollene må vises etter at kameraet er koblet til",
        )
        XCTAssertTrue(
            video.buttons["canon-setting-iso"].waitForExistence(timeout: 3),
            "Kameraannonserte ISO-verdier må være tilgjengelige",
        )

        let landscapeTakeButton = video.buttons["video-take-panel"]
        if landscapeTakeButton.waitForExistence(timeout: 2) {
            XCTAssertTrue(landscapeTakeButton.isHittable, "Take-knappen må være trykkbar i landscape")
            landscapeTakeButton.tap()
        } else {
            XCTAssertTrue(
                video.buttons["video-take-status-good"].waitForExistence(timeout: 3),
                "Take-panelet må være synlig når egen knapp ikke brukes",
            )
        }
        let goodTakeStatus = video.buttons["video-take-status-good"]
        XCTAssertTrue(
            goodTakeStatus.waitForExistence(timeout: 4),
            "Take board må vise statuskontroller for valgt take",
        )
        XCTAssertTrue(goodTakeStatus.isHittable, "Take-status må være synlig og trykkbar")
        snap(video, name: "QA_Video_Landscape")

        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(
            video.staticTexts["VIDEOKILDER"].waitForExistence(timeout: 8),
            "Videokilder må fortsatt være tilgjengelige etter rotasjon",
        )
        let takeInspectorVisible = video.staticTexts["TAKE"].waitForExistence(timeout: 2)
        let takeButtonVisible = takeInspectorVisible
            ? false
            : video.buttons["video-take-panel"].waitForExistence(timeout: 6)
        XCTAssertTrue(
            takeInspectorVisible || takeButtonVisible,
            "Take-panelet må fortsatt være tilgjengelig etter rotasjon",
        )
    }

    /// Opt-in test against a physical Canon body. Run only while the iPad is
    /// on the camera's CCAPI network:
    /// `RUN_REAL_CANON_SMOKE=1 xcodebuild ... -only-testing:.../testRealCanonR6HardwareSmoke`
    func testRealCanonR6HardwareSmoke() throws {
        guard ProcessInfo.processInfo.environment["RUN_REAL_CANON_SMOKE"] == "1" else {
            throw XCTSkip("Krever fysisk Canon R6 Mark II i CCAPI-modus")
        }

        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += ["--tab-video", "--canon-hardware-smoke"]
        app.launch()

        let camera = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Canon EOS R6 Mark II")
        ).firstMatch
        XCTAssertTrue(
            camera.waitForExistence(timeout: 90),
            "R6 Mark II ble ikke oppdaget på iPadens lokale nettverk",
        )
        camera.tap()

        XCTAssertTrue(
            app.images["Canon CCAPI live monitor"].waitForExistence(timeout: 30),
            "R6 Mark II leverte ikke CCAPI live view",
        )
        XCTAssertTrue(
            app.buttons["canon-setting-iso"].waitForExistence(timeout: 10),
            "R6 Mark II annonserte ikke en skrivbar ISO-kontroll i aktiv modus",
        )

        let record = app.buttons["video-record-button"]
        XCTAssertTrue(record.isEnabled, "R6 Mark II annonserte ikke fjernstyrt video-REC")
        record.tap()
        XCTAssertTrue(
            app.buttons["Stopp opptak"].waitForExistence(timeout: 10),
            "R6 Mark II bekreftet ikke opptaksstart",
        )
        sleep(2)
        app.buttons["Stopp opptak"].tap()

        XCTAssertTrue(
            app.buttons["Start opptak"].waitForExistence(timeout: 60),
            "Klippet ble ikke ferdigstilt og importert fra R6 Mark II",
        )
        snap(app, name: "QA_Canon_R6_Mark_II")
    }

    func testCanonVideoDemoRecordAndImport() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += [
            "--tab-video",
            "--fake-cameras",
            "--canon-video-demo",
            "--canon-hardware-smoke",
        ]
        app.launch()

        let camera = app.buttons["canon-camera-fake2"]
        XCTAssertTrue(camera.waitForExistence(timeout: 15))
        camera.tap()
        XCTAssertTrue(app.images["Canon CCAPI live monitor"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["canon-setting-iso"].waitForExistence(timeout: 5))

        let record = app.buttons["video-record-button"]
        XCTAssertTrue(record.isEnabled)
        record.tap()
        XCTAssertTrue(app.buttons["Stopp opptak"].waitForExistence(timeout: 5))
        app.buttons["Stopp opptak"].tap()
        XCTAssertTrue(app.buttons["Start opptak"].waitForExistence(timeout: 15))
        XCTAssertTrue(
            app.staticTexts["Klippet er hentet fra kameraet og sikres i CreatorHub."]
                .waitForExistence(timeout: 15)
        )
    }

    /// iPadOS 26 exposes SwiftUI's floating tab bar as button/cell nodes, not
    /// an XCUIElementTypeTabBar. Query the accessible tab button directly so
    /// the harness works on both the old bottom bar and the new floating bar.
    private func tapTab(_ title: String, in app: XCUIApplication) {
        let button = app.buttons[title].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 4), "Fant ikke \(title)-fanen")
        button.tap()
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
