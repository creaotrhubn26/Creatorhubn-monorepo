import XCTest

final class AIStoryboardStudioUITests: XCTestCase {
    @MainActor
    func testGenerateArtisticTrollStoryboardFromManuscript() throws {
        #if !TROLL_AI_GENERATE_E2E
        throw XCTSkip("Betalt TROLL-bilde krever kompilering med TROLL_AI_GENERATE_E2E")
        #endif

        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        XCTAssertTrue(openBoard.waitForExistence(timeout: 30), "TROLL-huben lastet ikke")
        dismissPushPrompt()
        openBoard.tap()

        let desiredShot = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "pulserende rute gjennom Dovrefjell"))
            .firstMatch
        XCTAssertTrue(desiredShot.waitForExistence(timeout: 20),
                      "Det eksisterende TROLL-shotet 3B mangler")
        desiredShot.tap()

        let aiStudio = app.buttons["Åpne AI Studio for aktivt shot"].firstMatch
        XCTAssertTrue(aiStudio.waitForExistence(timeout: 10))
        aiStudio.tap()

        XCTAssertTrue(app.staticTexts["AI Studio · Shot 3B"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Én kontekst for bilde og animasjon"].exists)
        XCTAssertTrue(app.staticTexts["AKTIVT SHOT 3B"].exists)
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "troll-omriss speiles"))
            .firstMatch.exists)

        let generate = app.buttons.matching(NSPredicate(
            format: "label == %@ OR label == %@",
            "Generer storyboard-bilde", "Lag ny versjon")).firstMatch
        XCTAssertTrue(generate.waitForExistence(timeout: 8), "Generer-knappen mangler")
        let scroll = app.scrollViews.element(boundBy: max(0, app.scrollViews.count - 1))
        for _ in 0..<5 where !generate.isHittable { scroll.swipeUp() }
        XCTAssertTrue(generate.isHittable, "Generer-knappen kunne ikke nås i AI Studio")
        generate.tap()

        let success = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Ny versjon er lagret på shot 3B"))
            .firstMatch
        XCTAssertTrue(success.waitForExistence(timeout: 150),
                      "Storyboard-bildet ble ikke ferdig generert og lagret")

        for _ in 0..<5 { scroll.swipeDown() }
        let studioScreenshot = XCTAttachment(screenshot: app.screenshot())
        studioScreenshot.name = "TROLL 3B — kunstnerisk storyboard fra manuskontekst"
        studioScreenshot.lifetime = .keepAlways
        add(studioScreenshot)

        app.buttons["Ferdig"].tap()
        XCTAssertTrue(aiStudio.waitForExistence(timeout: 8))
        let boardScreenshot = XCTAttachment(screenshot: app.screenshot())
        boardScreenshot.name = "TROLL 3B — AI-storyboard lagret i Board"
        boardScreenshot.lifetime = .keepAlways
        add(boardScreenshot)
    }

    @MainActor
    func testDrawCinematicTrollStoryboardAndSync() throws {
        #if !TROLL_DRAW_E2E
        throw XCTSkip("Produksjonstegning krever kompilering med TROLL_DRAW_E2E")
        #endif

        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        XCTAssertTrue(openBoard.waitForExistence(timeout: 30), "Troll-huben lastet ikke")
        let troll = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "TROLL")).firstMatch
        XCTAssertTrue(troll.waitForExistence(timeout: 5), "TROLL-prosjektet er ikke aktivt")
        openBoard.tap()

        let addShot = app.buttons["Add shot"].firstMatch
        XCTAssertTrue(addShot.waitForExistence(timeout: 20), "Boardet lastet ikke")
        let storyboardDescription = "Nora ser en pulserende rute gjennom Dovrefjell. Et mørkt troll-omriss speiles i vinduet bak henne."
        let existingShot = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "pulserende rute gjennom Dovrefjell"))
            .firstMatch
        if existingShot.waitForExistence(timeout: 4) {
            // Forrige kjøring opprettet metadata, men null strøk. Velg samme
            // blanke frame og fortsett — aldri lag duplikat ved retry.
            let blankFrame = app.staticTexts["Trykk for å tegne"].firstMatch
            XCTAssertTrue(blankFrame.waitForExistence(timeout: 5),
                          "Det eksisterende TROLL-shotet kunne ikke velges")
            blankFrame.tap()
        } else {
            addShot.tap()
            XCTAssertTrue(app.staticTexts["Shot lagt til ✓"].waitForExistence(timeout: 15),
                          "Det nye storyboard-shotet ble ikke opprettet")

            // Gjør shotet produksjonslesbart før vi tegner.
            let description = app.textFields["Hva skjer i shotet…"].firstMatch
            XCTAssertTrue(description.waitForExistence(timeout: 5))
            description.tap()
            description.typeText(storyboardDescription + "\n")
            if app.keyboards.count > 0 { app.keyboards.buttons["Return"].firstMatch.tap() }
            if app.buttons["OTS"].firstMatch.exists { app.buttons["OTS"].firstMatch.tap() }
            if app.buttons["Push In"].firstMatch.exists { app.buttons["Push In"].firstMatch.tap() }
        }

        // Inline-canvasen eier fingerdrag direkte. Fullskjerm-canvasen ligger
        // i en zoom-scrollview som XCUITest-drag ellers kan bli tolket av.
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 8), "Aktiv storyboard-canvas mangler")

        // Lys konstruksjon: monitor/vindu, skrivebord og ettpunktsdybde.
        selectBrush("Layout", in: app)
        drawLine(canvas, .init(dx: 0.08, dy: 0.10), .init(dx: 0.64, dy: 0.10))
        let firstStroke = app.staticTexts.matching(
            NSPredicate(format: "NOT (label == %@) AND label ENDSWITH %@", "0 strøk", "strøk"))
            .firstMatch
        guard firstStroke.waitForExistence(timeout: 5) else {
            XCTFail("Simulatorberøringen ble ikke registrert i inline-canvasen")
            return
        }
        polyline(canvas, [.init(dx: 0.08, dy: 0.10), .init(dx: 0.64, dy: 0.10),
                          .init(dx: 0.64, dy: 0.59), .init(dx: 0.08, dy: 0.59),
                          .init(dx: 0.08, dy: 0.10)])
        polyline(canvas, [.init(dx: 0.11, dy: 0.14), .init(dx: 0.61, dy: 0.14),
                          .init(dx: 0.61, dy: 0.55), .init(dx: 0.11, dy: 0.55),
                          .init(dx: 0.11, dy: 0.14)])
        drawLine(canvas, .init(dx: 0.03, dy: 0.69), .init(dx: 0.97, dy: 0.69))
        drawLine(canvas, .init(dx: 0.03, dy: 0.92), .init(dx: 0.97, dy: 0.92))
        drawLine(canvas, .init(dx: 0.03, dy: 0.69), .init(dx: 0.03, dy: 0.92))
        drawLine(canvas, .init(dx: 0.97, dy: 0.69), .init(dx: 0.97, dy: 0.92))
        for corner in [CGVector(dx: 0.02, dy: 0.03), .init(dx: 0.98, dy: 0.03),
                       .init(dx: 0.02, dy: 0.97), .init(dx: 0.98, dy: 0.97)] {
            drawLine(canvas, corner, .init(dx: 0.53, dy: 0.49))
        }
        drawLine(canvas, .init(dx: 0.32, dy: 0.59), .init(dx: 0.32, dy: 0.68))
        drawLine(canvas, .init(dx: 0.40, dy: 0.59), .init(dx: 0.40, dy: 0.68))
        drawLine(canvas, .init(dx: 0.27, dy: 0.68), .init(dx: 0.45, dy: 0.68))

        // Grafittone: Nora som tydelig mørk forgrunnsfigur og bordflate.
        selectBrush("Tone", in: app)
        for x in stride(from: 0.72, through: 0.88, by: 0.022) {
            drawLine(canvas, .init(dx: x, dy: 0.58), .init(dx: x + 0.01, dy: 0.93), duration: 0.06)
        }
        let headBands: [(Double, Double, Double)] = [
            (0.755, 0.855, 0.34), (0.735, 0.875, 0.37),
            (0.725, 0.885, 0.40), (0.725, 0.885, 0.43),
            (0.735, 0.875, 0.46), (0.755, 0.855, 0.49),
        ]
        for band in headBands {
            drawLine(canvas, .init(dx: band.0, dy: band.2),
                     .init(dx: band.1, dy: band.2), duration: 0.05)
        }
        for y in stride(from: 0.74, through: 0.90, by: 0.035) {
            drawLine(canvas, .init(dx: 0.03, dy: y), .init(dx: 0.69, dy: y), duration: 0.05)
        }

        // Myk skjermglød og romskygge gir tre tydelige dybdeplan.
        selectBrush("Skygge", in: app)
        for y in stride(from: 0.18, through: 0.50, by: 0.055) {
            drawLine(canvas, .init(dx: 0.13, dy: y), .init(dx: 0.59, dy: y), duration: 0.06)
        }
        for offset in stride(from: 0.0, through: 0.12, by: 0.03) {
            drawLine(canvas, .init(dx: 0.64, dy: 0.18 + offset),
                     .init(dx: 0.96, dy: 0.08 + offset), duration: 0.06)
        }

        // Ferdig tusjkontur: fjellkart, rute, karakterprofil og pekende arm.
        selectBrush("Tusj", in: app)
        polyline(canvas, [.init(dx: 0.12, dy: 0.50), .init(dx: 0.22, dy: 0.31),
                          .init(dx: 0.31, dy: 0.48), .init(dx: 0.43, dy: 0.25),
                          .init(dx: 0.59, dy: 0.50)])
        polyline(canvas, [.init(dx: 0.15, dy: 0.45), .init(dx: 0.27, dy: 0.40),
                          .init(dx: 0.38, dy: 0.43), .init(dx: 0.52, dy: 0.33)])
        // Hode i profil, 12 korte segmenter for en kontrollert kurve.
        let head: [CGVector] = [
            .init(dx: 0.79, dy: 0.32), .init(dx: 0.84, dy: 0.33),
            .init(dx: 0.88, dy: 0.36), .init(dx: 0.89, dy: 0.40),
            .init(dx: 0.87, dy: 0.42), .init(dx: 0.90, dy: 0.44),
            .init(dx: 0.86, dy: 0.46), .init(dx: 0.85, dy: 0.50),
            .init(dx: 0.80, dy: 0.52), .init(dx: 0.75, dy: 0.49),
            .init(dx: 0.72, dy: 0.44), .init(dx: 0.73, dy: 0.37),
            .init(dx: 0.79, dy: 0.32),
        ]
        polyline(canvas, head)
        polyline(canvas, [.init(dx: 0.74, dy: 0.51), .init(dx: 0.68, dy: 0.60),
                          .init(dx: 0.61, dy: 0.67)])
        polyline(canvas, [.init(dx: 0.86, dy: 0.51), .init(dx: 0.91, dy: 0.60),
                          .init(dx: 0.94, dy: 0.91)])
        polyline(canvas, [.init(dx: 0.72, dy: 0.59), .init(dx: 0.63, dy: 0.55),
                          .init(dx: 0.54, dy: 0.42), .init(dx: 0.50, dy: 0.40)])
        drawLine(canvas, .init(dx: 0.50, dy: 0.40), .init(dx: 0.52, dy: 0.38))
        drawLine(canvas, .init(dx: 0.50, dy: 0.40), .init(dx: 0.52, dy: 0.42))
        drawLine(canvas, .init(dx: 0.08, dy: 0.10), .init(dx: 0.64, dy: 0.10))
        drawLine(canvas, .init(dx: 0.64, dy: 0.10), .init(dx: 0.64, dy: 0.59))
        drawLine(canvas, .init(dx: 0.64, dy: 0.59), .init(dx: 0.08, dy: 0.59))
        drawLine(canvas, .init(dx: 0.08, dy: 0.59), .init(dx: 0.08, dy: 0.10))

        // Detaljer: kartmarkører, skjermgrafikk og et subtilt troll-speil.
        selectBrush("Detalj", in: app)
        for x in [0.18, 0.27, 0.38, 0.52] {
            drawLine(canvas, .init(dx: x - 0.012, dy: 0.40), .init(dx: x + 0.012, dy: 0.40))
            drawLine(canvas, .init(dx: x, dy: 0.385), .init(dx: x, dy: 0.415))
        }
        for y in [0.19, 0.23, 0.27] {
            drawLine(canvas, .init(dx: 0.14, dy: y), .init(dx: 0.28, dy: y))
        }
        drawLine(canvas, .init(dx: 0.83, dy: 0.39), .init(dx: 0.86, dy: 0.39))
        // Horn og skuldre som svakt motiv i skjermens mørke bakgrunn.
        polyline(canvas, [.init(dx: 0.47, dy: 0.20), .init(dx: 0.45, dy: 0.16),
                          .init(dx: 0.49, dy: 0.19), .init(dx: 0.52, dy: 0.15),
                          .init(dx: 0.51, dy: 0.21)])
        polyline(canvas, [.init(dx: 0.43, dy: 0.29), .init(dx: 0.47, dy: 0.23),
                          .init(dx: 0.51, dy: 0.23), .init(dx: 0.55, dy: 0.29)])

        let strokeCount = app.staticTexts.matching(
            NSPredicate(format: "label ENDSWITH %@", "strøk")).firstMatch
        XCTAssertTrue(strokeCount.waitForExistence(timeout: 5))
        XCTAssertNotEqual(strokeCount.label, "0 strøk")

        let drawing = XCTAttachment(screenshot: app.screenshot())
        drawing.name = "TROLL — nytt håndtegnet storyboard-shot"
        drawing.lifetime = .keepAlways
        add(drawing)

        let syncNow = app.buttons["Synk nå"].firstMatch
        if syncNow.waitForExistence(timeout: 5) { syncNow.tap() }
        XCTAssertTrue(app.staticTexts["Synket ✓"].waitForExistence(timeout: 15),
                      "Tegningen ble ikke bekreftet lagret i Role Room")
        let synced = XCTAttachment(screenshot: app.screenshot())
        synced.name = "TROLL — storyboard synket til Role Room"
        synced.lifetime = .keepAlways
        add(synced)
    }

    @MainActor
    func testAIStudioOpensForActiveShotWithoutGenerating() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let environment = ProcessInfo.processInfo.environment
        let app = XCUIApplication()
        // CI kan injisere token. Lokal simulator kan gjenbruke den ekte
        // Role Room-sesjonen i Keychain, slik at vi tester samme flyt som
        // brukeren ser uten å kopiere hemmeligheter inn i testloggen.
        if let token = environment["SB_E2E_TOKEN"], !token.isEmpty {
            app.launchEnvironment["SB_TOKEN"] = token
            app.launchEnvironment["SB_SERVER"] = environment["SB_E2E_SERVER"]
                ?? "https://theroleroom.com"
        }
        app.launch()

        let hub = app.buttons["Åpne board"].firstMatch
        XCTAssertTrue(
            hub.waitForExistence(timeout: 30),
            "Role Room-økten mangler eller prosjekt-huben kunne ikke lastes")
        dismissPushPrompt()
        if let expectedProject = environment["SB_E2E_PROJECT"], !expectedProject.isEmpty {
            let project = app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] %@", expectedProject)).firstMatch
            XCTAssertTrue(project.waitForExistence(timeout: 5),
                          "Forventet prosjekt \(expectedProject) ble ikke åpnet")
        }
        if hub.waitForExistence(timeout: 10) { hub.tap() }

        let aiStudio = app.buttons["Åpne AI Studio for aktivt shot"].firstMatch
        XCTAssertTrue(aiStudio.waitForExistence(timeout: 15), "AI Studio mangler i Board-topbaren")
        aiStudio.tap()

        XCTAssertTrue(app.staticTexts["Regissørens intensjon"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.otherElements["storyboard.ai.context.panel"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Én kontekst for bilde og animasjon"].exists)
        XCTAssertTrue(app.staticTexts["Koblet til bilde"].exists)
        XCTAssertTrue(app.staticTexts["Koblet til animasjon"].exists)

        let promptInspector = app.buttons["Prompt Inspector"].firstMatch
        XCTAssertTrue(promptInspector.waitForExistence(timeout: 8),
                      "Prompt Inspector mangler i AI Studio")
        promptInspector.tap()
        XCTAssertTrue(app.navigationBars["Prompt Inspector"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Preflight valid"].waitForExistence(timeout: 20),
                      "Produksjonskonteksten ble ikke kompilert av Prompt Engine")
        XCTAssertTrue(app.staticTexts["FINAL COMPILED PROMPT"].exists)

        let inspectorScreenshot = XCTAttachment(screenshot: app.screenshot())
        inspectorScreenshot.name = "TROLL — live Prompt Inspector"
        inspectorScreenshot.lifetime = .keepAlways
        add(inspectorScreenshot)
        app.buttons["Ferdig"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Regissørens intensjon"].waitForExistence(timeout: 5))

        let contextScreenshot = XCTAttachment(screenshot: app.screenshot())
        contextScreenshot.name = "TROLL — Shot Context v1"
        contextScreenshot.lifetime = .keepAlways
        add(contextScreenshot)

        for _ in 0..<4 where !app.staticTexts["Visuell stil"].exists { app.swipeUp() }
        XCTAssertTrue(app.staticTexts["Visuell stil"].waitForExistence(timeout: 5))

        for _ in 0..<5 where !app.staticTexts["Animer shot"].exists { app.swipeUp() }
        XCTAssertTrue(app.staticTexts["Animer shot"].waitForExistence(timeout: 8))
        let autoModel = app.buttons["Auto · billigst"]
        if autoModel.waitForExistence(timeout: 12) {
            XCTAssertTrue(app.buttons["Animer med billigste modell"].exists,
                          "AI-video-handlingen mangler")
        } else {
            let gracefulError = app.staticTexts.matching(NSPredicate(
                format: "label CONTAINS[c] %@ OR label CONTAINS[c] %@",
                "AI-oppsettet kunne ikke lastes", "AI-video er ikke aktivert"))
                .firstMatch
            XCTAssertTrue(gracefulError.exists,
                          "Udeployet videokonfigurasjon må gi en synlig, trygg feiltilstand")
        }

        let videoScreenshot = XCTAttachment(screenshot: app.screenshot())
        videoScreenshot.name = "TROLL — AI Studio og AI-video"
        videoScreenshot.lifetime = .keepAlways
        add(videoScreenshot)

        // Bevisst ingen generering: UI-smoken skal aldri bruke modellkreditt.
        app.buttons["Ferdig"].tap()
        XCTAssertTrue(aiStudio.waitForExistence(timeout: 5))
    }

    @MainActor
    private func dismissPushPrompt() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.alerts.buttons["Allow"].firstMatch
        if allow.waitForExistence(timeout: 3) { allow.tap() }
    }

    @MainActor
    private func selectBrush(_ name: String, in app: XCUIApplication,
                             file: StaticString = #filePath, line: UInt = #line) {
        let picker = app.buttons["Penselvalg"].firstMatch
        XCTAssertTrue(picker.waitForExistence(timeout: 5), file: file, line: line)
        picker.tap()
        let option = app.buttons[name].firstMatch
        XCTAssertTrue(option.waitForExistence(timeout: 5),
                      "Penselen \(name) mangler", file: file, line: line)
        option.tap()
    }

    @MainActor
    private func drawLine(_ canvas: XCUIElement, _ start: CGVector, _ end: CGVector,
                          duration: TimeInterval = 0.08) {
        canvas.coordinate(withNormalizedOffset: start)
            .press(forDuration: 0.02,
                   thenDragTo: canvas.coordinate(withNormalizedOffset: end),
                   withVelocity: .fast,
                   thenHoldForDuration: duration)
    }

    @MainActor
    private func polyline(_ canvas: XCUIElement, _ points: [CGVector]) {
        guard points.count > 1 else { return }
        for index in 0..<(points.count - 1) {
            drawLine(canvas, points[index], points[index + 1], duration: 0.04)
        }
    }
}
