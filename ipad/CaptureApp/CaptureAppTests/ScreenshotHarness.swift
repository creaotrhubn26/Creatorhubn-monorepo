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
@MainActor
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

    /// Photo/Shoot has a separate ingest pipeline from Video. Keep a dedicated
    /// physical smoke test so a working live-view connection cannot mask a
    /// broken still-photo connection.
    func testRealCanonR6PhotoConnectionSmoke() throws {
        guard ProcessInfo.processInfo.environment["RUN_REAL_CANON_PHOTO_SMOKE"] == "1" else {
            throw XCTSkip("Krever fysisk Canon R6 Mark II i CCAPI-modus")
        }

        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += ["--tab-shoot", "--canon-hardware-smoke"]
        app.launch()

        let camera = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "photo-camera-ip:")
        ).firstMatch
        XCTAssertTrue(
            camera.waitForExistence(timeout: 90),
            "R6 Mark II ble ikke oppdaget i Foto/Shoot på iPadens lokale nettverk",
        )
        camera.tap()

        let shutter = app.buttons["capture-shutter-button"]
        XCTAssertTrue(
            shutter.waitForExistence(timeout: 30),
            "Foto/Shoot opprettet ikke en klar CCAPI-økt mot R6 Mark II",
        )
        XCTAssertTrue(shutter.isEnabled, "Foto-utløseren må være klar etter tilkobling")
        snap(app, name: "QA_Canon_R6_Mark_II_Photo")
    }

    /// Opt-in destructive hardware check: fires one real still, waits for the
    /// CCAPI content event, downloads the preview, and verifies that the UI is
    /// backed by persisted bytes plus a SHA-256 checksum. Kept separate from
    /// the connection smoke so ordinary QA never takes a photograph.
    func testRealCanonR6PhotoCaptureAndIngest() throws {
        guard ProcessInfo.processInfo.environment["RUN_REAL_CANON_PHOTO_CAPTURE"] == "1" else {
            throw XCTSkip("Krever eksplisitt opt-in; testen tar ett fysisk bilde")
        }

        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += ["--tab-shoot"]
        app.launch()

        let camera = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "photo-camera-ip:")
        ).firstMatch
        if camera.waitForExistence(timeout: 15) {
            camera.tap()
        } else {
            // Auto-discovery and direct address are both production paths.
            // Keep the hardware test recoverable if Canon is briefly busy
            // after releasing a prior RAW transfer.
            let address = app.textFields["photo-direct-address"]
            XCTAssertTrue(address.waitForExistence(timeout: 5))
            address.tap()
            let existing = address.value as? String ?? ""
            address.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
            address.typeText("https://192.168.1.16")
            app.buttons["photo-direct-connect"].tap()
        }

        let shutter = app.buttons["capture-shutter-button"]
        XCTAssertTrue(shutter.waitForExistence(timeout: 30))
        XCTAssertTrue(shutter.isEnabled)
        shutter.tap()

        let captured = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "photo-asset-")
        ).firstMatch
        XCTAssertTrue(
            captured.waitForExistence(timeout: 45),
            "Bildet fra kameraet dukket ikke opp i filmstripen"
        )
        let verified = XCTNSPredicateExpectation(
            predicate: NSPredicate(
                format: "(value CONTAINS[c] %@ OR value CONTAINS[c] %@) AND value CONTAINS[c] %@ AND value CONTAINS[c] %@",
                "rawReady",
                "fullReady",
                "checksum verifisert",
                "byte"
            ),
            object: captured
        )
        XCTAssertEqual(
            XCTWaiter().wait(for: [verified], timeout: 180),
            .completed,
            "Kameraoriginalen ble ikke bekreftet med byte-størrelse og SHA-256"
        )
        snap(app, name: "QA_Canon_R6_Mark_II_Photo_Captured")
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

        XCTAssertTrue(
            app.descendants(matching: .any)["video-storage-menu"].waitForExistence(timeout: 10),
            "Videoarbeidsflaten må vise brukt lokal lagring og lagringsvalg"
        )

        let camera = app.buttons["canon-camera-fake2"]
        XCTAssertTrue(camera.waitForExistence(timeout: 15))
        camera.tap()
        XCTAssertTrue(app.images["Canon CCAPI live monitor"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["canon-setting-iso"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.descendants(matching: .any)["canon-battery-status"].waitForExistence(timeout: 5),
            "Canon-batteriet må vises i monitoren",
        )

        let record = app.buttons["video-record-button"]
        XCTAssertTrue(record.isEnabled)
        record.tap()
        XCTAssertTrue(app.buttons["Stopp opptak"].waitForExistence(timeout: 5))
        app.buttons["Stopp opptak"].tap()
        XCTAssertTrue(app.buttons["Start opptak"].waitForExistence(timeout: 15))
        XCTAssertTrue(
            app.staticTexts["Klippet er hentet fra kameraet og lagret på iPaden."]
                .waitForExistence(timeout: 15)
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["video-transfer-confirmation"]
                .waitForExistence(timeout: 5),
            "En lagret Canon-fil må bekreftes uten å stoppe arbeidsflyten"
        )
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "video-take-")).firstMatch
                .waitForExistence(timeout: 10),
            "Det importerte Canon-klippet må bli synlig i filmstripen"
        )
    }

    func testCanonVideoRecordedOnCameraAppearsInFilmstrip() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += [
            "--tab-video",
            "--fake-cameras",
            "--canon-video-demo",
            "--canon-external-movie-demo",
            "--canon-hardware-smoke",
        ]
        app.launch()

        let camera = app.buttons["canon-camera-fake2"]
        XCTAssertTrue(camera.waitForExistence(timeout: 15))
        camera.tap()
        XCTAssertTrue(app.images["Canon CCAPI live monitor"].waitForExistence(timeout: 10))
        XCTAssertTrue(
            app.staticTexts["MVI_EXTERNAL.MP4"].waitForExistence(timeout: 15),
            "Et klipp tatt med kameraets fysiske REC-knapp må importeres automatisk"
        )
    }

    /// Går gjennom den virkelige redigeringsflaten med et fotografisk portrett,
    /// ikke den gamle syntetiske sirkel-fixturen. Testen beskytter samtidig
    /// landscape/portrait, presetvalg, eksponering, crop og undo/redo.
    func testPortraitEditingWorkflow() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += ["--demo-redigering", "--portrait-fixture"]
        app.launch()
        rotate(.landscapeLeft, app: app, landscape: true)

        XCTAssertTrue(
            app.staticTexts["Portrett QA"].waitForExistence(timeout: 15),
            "Portrett-fixturen må bli seedet og valgt i redigeringsflaten",
        )
        XCTAssertTrue(app.staticTexts["Før"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Etter"].waitForExistence(timeout: 15))
        XCTAssertTrue(
            app.descendants(matching: .any)["redigering-image-loaded"]
                .waitForExistence(timeout: 8),
            "Editoren må ha dekodet selve portrettet, ikke bare vist rammen",
        )
        let presetMenu = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Preset:")
        ).firstMatch
        XCTAssertTrue(presetMenu.waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["redigering-reset"].exists)
        XCTAssertTrue(app.staticTexts["Lys og farge"].exists)
        XCTAssertTrue(app.sliders["redigering-slider-eksponering"].exists)
        snap(app, name: "QA_Redigering_Portrett_Landscape")

        // Portrett-fixturen kan allerede ha Portrett som aktiv recipe. I så fall
        // åpner ikke alle iOS-versjoner SwiftUI-menyen deterministisk via den
        // generiske accessibility-knappen; det er heller ingen grunn til å velge
        // samme preset på nytt. Velg kun når den ikke allerede er aktiv.
        if !app.buttons["Preset: Portrett"].exists {
            presetMenu.tap()
            let portraitPreset = app.buttons["Portrett"]
            XCTAssertTrue(portraitPreset.waitForExistence(timeout: 4))
            portraitPreset.tap()
        }
        XCTAssertTrue(app.buttons["Preset: Portrett"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["Tilpass tone til motiv"].exists)

        let exposure = app.sliders.firstMatch
        XCTAssertTrue(exposure.waitForExistence(timeout: 4))
        // En liten, synlig EV-endring uten å blåse ut hudtonene i den visuelle
        // regresjonen. XCUITest-posisjonen er med vilje nær midtpunktet.
        exposure.adjust(toNormalizedSliderPosition: 0.515)

        let crop = app.buttons["Beskjær"].firstMatch
        XCTAssertTrue(crop.waitForExistence(timeout: 4))
        crop.tap()
        XCTAssertTrue(app.navigationBars["Beskjær"].waitForExistence(timeout: 4))

        // SmartCropSheet opens in face-aware mode when Vision has found a
        // subject. Exercise the lossless manual fallback explicitly so the
        // drag gesture remains covered after the crop workspace redesign.
        let manualMode = app.buttons["Manuell"]
        XCTAssertTrue(manualMode.waitForExistence(timeout: 4))
        manualMode.tap()
        let drawCrop = app.buttons["Tegn utsnitt"]
        XCTAssertTrue(drawCrop.waitForExistence(timeout: 4))
        drawCrop.tap()
        XCTAssertTrue(app.navigationBars["Fri beskjæring"].waitForExistence(timeout: 4))
        let canvas = app.descendants(matching: .any)["redigering-crop-canvas"]
        XCTAssertTrue(canvas.waitForExistence(timeout: 4))
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.22, dy: 0.20))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: 0.82))
        start.press(forDuration: 0.1, thenDragTo: end)
        let applyManualCrop = app.navigationBars["Fri beskjæring"].buttons["Bruk utsnitt"]
        XCTAssertTrue(applyManualCrop.isEnabled)
        applyManualCrop.tap()
        XCTAssertTrue(app.navigationBars["Beskjær"].waitForExistence(timeout: 4))
        let applyCrop = app.navigationBars["Beskjær"].buttons["Bruk"]
        XCTAssertTrue(applyCrop.waitForExistence(timeout: 4))
        XCTAssertTrue(applyCrop.isEnabled)
        applyCrop.tap()

        let undo = app.buttons["Angre"]
        XCTAssertTrue(undo.waitForExistence(timeout: 8))
        XCTAssertTrue(undo.isEnabled)
        undo.tap()
        let redo = app.buttons["Gjør om"]
        XCTAssertEqual(
            XCTWaiter().wait(
                for: [XCTNSPredicateExpectation(
                    predicate: NSPredicate(format: "enabled == true"),
                    object: redo,
                )],
                timeout: 8
            ),
            .completed,
        )
        redo.tap()

        rotate(.portrait, app: app, landscape: false)
        XCTAssertTrue(app.staticTexts["Før"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Etter"].waitForExistence(timeout: 8))
        XCTAssertTrue(
            app.buttons["Preset: Portrett"].waitForExistence(timeout: 8),
            "Smart Edit-panelet må fortsatt være tilgjengelig i portrait",
        )
        // Verifiser den eksplisitte sammenligningsmodellen, ikke bare splitten:
        // Delt → Før → Etter. Det fanger knapper som finnes visuelt men ikke gjør
        // noe, og gir et rent helbilde av den ferdige redigeringen til QA.
        let splitMode = app.buttons["Delt"]
        XCTAssertTrue(splitMode.waitForExistence(timeout: 4))
        splitMode.tap()
        let beforeMode = app.buttons["Før"]
        XCTAssertTrue(beforeMode.waitForExistence(timeout: 4))
        beforeMode.tap()
        XCTAssertTrue(app.buttons["Etter"].waitForExistence(timeout: 4))
        snap(app, name: "QA_Redigering_Portrett_Portrait")
    }

    private func rotate(_ orientation: UIDeviceOrientation, app: XCUIApplication, landscape: Bool) {
        XCUIDevice.shared.orientation = orientation
        let window = app.windows.firstMatch
        XCTAssertEqual(
            XCTWaiter().wait(
                for: [XCTNSPredicateExpectation(
                    predicate: NSPredicate { object, _ in
                        guard let element = object as? XCUIElement else { return false }
                        return landscape
                            ? element.frame.width > element.frame.height
                            : element.frame.height > element.frame.width
                    },
                    object: window,
                )],
                timeout: 8
            ),
            .completed,
            "Redigeringsflaten roterte ikke til forventet orientering",
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
        // `exists == true` is already satisfied and therefore never waited for
        // the physical orientation animation. On device that occasionally
        // captured the app window halfway through rotation with a large black
        // band. Keep this intentionally short, but deterministic.
        Thread.sleep(forTimeInterval: 1.0)

        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
