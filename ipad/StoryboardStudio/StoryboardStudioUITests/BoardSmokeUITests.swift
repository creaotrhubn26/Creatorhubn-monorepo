import XCTest

// Smoke: touch → strøk → UI-teller. Frikanvas er backend-uavhengig, så
// testen låser hele tegne-pipelinen (gesture → CanvasState → toolbar)
// uten nett. Board-flyten dekkes av idb-verifiseringene mot prod.
final class BoardSmokeUITests: XCTestCase {

    @MainActor
    func testFreeCanvasDrawIncrementsStrokeCount() throws {
        let app = XCUIApplication()
        app.launch()

        app.staticTexts["Frikanvas"].tap()
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))

        // Tegn ett strøk midt på tegneflaten.
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.4))
        let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.65))
        start.press(forDuration: 0.1, thenDragTo: end)

        XCTAssertTrue(app.staticTexts["1 strøk"].waitForExistence(timeout: 5))

        // Undo tar den tilbake.
        app.buttons["Angre"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))
    }
}
