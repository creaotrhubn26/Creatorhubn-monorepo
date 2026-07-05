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

final class QASweepTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    // MARK: - Hjelpere

    private func launchApp(tab: Int) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["QA_BEARER_TOKEN"] =
            ProcessInfo.processInfo.environment["QA_BEARER_TOKEN"] ?? ""
        app.launchEnvironment["QA_TAB"] = "\(tab)"
        app.launch()
        // La bootstrap + refresh lande før snapshot (kald Render kan bruke tid).
        sleep(10)
        return app
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
        let app = launchApp(tab: 6)
        let appW = app.frame.width

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
                app.buttons.containing(
                    NSPredicate(format: "label CONTAINS %@", navn)
                ).allElementsBoundByIndex.first {
                    $0.exists && $0.frame.minX >= 0 && $0.frame.maxX <= appW
                }
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
