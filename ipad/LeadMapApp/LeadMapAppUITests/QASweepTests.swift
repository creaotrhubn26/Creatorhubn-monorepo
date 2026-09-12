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

    private func tapWhenHittable(_ element: XCUIElement, scrolling form: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 3))
        for _ in 0..<8 where !element.isHittable {
            form.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
        element.tap()
    }

    private func waitUntilHittable(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND hittable == true"),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func dismissKeyboard(in app: XCUIApplication) {
        guard app.keyboards.count > 0 else { return }
        let returnKey = app.keyboards.buttons["Return"].firstMatch
        if returnKey.exists {
            returnKey.tap()
        }
    }

    private func displayedText(of element: XCUIElement) -> String {
        (element.value as? String) ?? element.label
    }

    private func undersizedVisibleButtons(in app: XCUIApplication) -> [String] {
        app.buttons.allElementsBoundByIndex.compactMap { button in
            guard button.exists else { return nil }
            let frame = button.frame
            // Ikke spør isHittable for offscreen SwiftUI-elementer. XCTest
            // kan kaste en Objective-C exception når et lazy element akkurat
            // er frigitt. Skjæringspunkt med app-vinduet er stabilt her.
            guard frame.intersects(app.frame),
                  frame.width > 0, frame.height > 0,
                  (frame.width < 44 || frame.height < 44) else { return nil }
            let name = button.identifier.isEmpty ? button.label : button.identifier
            // OS-eid sidebar-kontroll er 54×36 på iPadOS 26 og kan ikke
            // styles av appen. Vi måler bare Leadgrid sine egne knapper.
            guard name != "Hide Sidebar" else { return nil }
            return "\(name.isEmpty ? "ukjent knapp" : name) \(Int(frame.width))×\(Int(frame.height))"
        }
    }

    private func pondusUsageCount(
        baseURL: URL,
        token: String,
        organizationID: String,
        projectID: String,
        templateID: String
    ) async throws -> Int {
        var statsURL = baseURL.appendingPathComponent("api/leadgrid/pondus/usage/stats")
        statsURL.append(queryItems: [
            URLQueryItem(name: "organization_id", value: organizationID),
            URLQueryItem(name: "project_id", value: projectID),
        ])
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
        let faner: [(Int, String)]
        if UIDevice.current.userInterfaceIdiom == .phone {
            faner = [
                (0, "oversikt"), (1, "kart"), (2, "leads"), (3, "moter"),
                (4, "mer"), (5, "team"), (6, "leadbook"), (7, "salgsledelse"),
            ]
        } else {
            // SidebarItem.allCases-rekkefølgen. Tidligere brukte iPad
            // iPhone-navnene og hoppet over de fem siste iPad-flatene.
            faner = [
                (0, "oversikt"), (1, "kart"), (2, "leads"), (3, "moter"),
                (4, "team"), (5, "leadbook"), (6, "salgsledelse"),
                (7, "leadgrid-go"), (8, "kvalitet"), (9, "anbud"),
                (10, "canvas"), (11, "verktoy"), (12, "agent"),
            ]
        }
        for (idx, navn) in faner {
            let app = launchApp(
                tab: idx,
                environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
            )
            snap(app, "fane-\(idx)-\(navn)")

            if navn == "anbud" {
                let title = app.staticTexts["Anbud"].firstMatch
                XCTAssertTrue(title.waitForExistence(timeout: 3))
                XCTAssertGreaterThan(
                    title.frame.width, 70,
                    "Anbud-tittelen skal ikke klemmes til én bokstav per linje på iPad mini"
                )
                XCTAssertLessThan(
                    title.frame.height, 80,
                    "Anbud-tittelen skal beholde normal linjehøyde på iPad mini"
                )
            }

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

    func testIPadMiniNavigationAndProjectGuideStayUnderstandable() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else {
            throw XCTSkip("Denne kontrollen gjelder iPad-sidebaren.")
        }
        let app = launchApp(
            tab: 0,
            environment: [
                "QA_TOUR": "dentum-outreach",
                "QA_DEMO": "1",
                "QA_PRODUCT_ONBOARDING": "1",
            ]
        )

        let title = app.staticTexts["leadgrid-screen-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 8))
        XCTAssertEqual(title.label, "Oversikt")
        XCTAssertGreaterThanOrEqual(
            title.frame.width,
            64,
            "Skjermtittelen skal ikke bli avkortet til én bokstav i iPad mini Split View"
        )

        XCTAssertTrue(app.buttons["sidebar.agent"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["sidebar.agent"].isHittable)

        let more = app.buttons["sidebar.more-features"]
        XCTAssertTrue(more.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["sidebar.leadgridGo"].exists)
        more.tap()
        XCTAssertTrue(app.buttons["sidebar.leadgridGo"].waitForExistence(timeout: 3))

        let guide = app.otherElements["product-onboarding.card"]
        XCTAssertTrue(guide.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Bli trygg i Leadgrid"].exists)
        app.buttons["product-onboarding.primary"].tap()
        XCTAssertTrue(app.staticTexts["Sjekk kundeprosjektet"].waitForExistence(timeout: 3))

        snap(app, "ipad-mini-forenklet-sidepanel-og-prosjektguide")

        let hideSidebar = app.buttons["Hide Sidebar"].firstMatch
        if hideSidebar.exists && hideSidebar.isHittable { hideSidebar.tap() }
        XCTAssertTrue(title.waitForExistence(timeout: 3))
        XCTAssertEqual(title.label, "Oversikt")

        snap(app, "ipad-mini-forenklet-navigasjon-og-prosjektguide")
        app.terminate()
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
        app.launchEnvironment["QA_TOUR"] = "lead-form-validation"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "2"
        app.launch()

        let newLead = app.buttons["lead-new"]
        XCTAssertTrue(newLead.waitForExistence(timeout: 10))
        newLead.tap()

        let form = app.scrollViews["add-lead.form"]
        XCTAssertTrue(form.waitForExistence(timeout: 5))

        XCTAssertEqual(
            app.textFields["add-lead.field.bedriftsnavn"].value as? String,
            "Valideringstest AS"
        )
        tapWhenHittable(app.buttons["add-lead.save"], scrolling: form)

        XCTAssertTrue(app.staticTexts["add-lead.error.org.nr"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["add-lead.error.nettside"].exists)
        XCTAssertTrue(app.staticTexts["add-lead.error.e-post"].exists)
        XCTAssertFalse(app.alerts["Kunne ikke lagre lead"].exists)
        app.terminate()
    }

    func testProfileEditValidationAndPersistenceFlow() throws {
        let app = launchApp(tab: 0, environment: ["QA_TOUR": "profile"])

        let avatar = app.buttons["header-profile-button"].firstMatch
        XCTAssertTrue(avatar.waitForExistence(timeout: 8))
        avatar.tap()

        let openProfile = button(in: app, containing: "Min profil")
        XCTAssertTrue(openProfile.waitForExistence(timeout: 5))
        openProfile.tap()

        XCTAssertTrue(app.otherElements["profile-screen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["profile-display-name"].waitForExistence(timeout: 3))
        XCTAssertEqual(app.staticTexts["profile-display-name"].label, "Ada Nordmann")

        let edit = app.buttons["profile-edit-toolbar-button"]
        XCTAssertTrue(edit.waitForExistence(timeout: 3))
        edit.tap()
        XCTAssertTrue(app.otherElements["profile-edit-screen"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["profile-email-readonly"].exists)

        let phone = app.textFields["profile-field-phone"]
        XCTAssertTrue(phone.waitForExistence(timeout: 3))
        replaceText(in: phone, with: "1234")
        XCTAssertTrue(app.staticTexts["profile-error-phone"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.otherElements["profile-edit-screen"].exists, "Ugyldig felt skal ikke lukke skjemaet")

        replaceText(in: phone, with: "+47 988 77 666", tapBeforeEditing: false)
        XCTAssertFalse(app.staticTexts["profile-error-phone"].exists)
        app.scrollViews.firstMatch.swipeDown()

        let firstName = app.textFields["profile-field-first-name"]
        XCTAssertTrue(firstName.waitForExistence(timeout: 3))
        replaceText(in: firstName, with: "Grace")
        app.scrollViews.firstMatch.swipeDown()
        app.buttons["profile-save-button"].tap()

        XCTAssertTrue(app.staticTexts["profile-display-name"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["profile-display-name"].label, "Grace Nordmann")
        XCTAssertFalse(app.otherElements["profile-edit-screen"].exists)
        snap(app, "profile-edit-saved")
        app.terminate()
    }

    private func replaceText(in field: XCUIElement, with value: String, tapBeforeEditing: Bool = true) {
        if tapBeforeEditing { field.tap() }
        let current = field.value as? String ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
        field.typeText(value)
    }

    func testKartAndLeadsOpenTheSharedLeadForm() throws {
        for tab in [1, 2] {
            let app = XCUIApplication()
            app.launchEnvironment["QA_TOUR"] = "shared-lead-form"
            app.launchEnvironment["QA_DEMO"] = "1"
            app.launchEnvironment["QA_TAB"] = "\(tab)"
            app.launch()

            if tab == 1 {
                let addMenu = app.buttons["kart.add-menu"]
                XCTAssertTrue(addMenu.waitForExistence(timeout: 10))
                addMenu.tap()
                let knownLead = app.buttons["kart.add.known"]
                XCTAssertTrue(knownLead.waitForExistence(timeout: 3))
                knownLead.tap()
            } else {
                let newLead = app.buttons["lead-new"]
                XCTAssertTrue(newLead.waitForExistence(timeout: 10))
                newLead.tap()
            }
            XCTAssertTrue(app.scrollViews["add-lead.form"].waitForExistence(timeout: 5))
            app.terminate()
        }
    }

    func testMapAddMenuSeparatesKnownLeadMapPointAndBusinessCard() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "shared-lead-form"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "1"
        app.launch()

        let addMenu = app.buttons["kart.add-menu"]
        XCTAssertTrue(addMenu.waitForExistence(timeout: 10))
        XCTAssertEqual(addMenu.label, "Legg til")
        // CoreGraphics kan rapportere 44 pt som 43.999999 på simulator.
        XCTAssertGreaterThanOrEqual(addMenu.frame.height, 43.5)

        addMenu.tap()
        let knownLead = app.buttons["kart.add.known"]
        let mapPoint = app.buttons["kart.add.map-point"]
        let businessCard = app.buttons["kart.add.business-card"]
        XCTAssertTrue(knownLead.waitForExistence(timeout: 3))
        XCTAssertTrue(mapPoint.exists)
        XCTAssertTrue(businessCard.exists)
        XCTAssertFalse(app.buttons["Ruteplanlegger"].exists)
        snap(app, "kart-add-menu")

        mapPoint.tap()
        let addLeadForm = app.scrollViews["add-lead.form"]
        XCTAssertTrue(addLeadForm.waitForExistence(timeout: 5))
        XCTAssertTrue(app.navigationBars["Legg til lead"].exists)
        app.buttons["Avbryt"].tap()

        XCTAssertTrue(addLeadForm.waitForNonExistence(timeout: 5))
        XCTAssertTrue(waitUntilHittable(addMenu))
        addMenu.tap()
        XCTAssertTrue(app.buttons["kart.add.business-card"].waitForExistence(timeout: 3))
        app.buttons["kart.add.business-card"].tap()
        XCTAssertTrue(app.navigationBars["Skann visittkort"].waitForExistence(timeout: 5))
        snap(app, "kart-business-card-scanner")
        app.buttons["Avbryt"].tap()

        XCTAssertTrue(app.navigationBars["Skann visittkort"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(waitUntilHittable(addMenu))
        XCTAssertFalse(app.buttons["kart.drop-pin"].exists)
        app.terminate()
    }

    func testSuperAdminDomainOnboardingOpensDiscovery() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "domain-onboarding"
        app.launchEnvironment["QA_TAB"] = "0"
        app.launch()

        XCTAssertTrue(app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 12))
        let domain = app.textFields["project-onboarding.domain"]
        XCTAssertTrue(domain.waitForExistence(timeout: 3))
        domain.tap()
        domain.typeText("dentum.no")
        dismissKeyboard(in: app)
        app.buttons["project-onboarding.analyze"].tap()

        let category = app.descendants(matching: .any)["project-onboarding.category"]
        XCTAssertTrue(category.waitForExistence(timeout: 5))
        XCTAssertTrue(displayedText(of: category).contains("Tannhelse"))

        let addProfile = app.buttons["project-onboarding.profile.add"]
        for _ in 0..<12 where !addProfile.exists {
            app.swipeUp()
        }
        XCTAssertTrue(addProfile.exists)
        addProfile.tap()

        let commit = app.buttons["project-onboarding.commit"]
        for _ in 0..<12 where !commit.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(commit.isHittable)
        XCTAssertTrue(app.staticTexts["Finn duplikater"].exists)
        XCTAssertTrue(app.staticTexts["Sjekk datakvalitet"].exists)
        commit.tap()

        XCTAssertTrue(
            app.staticTexts["project-onboarding.access-ready"].waitForExistence(timeout: 5),
            "Kundeorganisasjon, admin, team og prosjekt-ACL skal verifiseres før Discovery åpnes"
        )

        XCTAssertTrue(
            app.buttons["discovery.close"].waitForExistence(timeout: 8),
            "Et bekreftet domeneprosjekt skal åpnes direkte i Discovery"
        )
        XCTAssertFalse(app.navigationBars["Nytt kundeprosjekt"].exists)
        app.terminate()
    }

    /// Bekrefter hele den synlige Dentum-kjeden frem til kartets primære
    /// Discovery-handling: prosjekt opprettes, Discovery åpnes, og kan
    /// deretter åpnes igjen fra en tekstmerket FAB uten ikon-gjetting.
    func testDentumMapShowsVisibleDiscoveryFABAndReopensDiscovery() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "domain-onboarding"
        app.launchEnvironment["QA_TAB"] = "0"
        app.launch()

        XCTAssertTrue(app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 12))
        let domain = app.textFields["project-onboarding.domain"]
        XCTAssertTrue(domain.waitForExistence(timeout: 3))
        domain.tap()
        domain.typeText("dentum.no")
        dismissKeyboard(in: app)
        app.buttons["project-onboarding.analyze"].tap()

        let addProfile = app.buttons["project-onboarding.profile.add"]
        for _ in 0..<12 where !addProfile.exists {
            app.swipeUp()
        }
        XCTAssertTrue(addProfile.exists)
        addProfile.tap()

        let commit = app.buttons["project-onboarding.commit"]
        for _ in 0..<12 where !commit.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(commit.isHittable)
        commit.tap()

        let closeDiscovery = app.buttons["discovery.close"]
        XCTAssertTrue(closeDiscovery.waitForExistence(timeout: 8))
        closeDiscovery.tap()

        let mapTab = app.buttons["Kart"].firstMatch
        XCTAssertTrue(mapTab.waitForExistence(timeout: 5))
        mapTab.tap()

        // QA_TOUR åpner onboarding automatisk én gang per ny faneinstans.
        // Lukk den ekstra QA-presentasjonen slik at vi tester den virkelige
        // kartflaten etter at Dentum allerede er opprettet og aktivert.
        if app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 2) {
            app.buttons["Avbryt"].tap()
        }

        let discoveryFAB = app.buttons["kart.discovery.open"]
        XCTAssertTrue(discoveryFAB.waitForExistence(timeout: 8))
        XCTAssertTrue(discoveryFAB.isHittable)
        XCTAssertEqual(discoveryFAB.label, "Hva vil du finne?")
        XCTAssertGreaterThanOrEqual(discoveryFAB.frame.height, 44)
        XCTAssertGreaterThan(discoveryFAB.frame.width, discoveryFAB.frame.height)

        let zoomIn = app.buttons["kart.zoom-in"]
        let zoomOut = app.buttons["kart.zoom-out"]
        XCTAssertTrue(zoomIn.exists)
        XCTAssertTrue(zoomOut.exists)
        XCTAssertLessThanOrEqual(zoomIn.frame.width, 48)
        XCTAssertLessThanOrEqual(zoomOut.frame.width, 48)
        XCTAssertGreaterThanOrEqual(zoomIn.frame.height, 44)
        XCTAssertGreaterThanOrEqual(zoomOut.frame.height, 44)
        snap(app, "dentum-kart-synlig-discovery-fab")

        discoveryFAB.tap()
        XCTAssertTrue(app.navigationBars["Hvem vil du finne?"].waitForExistence(timeout: 5))
        snap(app, "dentum-kart-fab-aapner-discovery")
        app.terminate()
    }

    /// Full native Dentum-slice: valgt klinikk → prosjekt-/bransjemal →
    /// ferdig personalisert mottaker, emne og tekst. Testen stopper før
    /// ekstern e-postapp, så den kan aldri sende en virkelig melding.
    func testDentumLeadBuildsPersonalizedDentalClinicEmail() throws {
        let app = launchApp(
            tab: 0,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )

        XCTAssertTrue(
            app.staticTexts["Majorstuen Tannlegesenter AS"]
                .firstMatch.waitForExistence(timeout: 10)
        )
        for irrelevantName in ["Holy Crust", "Holmenkollen Hotell"] {
            let leakedElement = app.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", irrelevantName)
            ).firstMatch
            XCTAssertFalse(
                leakedElement.exists,
                "Dentum-prosjektet skal ikke vise \(irrelevantName)"
            )
        }
        XCTAssertFalse(app.staticTexts["1 248 leads"].exists)
        XCTAssertFalse(app.staticTexts["+842 nye"].exists)

        let showSidebar = app.buttons["Show Sidebar"].firstMatch
        if showSidebar.exists && showSidebar.isHittable {
            showSidebar.tap()
        }
        let leadsTab = app.buttons["Leads"].firstMatch
        XCTAssertTrue(leadsTab.waitForExistence(timeout: 5))
        XCTAssertTrue(leadsTab.isHittable)
        leadsTab.tap()

        let clinicRow = app.buttons[
            "lead.row.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        ]
        XCTAssertTrue(clinicRow.waitForExistence(timeout: 10))
        XCTAssertTrue(clinicRow.isHittable)
        clinicRow.tap()

        let openOutreach = app.buttons["lead.outreach.open"].firstMatch
        XCTAssertTrue(openOutreach.waitForExistence(timeout: 5))
        XCTAssertTrue(openOutreach.isHittable)
        openOutreach.tap()

        XCTAssertTrue(app.navigationBars["Klar e-post"].waitForExistence(timeout: 6))
        XCTAssertEqual(app.staticTexts["outreach.audience"].label, "7 maler for tannklinikker")
        XCTAssertTrue(app.staticTexts["Dentum-oppsett"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Tannhelse"].firstMatch.exists)
        XCTAssertTrue(
            app.staticTexts["outreach.compliance.status"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertEqual(
            app.staticTexts["outreach.compliance.status"].label,
            "Verifisert fellesadresse"
        )
        XCTAssertTrue(app.otherElements["outreach.compliance.card"].exists)
        XCTAssertFalse(app.staticTexts["Offentlig e-post"].exists)
        let complianceEditor = app.buttons["outreach.compliance.edit"]
        XCTAssertTrue(complianceEditor.isHittable)
        complianceEditor.tap()
        XCTAssertTrue(
            app.navigationBars["Kan vi sende e-post?"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertEqual(
            app.staticTexts["outreach.compliance.editor.status"].label,
            "Verifisert fellesadresse"
        )
        XCTAssertTrue(app.staticTexts["Dokumenter GDPR-grunnlaget"].exists)
        XCTAssertTrue(app.staticTexts["Har mottakeren sagt nei?"].exists)
        snap(app, "dentum-epost-personvernkontroll")
        app.buttons["Ferdig"].tap()
        XCTAssertTrue(app.navigationBars["Klar e-post"].waitForExistence(timeout: 3))

        let subject = app.textFields["outreach.subject"]
        XCTAssertTrue(subject.waitForExistence(timeout: 5))
        XCTAssertEqual(
            subject.value as? String,
            "Kan Majorstuen Tannlegesenter AS bli med i Dentum-piloten?"
        )

        let body = app.textViews["outreach.body"]
        XCTAssertTrue(body.waitForExistence(timeout: 5))
        let pilotText = body.value as? String ?? ""
        XCTAssertTrue(pilotText.contains("Hei Anne,"))
        XCTAssertTrue(pilotText.contains("pasienter i Oslo"))
        XCTAssertTrue(pilotText.contains("Majorstuen Tannlegesenter AS"))
        XCTAssertTrue(pilotText.contains("Daniel Qazi"))
        XCTAssertFalse(pilotText.contains("{{"))

        let profileTemplate = app.buttons["outreach.template.dentum-profile"]
        XCTAssertTrue(profileTemplate.waitForExistence(timeout: 5))
        profileTemplate.tap()
        XCTAssertEqual(
            subject.value as? String,
            "Vi setter opp Dentum-profilen for Majorstuen Tannlegesenter AS"
        )
        XCTAssertTrue((body.value as? String ?? "").contains("før publisering"))

        snap(app, "dentum-lead-personalisert-epost")
        app.terminate()
    }

    func testDentumNamedPersonEmailIsBlockedBeforeMailOpens() throws {
        let app = launchApp(
            tab: 0,
            environment: [
                "QA_TOUR": "dentum-outreach",
                "QA_DEMO": "1",
                "QA_OUTREACH_COMPLIANCE": "named-person",
            ]
        )
        let showSidebar = app.buttons["Show Sidebar"].firstMatch
        if showSidebar.exists && showSidebar.isHittable { showSidebar.tap() }
        let leadsTab = app.buttons["Leads"].firstMatch
        XCTAssertTrue(leadsTab.waitForExistence(timeout: 5))
        leadsTab.tap()
        let clinicRow = app.buttons[
            "lead.row.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        ]
        XCTAssertTrue(clinicRow.waitForExistence(timeout: 8))
        clinicRow.tap()
        let openOutreach = app.buttons["lead.outreach.open"].firstMatch
        XCTAssertTrue(openOutreach.waitForExistence(timeout: 5))
        openOutreach.tap()

        XCTAssertTrue(app.navigationBars["Klar e-post"].waitForExistence(timeout: 5))
        XCTAssertEqual(
            app.staticTexts["outreach.compliance.status"].label,
            "Personadresse – samtykke mangler"
        )
        let openMail = app.buttons["outreach.open-mail"]
        XCTAssertTrue(openMail.exists)
        XCTAssertFalse(openMail.isEnabled)
        snap(app, "dentum-personadresse-blokkert")
        app.terminate()
    }

    /// The selected Dentum lead must keep its own activity, notes and files.
    /// These detail tabs previously reused the generic Nordic Elektro/Lars
    /// showcase even though the project pill correctly said Dentum.
    func testDentumLeadDetailTabsDoNotLeakGenericDemoData() throws {
        guard UIDevice.current.userInterfaceIdiom != .phone else {
            throw XCTSkip("The persistent detail sidebar is an iPad workflow.")
        }

        let app = launchApp(
            tab: 2,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let clinicRow = app.buttons[
            "lead.row.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        ]
        XCTAssertTrue(clinicRow.waitForExistence(timeout: 10))
        clinicRow.tap()

        let forbidden = [
            "Lars Kristiansen", "Lars Kristensen", "Lars K.",
            "Nordic Elektro", "Anders Johansen", "Jonas Eide",
            "Telefonmøte med Jonas Eide", "420 000 kr",
        ]
        func assertClean(_ context: String) {
            for value in forbidden {
                let leaked = app.descendants(matching: .any).matching(
                    NSPredicate(format: "label CONTAINS[c] %@", value)
                ).firstMatch
                XCTAssertFalse(leaked.exists, "\(context) lekket \(value)")
            }
        }

        assertClean("Dentum-detaljer")

        let activity = app.buttons["Aktivitet"].firstMatch
        XCTAssertTrue(activity.waitForExistence(timeout: 4))
        activity.tap()
        XCTAssertTrue(app.staticTexts["Lead godkjent i Discovery"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Daniel Qazi · Dentum-prosjektet"].exists)
        assertClean("Dentum-aktivitet")

        let notes = app.buttons["Notater"].firstMatch
        XCTAssertTrue(notes.isHittable)
        notes.tap()
        XCTAssertTrue(app.staticTexts["Daniel Qazi"].firstMatch.waitForExistence(timeout: 3))
        assertClean("Dentum-notater")

        let files = app.buttons["Filer"].firstMatch
        XCTAssertTrue(files.isHittable)
        files.tap()
        XCTAssertTrue(app.staticTexts["0 filer"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Ingen filer lastet opp enda"].exists)
        assertClean("Dentum-filer")
        snap(app, "dentum-leaddetalj-uten-demo-lekkasje")
        app.terminate()
    }

    func testDentumMeetingBriefUsesDentalContextOnly() throws {
        let app = launchApp(
            tab: 3,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let meeting = app.buttons.matching(
            NSPredicate(
                format: "label CONTAINS[c] %@",
                "Majorstuen Tannlegesenter AS"
            )
        ).firstMatch
        XCTAssertTrue(meeting.waitForExistence(timeout: 10))
        meeting.tap()

        let brief = app.buttons["Møtebrief"].firstMatch
        XCTAssertTrue(brief.waitForExistence(timeout: 5))
        brief.tap()
        XCTAssertTrue(app.navigationBars["Møtebrief"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] %@", "tannklinikk i Oslo")
            ).firstMatch.exists
        )

        for forbidden in [
            "elektro-entreprenør", "elektrisk installasjonsarbeid",
            "Byggmester Hansen", "Nordic Elektro", "Lars Kristensen",
        ] {
            let leaked = app.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", forbidden)
            ).firstMatch
            XCTAssertFalse(leaked.exists, "Dentum-møtebrief lekket \(forbidden)")
        }
        snap(app, "dentum-motebrief-uten-elektro-demo")
        app.terminate()
    }

    /// Drilldowns used to ignore the active project and reintroduce the
    /// generic 1,248-lead sales showcase behind otherwise clean KPI cards.
    func testDentumDeepKPIDrilldownsUseOnlyProjectData() throws {
        let forbidden = [
            "1 248", "350 000", "Nordic Elektro", "Byggmester Hansen",
            "Lars Kristensen", "Kari Nordmann", "Maria Lindholm", "Espen Bråten",
        ]

        func assertClean(_ app: XCUIApplication, _ context: String) {
            for value in forbidden {
                let leaked = app.descendants(matching: .any).matching(
                    NSPredicate(format: "label CONTAINS[c] %@", value)
                ).firstMatch
                XCTAssertFalse(leaked.exists, "\(context) lekket \(value)")
            }
        }

        let leads = launchApp(
            tab: 2,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let leadStats = button(in: leads, containing: "Statistikk")
        XCTAssertTrue(leadStats.waitForExistence(timeout: 5))
        leadStats.tap()
        let totalLeadKPI = button(in: leads, containing: "Totalt leads")
        XCTAssertTrue(totalLeadKPI.waitForExistence(timeout: 5))
        totalLeadKPI.tap()
        XCTAssertTrue(leads.navigationBars["Totalt leads"].waitForExistence(timeout: 5))
        XCTAssertTrue(leads.staticTexts["Ingen leadhistorikk ennå"].exists)
        XCTAssertTrue(leads.staticTexts["Majorstuen Tannlegesenter AS"].firstMatch.exists)
        assertClean(leads, "Leads-KPI")
        snap(leads, "dentum-leads-kpi-prosjektisolert")
        leads.terminate()

        let team = launchApp(
            tab: 4,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let teamStats = button(in: team, containing: "Statistikk")
        XCTAssertTrue(teamStats.waitForExistence(timeout: 5))
        teamStats.tap()
        let teamLeadKPI = button(in: team, containing: "Totalt leads")
        XCTAssertTrue(teamLeadKPI.waitForExistence(timeout: 5))
        teamLeadKPI.tap()
        XCTAssertTrue(team.navigationBars["Totalt leads"].waitForExistence(timeout: 5))
        XCTAssertTrue(team.staticTexts["Ingen aktivitetshistorikk ennå"].exists)
        XCTAssertTrue(team.staticTexts["Daniel Qazi"].firstMatch.exists)
        assertClean(team, "Team-KPI")
        snap(team, "dentum-team-kpi-prosjektisolert")
        team.terminate()

        let leadbook = launchApp(
            tab: 5,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let leadbookStats = button(in: leadbook, containing: "Statistikk")
        XCTAssertTrue(leadbookStats.waitForExistence(timeout: 5))
        leadbookStats.tap()
        let templatesKPI = button(in: leadbook, containing: "Aktive maler")
        XCTAssertTrue(templatesKPI.waitForExistence(timeout: 5))
        templatesKPI.tap()
        XCTAssertTrue(leadbook.navigationBars["Aktive maler"].waitForExistence(timeout: 5))
        XCTAssertTrue(leadbook.staticTexts["Ingen brukshistorikk ennå"].exists)
        assertClean(leadbook, "Leadbook-KPI")
        snap(leadbook, "dentum-leadbook-kpi-prosjektisolert")
        leadbook.terminate()
    }

    func testDentumMeetingPlannerAndAftercareStayDental() throws {
        let planner = launchApp(
            tab: 1,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let plannerPin = planner.buttons[
            "kart.lead.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        ]
        XCTAssertTrue(plannerPin.waitForExistence(timeout: 8))
        plannerPin.tap()
        let planMeeting = button(in: planner, containing: "Planlegg møte")
        XCTAssertTrue(planMeeting.waitForExistence(timeout: 8))
        planMeeting.tap()
        XCTAssertTrue(planner.navigationBars["Planlegg møte"].waitForExistence(timeout: 5))
        XCTAssertTrue(planner.staticTexts["Anne Lunde"].waitForExistence(timeout: 3))
        XCTAssertFalse(planner.staticTexts["Anders Johansen"].exists)
        snap(planner, "dentum-moteplanlegger-riktig-kontakt")
        planner.terminate()

        let aftercare = launchApp(
            tab: 3,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let meeting = aftercare.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Majorstuen Tannlegesenter AS")
        ).firstMatch
        XCTAssertTrue(meeting.waitForExistence(timeout: 8))
        meeting.tap()
        let more = aftercare.buttons["meeting-detail-more"].firstMatch
        XCTAssertTrue(more.waitForExistence(timeout: 5))
        more.tap()

        let addToCampaign = aftercare.buttons["Legg til i kampanje (demo)"].firstMatch
        XCTAssertTrue(addToCampaign.waitForExistence(timeout: 4))
        addToCampaign.tap()
        XCTAssertTrue(aftercare.navigationBars["Legg til i kampanje"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            aftercare.staticTexts["Dentum-pilot · Tannklinikker i Oslo"]
                .waitForExistence(timeout: 4)
        )
        for value in ["elektroentreprenører", "ERP-migrering", "AI-modulen", "Bygg-bransjen"] {
            XCTAssertFalse(aftercare.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", value)
            ).firstMatch.exists, "Dentum-kampanjer lekket \(value)")
        }
        snap(aftercare, "dentum-kampanjevelger-prosjektisolert")

        let createCampaign = aftercare.buttons["Opprett ny kampanje"].firstMatch
        XCTAssertTrue(createCampaign.isHittable)
        createCampaign.tap()
        XCTAssertTrue(aftercare.navigationBars["Ny kampanje"].waitForExistence(timeout: 5))
        XCTAssertTrue(
            aftercare.staticTexts["Dentum-pilot · klinikkprofil"]
                .waitForExistence(timeout: 4)
        )
        XCTAssertTrue(aftercare.staticTexts["Klinikkoppfølging · 30 dager"].exists)
        XCTAssertFalse(aftercare.staticTexts["Produkt-lansering (90 dgr)"].exists)
        XCTAssertFalse(aftercare.staticTexts["F.eks. Q3 ERP-løft"].exists)
        snap(aftercare, "dentum-ny-kampanje-riktig-maler")
        aftercare.buttons["Avbryt"].firstMatch.tap()
        XCTAssertTrue(aftercare.navigationBars["Legg til i kampanje"].waitForExistence(timeout: 4))
        aftercare.buttons["Avbryt"].firstMatch.tap()

        XCTAssertTrue(more.waitForExistence(timeout: 4))
        more.tap()
        let afterMeeting = aftercare.buttons["Etter møtet — logg & oppfølging"].firstMatch
        XCTAssertTrue(afterMeeting.waitForExistence(timeout: 4))
        afterMeeting.tap()
        let analyze = aftercare.buttons["Analyser møtet"].firstMatch
        XCTAssertTrue(analyze.waitForExistence(timeout: 5))
        analyze.tap()
        XCTAssertTrue(aftercare.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "klinikkprofilen")
        ).firstMatch.waitForExistence(timeout: 5))
        for value in ["el-leveransene", "rammeavtale", "Byggmester Hansen", "teknisk sjef"] {
            XCTAssertFalse(aftercare.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", value)
            ).firstMatch.exists, "Møteetterarbeidet lekket \(value)")
        }
        snap(aftercare, "dentum-moteetterarbeid-riktig-kontekst")
        aftercare.terminate()
    }

    /// The expanded map card used to reintroduce an electrician profile even
    /// when its selected lead and surrounding map correctly belonged to Dentum.
    func testDentumExpandedMapLeadUsesDentalMetadata() throws {
        let app = launchApp(
            tab: 1,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let clinicPin = app.buttons[
            "kart.lead.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        ]
        XCTAssertTrue(clinicPin.waitForExistence(timeout: 8))
        clinicPin.tap()
        let openLead = button(in: app, containing: "Åpne lead")
        XCTAssertTrue(openLead.waitForExistence(timeout: 8))
        openLead.tap()

        XCTAssertTrue(
            app.staticTexts["Majorstuen Tannlegesenter AS"]
                .firstMatch.waitForExistence(timeout: 5)
        )
        XCTAssertTrue(app.staticTexts["Tannhelse"].firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Anne Lunde"].firstMatch.exists)
        for value in [
            "Elektro", "nordicelektro.no", "Anders Johansen",
            "Kari Olsen", "Lars Kristensen", "25-50 ansatte", "10-20 mill.",
        ] {
            let leaked = app.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", value)
            ).firstMatch
            XCTAssertFalse(leaked.exists, "Utvidet Dentum-lead lekket \(value)")
        }
        snap(app, "dentum-kart-leaddetalj-riktig-metadata")
        app.terminate()
    }

    func testDentumDeepLeadbookInsightsAndEquipmentAreEmpty() throws {
        let leadbook = launchApp(
            tab: 5,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let insights = leadbook.buttons["leadbook-subtab-Innsikt"].firstMatch
        XCTAssertTrue(insights.waitForExistence(timeout: 5))
        insights.tap()
        XCTAssertTrue(leadbook.staticTexts["Ingen innsikt enda"].waitForExistence(timeout: 5))
        XCTAssertFalse(leadbook.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Maria")
        ).firstMatch.exists)
        snap(leadbook, "dentum-innsikt-aerlig-tomtilstand")
        leadbook.terminate()

        let team = launchApp(
            tab: 4,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let newMenu = team.buttons["Ny"].firstMatch
        XCTAssertTrue(newMenu.waitForExistence(timeout: 5))
        newMenu.tap()
        let equipment = team.buttons["Utstyr"].firstMatch
        XCTAssertTrue(equipment.waitForExistence(timeout: 4))
        equipment.tap()
        XCTAssertTrue(team.navigationBars["Utstyrsregister"].waitForExistence(timeout: 5))
        XCTAssertTrue(team.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Ingen utstyr registrert")
        ).firstMatch.exists)
        for value in ["Kari Nordmann", "Ola Magnussen", "Henrik"] {
            XCTAssertFalse(team.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[c] %@", value)
            ).firstMatch.exists, "Utstyrsregisteret lekket \(value)")
        }
        snap(team, "dentum-utstyr-aerlig-tomtilstand")
        team.terminate()
    }

    /// Offline QA and showcase fixtures used to share one broad `isDemo`
    /// switch. This verifies that the deeper Academy and Examples sections do
    /// not revive the fictional Leadgrid cast in the Dentum project.
    func testDentumLeadbookDeepSectionsDoNotLeakGenericPeople() throws {
        let app = launchApp(
            tab: 5,
            environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
        )
        let forbiddenPattern =
            ".*(Lars Kristiansen|Lars Kristensen|Marit Hansen|" +
            "Maria Lindholm|Espen Bråten|Kari Nordmann).*"

        func assertNoGenericPeople(_ section: String) {
            let leaked = app.descendants(matching: .any).matching(
                NSPredicate(format: "label MATCHES[c] %@", forbiddenPattern)
            ).firstMatch
            XCTAssertFalse(leaked.exists, "Dentum \(section) lekket \(leaked.label)")
        }

        let academy = app.buttons["leadbook-subtab-Akademi"].firstMatch
        XCTAssertTrue(academy.waitForExistence(timeout: 8))
        academy.tap()
        XCTAssertTrue(
            app.staticTexts["Ingen publiserte Leadgrid-kurs er tilgjengelige."]
                .waitForExistence(timeout: 5)
        )
        assertNoGenericPeople("Akademi")

        let examples = app.buttons["leadbook-subtab-Eksempler"].firstMatch
        XCTAssertTrue(examples.waitForExistence(timeout: 5))
        examples.tap()
        XCTAssertTrue(
            app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] %@", "0 eksempler")
            ).firstMatch.waitForExistence(timeout: 5)
        )
        assertNoGenericPeople("Eksempler")
        snap(app, "dentum-leadbook-dyp-uten-demo-personer")
        app.terminate()
    }

    /// Dentum must remain the visible and authoritative customer project on
    /// every iPad surface. Besides the project switcher, this catches stale
    /// global demo fixtures that previously made hotels, restaurants and
    /// electrician companies appear while Dentum was selected.
    func testDentumProjectCoversEveryIPadSurface() throws {
        guard UIDevice.current.userInterfaceIdiom != .phone else {
            throw XCTSkip("The complete 13-surface sweep belongs to the iPad sidebar.")
        }

        let surfaces: [(index: Int, name: String)] = [
            (0, "oversikt"), (1, "kart"), (2, "leads"), (3, "moter"),
            (4, "team"), (5, "leadbook"), (6, "salgsledelse"),
            (7, "leadgrid-go"), (8, "kvalitet"), (9, "anbud"),
            (10, "canvas"), (11, "verktoy"), (12, "agent"),
        ]
        let unrelatedCustomerFixtures = [
            "Holy Crust", "Holmenkollen Hotell", "Nordic Elektro",
            "Byggmester Hansen", "Frogner Utvikling", "TechSolutions",
            "Lørenskog kommune", "Lars Kristiansen", "Lars Kristensen",
            "Lars Erik Moen", "Lars K.", "lars@leadgrid.no",
        ]
        let unrelatedPeoplePattern =
            ".*(Lars Kristiansen|Lars Kristensen|Lars Erik Moen|Lars K\\.|" +
            "Mikkel Berg|Anniken Sørli|Marit Hansen|Maria Lindholm|" +
            "Espen Bråten|Kari Nilsen|Sofie Vik|Anne Berg|Marit Olsen|" +
            "Espen Haug|Kari Nordmann).*"

        func assertNoUnrelatedPeople(in app: XCUIApplication, surface: String) {
            let leaked = app.descendants(matching: .any).matching(
                NSPredicate(format: "label MATCHES[c] %@", unrelatedPeoplePattern)
            ).firstMatch
            XCTAssertFalse(
                leaked.exists,
                "\(surface) lekket persondata fra generisk demo: \(leaked.label)"
            )
        }

        for surface in surfaces {
            let app = launchApp(
                tab: surface.index,
                environment: ["QA_TOUR": "dentum-outreach", "QA_DEMO": "1"]
            )

            let projectPill = app.buttons["header-project-pill"].firstMatch
            XCTAssertTrue(
                projectPill.waitForExistence(timeout: 8),
                "\(surface.name) skal alltid vise aktiv prosjektkontekst"
            )
            XCTAssertTrue(
                projectPill.label.localizedCaseInsensitiveContains("Dentum"),
                "\(surface.name) skal vise Dentum som aktivt prosjekt, fikk: \(projectPill.label)"
            )

            for name in unrelatedCustomerFixtures {
                let leaked = app.descendants(matching: .any).matching(
                    NSPredicate(format: "label CONTAINS[c] %@", name)
                ).firstMatch
                XCTAssertFalse(
                    leaked.exists,
                    "\(surface.name) lekket generisk kundedata: \(name)"
                )
            }
            assertNoUnrelatedPeople(in: app, surface: surface.name)

            switch surface.name {
            case "oversikt", "leads", "moter":
                XCTAssertTrue(
                    app.descendants(matching: .any).matching(
                        NSPredicate(
                            format: "label CONTAINS[c] %@",
                            "Majorstuen Tannlegesenter AS"
                        )
                    ).firstMatch.waitForExistence(timeout: 4),
                    "\(surface.name) skal bruke den godkjente Dentum-klinikken"
                )
            case "team", "salgsledelse":
                XCTAssertTrue(
                    app.staticTexts["Daniel Qazi"].firstMatch.waitForExistence(timeout: 4),
                    "\(surface.name) skal bruke Dentum-teamet"
                )
            case "anbud":
                XCTAssertTrue(
                    app.descendants(matching: .any)["anbud-project-empty"]
                        .waitForExistence(timeout: 4),
                    "Anbud skal ikke hente brede, irrelevante treff for Dentum"
                )
            case "canvas":
                XCTAssertTrue(
                    app.staticTexts["Majorstuen Tannlegesenter AS"]
                        .firstMatch.waitForExistence(timeout: 4),
                    "Canvas skal gruppere Dentum-notatet under riktig klinikk"
                )
            case "leadgrid-go":
                XCTAssertTrue(
                    app.staticTexts["Ingen kjøring registrert for Dentum"]
                        .firstMatch.waitForExistence(timeout: 4),
                    "Leadgrid Go skal vise en sann Dentum-tomtilstand"
                )
            case "kvalitet":
                XCTAssertTrue(
                    app.staticTexts["Ingen salg i køen. Vunnede salg dukker opp her automatisk."]
                        .firstMatch.waitForExistence(timeout: 4),
                    "Kvalitet skal ikke dikte opp vunnet-salg for Dentum"
                )
            case "verktoy":
                XCTAssertTrue(
                    app.staticTexts["Vunnet / Tapt – ingen resultater ennå"]
                        .firstMatch.waitForExistence(timeout: 4),
                    "Verktøy skal beholde Dentum-kontekst også uten API i QA"
                )
            case "agent":
                XCTAssertTrue(
                    app.staticTexts["Samtykke før Agenten brukes"]
                        .firstMatch.waitForExistence(timeout: 4),
                    "Agenten skal vise samtykkeporten i Dentum-prosjektet"
                )
            case "leadbook":
                XCTAssertTrue(
                    app.descendants(matching: .any).matching(
                        NSPredicate(
                            format: "label CONTAINS[c] %@",
                            "Dentum – første kontakt med tannklinikk"
                        )
                    ).firstMatch.waitForExistence(timeout: 4),
                    "Leadbook/Pondus skal åpne med Dentum-spesifikk kontaktmal"
                )
            default:
                break
            }

            if ["oversikt", "leads", "moter", "team", "leadbook", "salgsledelse"]
                .contains(surface.name) {
                for depth in 1...4 {
                    app.swipeUp()
                    assertNoUnrelatedPeople(
                        in: app,
                        surface: "\(surface.name), scroll \(depth)"
                    )
                }
            }

            snap(app, "dentum-fane-\(surface.index)-\(surface.name)")
            app.terminate()
        }
    }

    func testSuperAdminRoleRoomOnboardingCoversAllCustomerTypes() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "domain-onboarding"
        app.launchEnvironment["QA_TAB"] = "0"
        app.launch()

        XCTAssertTrue(app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 12))
        let domain = app.textFields["project-onboarding.domain"]
        XCTAssertTrue(domain.waitForExistence(timeout: 3))
        domain.tap()
        domain.typeText("theroleroom.com")
        dismissKeyboard(in: app)
        app.buttons["project-onboarding.analyze"].tap()

        let category = app.descendants(matching: .any)["project-onboarding.category"]
        XCTAssertTrue(category.waitForExistence(timeout: 5))
        XCTAssertTrue(displayedText(of: category).contains("Film, TV, casting og talent"))
        let projectName = app.descendants(matching: .any)["project-onboarding.project-name"]
        XCTAssertTrue(projectName.waitForExistence(timeout: 3))
        XCTAssertTrue(displayedText(of: projectName).contains("The Role Room"))

        let expectedProfiles = [
            "Film- og TV-produksjon – Norge",
            "Reklame- og innholdsbyråer – Norge",
            "Casting- og talentmiljøer – Norge",
            "Film- og medieutdanning – Norge",
            "Dansestudioer og danseskoler – Norge",
            "Skuespillere og talenter – Norge",
        ]
        for (profileIndex, profileName) in expectedProfiles.enumerated() {
            let profileTitle = app.staticTexts[
                "project-onboarding.profile.\(profileIndex).title"
            ]
            for _ in 0..<12 where !profileTitle.exists {
                app.swipeUp()
            }
            XCTAssertTrue(profileTitle.exists, "Mangler Discovery-profilen \(profileName)")
            XCTAssertEqual(profileTitle.label, profileName)
        }

        let commit = app.buttons["project-onboarding.commit"]
        for _ in 0..<12 where !commit.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(commit.isHittable)
        commit.tap()

        let accessReady = app.staticTexts["project-onboarding.access-ready"]
            .waitForExistence(timeout: 3)
        let discoveryOpened = app.buttons["discovery.close"].waitForExistence(timeout: 8)
        XCTAssertTrue(
            accessReady || discoveryOpened,
            "Verifisert tilgang skal bekreftes eller gå direkte til Discovery"
        )
        XCTAssertTrue(
            discoveryOpened,
            "The Role Room-prosjektet skal åpnes direkte i Discovery"
        )
        app.terminate()
    }

    func testSuperAdminTidumOnboardingCreatesFourNationalProfilesAndOpensDiscovery() throws {
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "domain-onboarding"
        app.launchEnvironment["QA_TAB"] = "0"
        app.launch()

        XCTAssertTrue(app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 12))
        let domain = app.textFields["project-onboarding.domain"]
        XCTAssertTrue(domain.waitForExistence(timeout: 3))
        domain.tap()
        domain.typeText("tidum.no")
        dismissKeyboard(in: app)
        app.buttons["project-onboarding.analyze"].tap()

        let category = app.descendants(matching: .any)["project-onboarding.category"]
        XCTAssertTrue(category.waitForExistence(timeout: 5))
        XCTAssertTrue(displayedText(of: category).contains("Arbeidstid, omsorg og miljøarbeid"))
        let projectName = app.descendants(matching: .any)["project-onboarding.project-name"]
        XCTAssertTrue(projectName.waitForExistence(timeout: 3))
        XCTAssertTrue(displayedText(of: projectName).contains("Tidum"))

        let expectedProfiles = [
            "Barnevern og avlastning – Norge",
            "Bofellesskap og miljøarbeid – Norge",
            "BPA og feltbasert omsorg – Norge",
            "Kommunale omsorgstjenester – Norge",
        ]
        for (profileIndex, profileName) in expectedProfiles.enumerated() {
            let profileTitle = app.staticTexts[
                "project-onboarding.profile.\(profileIndex).title"
            ]
            for _ in 0..<12 where !profileTitle.exists {
                app.swipeUp()
            }
            XCTAssertTrue(profileTitle.exists, "Mangler Discovery-profilen \(profileName)")
            XCTAssertEqual(profileTitle.label, profileName)
        }

        XCTAssertTrue(app.staticTexts["Finn duplikater"].exists)
        XCTAssertTrue(app.staticTexts["Sjekk datakvalitet"].exists)
        let commit = app.buttons["project-onboarding.commit"]
        for _ in 0..<12 where !commit.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(commit.isHittable)
        commit.tap()

        XCTAssertTrue(
            app.buttons["discovery.close"].waitForExistence(timeout: 8),
            "Et bekreftet Tidum-prosjekt skal åpnes direkte i Discovery"
        )
        let customerType = app.textFields["discovery.simple.customer-type"]
        XCTAssertTrue(customerType.waitForExistence(timeout: 5))
        XCTAssertTrue((customerType.value as? String)?.contains("87.104") == true)
        let customerNext = app.buttons["discovery.simple.next.customer-type"]
        for _ in 0..<4 where !customerNext.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(customerNext.isHittable)
        customerNext.tap()
        let nationwide = app.buttons["discovery.simple.area.nationwide"]
        XCTAssertTrue(nationwide.waitForExistence(timeout: 5))
        XCTAssertTrue(nationwide.isSelected)
        app.terminate()
    }

    func testDiscoverySimpleModeUsesThreeClearStepsAndKeepsAdvancedMode() throws {
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "domain-onboarding"
        app.launchEnvironment["QA_TAB"] = "0"
        app.launch()

        XCTAssertTrue(app.navigationBars["Nytt kundeprosjekt"].waitForExistence(timeout: 12))
        let domain = app.textFields["project-onboarding.domain"]
        XCTAssertTrue(domain.waitForExistence(timeout: 3))
        domain.tap()
        domain.typeText("dentum.no")
        dismissKeyboard(in: app)
        app.buttons["project-onboarding.analyze"].tap()

        let addProfile = app.buttons["project-onboarding.profile.add"]
        for _ in 0..<12 where !addProfile.exists { app.swipeUp() }
        XCTAssertTrue(addProfile.exists)
        addProfile.tap()

        let commit = app.buttons["project-onboarding.commit"]
        for _ in 0..<14 where !commit.isHittable { app.swipeUp() }
        XCTAssertTrue(commit.isHittable)
        commit.tap()
        XCTAssertTrue(app.buttons["discovery.close"].waitForExistence(timeout: 8))

        let simpleMode = app.buttons["discovery.brief.mode.simple"]
        let advancedMode = app.buttons["discovery.brief.mode.advanced"]
        XCTAssertTrue(simpleMode.waitForExistence(timeout: 5))
        XCTAssertTrue(advancedMode.exists)
        XCTAssertTrue(app.textFields["discovery.simple.customer-type"].exists)
        XCTAssertFalse(app.textViews["discovery.brief.queries"].exists)

        advancedMode.tap()
        XCTAssertTrue(app.textViews["discovery.brief.queries"].waitForExistence(timeout: 3))
        snap(app, "discovery-avansert")
        simpleMode.tap()

        let customerType = app.textFields["discovery.simple.customer-type"]
        let customerNext = app.buttons["discovery.simple.next.customer-type"]
        XCTAssertTrue(customerNext.waitForExistence(timeout: 3))
        XCTAssertTrue(customerNext.isEnabled, "Den bekreftede standardprofilen skal fylle kundetype automatisk")
        XCTAssertTrue((customerType.value as? String)?.localizedCaseInsensitiveContains("tann") == true)
        snap(app, "discovery-enkel-steg-1")
        for _ in 0..<4 where !customerNext.isHittable { app.swipeUp() }
        customerNext.tap()

        let nationwide = app.buttons["discovery.simple.area.nationwide"]
        XCTAssertTrue(nationwide.waitForExistence(timeout: 3))
        snap(app, "discovery-enkel-steg-2")
        let areaNext = app.buttons.containing(
            NSPredicate(format: "label CONTAINS[c] %@", "velg antall")
        ).firstMatch
        XCTAssertTrue(areaNext.waitForExistence(timeout: 3))
        for _ in 0..<4 where !areaNext.isHittable { app.swipeUp() }
        areaNext.tap()

        let thirty = app.buttons["discovery.simple.amount.30"]
        XCTAssertTrue(thirty.waitForExistence(timeout: 3))
        for _ in 0..<4 where !thirty.isHittable { app.swipeUp() }
        thirty.tap()
        let summary = app.descendants(matching: .any)["discovery.simple.summary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 3))
        XCTAssertTrue(summary.label.contains("Oslo"), "Byvalget fra Dentum-profilen skal beholdes i oppsummeringen")
        XCTAssertFalse(summary.label.localizedCaseInsensitiveContains("hele Norge"))

        let backToArea = app.buttons["discovery.simple.back"]
        XCTAssertTrue(backToArea.exists)
        backToArea.tap()
        XCTAssertTrue(nationwide.waitForExistence(timeout: 3))
        for _ in 0..<4 where !nationwide.isHittable { app.swipeUp() }
        nationwide.tap()
        for _ in 0..<4 where !areaNext.isHittable { app.swipeUp() }
        areaNext.tap()
        XCTAssertTrue(thirty.waitForExistence(timeout: 3))
        thirty.tap()
        XCTAssertTrue(summary.waitForExistence(timeout: 3))
        XCTAssertTrue(summary.label.contains("30"))
        XCTAssertTrue(summary.label.contains("leads") || summary.label.contains("Leads"))
        XCTAssertFalse(summary.label.contains("Leadbook"))
        XCTAssertTrue(summary.label.localizedCaseInsensitiveContains("hele Norge"))
        XCTAssertTrue(app.buttons["discovery.simple.preview"].isEnabled)
        snap(app, "discovery-enkel-klar")
        app.terminate()
    }

    func testLeadgridAgentProposalRequiresConfirmationBeforeExecution() throws {
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
        let app = XCUIApplication()
        app.launchEnvironment["QA_TOUR"] = "agent-skills"
        app.launchEnvironment["QA_DEMO"] = "1"
        app.launchEnvironment["QA_TAB"] = "12"
        app.launch()

        let proposal = app.buttons["agent-skill-leadgrid_data_quality"]
        for _ in 0..<8 where !proposal.exists || !proposal.isHittable {
            app.scrollViews.firstMatch.swipeUp()
        }
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
              let projectID = environment["LEADGRID_STAGING_PROJECT_ID"],
              !stagingURL.isEmpty, !token.isEmpty,
              !organizationID.isEmpty, !projectID.isEmpty
        else {
            throw XCTSkip(
                "Krever staging-URL, bearer-token, org-ID og prosjekt-ID"
            )
        }
        guard let baseURL = URL(string: stagingURL),
              baseURL.scheme == "https",
              baseURL.host != "creatorhub-backend-rtbl.onrender.com"
        else {
            XCTFail("Staging-E2E nekter ugyldig eller produksjons-URL")
            return
        }

        let runID = UUID()
        let uniqueName = "[E2E] iPad reconnect \(runID.uuidString.prefix(8))"
        let coordinateBytes = runID.uuid
        let latitude = 58.8 + Double(coordinateBytes.0) * 0.005
        let longitude = 9.7 + Double(coordinateBytes.1) * 0.005
        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] = token
        app.launchEnvironment["LEADGRID_API_BASE_URL"] = stagingURL
        app.launchEnvironment["QA_NETWORK_CONTROLS"] = "1"
        app.launchEnvironment["QA_RESET_OFFLINE_QUEUE"] = "1"
        app.launchEnvironment["QA_ORGANIZATION_ID"] = organizationID
        app.launchEnvironment["QA_PROJECT_ID"] = projectID
        app.launchEnvironment["QA_LEAD_LATITUDE"] = String(format: "%.6f", latitude)
        app.launchEnvironment["QA_LEAD_LONGITUDE"] = String(format: "%.6f", longitude)
        app.launchEnvironment["QA_TAB"] = "2"
        app.launch()

        XCTAssertTrue(app.staticTexts["staging-environment-badge"].waitForExistence(timeout: 12))
        let offline = app.buttons["qa-network-offline"]
        XCTAssertTrue(offline.waitForExistence(timeout: 3))
        offline.tap()

        let newLead = app.buttons["lead-new"]
        XCTAssertTrue(newLead.waitForExistence(timeout: 10))
        newLead.tap()

        let name = app.textFields["add-lead.field.bedriftsnavn"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(uniqueName)
        let submit = app.buttons["add-lead.save"]
        XCTAssertTrue(submit.waitForExistence(timeout: 3))
        submit.tap()

        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "lagret offline")
            ).firstMatch.waitForExistence(timeout: 8)
        )
        let syncStatus = app.buttons["global-sync-status"]
        XCTAssertTrue(syncStatus.waitForExistence(timeout: 5))
        XCTAssertTrue(syncStatus.label.localizedCaseInsensitiveContains("lagret lokalt"))

        app.buttons["qa-network-online"].tap()
        let pendingGone = NSPredicate(format: "exists == false")
        let drainExpectation = expectation(
            for: pendingGone,
            evaluatedWith: syncStatus
        )
        await fulfillment(of: [drainExpectation], timeout: 20)

        var components = URLComponents(
            url: baseURL.appendingPathComponent("api/admin-room/lead-map/leads"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "project_id", value: projectID)]
        let scopedLeadsURL = try XCTUnwrap(components?.url)
        var request = URLRequest(url: scopedLeadsURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(organizationID, forHTTPHeaderField: "X-Organization-Id")
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let leads = payload?["leads"] as? [[String: Any]] ?? []
        XCTAssertEqual(leads.filter { ($0["name"] as? String) == uniqueName }.count, 1)
        app.terminate()
    }

    /// Verifiserer den virkelige native kjeden etter at shell-harnessen har
    /// opprettet/gjenbrukt The Role Room via staging-API og PostgreSQL.
    func testStagingRoleRoomProjectOpensAllDiscoveryProfiles() throws {
        let environment = ProcessInfo.processInfo.environment
        guard let stagingURL = environment["LEADGRID_STAGING_BASE_URL"],
              let token = environment["LEADGRID_STAGING_BEARER_TOKEN"],
              let organizationID = environment["LEADGRID_STAGING_ORG_ID"],
              let projectID = environment["LEADGRID_STAGING_ROLE_ROOM_PROJECT_ID"],
              !stagingURL.isEmpty,
              !token.isEmpty,
              !organizationID.isEmpty,
              !projectID.isEmpty
        else {
            throw XCTSkip("Krever verifisert The Role Room staging-prosjekt")
        }
        guard let baseURL = URL(string: stagingURL),
              baseURL.scheme == "https",
              baseURL.host != "creatorhub-backend-rtbl.onrender.com"
        else {
            XCTFail("Role Room-E2E nekter ugyldig eller produksjons-URL")
            return
        }

        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] = token
        app.launchEnvironment["LEADGRID_API_BASE_URL"] = stagingURL
        app.launchEnvironment["QA_ORGANIZATION_ID"] = organizationID
        app.launchEnvironment["QA_PROJECT_ID"] = projectID
        app.launchEnvironment["QA_TAB"] = UIDevice.current.userInterfaceIdiom == .phone ? "12" : "11"
        app.launch()

        XCTAssertTrue(app.staticTexts["staging-environment-badge"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.navigationBars["Verktøy"].waitForExistence(timeout: 15))
        let discovery = app.buttons["Profiler, kandidater og markedsinnsikt"]
        XCTAssertTrue(discovery.waitForExistence(timeout: 10))
        discovery.tap()

        XCTAssertTrue(app.buttons["discovery.close"].waitForExistence(timeout: 12))
        XCTAssertTrue(
            app.staticTexts["The Role Room"].waitForExistence(timeout: 12),
            "Det autoritative staging-prosjektet skal være aktivt i Discovery"
        )
        let profileCount = app.staticTexts["discovery.profile.count"]
        XCTAssertTrue(profileCount.waitForExistence(timeout: 12))
        XCTAssertEqual(profileCount.label, "6 profiler")
        XCTAssertTrue(app.buttons["discovery.campaign.start"].exists)
        app.terminate()
    }

    /// Ekte Pondus-infrastrukturtest: staging-auth, publisert PostgreSQL-mal,
    /// offline-kø, reconnect og serververifisert usage_session_id.
    func testStagingPondusUsageOfflineReconnect() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let stagingURL = environment["LEADGRID_STAGING_BASE_URL"],
              let token = environment["LEADGRID_STAGING_BEARER_TOKEN"],
              let organizationID = environment["LEADGRID_STAGING_ORG_ID"],
              let projectID = environment["LEADGRID_STAGING_PROJECT_ID"],
              !stagingURL.isEmpty, !token.isEmpty,
              !organizationID.isEmpty, !projectID.isEmpty
        else {
            throw XCTSkip("Krever staging-URL, bearer-token, org-ID og prosjekt-ID")
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
        app.launchEnvironment["QA_RESET_OFFLINE_QUEUE"] = "1"
        app.launchEnvironment["QA_ORGANIZATION_ID"] = organizationID
        app.launchEnvironment["QA_PROJECT_ID"] = projectID
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
            projectID: projectID,
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
        let closeCoach = app.buttons["Lukk"].firstMatch
        XCTAssertTrue(closeCoach.waitForExistence(timeout: 5))
        closeCoach.tap()
        XCTAssertFalse(app.staticTexts["pondus-active-coach"].waitForExistence(timeout: 3))
        let syncStatus = app.buttons["global-sync-status"]
        XCTAssertTrue(syncStatus.waitForExistence(timeout: 5))
        XCTAssertTrue(syncStatus.label.localizedCaseInsensitiveContains("lagret lokalt"))
        app.buttons["qa-network-online"].tap()

        let pendingGone = NSPredicate(format: "exists == false")
        let drained = expectation(
            for: pendingGone,
            evaluatedWith: syncStatus
        )
        await fulfillment(of: [drained], timeout: 20)

        let usageAfter = try await pondusUsageCount(
            baseURL: baseURL,
            token: token,
            organizationID: organizationID,
            projectID: projectID,
            templateID: templateID
        )
        XCTAssertEqual(usageAfter, usageBefore + 1, "Reconnect skal persistere nøyaktig én Pondus-økt")
        app.terminate()
    }

    /// Lokal, hemmelighetsfri UI-smoke av den samme produksjonscoachen.
    /// Køkontrakten testes separat; stagingtesten over beviser reconnect.
    func testPondusCoachLocalSmoke() throws {
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
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

    // MARK: - iPad mini: smale detail-kolonner

    func testIPadCompactMeetingsAndPondusLayouts() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else {
            throw XCTSkip("Denne testen verifiserer iPad-layout")
        }

        let meetings = launchApp(
            tab: 3,
            environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
        )
        let compactMeetings = meetings.descendants(matching: .any)["meetings-layout-compact"]
        XCTAssertTrue(compactMeetings.waitForExistence(timeout: 5))
        snap(meetings, "ipad-compact-moter")

        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(2)
        let rotatedMeetingsLayout = meetings.descendants(matching: .any)["meetings-layout-compact"]
        let rotatedMeetingsWideLayout = meetings.descendants(matching: .any)["meetings-layout-inline"]
        XCTAssertTrue(
            rotatedMeetingsLayout.exists || rotatedMeetingsWideLayout.exists,
            "Møter skal velge en gyldig layout etter iPad-rotasjon"
        )
        snap(meetings, "ipad-moter-landskap")
        XCUIDevice.shared.orientation = .portrait
        sleep(2)
        #endif

        let firstMeeting = button(in: meetings, containing: "Nordic Elektro")
        XCTAssertTrue(firstMeeting.waitForExistence(timeout: 5))
        firstMeeting.tap()
        let detailSheet = meetings.descendants(matching: .any)["meeting-detail-sheet"]
        XCTAssertTrue(detailSheet.waitForExistence(timeout: 5))
        snap(meetings, "ipad-compact-motedetalj")
        meetings.terminate()

        let leadbook = launchApp(
            tab: 5,
            environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
        )
        let compactPondus = leadbook.descendants(matching: .any)["pondus-layout-compact"]
        XCTAssertTrue(compactPondus.waitForExistence(timeout: 8))
        XCTAssertTrue(
            leadbook.buttons["header-project-pill"].exists,
            "Pondus/Leadbook skal alltid vise hvilken prosjektkontekst som er aktiv"
        )
        let redigerMode = leadbook.buttons["Rediger"].firstMatch
        XCTAssertTrue(redigerMode.waitForExistence(timeout: 3))
        XCTAssertGreaterThanOrEqual(redigerMode.frame.height, 44)
        XCTAssertLessThanOrEqual(
            redigerMode.frame.height, 56,
            "Rediger skal være én lesbar linje på iPad mini"
        )
        snap(leadbook, "ipad-compact-pondus")

        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(2)
        let rotatedPondusCompact = leadbook.descendants(matching: .any)["pondus-layout-compact"]
        let rotatedPondusWide = leadbook.descendants(matching: .any)["pondus-layout-wide"]
        XCTAssertTrue(
            rotatedPondusCompact.exists || rotatedPondusWide.exists,
            "Pondus skal velge en gyldig layout etter iPad-rotasjon"
        )
        XCTAssertTrue(button(in: leadbook, containing: "Cheat note").isHittable)
        snap(leadbook, "ipad-pondus-landskap")
        XCUIDevice.shared.orientation = .portrait
        #endif
        leadbook.terminate()
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
        app.launchEnvironment["QA_TAB"] = UIDevice.current.userInterfaceIdiom == .phone ? "11" : "10"
        app.launchEnvironment["QA_CAPTURE"] = "1"
        app.launch()

        let note = button(in: app, containing: "Ruteplan")
        XCTAssertTrue(note.waitForExistence(timeout: 12))
        note.tap()

        let panorer = app.buttons["Panorer"]
        if UIDevice.current.userInterfaceIdiom == .phone {
            // iPhone samler de fire modusene i en kompakt meny.
            let modeMenu = app.buttons["canvas-mode-menu"]
            XCTAssertTrue(modeMenu.waitForExistence(timeout: 5))
            modeMenu.tap()
        }
        // iPad har plass til den opprinnelige, direkte modusknappen.
        XCTAssertTrue(panorer.waitForExistence(timeout: 3))
        panorer.tap()
        let fit = app.buttons["Tilpass dokumentbredden"].firstMatch
        XCTAssertTrue(fit.waitForExistence(timeout: 5))
        let toolOptions = app.scrollViews["canvas-tool-options"].firstMatch
        for _ in 0..<3 where !fit.isHittable && toolOptions.exists {
            toolOptions.swipeLeft()
        }
        XCTAssertTrue(fit.isHittable)
        fit.tap()
        snap(app, "canvas-editor-portrett")

        #if !targetEnvironment(macCatalyst)
        let device = XCUIDevice.shared
        device.orientation = .landscapeLeft
        // På iPadOS 26 kan app-vinduet beholde portrettgeometri selv om
        // simulatoren roteres (vindusmodus). Verifiser derfor selve
        // enhetsorienteringen, og test at kontrollene fortsatt er brukbare.
        sleep(2)
        XCTAssertEqual(device.orientation, .landscapeLeft)
        XCTAssertTrue(fit.waitForExistence(timeout: 5))
        XCTAssertTrue(fit.isHittable)
        snap(app, "canvas-editor-etter-rotasjon")
        device.orientation = .portrait
        sleep(1)
        XCTAssertEqual(device.orientation, .portrait)
        #endif
        app.terminate()
    }

    // MARK: - Leadbook: dyp-sveip over under-faner + header-modaler

    /// Leadbook har 6 under-faner + 3 header-CTAer med egne modaler —
    /// hoved-sveipet fanger bare landingssiden (Pondus). Dette sveiper alt.
    func testLeadbookDeepSweep() throws {
        let app = launchApp(tab: UIDevice.current.userInterfaceIdiom == .phone ? 6 : 5)
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

    func testPairingAccessibilityAudit() throws {
        guard #available(iOS 17.0, *) else {
            throw XCTSkip("performAccessibilityAudit krever iOS 17")
        }
        #if !targetEnvironment(macCatalyst)
        XCUIDevice.shared.orientation = .portrait
        #endif
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["Jeg har en pairing-kode"].waitForExistence(timeout: 8))

        let rapport = A11yRapport()
        try app.performAccessibilityAudit { issue in
            let el = issue.element.map { String(describing: $0) } ?? "ukjent element"
            rapport.linjer.append("\(issue.auditType): \(issue.compactDescription) — \(el)")
            return true
        }
        app.terminate()
        XCTAssertTrue(
            rapport.linjer.isEmpty,
            "Innloggingsflaten har tilgjengelighetsfunn:\n\(rapport.linjer.joined(separator: "\n"))"
        )
    }

    func testIPadMeetingsActionableAccessibilityAudit() throws {
        guard #available(iOS 17.0, *), UIDevice.current.userInterfaceIdiom == .pad else {
            throw XCTSkip("Denne auditen krever iPad med iOS 17 eller nyere")
        }
        let app = launchApp(
            tab: 3,
            environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
        )
        let rapport = A11yRapport()
        rapport.linjer.append(contentsOf: undersizedVisibleButtons(in: app).map { "Preflight hit area: \($0)" })
        let actionable: XCUIAccessibilityAuditType = [
            .contrast, .hitRegion, .sufficientElementDescription, .textClipped,
        ]
        try app.performAccessibilityAudit(for: actionable) { issue in
            // iPadOS 26-simulatoren returnerer også kontrast-/klippfunn
            // uten elementreferanse for systemmaterialet rundt split view.
            // Den brede rapport-auditen under beholder disse; denne testen
            // feiler på konkrete Leadgrid-elementer som kan rettes.
            if let element = issue.element {
                rapport.linjer.append(
                    "\(issue.auditType): \(issue.compactDescription) — \(String(describing: element))"
                )
            }
            return true
        }
        app.terminate()
        XCTAssertTrue(
            rapport.linjer.isEmpty,
            "Møter har handlingsbare tilgjengelighetsfunn:\n\(rapport.linjer.joined(separator: "\n"))"
        )
    }

    func testIPadLeadbookActionableAccessibilityAudit() throws {
        guard #available(iOS 17.0, *), UIDevice.current.userInterfaceIdiom == .pad else {
            throw XCTSkip("Denne auditen krever iPad med iOS 17 eller nyere")
        }
        let app = launchApp(
            tab: 5,
            environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
        )
        let rapport = A11yRapport()
        rapport.linjer.append(contentsOf: undersizedVisibleButtons(in: app).map { "Preflight hit area: \($0)" })
        let actionable: XCUIAccessibilityAuditType = [
            .contrast, .hitRegion, .sufficientElementDescription, .textClipped,
        ]
        try app.performAccessibilityAudit(for: actionable) { issue in
            if let element = issue.element {
                rapport.linjer.append(
                    "\(issue.auditType): \(issue.compactDescription) — \(String(describing: element))"
                )
            }
            return true
        }
        app.terminate()
        XCTAssertTrue(
            rapport.linjer.isEmpty,
            "Leadbook har handlingsbare tilgjengelighetsfunn:\n\(rapport.linjer.joined(separator: "\n"))"
        )
    }

    func testAccessibilityAudit() throws {
        guard #available(iOS 17.0, *) else {
            throw XCTSkip("performAccessibilityAudit krever iOS 17")
        }
        let rapport = A11yRapport()
        for (idx, navn) in [(0, "oversikt"), (2, "leads"), (3, "moter")] {
            let app = launchApp(
                tab: idx,
                environment: ["QA_TOUR": "profile", "QA_DEMO": "1"]
            )
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
