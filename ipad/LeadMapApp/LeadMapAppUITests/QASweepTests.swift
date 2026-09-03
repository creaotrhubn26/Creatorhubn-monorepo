// QASweepTests.swift — automatisert visuell QA (2026-07-04)
//
// Innlogget sveip over alle hovedfaner + interaksjoner som ikke kan nås
// med simctl alene (statistikk-modaler, sheets). Hvert steg legger ved et
// skjermbilde som XCTAttachment — scripts/qa-sweep.sh eksporterer alt til
// et galleri per kjøring.
//
// Auth: appen leser QA_BEARER_TOKEN/QA_TAB fra launch-environment
// (DEBUG-only hooks i AuthClient/MainTabView). Token injiseres i test-
// runneren via `TEST_RUNNER_QA_BEARER_TOKEN=… xcodebuild test`.

import XCTest

@MainActor
final class QASweepTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    // MARK: - Hjelpere

    private func launchApp(
        tab: Int,
        environment: [String: String] = [:]
    ) -> XCUIApplication {
        // Portrett-lås på iOS-enheter — rotert/opp-ned sim gir speilvendte
        // tap-koordinater og letterbox-artefakter i skjermbildene.
        // (Setteren finnes ikke på Mac Catalyst og feller testen der.)
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] =
            ProcessInfo.processInfo.environment["QA_BEARER_TOKEN"] ?? ""
        app.launchEnvironment["QA_TAB"] = "\(tab)"
        for (key, value) in environment {
            app.launchEnvironment[key] = value
        }
        app.launch()
        // La bootstrap + refresh lande før snapshot (kald Render kan bruke tid).
        sleep(10)
        return app
    }

    // MARK: - Add lead: responsiv iPhone-layout

    func testAddLeadMobileLayout() throws {
        let app = launchApp(
            tab: 2,
            environment: ["QA_TOUR": "add-lead", "QA_DEMO": "1"]
        )

        let addLead = button(in: app, containing: "Nytt lead")
        XCTAssertTrue(addLead.waitForExistence(timeout: 5))
        addLead.tap()

        XCTAssertTrue(app.navigationBars["Legg til lead"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons.matching(
            NSPredicate(format: "label == 'Avbryt'")
        ).count, 1, "iPhone skal bare ha Avbryt i navigasjonslinjen")

        let form = app.scrollViews["add-lead.form"]
        XCTAssertTrue(form.waitForExistence(timeout: 3))
        form.swipeUp()
        form.swipeUp()

        let classificationIDs = [
            "temperature.cold", "temperature.warm", "temperature.hot", "temperature.ready",
            "pipeline.unvisited", "pipeline.visited", "pipeline.interested",
            "pipeline.meeting_booked", "pipeline.proposal_sent", "pipeline.won",
        ]
        for classificationID in classificationIDs {
            let chip = app.buttons["add-lead.\(classificationID)"]
            XCTAssertTrue(chip.waitForExistence(timeout: 3))
            XCTAssertGreaterThanOrEqual(chip.frame.width, 96)
            XCTAssertGreaterThanOrEqual(chip.frame.height, 40)
            XCTAssertLessThanOrEqual(chip.frame.height, 52, "Statusnavn skal ikke brytes over flere linjer")
        }

        let nameField = app.textFields["add-lead.field.navn"]
        let roleField = app.textFields["add-lead.field.rolle"]
        XCTAssertGreaterThan(roleField.frame.minY, nameField.frame.maxY,
                             "Kontaktfeltene skal stables på iPhone")

        snap(app, "leads-add-lead-mobile-responsive")
        app.terminate()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// Første knapp hvis label inneholder teksten — SwiftUI setter sammen
    /// child-tekster, så eksakt match er upålitelig.
    private func button(in app: XCUIApplication, containing text: String) -> XCUIElement {
        app.buttons.containing(
            NSPredicate(format: "label CONTAINS %@", text)
        ).firstMatch
    }

    private func pondusUsageCount(
        baseURL: URL,
        token: String,
        organizationID: String,
        templateID: String
    ) async throws -> Int {
        var statsURL = baseURL.appendingPathComponent("api/leadgrid/pondus/usage/stats")
        statsURL.append(queryItems: [URLQueryItem(name: "organization_id", value: organizationID)])
        var request = URLRequest(url: statsURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(organizationID, forHTTPHeaderField: "X-Organization-Id")
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let templates = payload?["templates"] as? [[String: Any]] ?? []
        let row = templates.first { ($0["template_id"] as? String) == templateID }
        return row?["used_total"] as? Int ?? 0
    }

    // MARK: - Fane-sveip m/ statistikk-modal

    /// iPhone-fanene: 0=Oversikt 1=Kart 2=Leads 3=Møter 4=Mer,
    /// 5/6/7 auto-pusher Team/Leadbook/Salgsledelse via Mer-fanen.
    func testSweepAlleFaner() throws {
        let faner = [
            (0, "oversikt"), (1, "kart"), (2, "leads"), (3, "moter"),
            (4, "mer"), (5, "team"), (6, "leadbook"), (7, "salgsledelse"),
        ]
        for (idx, navn) in faner {
            let app = launchApp(tab: idx)
            snap(app, "fane-\(idx)-\(navn)")

            // Statistikk-modal der fanen har den (Oversikt/Leads/Møter/
            // Team/Leadbook).
            let stats = button(in: app, containing: "Statistikk")
            if stats.waitForExistence(timeout: 3), stats.isHittable {
                stats.tap()
                sleep(2)
                snap(app, "fane-\(idx)-\(navn)-statistikk-modal")
                app.swipeDown()
                sleep(1)
            }
            app.terminate()
        }
    }

    // MARK: - Leads: rad-tap → detalj-sheet

    func testLeadsDetaljSheet() throws {
        let app = launchApp(tab: 2)
        // Tap første lead-rad (kompaktraden er en Button med firmanavnet).
        let firstRow = app.buttons.containing(
            NSPredicate(format: "label CONTAINS 'NOK'")
        ).firstMatch
        if firstRow.waitForExistence(timeout: 5), firstRow.isHittable {
            firstRow.tap()
            sleep(2)
            snap(app, "leads-detalj-sheet")
            app.swipeDown()
        } else {
            snap(app, "leads-detalj-sheet-UTILGJENGELIG")
        }
        app.terminate()
    }

    func testSharedLeadFormShowsInlineValidationErrors() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "lead-form"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "2"
        app.launch()

        let newLead = app.buttons["lead-new"]
        XCTAssertTrue(newLead.waitForExistence(timeout: 10))
        newLead.tap()

        let form = app.otherElements["lead-add-form"]
        XCTAssertTrue(form.waitForExistence(timeout: 5))

        let name = app.textFields["lead-field-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 3))
        name.tap()
        name.typeText("Valideringstest AS")

        let orgNumber = app.textFields["lead-field-organizationNumber"]
        orgNumber.tap()
        orgNumber.typeText("123456789")

        let website = app.textFields["lead-field-website"]
        website.tap()
        website.typeText("javascript:alert(1)")

        let email = app.textFields["lead-field-email"]
        email.tap()
        email.typeText("ugyldig-epost")

        app.buttons["lead-submit"].tap()

        XCTAssertTrue(app.staticTexts["lead-error-organizationNumber"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["lead-error-website"].exists)
        XCTAssertTrue(app.staticTexts["lead-error-email"].exists)
        XCTAssertFalse(app.alerts["Kunne ikke lagre lead"].exists)
        app.terminate()
    }

    func testKartAndLeadsOpenTheSharedLeadForm() throws {
        for tab in [1, 2] {
            let app = XCUIApplication()
            app.launchEnvironment["QA_TOUR"] = "shared-lead-form"
            app.launchEnvironment["QA_DEMO"] = "1"
            app.launchEnvironment["QA_TAB"] = "\(tab)"
            app.launch()

            if tab == 1 {
                let actions = app.buttons["lead-actions-menu"]
                XCTAssertTrue(actions.waitForExistence(timeout: 10))
                actions.tap()
                let newMapLead = app.buttons["lead-new-map"]
                XCTAssertTrue(newMapLead.waitForExistence(timeout: 3))
                newMapLead.tap()
            } else {
                let newLead = app.buttons["lead-new"]
                XCTAssertTrue(newLead.waitForExistence(timeout: 10))
                newLead.tap()
            }
            XCTAssertTrue(app.otherElements["lead-add-form"].waitForExistence(timeout: 5))
            app.terminate()
        }
    }

    func testLeadgridAgentProposalRequiresConfirmationBeforeExecution() throws {
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .landscapeLeft
        #endif
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "agent-skills"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "12"
        app.launch()

        let proposal = app.buttons["agent-skill-leadgrid_data_quality"]
        XCTAssertTrue(proposal.waitForExistence(timeout: 12))
        proposal.tap()

        XCTAssertTrue(app.navigationBars["Bekreft agenthandling"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "analyse")
            ).firstMatch.exists
        )
        let cancel = app.buttons["Avbryt"]
        XCTAssertTrue(cancel.exists)
        cancel.tap()
        XCTAssertTrue(proposal.waitForExistence(timeout: 3))

        proposal.tap()
        let confirm = app.buttons["agent-skill-confirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 3))
        confirm.tap()

        XCTAssertTrue(app.staticTexts["Datakvalitet kontrollert"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars["Bekreft agenthandling"].exists)
        app.terminate()
    }

    /// Kjører bare når CI/test-runneren har fått en ekte staging-token.
    /// Testen beviser appens offline-kø, reconnect-drain og staging-persistens
    /// uten å legge hemmeligheter i repoet eller XCTest-loggen.
    func testStagingLeadCreationOfflineReconnect() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let stagingURL = environment["LEADGRID_STAGING_BASE_URL"],
              let token = environment["LEADGRID_STAGING_BEARER_TOKEN"],
              let organizationID = environment["LEADGRID_STAGING_ORG_ID"],
              !stagingURL.isEmpty, !token.isEmpty, !organizationID.isEmpty
        else {
            throw XCTSkip(
                "Krever LEADGRID_STAGING_BASE_URL, LEADGRID_STAGING_BEARER_TOKEN og LEADGRID_STAGING_ORG_ID"
            )
        }
        guard let baseURL = URL(string: stagingURL),
              baseURL.scheme == "https",
              baseURL.host != "creatorhub-backend-rtbl.onrender.com"
        else {
            XCTFail("Staging-E2E nekter ugyldig eller produksjons-URL")
            return
        }

        let uniqueName = "[E2E] iPad reconnect \(UUID().uuidString.prefix(8))"
        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] = token
        app.launchEnvironment["LEADGRID_API_BASE_URL"] = stagingURL
        app.launchEnvironment["QA_NETWORK_CONTROLS"] = "1"
        app.launchEnvironment["QA_ORGANIZATION_ID"] = organizationID
        app.launchEnvironment["QA_TAB"] = "2"
        app.launch()

        XCTAssertTrue(app.staticTexts["staging-environment-badge"].waitForExistence(timeout: 12))
        let offline = app.buttons["qa-network-offline"]
        XCTAssertTrue(offline.waitForExistence(timeout: 3))
        offline.tap()

        let newLead = app.buttons["lead-new"]
        XCTAssertTrue(newLead.waitForExistence(timeout: 10))
        newLead.tap()

        let name = app.textFields["lead-field-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(uniqueName)
        app.buttons["lead-submit"].tap()

        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "lagret offline")
            ).firstMatch.waitForExistence(timeout: 8)
        )
        XCTAssertTrue(app.staticTexts["offline-queue-pending-count"].waitForExistence(timeout: 5))

        app.buttons["qa-network-online"].tap()
        let pendingGone = NSPredicate(format: "exists == false")
        let drainExpectation = expectation(
            for: pendingGone,
            evaluatedWith: app.staticTexts["offline-queue-pending-count"]
        )
        await fulfillment(of: [drainExpectation], timeout: 20)

        var request = URLRequest(
            url: baseURL.appendingPathComponent("api/admin-room/lead-map/leads")
        )
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(organizationID, forHTTPHeaderField: "X-Organization-Id")
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let leads = payload?["leads"] as? [[String: Any]] ?? []
        XCTAssertEqual(leads.filter { ($0["name"] as? String) == uniqueName }.count, 1)
        app.terminate()
    }

    /// Ekte Pondus-infrastrukturtest: staging-auth, publisert PostgreSQL-mal,
    /// offline-kø, reconnect og serververifisert usage_session_id.
    func testStagingPondusUsageOfflineReconnect() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let stagingURL = environment["LEADGRID_STAGING_BASE_URL"],
              let token = environment["LEADGRID_STAGING_BEARER_TOKEN"],
              let organizationID = environment["LEADGRID_STAGING_ORG_ID"],
              !stagingURL.isEmpty, !token.isEmpty, !organizationID.isEmpty
        else {
            throw XCTSkip("Krever staging-URL, bearer-token og org-ID")
        }
        guard let baseURL = URL(string: stagingURL),
              baseURL.scheme == "https",
              baseURL.host != "creatorhub-backend-rtbl.onrender.com"
        else {
            XCTFail("Pondus-E2E nekter ugyldig eller produksjons-URL")
            return
        }

        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] = token
        app.launchEnvironment["LEADGRID_API_BASE_URL"] = stagingURL
        app.launchEnvironment["QA_NETWORK_CONTROLS"] = "1"
        app.launchEnvironment["QA_ORGANIZATION_ID"] = organizationID
        app.launchEnvironment["QA_TAB"] = UIDevice.current.userInterfaceIdiom == .phone ? "6" : "5"
        app.launch()

        XCTAssertTrue(app.staticTexts["staging-environment-badge"].waitForExistence(timeout: 12))
        let useTemplate = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "pondus-use-")
        ).firstMatch
        XCTAssertTrue(useTemplate.waitForExistence(timeout: 15), "Staging må ha minst én publisert Pondus-mal")
        let templateID = String(useTemplate.identifier.dropFirst("pondus-use-".count))
        XCTAssertFalse(templateID.isEmpty)
        let usageBefore = try await pondusUsageCount(
            baseURL: baseURL,
            token: token,
            organizationID: organizationID,
            templateID: templateID
        )
        app.buttons["qa-network-offline"].tap()
        useTemplate.tap()
        XCTAssertTrue(app.buttons["pondus-start-session"].waitForExistence(timeout: 5))

        app.buttons["pondus-start-session"].tap()
        XCTAssertTrue(app.staticTexts["pondus-active-coach"].waitForExistence(timeout: 8))
        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "offline")
            ).firstMatch.exists
        )
        app.buttons["pondus-outcome-meeting_booked"].tap()
        app.buttons["qa-network-online"].tap()

        let pendingGone = NSPredicate(format: "exists == false")
        let drained = expectation(
            for: pendingGone,
            evaluatedWith: app.staticTexts["offline-queue-pending-count"]
        )
        await fulfillment(of: [drained], timeout: 20)

        let usageAfter = try await pondusUsageCount(
            baseURL: baseURL,
            token: token,
            organizationID: organizationID,
            templateID: templateID
        )
        XCTAssertEqual(usageAfter, usageBefore + 1, "Reconnect skal persistere nøyaktig én Pondus-økt")
        app.terminate()
    }

    /// Lokal, hemmelighetsfri UI-smoke av den samme produksjonscoachen.
    /// Køkontrakten testes separat; stagingtesten over beviser reconnect.
    func testPondusCoachLocalSmoke() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "pondus-coach"
        app.launchEnvironment["QA_NETWORK_CONTROLS"] = "1"
        app.launchEnvironment["QA_TAB"] = UIDevice.current.userInterfaceIdiom == .phone ? "6" : "5"
        app.launch()

        let useTemplate = app.buttons["pondus-use-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]
        XCTAssertTrue(useTemplate.waitForExistence(timeout: 12))
        app.buttons["qa-network-offline"].tap()
        useTemplate.tap()
        let start = app.buttons["pondus-start-session"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        start.tap()
        XCTAssertTrue(app.staticTexts["pondus-active-coach"].waitForExistence(timeout: 5))

        let next = app.buttons["pondus-next-step"]
        XCTAssertTrue(next.exists)
        next.tap()
        XCTAssertTrue(app.staticTexts["Steg 2 av 2"].waitForExistence(timeout: 3))

        app.buttons["pondus-outcome-meeting_booked"].tap()
        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "lagret offline")
            ).firstMatch.waitForExistence(timeout: 5)
        )
        app.terminate()
    }

    // MARK: - Canvas: editor + adaptiv rotasjon

    func testCanvasAdaptiveEditorSmoke() throws {
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
        let app = XCUIApplication()
        // QA_TOUR gir en prosesslokal testidentitet uten å opprette sesjon;
        // QA_DEMO gjør at Canvas bruker deterministiske, lokale notater.
        app.launchEnvironment["QA_TOUR"] = "canvas"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "10"
        app.launchEnvironment["QA_CAPTURE"] = "1"
        app.launch()

        let note = button(in: app, containing: "Ruteplan")
        XCTAssertTrue(note.waitForExistence(timeout: 12))
        note.tap()

        let panorer = button(in: app, containing: "Panorer")
        XCTAssertTrue(panorer.waitForExistence(timeout: 5))
        panorer.tap()
        let fit = app.buttons["Tilpass dokumentbredden"].firstMatch
        XCTAssertTrue(fit.waitForExistence(timeout: 5))
        XCTAssertTrue(fit.isHittable)
        fit.tap()
        snap(app, "canvas-editor-portrett")

        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(fit.waitForExistence(timeout: 5))
        XCTAssertTrue(fit.isHittable)
        snap(app, "canvas-editor-landskap")
        XCUIDevice.shared.orientation = .portrait
        #endif
        app.terminate()
    }

    // MARK: - Leadbook: dyp-sveip over under-faner + header-modaler

    /// Leadbook har 6 under-faner + 3 header-CTAer med egne modaler —
    /// hoved-sveipet fanger bare landingssiden (Pondus). Dette sveiper alt.
    func testLeadbookDeepSweep() throws {
        let app = launchApp(tab: 6)
        snap(app, "leadbook-0-landing")

        let appW = app.frame.width
        // Fullskjerm-kursspilleren (Pondus) dekker ALT hvis den åpnes ved
        // et uhell — kjøring 4 mistet Eksempler/Innsikt + alle modaler
        // fordi et drag-fallback landet som tap på et kurs-kort. Lukk
        // defensivt før hvert steg.
        func lukkEventuellSpiller() {
            let lukk = app.buttons["Lukk"].firstMatch
            if lukk.exists, lukk.frame.minY < 300, lukk.frame.minX >= 0 {
                lukk.tap()
                sleep(1)
            }
        }
        // Under-fanene har stabile accessibility-ids («leadbook-subtab-…»)
        // — label-CONTAINS traff kurs-kort og hoved-tab-baren i tidligere
        // kjøringer. Off-screen faner hentes inn ved å sveipe SCROLLEREN
        // (egen id), aldri finger-drag fra en knapp.
        let scroller = app.scrollViews["leadbook-subtab-scroller"].firstMatch
        func synligFane(_ navn: String) -> XCUIElement? {
            let tab = app.buttons["leadbook-subtab-\(navn)"].firstMatch
            guard tab.exists else { return nil }
            let f = tab.frame
            return (f.minX >= 0 && f.maxX <= appW) ? tab : nil
        }
        for (i, navn) in ["Oversikt", "Maler", "Pondus", "Akademi", "Eksempler", "Innsikt"].enumerated() {
            lukkEventuellSpiller()
            var tab = synligFane(navn)
            var forsok = 0
            while tab == nil, forsok < 3, scroller.exists {
                scroller.swipeLeft()
                sleep(1)
                tab = synligFane(navn)
                forsok += 1
            }
            if let tab {
                tab.tap()
                sleep(2)
                snap(app, "leadbook-fane-\(i)-\(navn.lowercased())")
            } else {
                snap(app, "leadbook-fane-\(i)-\(navn.lowercased())-UTILGJENGELIG")
            }
        }

        // Header-CTAer → modaler (lukkes med swipeDown)
        for navn in ["Bibliotek", "Ytelse", "Versjoner"] {
            lukkEventuellSpiller()
            let cta = button(in: app, containing: navn)
            if cta.waitForExistence(timeout: 3),
               cta.frame.minX >= 0, cta.frame.maxX <= appW {
                cta.tap()
                sleep(2)
                snap(app, "leadbook-modal-\(navn.lowercased())")
                app.swipeDown()
                sleep(1)
            } else {
                snap(app, "leadbook-modal-\(navn.lowercased())-UTILGJENGELIG")
            }
        }
        app.terminate()
    }

    // MARK: - SuperAdmin: konsoll + org-detalj + entitlement-matrise

    /// Sveiper hele «gi organisasjon tilgang»-flyten: profil-meny →
    /// SuperAdmin-konsoll → org-kort → detalj-faner → tilgangs-matrise
    /// → toggle → Lagre. Alle steg får skjermbilde.
    func testSuperAdminDeepSweep() throws {
        // Leadbook eier SuperAdmin-inngangen: QA_TAB 6 på iPhone (via
        // Mer-push), 5 på iPad/Mac (ingen Mer-fane — indeksene forskyves).
        let leadbookTab = UIDevice.current.userInterfaceIdiom == .phone ? 6 : 5
        let app = launchApp(tab: leadbookTab)
        let appW = app.frame.width

        // iPad/Mac: QA_TAB-selection er upålitelig på sidebar-TabView —
        // tapp Leadbook-fanen eksplisitt så vi garantert står der
        // SuperAdmin-inngangen er wiret.
        if UIDevice.current.userInterfaceIdiom != .phone {
            let lb = app.buttons["Leadbook"].firstMatch
            if lb.waitForExistence(timeout: 5) {
                lb.tap()
                sleep(2)
            }
            snap(app, "superadmin-00-leadbook-landing")
        }

        // 1. Profil-knapp i delt header → popover → SuperAdmin-konsoll
        let avatar = app.buttons["header-profile-button"].firstMatch
        guard avatar.waitForExistence(timeout: 5) else {
            snap(app, "superadmin-0-avatar-UTILGJENGELIG")
            return
        }
        avatar.tap()
        sleep(1)
        snap(app, "superadmin-0-profilmeny")
        let konsoll = app.buttons["SuperAdmin-konsoll"].firstMatch
        guard konsoll.waitForExistence(timeout: 3) else {
            snap(app, "superadmin-1-konsoll-rad-UTILGJENGELIG")
            return
        }
        konsoll.tap()
        sleep(3)
        snap(app, "superadmin-1-dashboard")

        // 2. Første org-kort → OrgDetailSheet
        let orgCard = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'superadmin-org-card'")
        ).firstMatch
        guard orgCard.waitForExistence(timeout: 5) else {
            snap(app, "superadmin-2-orgkort-UTILGJENGELIG")
            return
        }
        orgCard.tap()
        sleep(2)
        snap(app, "superadmin-2-orgdetalj-oversikt")

        // 3. Detalj-faner (Tilganger/Fakturering/Audit-logg) — fane-raden
        // er en scroller på iPhone; sveip den hvis fanen er off-screen.
        let orgTabBar = app.scrollViews["orgdetail-tabbar"].firstMatch
        for (i, navn) in ["Tilganger", "Fakturering", "Audit-logg"].enumerated() {
            func synligDetaljFane() -> XCUIElement? {
                // Unik id — label-søk kunne treffe dashboardet bak det
                // sentrerte iPad-arket, og tap utenfor arket lukket det.
                let tab = app.buttons["orgdetail-tab-\(navn)"].firstMatch
                guard tab.exists, tab.frame.minX >= 0, tab.frame.maxX <= appW
                else { return nil }
                return tab
            }
            var fane = synligDetaljFane()
            var forsok = 0
            while fane == nil, forsok < 2, orgTabBar.exists {
                orgTabBar.swipeLeft()
                sleep(1)
                fane = synligDetaljFane()
                forsok += 1
            }
            if let fane {
                fane.tap()
                sleep(1)
                snap(app, "superadmin-3\(i)-fane-\(navn.lowercased())")
            } else {
                snap(app, "superadmin-3\(i)-fane-\(navn.lowercased())-UTILGJENGELIG")
            }
        }

        // 4. Mer-meny → Rediger entitlements → matrise
        let mer = app.buttons["org-detail-more"].firstMatch
        guard mer.waitForExistence(timeout: 3) else {
            snap(app, "superadmin-4-mer-meny-UTILGJENGELIG")
            return
        }
        mer.tap()
        sleep(1)
        let rediger = app.buttons["Rediger entitlements"].firstMatch
        guard rediger.waitForExistence(timeout: 3) else {
            snap(app, "superadmin-4-rediger-UTILGJENGELIG")
            return
        }
        rediger.tap()
        sleep(2)
        snap(app, "superadmin-4-matrise")

        // 5. Toggle første feature til Sperret → Lagre → toast
        let sperr = app.buttons["matrix-0-Sperret"].firstMatch
        if sperr.waitForExistence(timeout: 3) {
            sperr.tap()
            sleep(1)
            snap(app, "superadmin-5-matrise-toggled")
        } else {
            snap(app, "superadmin-5-toggle-UTILGJENGELIG")
        }
        let lagre = app.buttons["matrix-lagre"].firstMatch
        if lagre.exists {
            lagre.tap()
            sleep(2)
            snap(app, "superadmin-6-etter-lagre")
        }
        app.terminate()
    }

    // MARK: - Oversikt: pin-info-sheet via kart utilgjengelig for XCUITest
    // (Map-annotations er ikke accessibility-elementer) — dekkes manuelt.

    // MARK: - Tilgjengelighets-audit per fane

    /// Rapporterende modus: alle funn logges som attachments i stedet for
    /// å feile testen — galleri-gjennomgangen avgjør hva som fikses.
    /// Trådtrygg samle-boks — audit-handleren krysser isolasjons-grense
    /// under Swift 6 strict concurrency (kalles i praksis synkront).
    private final class A11yRapport: @unchecked Sendable {
        var linjer: [String] = []
    }

    func testAccessibilityAudit() throws {
        guard #available(iOS 17.0, *) else {
            throw XCTSkip("performAccessibilityAudit krever iOS 17")
        }
        let rapport = A11yRapport()
        for (idx, navn) in [(0, "oversikt"), (2, "leads"), (3, "moter")] {
            let app = launchApp(tab: idx)
            try app.performAccessibilityAudit { issue in
                // Element-info gjør funnene handlingsbare — uten den vet
                // vi bare AT noe mangler beskrivelse, ikke HVA.
                let el = issue.element.map { String(describing: $0) } ?? "ukjent element"
                rapport.linjer.append("[\(navn)] \(issue.auditType): \(issue.compactDescription) — \(el)")
                return true // logg, ikke feil — rapporterende modus
            }
            app.terminate()
        }
        let attachment = XCTAttachment(
            string: rapport.linjer.isEmpty ? "Ingen funn" : rapport.linjer.joined(separator: "\n")
        )
        attachment.name = "a11y-rapport"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
