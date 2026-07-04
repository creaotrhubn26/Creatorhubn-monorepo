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
