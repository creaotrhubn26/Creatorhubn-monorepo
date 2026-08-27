import XCTest

// Visuell QA av runde-4-features på ekte board (prod-backend via
// SIMCTL_CHILD_SB_TOKEN): perspektiv-overlay og onion-skin slås på og
// dokumenteres som screenshot-attachments. Verifisering = se på bildene
// via `xcrun xcresulttool export attachments`.
final class FeatureVisualQATests: XCTestCase {

    /// iOS-varslingsdialogen (push) dukker ved første hub-innlasting.
    @MainActor
    func dismissPushPrompt() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.alerts.buttons["Allow"].firstMatch
        if allow.waitForExistence(timeout: 3) { allow.tap() }
    }

    @MainActor
    func testBoardPerspectiveAndOnionSkinScreenshots() throws {
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()

        // Auto-login (env-token): rotliste → Role Room → TROLL → manus → board.
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        // Prosjekt-hub ligger nå foran boardet
        let openBoard = app.buttons["Åpne board"].firstMatch
        if openBoard.waitForExistence(timeout: 10) { openBoard.tap() }

        let perspective = app.buttons["Perspektiv"].firstMatch
        XCTAssertTrue(perspective.waitForExistence(timeout: 15), "board åpnet ikke")

        attachShot(app, name: "01-board-grunntilstand")

        perspective.tap()
        let twoPoint = app.buttons["2-punkts"].firstMatch
        if twoPoint.waitForExistence(timeout: 4) {
            twoPoint.tap()
            Thread.sleep(forTimeInterval: 1)
            attachShot(app, name: "02-perspektiv-2punkts")
        }

        let onion = app.buttons["Onion-skin"].firstMatch
        if onion.exists {
            onion.tap()
            let previous = app.buttons["Forrige shot"].firstMatch
            if previous.waitForExistence(timeout: 4) {
                previous.tap()
                Thread.sleep(forTimeInterval: 2)
                attachShot(app, name: "03-onion-forrige-shot")
            }
        }
    }

    @MainActor
    private func attachShot(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // Runde 7 interaktivt: iso/fisheye-guides, VP-snap-toggle, retusj.
    @MainActor
    func testRound7BoardFeatures() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        // Prosjekt-hub ligger nå foran boardet
        let openBoard = app.buttons["Åpne board"].firstMatch
        if openBoard.waitForExistence(timeout: 10) { openBoard.tap() }
        let perspective = app.buttons["Perspektiv"].firstMatch
        XCTAssertTrue(perspective.waitForExistence(timeout: 15))

        func pick(_ label: String, shot: String) {
            perspective.tap()
            let option = app.buttons[label].firstMatch
            if option.waitForExistence(timeout: 4) {
                option.tap()
                Thread.sleep(forTimeInterval: 1.5)
                attachShot(app, name: shot)
            } else {
                app.tap()
            }
        }
        pick("Isometrisk", shot: "r7-01-isometrisk")
        pick("Fisheye", shot: "r7-02-fisheye")
        pick("2-punkts", shot: "r7-03-2punkts")
        // Snap-toggle synlig i menyen
        perspective.tap()
        let snap = app.switches["Snap strøk til VP"].firstMatch
        if snap.waitForExistence(timeout: 4) {
            attachShot(app, name: "r7-04-snap-meny")
            snap.tap()
        } else {
            app.tap()
        }
        pick("Av", shot: "r7-05-av")

        // Retusj: lasso rundt tegningen → juster-knappene synlige
        app.buttons["Select"].firstMatch.exists
            ? app.buttons["Select"].firstMatch.tap()
            : app.buttons.matching(NSPredicate(format: "label == 'select'")).firstMatch.tap()
        Thread.sleep(forTimeInterval: 1)
        attachShot(app, name: "r7-06-selectmodus")
    }

    // Prosjekt-hub: visuell verifisering mot prod (TROLL).
    @MainActor
    func testProjectHubScreenshot() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        XCTAssertTrue(app.buttons["Åpne board"].firstMatch.waitForExistence(timeout: 15),
                      "hub åpnet ikke")
        Thread.sleep(forTimeInterval: 3)
        attachShot(app, name: "hub-01-oversikt")
        app.swipeUp()
        Thread.sleep(forTimeInterval: 1)
        attachShot(app, name: "hub-02-nedre")
    }

    // TROLL production bible: godkjenn/lock referanser og bevis at Prompt
    // Engine arver den samme produksjonskonteksten. Ingen modellkall utføres.
    @MainActor
    func testTrollReferencesAndPromptInspector() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()

        let hub = app.buttons["Åpne board"].firstMatch
        guard hub.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        hub.tap()

        let aiStudio = app.buttons["Åpne AI Studio for aktivt shot"].firstMatch
        XCTAssertTrue(aiStudio.waitForExistence(timeout: 15),
                      "AI Studio mangler i Board-topbaren")
        aiStudio.tap()
        XCTAssertTrue(app.staticTexts["Regissørens intensjon"].waitForExistence(timeout: 8))

        let references = app.buttons["Referanser"].firstMatch
        XCTAssertTrue(references.waitForExistence(timeout: 8),
                      "Produksjonsreferanser mangler i AI Studio")
        references.tap()

        XCTAssertTrue(app.navigationBars["Produksjonsreferanser"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["TROLL · PRODUCTION BIBLE V1"].waitForExistence(timeout: 8))

        let allLocked = app.staticTexts["4/4 låst"].firstMatch
        if !allLocked.exists {
            for draftNumber in 1...4 {
                let approve = app.buttons["Godkjenn"].firstMatch
                for _ in 0..<5 where !approve.isHittable { app.swipeUp() }
                if !approve.isHittable {
                    for _ in 0..<5 where !allLocked.exists { app.swipeDown() }
                    if allLocked.exists { break }
                }
                XCTAssertTrue(approve.isHittable,
                              "Fant ikke Godkjenn-handlingen for utkast \(draftNumber)")
                guard approve.isHittable else { return }
                approve.tap()
                XCTAssertTrue(app.buttons["Godkjent"].firstMatch.waitForExistence(timeout: 12),
                              "Utkast \(draftNumber) ble ikke bekreftet godkjent")
            }
        }

        for _ in 0..<5 where !allLocked.exists { app.swipeDown() }
        XCTAssertTrue(allLocked.waitForExistence(timeout: 12),
                      "Alle fire TROLL-referanser ble ikke godkjent og låst")
        attachShot(app, name: "TROLL — 4 av 4 produksjonsreferanser låst")

        app.buttons["Ferdig"].firstMatch.tap()
        let inspector = app.buttons["Prompt Inspector"].firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 8), "Prompt Inspector mangler")
        inspector.tap()
        XCTAssertTrue(app.navigationBars["Prompt Inspector"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Preflight valid"].waitForExistence(timeout: 20),
                      "Prompt Engine kompilerte ikke TROLL-konteksten")
        XCTAssertTrue(app.staticTexts["FINAL COMPILED PROMPT"].exists)
        XCTAssertTrue(app.staticTexts["Locked properties"].exists)
        attachShot(app, name: "TROLL — production-aware Prompt Inspector")

        // Bevisst ingen bilde- eller videogenerering i denne testen.
    }

    // Generisk prosjekt: åpne den native opprettelsesflaten, rediger metadata
    // og scenemapping. Debug-harnessen gjør ingen nettverks- eller modellkall.
    @MainActor
    func testGenericProjectReferenceCreationSheet() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_AI_VIDEO_DEMO"] = "1"
        app.launchEnvironment["SB_REFERENCE_LIBRARY_DEMO"] = "1"
        app.launchEnvironment["SB_REFERENCE_CREATE_DEMO"] = "1"
        app.launchEnvironment["SB_REFERENCE_PROJECT_NAME"] = "NORDLYS"
        app.launch()

        XCTAssertTrue(
            app.navigationBars["Ny produksjonsreferanse"].waitForExistence(timeout: 12),
            "Opprettelsesflaten åpnet ikke")
        XCTAssertTrue(app.staticTexts["NORDLYS"].exists)
        XCTAssertTrue(app.staticTexts["Bygg prosjektets visuelle hukommelse"].exists)
        XCTAssertTrue(app.buttons["storyboard.reference.create.photo"].exists)
        XCTAssertTrue(app.staticTexts["1 valgt"].exists)

        let name = app.textFields["storyboard.reference.create.name"]
        XCTAssertTrue(name.exists)
        name.tap()
        name.typeText("Mina · vinterfrakk")

        let activeScene = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "SCENE 3 · INT. TOG — NATT")
        ).firstMatch
        XCTAssertTrue(activeScene.exists)
        activeScene.tap()
        XCTAssertTrue(app.staticTexts["0 valgt"].waitForExistence(timeout: 3))

        let save = app.buttons["storyboard.reference.create.save"]
        XCTAssertTrue(save.exists)
        XCTAssertFalse(save.isEnabled, "Utkast skal kreve et referansebilde")
        attachShot(app, name: "NORDLYS — ny prosjektbundet referanse")

        // Bevisst ingen opplasting eller AI-generering i denne UI-testen.
    }

    // Assets-fanen: visuell verifisering mot prod.
    @MainActor
    func testAssetsScreenshot() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        let assets = app.buttons["Assets"].firstMatch
        XCTAssertTrue(assets.waitForExistence(timeout: 15), "sidebar-Assets mangler")
        assets.tap()
        Thread.sleep(forTimeInterval: 4)
        attachShot(app, name: "assets-01")
    }

    // Review-flaten: visuell verifisering mot prod.
    @MainActor
    func testReviewScreenshot() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        let review = app.buttons["Review"].firstMatch
        XCTAssertTrue(review.waitForExistence(timeout: 15), "sidebar-Review mangler")
        review.tap()
        XCTAssertTrue(app.buttons["Godkjenn shot"].firstMatch.waitForExistence(timeout: 15),
                      "review-flaten åpnet ikke")
        Thread.sleep(forTimeInterval: 3)
        attachShot(app, name: "review-01")
    }
}
