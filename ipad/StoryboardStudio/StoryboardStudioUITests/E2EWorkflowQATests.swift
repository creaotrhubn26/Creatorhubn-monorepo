import XCTest

// Full E2E-workflow-QA mot prod (TROLL): login → board → tegn → synk →
// angre → synk (prod ryddes) → verktøy (perspektiv/onion) → tone-rapport →
// eksport → animatic → review → fullskjerm. Screenshot-attachments per
// steg; eksporteres med `xcresulttool export attachments`.
final class E2EWorkflowQATests: XCTestCase {

    /// iOS-varslingsdialogen (push) dukker ved første hub-innlasting.
    func dismissPushPrompt() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.alerts.buttons["Allow"].firstMatch
        if allow.waitForExistence(timeout: 3) { allow.tap() }
    }

    @MainActor
    func testFullBoardWorkflow() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = "e2e-verify-daniel-2026"
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()

        // ── 1: Login → TROLL → board ──
        // Ny root-flyt: env-token lander rett i prosjekt-huben.
        let hubReady = app.buttons["Åpne board"].firstMatch
        guard hubReady.waitForExistence(timeout: 30) else { throw XCTSkip("prod/token") }
        dismissPushPrompt()
        // Prosjekt-hub ligger nå foran boardet
        let openBoard = app.buttons["Åpne board"].firstMatch
        if openBoard.waitForExistence(timeout: 10) { openBoard.tap() }
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 15), "board/canvas åpnet ikke")
        Thread.sleep(forTimeInterval: 2)
        attach(app, "01-board")

        // Scene 1 shot 3A har 28 strøk fra før (prod-fasit).
        XCTAssertTrue(app.staticTexts["28 strøk"].waitForExistence(timeout: 8),
                      "ventet 28 strøk i aktiv frame")

        // ── 2: Tegn ett strøk (høyre→venstre — pop-gesture). Sim-AX kan
        // droppe første touch etter navigering — retry opptil 3 ganger.
        var drew = false
        for attempt in 0..<3 where !drew {
            let jitter = Double(attempt) * 0.05
            let start = canvas.coordinate(withNormalizedOffset:
                CGVector(dx: 0.7 - jitter, dy: 0.35 + jitter))
            let end = canvas.coordinate(withNormalizedOffset:
                CGVector(dx: 0.35 - jitter, dy: 0.6 + jitter))
            start.press(forDuration: 0.1, thenDragTo: end)
            drew = app.staticTexts["29 strøk"].waitForExistence(timeout: 4)
        }
        XCTAssertTrue(drew, "tegning registrerte ikke strøk etter 3 forsøk")
        attach(app, "02-tegnet-strok")

        // ── 3: Synk til prod ──
        app.buttons["Synk"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Synket ✓"].waitForExistence(timeout: 15),
                      "synk feilet")

        // ── 4: Angre → autosynken (3 s debounce) tar lagringen; manuell
        // Synk i tillegg ga et race med visnings-desynk. La den lande.
        app.buttons["Angre"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["28 strøk"].waitForExistence(timeout: 5))
        Thread.sleep(forTimeInterval: 6)
        XCTAssertTrue(app.staticTexts["28 strøk"].exists,
                      "teller endret seg etter autosynk — visnings-desynk")
        attach(app, "04-ryddet")

        // ── 4b: Server-tilstand, ikke bare lokal: bytt scene og tilbake —
        // canvasen reloades fra serveren. Fanger stale-baseline-klassen
        // (angre som «synket ✓» men aldri nådde serveren pga falsk konflikt).
        app.staticTexts["02"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 2)
        app.staticTexts["01"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["28 strøk"].waitForExistence(timeout: 15),
                      "serveren har ikke 28 strøk — angre-synken nådde ikke prod")

        // ── 5: Perspektiv 2-punkts ──
        let perspective = app.buttons["Perspektiv"].firstMatch
        if perspective.exists {
            perspective.tap()
            let twoPoint = app.buttons["2-punkts"].firstMatch
            if twoPoint.waitForExistence(timeout: 4) {
                twoPoint.tap()
                Thread.sleep(forTimeInterval: 1)
                attach(app, "05-perspektiv")
                perspective.tap()
                if app.buttons["Av"].firstMatch.waitForExistence(timeout: 4) {
                    app.buttons["Av"].firstMatch.tap()
                }
            } else {
                app.tap() // lukk menyen
            }
        }

        // ── 6: Onion-skin ──
        let onion = app.buttons["Onion-skin"].firstMatch
        if onion.exists {
            onion.tap()
            let previous = app.buttons["Forrige shot"].firstMatch
            if previous.waitForExistence(timeout: 4) {
                previous.tap()
                Thread.sleep(forTimeInterval: 2)
                attach(app, "06-onion")
                onion.tap()
                if app.buttons["Av"].firstMatch.waitForExistence(timeout: 4) {
                    app.buttons["Av"].firstMatch.tap()
                }
            } else {
                app.tap()
            }
        }

        // ── 7: Tone-rapport (fokus + hero) ──
        app.buttons["Tone-analyse"].firstMatch.tap()
        if app.staticTexts["Fokal kontrast"].waitForExistence(timeout: 10) {
            attach(app, "07-tonerapport")
        }
        if app.buttons["Lukk"].firstMatch.exists { app.buttons["Lukk"].firstMatch.tap() }
        else { app.swipeDown() }

        // ── 8: PDF-eksport (async m/ progress) ──
        let export = app.buttons["Eksporter PDF"].firstMatch
        if export.waitForExistence(timeout: 5) {
            export.tap()
            let pdf = app.buttons["PDF"].firstMatch
            if pdf.waitForExistence(timeout: 4) {
                pdf.tap()
                // Share-sheet når eksporten er ferdig (16 frames re-rendres).
                let shareSheet = app.otherElements["ActivityListView"].firstMatch
                _ = shareSheet.waitForExistence(timeout: 45)
                attach(app, "08-pdf-eksport")
                app.buttons["Close"].firstMatch.exists
                    ? app.buttons["Close"].firstMatch.tap()
                    : app.tap()
            }
        }

        // ── 9: Animatic ──
        app.staticTexts["Animatic"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 2)
        attach(app, "09-animatic")
        let closeAnimatic = app.buttons.matching(
            NSPredicate(format: "label == 'xmark' OR identifier == 'xmark'")).firstMatch
        if closeAnimatic.exists { closeAnimatic.tap() } else {
            app.images["xmark"].firstMatch.tap()
        }

        // ── 10: Review ──
        if app.staticTexts["Review"].firstMatch.waitForExistence(timeout: 5) {
            app.staticTexts["Review"].firstMatch.tap()
            Thread.sleep(forTimeInterval: 2)
            attach(app, "10-review")
            if app.buttons["Lukk"].firstMatch.exists { app.buttons["Lukk"].firstMatch.tap() }
            else { app.swipeDown() }
        }

        // ── 11: Fullskjerm tegnemodus ──
        let fullscreen = app.buttons["Fullskjerm tegning"].firstMatch
        if fullscreen.waitForExistence(timeout: 5) {
            fullscreen.tap()
            Thread.sleep(forTimeInterval: 2)
            attach(app, "11-fullskjerm")
            if app.buttons["Ferdig"].firstMatch.waitForExistence(timeout: 4) {
                app.buttons["Ferdig"].firstMatch.tap()
            }
        }

        attach(app, "12-slutt")
    }

    @MainActor
    private func attach(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
