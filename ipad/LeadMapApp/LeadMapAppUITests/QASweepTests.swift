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
                let newMapLead = app.buttons["kart.drop-pin"]
                XCTAssertTrue(newMapLead.waitForExistence(timeout: 10))
                newMapLead.tap()
            } else {
                let newLead = app.buttons["lead-new"]
                XCTAssertTrue(newLead.waitForExistence(timeout: 10))
                newLead.tap()
            }
            XCTAssertTrue(app.scrollViews["add-lead.form"].waitForExistence(timeout: 5))
            app.terminate()
        }
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
        for _ in 0..<4 where !nationwide.isHittable { app.swipeUp() }
        nationwide.tap()
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
        XCTAssertTrue(summary.label.contains("30"))
        XCTAssertTrue(summary.label.contains("Leadbook"))
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

        let openAgent = app.buttons["leadgrid-agent-open"]
        if !openAgent.waitForExistence(timeout: 5) {
            app.scrollViews.firstMatch.swipeUp()
        }
        XCTAssertTrue(openAgent.waitForExistence(timeout: 5))
        openAgent.tap()

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
