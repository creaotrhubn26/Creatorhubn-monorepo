import XCTest

// Visuell verifisering av Story Brush Engine: tegner med hver pensel i
// Frikanvas og legger ved skjermbilde (hentes ut av xcresult).
final class BrushEngineVisualTests: XCTestCase {

    /// Ett sammenhengende blocking-diagram for vendepunktet 42–48 sekunder i
    /// The Role Room-filmen: produksjonslederen åpner felles sannhet ved
    /// monitorplassen, mens kamera, lyd og lys allerede står i riktig rolle.
    /// Dette er en ekte canvas-komposisjon, ikke en kontaktark/grid-test.
    @MainActor
    func testComposeRoleRoomNinetySecondAdTurningPoint() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments += [
            "-rr.lastProjectId", "__ui_test_no_project__",
            "-rr.lastManuscriptId", "__ui_test_no_manuscript__",
        ]
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launch()

        let freeCanvasButton = app.buttons["open-free-canvas"]
        XCTAssertTrue(freeCanvasButton.waitForExistence(timeout: 5))
        freeCanvasButton.tap()
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))

        func selectBrush(_ name: String) {
            app.buttons["Penselvalg"].tap()
            let item = app.buttons[name].firstMatch
            let picker = app.scrollViews.firstMatch
            if !item.exists {
                for _ in 0..<12 {
                    guard picker.exists, !item.exists else { break }
                    picker.swipeUp()
                }
            }
            XCTAssertTrue(item.waitForExistence(timeout: 3), "fant ikke \(name)")
            item.tap()
        }

        func place(_ brush: String, at x: Double, _ y: Double) {
            selectBrush(brush)
            canvas.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)).tap()
        }

        // Artwork-lag: rom, crew, produksjonsleder, møbler og den fysiske
        // arbeidsflaten som det ekte Role Room-opptaket senere keyes inn i.
        place("Crowd Stamp", at: 0.46, 0.34)
        place("Window Stamp", at: 0.76, 0.34)
        place("Chair Stamp", at: 0.28, 0.69)
        place("Character Pose Stamp", at: 0.48, 0.57)
        place("Door Stamp", at: 0.88, 0.48)
        place("Table Stamp", at: 0.49, 0.76)

        // Produksjonsoverlays: kamera-, lyd- og lysplassering holdes separat
        // fra artwork i den lagdelte modellen.
        place("Camera Rig Stamp", at: 0.16, 0.67)
        place("Boom Mic Stamp", at: 0.62, 0.29)
        place("Film Light Stamp", at: 0.78, 0.59)

        // Felles sannhet: kontrollplass + fysisk kommunikasjonsprop. Selve
        // produkt-UI-en skal være ekte simulatoropptak, aldri stamp/AI-tekst.
        place("Workstation Stamp", at: 0.64, 0.70)
        place("Communication Prop Stamp", at: 0.54, 0.68)

        XCTAssertTrue(app.staticTexts["11 strøk"].waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "roleroom-90s-b08-stamp-scene"
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testPlaceAllProductionStamps() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-rr.lastProjectId", "__ui_test_no_project__",
            "-rr.lastManuscriptId", "__ui_test_no_manuscript__",
        ]
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launch()
        let freeCanvasButton = app.buttons["open-free-canvas"]
        XCTAssertTrue(freeCanvasButton.waitForExistence(timeout: 5))
        freeCanvasButton.tap()
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))

        func selectBrush(_ name: String) {
            app.buttons["Penselvalg"].tap()
            let item = app.buttons[name].firstMatch
            let picker = app.scrollViews.firstMatch
            if !item.exists {
                for _ in 0..<12 {
                    guard picker.exists, !item.exists else { break }
                    picker.swipeUp()
                }
            }
            XCTAssertTrue(item.waitForExistence(timeout: 3), "fant ikke \(name)")
            item.tap()
        }

        let stamps = [
            "Crowd Stamp", "Tree Stamp", "Window Stamp", "Car Stamp",
            "Chair Stamp", "Face Expression Stamp", "Hand Pose Stamp",
            "Camera Rig Stamp",
            "Character Pose Stamp", "Door Stamp", "Table Stamp", "Sofa Stamp",
            "Building Stamp", "Street Light Stamp", "Boom Mic Stamp",
            "Film Light Stamp",
            "Bed Stamp", "Staircase Stamp", "Counter Stamp",
            "Workstation Stamp", "Communication Prop Stamp", "Luggage Stamp",
            "Public Transport Stamp", "Animal Stamp", "Rock Terrain Stamp",
            "Water Stamp", "Fire / Smoke FX Stamp", "Weather FX Stamp",
        ]
        let positions: [CGVector] = stamps.indices.map { index in
            let column = index % 7
            let row = index / 7
            return .init(
                dx: 0.10 + Double(column) * (0.80 / 6),
                dy: 0.27 + Double(row) * 0.195)
        }
        for (index, stamp) in stamps.enumerated() {
            selectBrush(stamp)
            if stamp == "Car Stamp" {
                let inspector = app.buttons["Stamp Inspector"]
                XCTAssertTrue(inspector.waitForExistence(timeout: 3))
                inspector.tap()
                XCTAssertTrue(app.navigationBars["Pensel-editor"]
                    .waitForExistence(timeout: 3))
                XCTAssertTrue(app.buttons["Ferdig"].waitForExistence(timeout: 3))
                app.buttons["Ferdig"].tap()
                // Drag skal fortsatt gi ett logisk objekt og samtidig
                // bestemme skala + retning.
                let start = canvas.coordinate(
                    withNormalizedOffset: positions[index])
                let end = canvas.coordinate(
                    withNormalizedOffset: CGVector(
                        dx: positions[index].dx - 0.10,
                        dy: positions[index].dy + 0.05))
                start.press(forDuration: 0.1, thenDragTo: end)
            } else {
                canvas.coordinate(withNormalizedOffset: positions[index]).tap()
            }
        }

        XCTAssertTrue(app.staticTexts["28 strøk"].waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "all-production-stamps"
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testDrawWithProductionIntelligenceFamilies() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-rr.lastProjectId", "__ui_test_no_project__",
            "-rr.lastManuscriptId", "__ui_test_no_manuscript__",
        ]
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launch()
        let freeCanvasButton = app.buttons["open-free-canvas"]
        XCTAssertTrue(freeCanvasButton.waitForExistence(timeout: 5))
        freeCanvasButton.tap()
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))

        func selectBrush(_ name: String) {
            app.buttons["Penselvalg"].tap()
            let item = app.buttons[name].firstMatch
            let picker = app.scrollViews.firstMatch
            if !item.exists {
                for _ in 0..<12 {
                    guard picker.exists, !item.exists else { break }
                    picker.swipeUp()
                }
            }
            XCTAssertTrue(item.waitForExistence(timeout: 3), "fant ikke \(name)")
            item.tap()
        }

        func draw(row: Int) {
            let y = 0.31 + Double(row) * 0.105
            let start = canvas.coordinate(
                withNormalizedOffset: CGVector(dx: 0.78, dy: y))
            let end = canvas.coordinate(
                withNormalizedOffset: CGVector(dx: 0.26, dy: y + 0.025))
            start.press(forDuration: 0.1, thenDragTo: end)
        }

        let representatives = [
            "Gesture", "Focus", "Concrete / Rough Wall",
            "Rain / Wet Surface", "Face Detail", "Edge Detail",
        ]
        for (row, brush) in representatives.enumerated() {
            selectBrush(brush)
            draw(row: row)
        }

        XCTAssertTrue(app.staticTexts["6 strøk"].waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "production-intelligence-families"
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testDrawWithTraditionalStudioFamilies() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-rr.lastProjectId", "__ui_test_no_project__",
            "-rr.lastManuscriptId", "__ui_test_no_manuscript__",
        ]
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launch()
        let freeCanvasButton = app.buttons["open-free-canvas"]
        XCTAssertTrue(freeCanvasButton.waitForExistence(timeout: 5))
        freeCanvasButton.tap()
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))

        func selectBrush(_ name: String) {
            app.buttons["Penselvalg"].tap()
            let item = app.buttons[name].firstMatch
            let picker = app.scrollViews.firstMatch
            for _ in 0..<18 where !item.exists {
                guard picker.exists else { break }
                picker.swipeUp()
            }
            XCTAssertTrue(item.waitForExistence(timeout: 3), "fant ikke \(name)")
            item.tap()
        }

        func draw(row: Int) {
            let y = 0.27 + Double(row) * 0.085
            let start = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.76, dy: y))
            let end = canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: y + 0.025))
            start.press(forDuration: 0.1, thenDragTo: end)
        }

        let representatives = [
            "Sketch HB", "Color Soft", "Studio HB", "Vine Charcoal",
            "Rough Nib", "Dot Tone", "Comic Flat", "Stipple Fine",
        ]
        for (row, brush) in representatives.enumerated() {
            selectBrush(brush)
            draw(row: row)
        }

        XCTAssertTrue(app.staticTexts["8 strøk"].waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "traditional-studio-families"
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testDrawWithStoryBrushes() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-rr.lastProjectId", "__ui_test_no_project__",
            "-rr.lastManuscriptId", "__ui_test_no_manuscript__",
        ]
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launch()
        let freeCanvasButton = app.buttons["open-free-canvas"]
        XCTAssertTrue(freeCanvasButton.waitForExistence(timeout: 5))
        freeCanvasButton.tap()
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["0 strøk"].waitForExistence(timeout: 5))

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
            let picker = app.scrollViews.firstMatch
            for _ in 0..<10 where !item.exists {
                guard picker.exists else { break }
                picker.swipeUp()
            }
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
