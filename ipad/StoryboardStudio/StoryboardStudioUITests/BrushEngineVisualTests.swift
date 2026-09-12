import XCTest

// Visuell verifisering av Story Brush Engine: tegner med hver pensel i
// Frikanvas og legger ved skjermbilde (hentes ut av xcresult).
final class BrushEngineVisualTests: XCTestCase {

    @MainActor
    func testDrawWithStoryBrushes() throws {
        let app = XCUIApplication()
        app.launch()
        app.staticTexts["Frikanvas"].tap()
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))

        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))

        func draw(fromY: Double, toY: Double) {
            // Høyre → venstre: venstre→høyre-drag tolkes som back-gesture
            // på iPad (interactive pop) og popper Frikanvas.
            let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: fromY))
            let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.28, dy: toY))
            start.press(forDuration: 0.1, thenDragTo: end)
        }

        func selectBrush(_ name: String) {
            app.buttons["Penselvalg"].tap()
            let item = app.buttons[name].firstMatch
            XCTAssertTrue(item.waitForExistence(timeout: 3), "fant ikke \(name)")
            item.tap()
        }

        // Story Pencil er default. (Øvre ~25 % av canvasen kolliderer med
        // navbar-gesten i testmiljøet — tegn i midt/nedre region.)
        draw(fromY: 0.30, toY: 0.33)
        XCTAssertTrue(app.staticTexts["1 strøk"].waitForExistence(timeout: 5), "første strøk mangler")
        selectBrush("Heavy")
        draw(fromY: 0.39, toY: 0.42)
        selectBrush("Detalj")
        draw(fromY: 0.48, toY: 0.50)
        selectBrush("Skraver")
        draw(fromY: 0.57, toY: 0.60)
        selectBrush("Kryss")
        draw(fromY: 0.67, toY: 0.70)
        selectBrush("Skygge")
        draw(fromY: 0.77, toY: 0.81)
        selectBrush("Korn")
        draw(fromY: 0.88, toY: 0.91)
        // Miljøpenslene (fase 2) — egne baner i høyre halvdel
        func drawRight(fromY: Double, toY: Double) {
            let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: fromY))
            let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: toY))
            start.press(forDuration: 0.1, thenDragTo: end)
        }
        selectBrush("Skog")
        drawRight(fromY: 0.30, toY: 0.32)
        selectBrush("Bunn")
        drawRight(fromY: 0.45, toY: 0.47)
        selectBrush("Bark")
        drawRight(fromY: 0.60, toY: 0.62)
        selectBrush("Pels")
        drawRight(fromY: 0.75, toY: 0.77)

        XCTAssertTrue(app.staticTexts["11 strøk"].waitForExistence(timeout: 5))

        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "story-brushes"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
