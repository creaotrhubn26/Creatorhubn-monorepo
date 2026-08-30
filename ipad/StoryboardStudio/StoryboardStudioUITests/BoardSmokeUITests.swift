import XCTest

// Smoke: touch → strøk → UI-teller. Frikanvas er backend-uavhengig, så
// testen låser hele tegne-pipelinen (gesture → CanvasState → toolbar)
// uten nett. Board-flyten dekkes av idb-verifiseringene mot prod.
final class BoardSmokeUITests: XCTestCase {

    @MainActor
    func testFreeCanvasDrawIncrementsStrokeCount() throws {
        let app = XCUIApplication()
        app.launch()
        let undo = app.buttons["Angre"].firstMatch
        let redo = app.buttons["Gjenta"].firstMatch

        app.buttons["open-free-canvas"].tap()
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))

        // Tegn ett strøk midt på tegneflaten.
        XCTAssertTrue(undo.waitForExistence(timeout: 5))
        XCTAssertTrue(redo.exists)
        XCTAssertFalse(undo.isEnabled)
        XCTAssertFalse(redo.isEnabled)
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.4))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.65))
        start.press(forDuration: 0.1, thenDragTo: end)

        XCTAssertTrue(app.staticTexts["1 strøk"].waitForExistence(timeout: 5))

        // Undo tar den tilbake.
        undo.tap()
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))
        XCTAssertTrue(redo.isEnabled)

        // Redo må være en førsteklasses handling, ikke bare intern state.
        redo.tap()
        XCTAssertTrue(app.staticTexts["1 strøk"].waitForExistence(timeout: 5))
        XCTAssertTrue(undo.isEnabled)
    }
}
