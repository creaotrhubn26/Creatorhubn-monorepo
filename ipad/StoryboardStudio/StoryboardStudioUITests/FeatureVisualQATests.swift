import XCTest

// Visuell QA av runde-4-features på ekte board (prod-backend via
// SIMCTL_CHILD_SB_TOKEN): perspektiv-overlay og onion-skin slås på og
// dokumenteres som screenshot-attachments. Verifisering = se på bildene
// via `xcrun xcresulttool export attachments`.
final class FeatureVisualQATests: XCTestCase {

    /// iOS-varslingsdialogen (push) dukker ved første hub-innlasting.
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
