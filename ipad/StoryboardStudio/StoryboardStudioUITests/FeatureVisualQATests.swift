import XCTest

// Visuell QA av runde-4-features på ekte board (prod-backend via
// SIMCTL_CHILD_SB_TOKEN): perspektiv-overlay og onion-skin slås på og
// dokumenteres som screenshot-attachments. Verifisering = se på bildene
// via `xcrun xcresulttool export attachments`.
final class FeatureVisualQATests: XCTestCase {

    private func requiredLiveToken() throws -> String {
        guard let token = ProcessInfo.processInfo.environment["SB_E2E_TOKEN"]?
            .trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
            throw XCTSkip("krever SB_E2E_TOKEN fra lokal/CI secret store")
        }
        return token
    }

    /// Camera metadata must be operational, not decorative: selecting CU
    /// changes the actual Metal viewport while keeping the source editable.
    @MainActor
    func testShotSizeChangesCanvasAndOpensManualFraming() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15))
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10))
        let before = canvas.screenshot().pngRepresentation

        let closeUp = app.buttons["CU"].firstMatch
        XCTAssertTrue(closeUp.waitForExistence(timeout: 5), "CU-valget mangler")
        closeUp.tap()
        // A combined SwiftUI accessibility element may bridge as either
        // `other` or `staticText` depending on the active iOS runtime.
        let framingStatus = app.descendants(matching: .any)
            .matching(identifier: "shot-framing-status").firstMatch
        XCTAssertTrue(framingStatus.waitForExistence(timeout: 5),
                      "framing-status mangler")
        XCTAssertFalse(framingStatus.label.contains("1.00×")
            || framingStatus.label.contains("1,00×"),
                       "CU brukte fortsatt identity-viewport: \(framingStatus.label)")
        let qualityOK = app.descendants(matching: .any)
            .matching(identifier: "shot-framing-quality-ok").firstMatch
        let qualityIssues = app.descendants(matching: .any)
            .matching(identifier: "shot-framing-quality-issues").firstMatch
        XCTAssertTrue(qualityOK.waitForExistence(timeout: 2)
            || qualityIssues.waitForExistence(timeout: 2),
            "Inspector viser ikke produksjonskontroll av utsnittet")
        let after = canvas.screenshot().pngRepresentation
        XCTAssertNotEqual(before, after, "Shot size endret bare metadata, ikke bildet")

        let angleMenu = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Angle:'")).firstMatch
        XCTAssertTrue(angleMenu.waitForExistence(timeout: 5), "Angle-kontrollen mangler")
        angleMenu.tap()
        let dutch = app.buttons["Dutch"].firstMatch
        XCTAssertTrue(dutch.waitForExistence(timeout: 3), "Dutch-valget mangler")
        dutch.tap()
        let dutchExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(
                format: "label CONTAINS '8.0°' OR label CONTAINS '8,0°'"),
            object: framingStatus)
        XCTAssertEqual(XCTWaiter.wait(for: [dutchExpectation], timeout: 5), .completed,
                       "Dutch oppdaterte ikke faktisk kamerarull")
        let afterDutch = canvas.screenshot().pngRepresentation
        XCTAssertNotEqual(after, afterDutch,
                          "Dutch endret bare metadata, ikke Metal-viewporten")

        let lensMenu = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Lens:'")).firstMatch
        XCTAssertTrue(lensMenu.waitForExistence(timeout: 5), "Lens-kontrollen mangler")
        lensMenu.tap()
        let telephoto = app.buttons["85mm"].firstMatch
        XCTAssertTrue(telephoto.waitForExistence(timeout: 3), "85mm-valget mangler")
        telephoto.tap()
        let afterLens = canvas.screenshot().pngRepresentation
        XCTAssertNotEqual(afterDutch, afterLens,
                          "Objektivbyttet endret bare metadata, ikke utsnittet")

        let inspector = app.descendants(matching: .any)
            .matching(identifier: "storyboard-inspector-v2").firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 5), "Inspector mangler")
        let adjustFraming = revealInspectorElement(
            app.buttons["adjust-shot-framing"].firstMatch,
            in: inspector,
            app: app)
        XCTAssertTrue(adjustFraming.isHittable,
                      "Juster utsnitt er ikke tilgjengelig i Inspector")
        adjustFraming.tap()
        let overlay = app.descendants(matching: .any)["shot-framing-overlay"]
        let finishFraming = app.buttons["finish-shot-framing"].firstMatch
        XCTAssertTrue(overlay.waitForExistence(timeout: 2)
            || finishFraming.waitForExistence(timeout: 3),
            "manuell framing-overlay åpnet ikke")
        attachShot(app, name: "shot-framing-cu-manual-overlay")
    }

    /// Aspect is part of the live viewport contract, not only persisted shot
    /// metadata. The Metal surface itself must become a 2.39:1 canvas.
    @MainActor
    func testCinematicAspectChangesActualCanvasViewport() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15), "lokalt produksjonsboard åpnet ikke")
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), "Metal-canvas mangler")
        let beforeFrame = canvas.frame
        let beforePixels = canvas.screenshot().pngRepresentation
        XCTAssertEqual(canvasAspect(beforeFrame), 16.0 / 9.0, accuracy: 0.08,
                       "sample-canvas startet ikke i 16:9")

        let inspector = app.descendants(matching: .any)
            .matching(identifier: "storyboard-inspector-v2").firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 5), "Inspector mangler")
        let cinematic = revealInspectorButton("2.39:1", in: inspector, app: app)
        XCTAssertTrue(cinematic.isHittable, "2.39:1 er ikke tilgjengelig i Inspector")
        cinematic.tap()

        let cinematicFrame = try XCTUnwrap(
            waitForCanvasAspect(canvas, expected: 2.39),
            "Metal-canvas fikk ikke faktisk 2.39:1-geometri"
        )
        XCTAssertLessThan(cinematicFrame.height, beforeFrame.height,
                          "2.39:1 endret bare metadata, ikke viewport-høyden")
        XCTAssertNotEqual(beforePixels, canvas.screenshot().pngRepresentation,
                          "2.39:1 endret ikke den rendrerte canvas-flaten")
        attachShot(app, name: "shot-framing-aspect-239-live-viewport")
    }

    /// Deterministic visual gate for the complete native production surface.
    /// It uses synthetic shots and never reads private Role Room data.
    @MainActor
    func testLocalSampleBoardProductionHealthUX() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15), "lokalt produksjonsboard åpnet ikke")
        XCTAssertTrue(app.otherElements["tegneflate"].firstMatch
            .waitForExistence(timeout: 15), "Metal-canvas mangler")
        let inspectorTabs = app.segmentedControls.firstMatch
        XCTAssertTrue(inspectorTabs
            .waitForExistence(timeout: 5), "Inspector v2 mangler")
        XCTAssertTrue(app.staticTexts["SHOT SIZE"].firstMatch.exists,
                      "Shot skal være standardfanen")
        XCTAssertFalse(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'scener ikke lastet'"))
            .firstMatch.exists, "lokal demo forsøkte feilaktig serversynk")
        attachShot(app, name: "inspector-v2-shot")

        inspectorTabs.buttons["Story"].tap()
        XCTAssertTrue(app.staticTexts["ACTION / DIALOG"].firstMatch
            .waitForExistence(timeout: 5), "Story-fanen mangler")
        attachShot(app, name: "inspector-v2-story")

        inspectorTabs.buttons["AI"].tap()
        XCTAssertTrue(app.staticTexts["AI PIPELINE"].firstMatch
            .waitForExistence(timeout: 5), "AI-fanen mangler")
        XCTAssertTrue(app.buttons["Generate AI Color"].firstMatch.exists,
                      "kontekstavhengig AI-hovedhandling mangler")
        attachShot(app, name: "inspector-v2-ai")

        inspectorTabs.buttons["Produksjon"].tap()
        XCTAssertTrue(app.staticTexts["PRODUCTION READY"].firstMatch
            .waitForExistence(timeout: 5),
                      "production readiness mangler i produksjonsfanen")
        attachShot(app, name: "inspector-v2-production")

        let health = app.buttons["Åpne Production Health"].firstMatch
        XCTAssertTrue(health.waitForExistence(timeout: 5), "Production Health-handling mangler")
        health.tap()
        XCTAssertTrue(app.navigationBars["Production Health"].firstMatch
            .waitForExistence(timeout: 10), "Production Health åpnet ikke")
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] '8 shots'"))
            .firstMatch.exists, "coverage-oppsummeringen mangler")
        attachShot(app, name: "local-production-health-coverage")

        app.buttons["Continuity"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'Continuity-locks'"))
            .firstMatch.waitForExistence(timeout: 5), "continuity-avvik mangler")
        attachShot(app, name: "local-production-health-continuity")

        app.buttons["Visual Arc"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["INT. WRITER'S STUDIO — MORNING"].firstMatch
            .waitForExistence(timeout: 5), "Visual Arc mangler scener")
        attachShot(app, name: "local-production-health-visual-arc")
    }

    /// Deterministic smoke test for the transactional Start / End editor.
    /// The local sample board avoids auth, network and production mutations.
    @MainActor
    func testCameraMotionStartEndEditorPushInFrameStepAndCancel() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launchEnvironment["SB_UI_TEST_INSPECTOR_TAB"] = "Shot"
        app.launch()

        let sampleBoard = app.otherElements["sample-production-board"]
        XCTAssertTrue(sampleBoard.waitForExistence(timeout: 15),
                      "lokalt produksjonsboard åpnet ikke")
        XCTAssertTrue(app.staticTexts["SHOT 1A"].firstMatch
            .waitForExistence(timeout: 5), "sample-shot 1A er ikke aktivt")

        let inspector = app.descendants(matching: .any)
            .matching(identifier: "storyboard-inspector-v2").firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 5), "Inspector mangler")
        let openEditor = revealInspectorElement(
            app.buttons["open-camera-motion-editor"].firstMatch,
            in: inspector,
            app: app)
        XCTAssertTrue(openEditor.isHittable,
                      "Movement sin Start / End-editor er ikke tilgjengelig")
        openEditor.tap()

        let stage = app.descendants(matching: .any)
            .matching(identifier: "camera-motion.stage").firstMatch
        let start = app.buttons["camera-motion.endpoint.start"].firstMatch
        let end = app.buttons["camera-motion.endpoint.end"].firstMatch
        let save = app.buttons["camera-motion.save"].firstMatch
        XCTAssertTrue(stage.waitForExistence(timeout: 5),
                      "kamera-preview åpnet ikke")
        XCTAssertTrue(start.waitForExistence(timeout: 5),
                      "Start-posen mangler")
        XCTAssertTrue(end.waitForExistence(timeout: 5),
                      "End-posen mangler")
        XCTAssertTrue(save.waitForExistence(timeout: 5),
                      "Save-handlingen mangler")

        let pushIn = app.buttons["camera-motion.preset.push-in"].firstMatch
        XCTAssertTrue(pushIn.waitForExistence(timeout: 5),
                      "Push in-preset mangler")
        pushIn.tap()
        XCTAssertTrue(pushIn.isSelected, "Push in ble ikke valgt")

        end.tap()
        XCTAssertTrue(end.isSelected, "End-posen ble ikke valgt")
        XCTAssertTrue(save.isEnabled, "gyldig Push in kan ikke lagres")

        let frameAtEnd = try XCTUnwrap(stage.value as? String,
                                      "preview mangler frame-status")
        let previousFrame = app.buttons["camera-motion.previous-frame"].firstMatch
        XCTAssertTrue(previousFrame.waitForExistence(timeout: 5),
                      "forrige frame-handling mangler")
        previousFrame.tap()
        let frameStepExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value != %@", frameAtEnd),
            object: stage)
        XCTAssertEqual(
            XCTWaiter.wait(for: [frameStepExpectation], timeout: 5),
            .completed,
            "frame-step flyttet ikke kamera-preview fra End"
        )

        attachShot(app, name: "camera-motion-push-in-end-frame-step")

        let cancel = app.buttons["camera-motion.cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 5),
                      "Cancel-handlingen mangler")
        cancel.tap()
        XCTAssertTrue(stage.waitForNonExistence(timeout: 5),
                      "Start / End-editor lukket ikke ved Cancel")
        XCTAssertTrue(sampleBoard.exists,
                      "Cancel returnerte ikke til sample-boardet")
    }

    /// Full-shot Perform is local and transactional: a take is recorded with
    /// direct manipulation, reduced to generated keys, reviewed, then
    /// cancelled back to the exact pre-take editor draft.
    @MainActor
    func testCameraMotionPerformStopReviewMarkersAndCancelTake() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launchEnvironment["SB_UI_TEST_INSPECTOR_TAB"] = "Shot"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15),
            "lokalt produksjonsboard åpnet ikke")
        let inspector = app.descendants(matching: .any)
            .matching(identifier: "storyboard-inspector-v2").firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 5),
                      "Inspector mangler")
        let openEditor = revealInspectorElement(
            app.buttons["open-camera-motion-editor"].firstMatch,
            in: inspector,
            app: app)
        XCTAssertTrue(openEditor.isHittable,
                      "Movement-editoren er ikke tilgjengelig")
        openEditor.tap()

        let stage = app.descendants(matching: .any)
            .matching(identifier: "camera-motion.stage").firstMatch
        let perform = app.buttons["camera-motion.perform"].firstMatch
        let save = app.buttons["camera-motion.save"].firstMatch
        let editorCancel = app.buttons["camera-motion.cancel"].firstMatch
        XCTAssertTrue(stage.waitForExistence(timeout: 5),
                      "kamera-preview åpnet ikke")
        XCTAssertTrue(perform.waitForExistence(timeout: 5),
                      "Perform-handlingen mangler")
        XCTAssertTrue(save.exists && editorCancel.exists,
                      "adaptive header skjuler Save eller Cancel")
        XCTAssertTrue(save.isHittable && editorCancel.isHittable,
                      "Save og Cancel er ikke tilgjengelige i editor-headeren")
        perform.tap()

        let replace = app.buttons["Replace and record"].firstMatch
        if replace.exists { replace.tap() }

        let stop = app.buttons["camera-motion.perform-stop"].firstMatch
        let cancelTake = app.buttons["camera-motion.perform-cancel"].firstMatch
        XCTAssertTrue(stop.exists,
                      "Perform gikk ikke til Recording")

        // Manipulate immediately: the sample shot is deliberately short and
        // the recording clock starts when Perform is tapped.
        stage.pinch(withScale: 1.18, velocity: 2)

        XCTAssertTrue(stop.isHittable && cancelTake.isHittable,
                      "Stop eller Cancel Take er ikke trykkbar")
        XCTAssertFalse(save.isEnabled,
                       "Save skal være låst mens opptaket pågår")
        stop.tap()

        let review = app.descendants(matching: .any)
            .matching(identifier: "camera-motion.perform-review")
            .firstMatch
        let markers = app.descendants(matching: .any)
            .matching(identifier: "camera-motion.perform-markers")
            .firstMatch
        XCTAssertTrue(review.waitForExistence(timeout: 5),
                      "Stop gikk ikke til Review")
        XCTAssertTrue(markers.waitForExistence(timeout: 5),
                      "Start/key/End-markørene mangler i Review")
        XCTAssertTrue(String(describing: markers.value).contains("generated"),
                      "markørstripen oppgir ikke antall genererte nøkler")
        XCTAssertTrue(save.isEnabled,
                      "gyldig performed track kan ikke lagres")
        XCTAssertTrue(save.isHittable && editorCancel.isHittable,
                      "header-handlingene ble borte i Review")

        let reviewCancelTake = app.buttons[
            "camera-motion.perform-cancel"].firstMatch
        let motionInspector = app.scrollViews[
            "camera-motion.inspector"].firstMatch
        for _ in 0..<4 where !reviewCancelTake.isHittable {
            let surface = motionInspector.exists ? motionInspector : app
            let start = surface.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
            let end = surface.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.52))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(reviewCancelTake.isHittable,
                      "Cancel Take mangler i Review")
        attachShot(app, name: "camera-motion-perform-review-markers")
        reviewCancelTake.tap()
        XCTAssertTrue(perform.waitForExistence(timeout: 5),
                      "Cancel Take gjenopprettet ikke pre-take draft")

        editorCancel.tap()
        XCTAssertTrue(stage.waitForNonExistence(timeout: 5),
                      "editor Cancel lukket ikke Perform-editoren")
    }

    /// Stage Manager / smal vindusflate bruker sheet i stedet for å klemme
    /// en 340pt Inspector inn ved siden av canvas og sceneliste.
    @MainActor
    func testCompactWorkspacePresentsAdaptiveInspectorSheet() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_COMPACT_WORKSPACE"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15), "lokalt produksjonsboard åpnet ikke")
        let openInspector = app.buttons["open-adaptive-inspector"].firstMatch
        XCTAssertTrue(openInspector.waitForExistence(timeout: 5),
                      "adaptiv Inspector-knapp mangler")
        openInspector.tap()
        XCTAssertTrue(app.buttons["Ferdig"].firstMatch
            .waitForExistence(timeout: 5), "Inspector-sheet åpnet ikke")
        XCTAssertTrue(app.segmentedControls.firstMatch.exists,
                      "Inspector-sheet kan ikke lukkes")
        attachShot(app, name: "inspector-v2-stage-manager-sheet")
    }

    /// The adaptive Inspector must expose portrait delivery formats without
    /// hiding the control or leaving the underlying canvas in landscape.
    @MainActor
    func testCompactInspectorAppliesVisibleVerticalCanvasViewport() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_UI_TEST_SAMPLE_BOARD"] = "1"
        app.launchEnvironment["SB_UI_TEST_DISABLE_KEYCHAIN"] = "1"
        app.launchEnvironment["SB_UI_TEST_COMPACT_WORKSPACE"] = "1"
        app.launch()

        XCTAssertTrue(app.otherElements["sample-production-board"]
            .waitForExistence(timeout: 15), "lokalt produksjonsboard åpnet ikke")
        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 10), "Metal-canvas mangler")
        let beforeFrame = canvas.frame

        let openInspector = app.buttons["open-adaptive-inspector"].firstMatch
        XCTAssertTrue(openInspector.waitForExistence(timeout: 5),
                      "adaptiv Inspector-knapp mangler")
        openInspector.tap()
        let done = app.buttons["Ferdig"].firstMatch
        XCTAssertTrue(done.waitForExistence(timeout: 5), "Inspector-sheet åpnet ikke")
        let inspector = app.descendants(matching: .any)
            .matching(identifier: "storyboard-inspector-v2").firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 5), "Inspector-innhold mangler")
        let vertical = revealInspectorButton("9:16", in: inspector, app: app)
        XCTAssertTrue(vertical.isHittable,
                      "9:16-kontrollen er skjult i kompakt Inspector")
        vertical.tap()
        done.tap()

        let verticalFrame = try XCTUnwrap(
            waitForCanvasAspect(canvas, expected: 9.0 / 16.0),
            "canvas beholdt landskapsgeometri etter 9:16"
        )
        XCTAssertGreaterThan(verticalFrame.height, beforeFrame.height,
                             "9:16 endret bare metadata, ikke viewport-høyden")
        XCTAssertTrue(verticalFrame.intersects(app.frame),
                      "9:16-canvas er ikke synlig i kompakt workspace")
        XCTAssertGreaterThan(verticalFrame.width, 44,
                             "9:16-canvas kollapset under minimum trykkflate")
        attachShot(app, name: "inspector-compact-aspect-vertical-live-viewport")
    }

    /// Kostnadsfri kontraktstest av den genererte pipelinen. Den åpner bare
    /// bekreftelsesgaten og avbryter før OpenAI-kallet; ingen strøk, bilder,
    /// prosjektdata eller provider-credits endres.
    @MainActor
    func testAIColorAtmospherePipelineRequiresConfirmationWithoutSpending() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launchEnvironment["SB_UI_TEST_FORCE_DOCKED_INSPECTOR"] = "1"
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        guard openBoard.waitForExistence(timeout: 30) else {
            throw XCTSkip("live testkonto/prosjekt er ikke tilgjengelig")
        }
        dismissPushPrompt()
        openBoard.tap()

        let canvas = app.otherElements["tegneflate"].firstMatch
        XCTAssertTrue(canvas.waitForExistence(timeout: 20), "board/canvas åpnet ikke")
        app.segmentedControls.firstMatch.buttons["AI"].tap()
        let color = app.buttons["ai-primary-action"].firstMatch
        XCTAssertTrue(color.waitForExistence(timeout: 10), "AI-hovedhandling mangler")
        guard color.label.localizedCaseInsensitiveContains("Generate AI Color") else {
            throw XCTSkip("testshotet har allerede en senere AI-pipeline-status")
        }

        color.tap()
        XCTAssertTrue(app.buttons["Generer med GPT Image 2 · HD"].firstMatch
            .waitForExistence(timeout: 5), "kostnadsgaten åpnet ikke")
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'Originaltegningen blir ikke overskrevet'"))
            .firstMatch.exists, "immutable Pencil-kontrakten mangler")
        attachShot(app, name: "ai-pencil-color-atmosphere-confirmation-no-spend")
    }

    /// Opt-in og betalbar ende-til-ende-test. Den tegner ingenting og kan
    /// bare sende kilden som nettopp har bestått serverens fingerprint- og
    /// prisgate. Ordinære testkjøringer hopper alltid over denne metoden.
    @MainActor
    func testLivePaidHiggsfieldSubmitUsesConfirmedPreflight() throws {
        guard ProcessInfo.processInfo.environment["SB_PAID_HIGGSFIELD_TEST"] == "1" else {
            throw XCTSkip("krever eksplisitt SB_PAID_HIGGSFIELD_TEST=1")
        }
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        guard openBoard.waitForExistence(timeout: 30) else {
            throw XCTSkip("live testkonto/prosjekt er ikke tilgjengelig")
        }
        dismissPushPrompt()
        openBoard.tap()
        XCTAssertTrue(app.otherElements["tegneflate"].firstMatch
            .waitForExistence(timeout: 20), "board/canvas åpnet ikke")

        let modelMenu = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Seedance'")) .firstMatch
        XCTAssertTrue(modelMenu.waitForExistence(timeout: 15),
                      "videomodellvelgeren mangler")
        modelMenu.tap()
        let higgsfield = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Higgsfield'")) .firstMatch
        XCTAssertTrue(higgsfield.waitForExistence(timeout: 10),
                      "Higgsfield mangler i modellmenyen")
        higgsfield.tap()
        app.buttons["Animate approved"].firstMatch.tap()

        let consent = app.alerts["Tillat AI for prosjektet?"].firstMatch
        if consent.waitForExistence(timeout: 4) {
            consent.buttons["Tillat og animer"].tap()
        }

        let paidStart = app.buttons["Bekreft og start animasjon"].firstMatch
        XCTAssertTrue(paidStart.waitForExistence(timeout: 45),
                      "bekreftet Higgsfield-preflight åpnet ikke")
        XCTAssertTrue(app.descendants(matching: .any).matching(
            NSPredicate(format: "label BEGINSWITH 'Autoritativ kostnad'"))
            .firstMatch.exists, "autoritativ kostnad mangler")
        attachShot(app, name: "live-higgsfield-paid-source-confirmed")

        paidStart.tap()
        let completed = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'Animert shot klart'")) .firstMatch
        XCTAssertTrue(completed.waitForExistence(timeout: 420),
                      "Higgsfield-jobben fullførte ikke i testvinduet")
        attachShot(app, name: "live-higgsfield-paid-job-completed")
    }

    /// Kostnadsfri kontrakttest for Pencil → AI Color → AI Atmosphere →
    /// Animate approved. Den inspiserer bare kontrollene og starter ingen
    /// leverandørkall eller prosjektmutasjon.
    @MainActor
    func testAnimationRequiresApprovedGeneratedImageStage() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
        app.launchEnvironment["SB_SERVER"] = "https://theroleroom.com"
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        guard openBoard.waitForExistence(timeout: 30) else {
            throw XCTSkip("live testkonto/prosjekt er ikke tilgjengelig")
        }
        dismissPushPrompt()
        openBoard.tap()
        XCTAssertTrue(app.otherElements["tegneflate"].firstMatch
            .waitForExistence(timeout: 20), "board/canvas åpnet ikke")

        XCTAssertTrue(app.buttons["generate-ai-color"].firstMatch
            .waitForExistence(timeout: 15), "AI Color-stadiet mangler")
        XCTAssertTrue(app.buttons["generate-ai-atmosphere"].firstMatch.exists,
                      "AI Atmosphere-stadiet mangler")
        let animate = app.buttons["animate-approved-ai-stage"].firstMatch
        XCTAssertTrue(animate.exists, "Animate approved mangler")
        if app.staticTexts["Color"].firstMatch.exists
            && app.staticTexts["Atmosphere"].firstMatch.exists {
            XCTAssertFalse(app.alerts["Tillat AI for prosjektet?"].exists,
                           "visuell kontroll skal ikke starte en leverandørjobb")
        }
        attachShot(app, name: "generated-image-stage-chain-no-spend")
    }

    /// Leser kun den offentlige `configured`-statusen som backend allerede
    /// sender til den innloggede appen. Testen eksponerer ikke credentialen og
    /// starter ingen betalt Higgsfield-jobb.
    @MainActor
    func testAuthenticatedHiggsfieldProviderIsConfigured() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        XCTAssertTrue(openBoard.waitForExistence(timeout: 30),
                      "innlogget prosjekt-hub åpnet ikke")
        dismissPushPrompt()
        openBoard.tap()

        XCTAssertTrue(app.otherElements["tegneflate"].firstMatch
            .waitForExistence(timeout: 20), "board/canvas åpnet ikke")

        let modelMenu = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Seedance'")) .firstMatch
        XCTAssertTrue(modelMenu.waitForExistence(timeout: 20),
                      "videomodell-katalogen ble ikke lastet")
        modelMenu.tap()

        let higgsfield = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Higgsfield'")) .firstMatch
        XCTAssertTrue(higgsfield.waitForExistence(timeout: 10),
                      "Higgsfield mangler i live modellkatalog")
        XCTAssertTrue(higgsfield.images["checkmark.circle"].exists,
                      "Higgsfield servercredential er ikke konfigurert i live Render-service")
        XCTAssertFalse(higgsfield.images["xmark.circle"].exists,
                       "live backend rapporterer Higgsfield som ukonfigurert")

        attachShot(app, name: "live-higgsfield-01-konfigurert")
        XCTAssertFalse(app.alerts["Tillat AI for prosjektet?"].exists,
                       "provider-sjekken skal ikke starte generering")
    }

    /// Autentisert live-smoke for production-aware Prompt Engine. Bruker
    /// brukerens eksisterende Keychain-sesjon og utløser ingen betalt generering.
    @MainActor
    func testAuthenticatedPromptEngineLiveSmoke() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()

        let openBoard = app.buttons["Åpne board"].firstMatch
        XCTAssertTrue(openBoard.waitForExistence(timeout: 30),
                      "innlogget prosjekt-hub åpnet ikke")
        dismissPushPrompt()
        openBoard.tap()

        XCTAssertTrue(app.otherElements["tegneflate"].firstMatch
            .waitForExistence(timeout: 20), "board/canvas åpnet ikke")
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label ==[c] 'Scenario / AI context'")) .firstMatch
            .waitForExistence(timeout: 15), "scenario-panelet mangler")
        XCTAssertTrue(app.staticTexts.matching(
            NSPredicate(format: "label ==[c] 'AI · Prompt Engine'")) .firstMatch
            .waitForExistence(timeout: 15), "Prompt Engine-panelet mangler")

        // Pakkevelgeren opprettes først når den versjonerte live-katalogen er lastet.
        XCTAssertTrue(app.buttons["—"].firstMatch.waitForExistence(timeout: 20),
                      "scenario-katalogen ble ikke lastet")
        XCTAssertFalse(app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'scenario' AND label CONTAINS[c] 'feil'"))
            .firstMatch.exists, "scenario-katalogen rapporterte feil")

        let inspector = app.buttons["Inspector"].firstMatch
        XCTAssertTrue(inspector.waitForExistence(timeout: 10),
                      "Prompt Inspector-handlingen mangler")
        inspector.tap()

        XCTAssertTrue(app.navigationBars["Prompt Inspector"].firstMatch
            .waitForExistence(timeout: 30), "Prompt Inspector åpnet ikke")
        XCTAssertTrue(app.staticTexts["Modell"].firstMatch.waitForExistence(timeout: 10),
                      "kompilert modellinformasjon mangler")
        XCTAssertTrue(app.staticTexts["Gyldig prompt"].firstMatch.exists,
                      "prompten ble ikke validert")
        XCTAssertFalse(app.staticTexts["Ingen prompt kompilert"].firstMatch.exists,
                       "Prompt Inspector mangler kompilering")

        attachShot(app, name: "live-prompt-engine-01-validert")
        XCTAssertFalse(app.alerts["Tillat AI for prosjektet?"].exists,
                       "smoke-testen skal ikke be om betalt AI-generering")
    }

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
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
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

    @MainActor
    private func revealInspectorButton(
        _ label: String,
        in inspector: XCUIElement,
        app: XCUIApplication
    ) -> XCUIElement {
        revealInspectorElement(app.buttons[label].firstMatch,
                               in: inspector,
                               app: app)
    }

    @MainActor
    private func revealInspectorElement(
        _ element: XCUIElement,
        in inspector: XCUIElement,
        app: XCUIApplication
    ) -> XCUIElement {
        let scrollView = app.scrollViews["storyboard-inspector-scroll"].firstMatch
        _ = scrollView.waitForExistence(timeout: 2)

        // A full-speed swipe can coast from the top to the bottom of this
        // compact Inspector and skip an entire row of controls. Move the
        // actual scroll surface in short, deterministic steps so lazily
        // exposed accessibility buttons become fully visible before we pass
        // them. XCUI can report a control as hittable when only a few pixels
        // intersect the viewport; tapping its offscreen center may then hit a
        // neighbouring action instead.
        for _ in 0..<8 {
            if element.exists, element.isHittable,
               inspectorElementIsFullyVisible(element, in: scrollView) {
                return element
            }

            let surface = scrollView.exists ? scrollView : inspector
            let start = surface.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
            let end = surface.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.52))
            start.press(forDuration: 0.1, thenDragTo: end)
        }
        return element
    }

    @MainActor
    private func inspectorElementIsFullyVisible(
        _ element: XCUIElement,
        in scrollView: XCUIElement
    ) -> Bool {
        guard scrollView.exists else { return true }
        let elementFrame = element.frame
        let visibleFrame = elementFrame.intersection(scrollView.frame)
        return !visibleFrame.isNull
            && visibleFrame.width >= elementFrame.width - 1
            && visibleFrame.height >= elementFrame.height - 1
    }

    @MainActor
    private func waitForCanvasAspect(
        _ canvas: XCUIElement,
        expected: CGFloat,
        timeout: TimeInterval = 5,
        accuracy: CGFloat = 0.08
    ) -> CGRect? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let frame = canvas.frame
            if frame.width > 0, frame.height > 0,
               abs(canvasAspect(frame) - expected) <= accuracy {
                return frame
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        } while Date() < deadline
        return nil
    }

    private func canvasAspect(_ frame: CGRect) -> CGFloat {
        frame.width / max(1, frame.height)
    }

    // Runde 7 interaktivt: iso/fisheye-guides, VP-snap-toggle, retusj.
    @MainActor
    func testRound7BoardFeatures() throws {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
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
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
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
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
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
        app.launchEnvironment["SB_TOKEN"] = try requiredLiveToken()
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
